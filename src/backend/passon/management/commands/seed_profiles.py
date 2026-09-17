"""Create the demo profiles: a Drive account each, and their PassOn record.

Edit PROFILES below -- names, addresses, passwords, roles, pictures -- then:

    docker compose exec web python manage.py seed_profiles

Each profile ends up with two things:

  * a user in Drive's Keycloak, so they can log in (PassOn has no accounts of
    its own: `accounts/README.md`), created through the realm's own
    registration form, the same one a person uses at :3000. Drive's realm has
    registrationAllowed=true, and its `admin` account is "not fully set up",
    so registering is both the supported path and the only one that works
    without touching Keycloak by hand;
  * a Collaborator row here, carrying what Drive does not know: the role, the
    job title, the team and who reports to whom.

Re-running is safe. A profile whose Drive account already exists is left
alone -- the password is not reset, since that would lock out whoever is
using it -- and its PassOn row is updated in place.

Pictures are optional. Give `picture` a path (absolute, or relative to the
repository root) and it is stored on the row and served by
`/api/collaborators/<id>/avatar/`; leave it None and the interface falls back
to initials, as it did before.
"""

import mimetypes
import re
from pathlib import Path
from urllib.parse import urljoin

import requests
from django.core.management.base import BaseCommand
from django.conf import settings

from accounts import oidc_login
from passon.models import Collaborator

# --------------------------------------------------------------------------
# The three profiles. Everything you are likely to change lives here.
#
#   role     "manager" or "employee"
#   reports_to  an email from this list, or None. Only employees have one.
#   picture  path to an image, or None
# --------------------------------------------------------------------------
PROFILES = [
    {
        "first_name": "Camille",
        "last_name": "Ferrand",
        "email": "camille.ferrand@collectivite.gouv.example",
        "password": "passon-demo",
        "job_title": "Responsable du service urbanisme",
        "team": "Service urbanisme",
        "role": "manager",
        "reports_to": None,
        "picture": None,
    },
    {
        "first_name": "Bastien",
        "last_name": "Morel",
        "email": "bastien.morel@collectivite.gouv.example",
        "password": "passon-demo",
        "job_title": "Instructeur droit des sols",
        "team": "Service urbanisme",
        "role": "employee",
        "reports_to": "camille.ferrand@collectivite.gouv.example",
        "picture": None,
    },
    {
        "first_name": "Inès",
        "last_name": "Royer",
        "email": "ines.royer@collectivite.gouv.example",
        "password": "passon-demo",
        "job_title": "Chargée des subventions",
        "team": "Service urbanisme",
        "role": "employee",
        "reports_to": "camille.ferrand@collectivite.gouv.example",
        "picture": None,
    },
]

# Keycloak refuses an avatar-sized payload nowhere, but the browser fetches
# this on every page that shows the person, so keep it small.
MAX_PICTURE_BYTES = 512 * 1024


