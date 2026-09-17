"""Put the demo dataset into Drive.

The handover only means something with material to summarize, and that
material lives in Drive, not in our database -- so it does not survive a
`docker compose down -v` there. This rebuilds it:

    python manage.py seed_demo --email someone@example.test --password ...

The account must already exist in Drive's Keycloak (see accounts/README.md).
Everything is written as that person, through the same API their own client
would use, so the result is indistinguishable from files they uploaded.

Re-running is safe: a document already in the Drive is skipped.
"""

import json
import mimetypes
import pathlib
from urllib.parse import urlparse, urlunparse

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts import oidc_login

DATA_DIR = pathlib.Path(__file__).resolve().parents[2] / "demo_data"


class Command(BaseCommand):
    help = "Upload the demo documents to Drive."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)

    def handle(self, *args, **options):
        self.seed_drive(options["email"], options["password"])

    # --- Drive ------------------------------------------------------------

    def seed_drive(self, email, password):
        """Upload each document, in the three steps Drive's API requires."""
        try:
            session, user = oidc_login.open_session("drive", email, password)
        except oidc_login.LoginFailed as error:
            raise CommandError(f"Drive login failed: {error.code}") from error

        base_url = oidc_login.public_base_url("drive")
        # Django refuses a session-authenticated write without it; the cookie
        # is set during the login flow, which is why the session is kept.
        csrf = session.cookies.get("csrftoken") or ""
        headers = {"X-CSRFToken": csrf, "Referer": f"{base_url}/"}

        listing = oidc_login.service_request(
            session, "drive", "GET", f"{base_url}/api/v1.0/items/?is_creator_me=true"
        )
        existing = {item.get("title") for item in listing.json().get("results", [])}

        self.stdout.write(f"Drive, as {user.get('email')}:")
        for path in sorted((DATA_DIR / "documents").iterdir()):
            if path.name in existing:
                self.stdout.write(f"  {path.name}: already there")
                continue
            self.upload(session, base_url, headers, path)
        session.close()

    def upload(self, session, base_url, headers, path):
        body = path.read_bytes()
        created = oidc_login.service_request(
            session, "drive", "POST", f"{base_url}/api/v1.0/items/",
            json={
                "type": "file",
                "filename": path.name,
                "title": path.name,
                "size": len(body),
                # Extraction only reads items whose mimetype starts with
                # "text/", so getting this right is what decides whether the
                # file ever reaches the model.
                "mimetype": mimetypes.guess_type(path.name)[0] or "text/plain",
            },
            headers=headers,
        )
        if created.status_code not in (200, 201):
            self.stdout.write(self.style.ERROR(f"  {path.name}: create failed ({created.status_code})"))
            return

        item = created.json()
        policy = item.get("policy")
        upload_url = policy.get("url") if isinstance(policy, dict) else policy
        if not upload_url:
            self.stdout.write(self.style.ERROR(f"  {path.name}: no upload policy returned"))
            return

        # Bytes go straight to object storage. Its host is the one a browser
        # would use, so the request is sent somewhere reachable while still
        # presenting that host -- the signature covers it. The URL signs
        # host;x-amz-acl, so exactly those headers must be sent: an extra
        # Content-Type is rejected as "headers ... which were not signed".
        target = urlparse(upload_url)
        # The host we can actually connect to comes from DRIVE_URL, not from
        # the public base: the public one is by definition what a browser
        # uses, which from inside a container is the container itself.
        reachable = urlparse(settings.DINUM_SERVICES["drive"]["url"]).hostname
        if target.hostname in ("localhost", "127.0.0.1") and reachable != target.hostname:
            netloc = reachable if target.port is None else f"{reachable}:{target.port}"
            sent_to = urlunparse(target._replace(netloc=netloc))
        else:
            sent_to = upload_url
        put = requests.put(
            sent_to, data=body,
            headers={"Host": target.netloc, "x-amz-acl": "private"},
            timeout=60,
        )
        if put.status_code not in (200, 204):
            self.stdout.write(self.style.ERROR(f"  {path.name}: upload failed ({put.status_code})"))
            return

        ended = oidc_login.service_request(
            session, "drive", "POST",
            f"{base_url}/api/v1.0/items/{item['id']}/upload-ended/",
            headers=headers,
        )
        state = "ok" if ended.status_code in (200, 201, 202) else f"upload-ended {ended.status_code}"
        self.stdout.write(self.style.SUCCESS(f"  {path.name}: {state}"))
