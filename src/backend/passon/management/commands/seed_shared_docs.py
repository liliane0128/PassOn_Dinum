"""Upload the shared demo documents and share them between the profiles.

    docker compose exec web python manage.py seed_shared_docs

`seed_profiles` creates the people; this gives them something to hand over,
and above all something *shared*. A document that belongs to someone else is
what makes two sections of the handover interesting:

  * contacts clés, which now counts document owners as well as correspondents
    -- so a colleague who shared a dossier shows up even with no mail at all,
    which matters as mail is on its way out;
  * points de blocage, because these documents are written around real
    obstacles: a suspended ABF opinion, a frozen recruitment, missing
    certified accounts.

Each entry below names the file, who owns it, and who it is shared with.
Ownership decides whose Drive it is uploaded to; the sharing is what makes it
visible -- and attributable -- to the others.

Passwords are not repeated here: they come from seed_profiles.PROFILES, which
stays the one place to edit them.

Re-running is safe: a document already in the owner's Drive is skipped, and
an access that already exists is left alone.
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from accounts import oidc_login

from .seed_demo import Command as SeedDemoCommand
from .seed_profiles import PROFILES

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "demo_data" / "shared"

# --------------------------------------------------------------------------
# Who owns what, and who else sees it.
# --------------------------------------------------------------------------
SHARED_DOCUMENTS = [
    {
        "file": "note-cadrage-service-urbanisme.md",
        "owner": "camille.ferrand@collectivite.gouv.example",
        "shared_with": [
            "bastien.morel@collectivite.gouv.example",
            "ines.royer@collectivite.gouv.example",
        ],
    },
    {
        "file": "dossier-permis-tanneurs.md",
        "owner": "bastien.morel@collectivite.gouv.example",
        "shared_with": ["camille.ferrand@collectivite.gouv.example"],
    },
    {
        "file": "subventions-associations-2026.md",
        "owner": "ines.royer@collectivite.gouv.example",
        "shared_with": [
            "camille.ferrand@collectivite.gouv.example",
            "bastien.morel@collectivite.gouv.example",
        ],
    },
    {
        "file": "plan-charge-2026.md",
        "owner": "camille.ferrand@collectivite.gouv.example",
        "shared_with": ["ines.royer@collectivite.gouv.example"],
    },
    {
        "file": "travaux-groupe-scolaire.md",
        "owner": "camille.ferrand@collectivite.gouv.example",
        "shared_with": [
            "bastien.morel@collectivite.gouv.example",
            "ines.royer@collectivite.gouv.example",
        ],
    },
    {
        "file": "marche-entretien-voirie.md",
        "owner": "ines.royer@collectivite.gouv.example",
        "shared_with": [
            "camille.ferrand@collectivite.gouv.example",
            "bastien.morel@collectivite.gouv.example",
        ],
    },
]

# Enough to read the document, not to change it: a handover should not hand
# out write access to someone else's dossier.
SHARED_ROLE = "reader"


class Command(BaseCommand):
    help = "Upload the shared demo documents and share them between profiles."

    def add_arguments(self, parser):
        parser.add_argument(
            "--share-with",
            action="append",
            default=[],
            metavar="EMAIL",
            help=(
                "Also share every document with this address, on top of the "
                "profiles named above. Repeatable. Meant for a real account "
                "you log in with yourself: its Drive then holds the same "
                "material, without this command ever needing its password."
            ),
        )

    def handle(self, *args, **options):
        passwords = {p["email"]: p["password"] for p in PROFILES}
        # Sharing only ever uses the owner's session, so an address given
        # here costs nothing but a grant -- no password, no account of ours.
        extra = [email.strip() for email in options["share_with"] if email.strip()]
        uploader = SeedDemoCommand()
        uploader.stdout = self.stdout
        uploader.style = self.style

        # One session per owner, reused across their documents: each login
        # walks Drive's whole OIDC chain.
        sessions = {}
        try:
            for entry in SHARED_DOCUMENTS:
                owner = entry["owner"]
                if owner not in sessions:
                    sessions[owner] = self.open(owner, passwords)
                session, base_url, headers = sessions[owner]
                self.place(session, base_url, headers, entry, uploader, extra)
        finally:
            for session, _, _ in sessions.values():
                session.close()

    def open(self, email, passwords):
        password = passwords.get(email)
        if not password:
            raise CommandError(
                f"{email} is not in seed_profiles.PROFILES, so its password is unknown"
            )
        try:
            session, _ = oidc_login.open_session("drive", email, password)
        except oidc_login.LoginFailed as error:
            raise CommandError(f"{email}: Drive login failed ({error.code})") from error

        base_url = oidc_login.public_base_url("drive")
        # Django refuses a session-authenticated write without it.
        headers = {
            "X-CSRFToken": session.cookies.get("csrftoken") or "",
            "Referer": f"{base_url}/",
        }
        return session, base_url, headers

    def place(self, session, base_url, headers, entry, uploader, extra=()):
        path = DATA_DIR / entry["file"]
        if not path.is_file():
            self.stdout.write(self.style.ERROR(f"{entry['file']}: missing from {DATA_DIR}"))
            return

        item = self.existing(session, base_url, entry["file"])
        if item:
            self.stdout.write(f"{entry['file']}: already in {entry['owner']}'s Drive")
        else:
            uploader.upload(session, base_url, headers, path)
            item = self.existing(session, base_url, entry["file"])
            if not item:
                self.stdout.write(self.style.ERROR(f"{entry['file']}: upload did not land"))
                return

        # The owner is skipped: Drive refuses to grant an access to itself,
        # and an extra address may well be one of the profiles already.
        targets = list(entry["shared_with"])
        targets += [email for email in extra if email not in targets]
        for target in targets:
            if target == entry["owner"]:
                continue
            self.share(session, base_url, headers, item, target)

    def existing(self, session, base_url, title):
        """The owner's item with this title, if the upload has completed.

        Drive lists an item only once its bytes are in place, which is also
        what makes this a usable "already done?" check.
        """
        listing = oidc_login.service_request(
            session, "drive", "GET", f"{base_url}/api/v1.0/items/?is_creator_me=true"
        )
        payload = listing.json()
        results = payload.get("results", payload if isinstance(payload, list) else [])
        for item in results:
            if item.get("title") == title:
                return item
        return None

    def share(self, session, base_url, headers, item, email):
        people = oidc_login.service_request(
            session, "drive", "GET", f"{base_url}/api/v1.0/users/?q={email}"
        ).json()
        match = next((u for u in people if u.get("email") == email), None)
        if not match:
            self.stdout.write(
                self.style.WARNING(f"  {email}: no Drive account, not shared with")
            )
            return

        granted = oidc_login.service_request(
            session,
            "drive",
            "POST",
            f"{base_url}/api/v1.0/items/{item['id']}/accesses/",
            json={"user_id": match["id"], "role": SHARED_ROLE},
            headers=headers,
        )
        if granted.status_code in (200, 201):
            self.stdout.write(self.style.SUCCESS(f"  shared with {email}"))
        else:
            # Drive answers 400 when the access already exists, which on a
            # re-run is the outcome we want anyway.
            self.stdout.write(f"  {email}: already had access")