class Command(BaseCommand):
    help = "Create the demo profiles in Drive's Keycloak and in this database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-drive",
            action="store_true",
            help="Only create the PassOn rows (no Keycloak account).",
        )

    def handle(self, *args, **options):
        created = {}
        for profile in PROFILES:
            if not options["skip_drive"]:
                self.ensure_drive_account(profile)
            created[profile["email"]] = self.ensure_collaborator(profile)

        # Second pass: a reporting line can only be set once both rows exist.
        for profile in PROFILES:
            manager_email = profile.get("reports_to")
            if not manager_email:
                continue
            person = created[profile["email"]]
            manager = created.get(manager_email) or Collaborator.objects.filter(
                email=manager_email
            ).first()
            if manager is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"  {profile['email']}: manager {manager_email} not found"
                    )
                )
                continue
            person.manager = manager
            person.save(update_fields=["manager"])
            self.stdout.write(f"  {person.email} reports to {manager.email}")

    # --- Drive ------------------------------------------------------------

    def ensure_drive_account(self, profile):
        """Register the account, unless it can already log in."""
        email, password = profile["email"], profile["password"]
        try:
            credential, _ = oidc_login.login("drive", email, password)
        except oidc_login.LoginFailed:
            credential = None
        if credential:
            self.stdout.write(f"{email}: Drive account already usable")
            return

        try:
            self.register(profile)
        except RuntimeError as error:
            self.stdout.write(self.style.ERROR(f"{email}: {error}"))
            return

        # Registering is not proof of anything until a login succeeds.
        try:
            oidc_login.login("drive", email, password)
        except oidc_login.LoginFailed as error:
            self.stdout.write(
                self.style.WARNING(f"{email}: registered, but login failed ({error.code})")
            )
            return
        self.stdout.write(self.style.SUCCESS(f"{email}: Drive account created"))

    def register(self, profile):
        """Walk Keycloak's registration form, as a browser would.

        The same shape as the login walk in accounts/oidc_login.py: ask Drive
        to authenticate, land on Keycloak's login page, follow its "Register"
        link, then post the form. Every request announces DINUM_PUBLIC_HOST,
        because Keycloak checks the redirect_uri against what it registered.
        """
        session = requests.Session()
        base_url = oidc_login.public_base_url("drive")

        # The same walk as accounts/oidc_login.open_session: Drive redirects
        # to its own Keycloak -- which is where its address comes from, not
        # from our settings -- and the chain has to be followed by hand,
        # rewriting each hop to a host this process can reach while still
        # announcing the public one.
        handoff = oidc_login.service_request(
            session, "drive", "GET", f"{base_url}/api/v1.0/authenticate/"
        )
        keycloak_url = handoff.headers.get("Location")
        if not keycloak_url:
            raise RuntimeError("Drive did not hand off to Keycloak")
        flow_origins = {oidc_login._origin(base_url), oidc_login._origin(keycloak_url)}

        page = oidc_login._follow(
            session, "drive", "GET", keycloak_url, flow_origins
        )
        link = re.search(r'<a[^>]+href="([^"]*registration[^"]*)"', page.text)
        if not link:
            raise RuntimeError(
                "no registration link on Keycloak's login page -- is "
                "registrationAllowed still true for the drive realm?"
            )
        # Keycloak emits this one protocol-relative ("//host/realms/...")
        # once its Host header has been rewritten, so it has to be resolved
        # against the page it came from before it can be fetched.
        registration_url = urljoin(
            page.url, link.group(1).replace("&amp;", "&")
        )

        form = oidc_login._follow(
            session, "drive", "GET", registration_url, flow_origins
        )
        action = re.search(r'<form[^>]+action="([^"]+)"', form.text)
        if not action:
            raise RuntimeError("could not find the registration form")

        answer = oidc_login._follow(
            session,
            "drive",
            "POST",
            urljoin(form.url, action.group(1).replace("&amp;", "&")),
            flow_origins,
            data={
                "firstName": profile["first_name"],
                "lastName": profile["last_name"],
                "email": profile["email"],
                "username": profile["email"],
                "password": profile["password"],
                "password-confirm": profile["password"],
            },
        )
        # Keycloak answers 200 with the form again when it refuses, so the
        # status code says nothing; the error text does.
        problem = re.search(
            r'<span[^>]*class="[^"]*kc-feedback-text[^"]*"[^>]*>([^<]+)', answer.text
        )
        if problem:
            raise RuntimeError(problem.group(1).strip())

    # --- This database ----------------------------------------------------

    def ensure_collaborator(self, profile):
        person, created = Collaborator.objects.update_or_create(
            email=profile["email"],
            defaults={
                "first_name": profile["first_name"],
                "last_name": profile["last_name"],
                "job_title": profile["job_title"],
                "team": profile["team"],
                "role": profile["role"],
            },
        )
        self.stdout.write(
            f"{person.email}: {'created' if created else 'updated'} as {person.role}"
        )
        self.attach_picture(person, profile.get("picture"))
        return person

    def attach_picture(self, person, picture):
        if not picture:
            return
        path = Path(picture)
        if not path.is_absolute():
            # Relative to the repository root, which is two levels above
            # BASE_DIR (src/backend).
            path = Path(settings.BASE_DIR).parent.parent / path
        if not path.is_file():
            self.stdout.write(self.style.WARNING(f"  picture not found: {path}"))
            return

        data = path.read_bytes()
        if len(data) > MAX_PICTURE_BYTES:
            self.stdout.write(
                self.style.WARNING(
                    f"  picture ignored, {len(data) // 1024} KB is over the "
                    f"{MAX_PICTURE_BYTES // 1024} KB limit: {path.name}"
                )
            )
            return

        person.avatar = data
        person.avatar_type = mimetypes.guess_type(path.name)[0] or "image/png"
        person.save(update_fields=["avatar", "avatar_type"])
        self.stdout.write(f"  picture attached: {path.name} ({len(data) // 1024} KB)")
