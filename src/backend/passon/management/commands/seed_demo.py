"""Put the demo dataset into Drive and Messages.

The handover only means something with material to summarize, and that
material lives in the upstream services, not in our database -- so it does not
survive a `docker compose down -v` on Drive or Messages. This rebuilds it:

    python manage.py seed_demo --email someone@example.test --password ...

The account must already exist in both services' Keycloaks (see
accounts/README.md). Everything is written as that person, through the same
APIs their own client would use, so the result is indistinguishable from files
they uploaded and mail they received.

Re-running is safe: documents already in the Drive and mails whose subject is
already in the mailbox are skipped.
"""

import base64
import hashlib
import hmac
import json
import mimetypes
import pathlib
import time
from email import message_from_bytes
from urllib.parse import urlparse, urlunparse

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts import oidc_login
from connectors import messages_client

DATA_DIR = pathlib.Path(__file__).resolve().parents[2] / "demo_data"

# Messages authenticates its inbound mail channel with a JWT signed by this
# shared secret (MDA_API_SECRET on its side). The development default is
# public in that project's deploy/env/backend.defaults.
DEFAULT_MDA_SECRET = "my-shared-secret-mda"


class Command(BaseCommand):
    help = "Upload the demo documents to Drive and deliver the demo mails to Messages."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--skip-drive", action="store_true")
        parser.add_argument("--skip-mails", action="store_true")
        parser.add_argument(
            "--mda-secret",
            default=DEFAULT_MDA_SECRET,
            help="Messages' MDA_API_SECRET (defaults to its development value).",
        )

    def handle(self, *args, **options):
        if not options["skip_drive"]:
            self.seed_drive(options["email"], options["password"])
        if not options["skip_mails"]:
            self.seed_mails(options["email"], options["password"], options["mda_secret"])

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

    # --- Messages ---------------------------------------------------------

    def seed_mails(self, email, password, secret):
        """Deliver each mail through the inbound MTA endpoint.

        Not written into Messages' database directly: going through the same
        door real mail uses means it is parsed, threaded and indexed like any
        other message.
        """
        base_url = oidc_login.public_base_url("messages")
        existing = self.existing_subjects(email, password)

        self.stdout.write(f"Messages, to {email}:")
        for path in sorted((DATA_DIR / "mails").iterdir()):
            body = path.read_bytes()
            subject = message_from_bytes(body).get("Subject", "")
            decoded = str(make_header_safe(subject))
            if decoded and decoded in existing:
                self.stdout.write(f"  {path.name}: already delivered")
                continue

            reachable = settings.DINUM_SERVICES["messages"]["url"].rstrip("/")
            response = requests.post(
                f"{reachable}/api/v1.0/inbound/mta/deliver/",
                data=body,
                headers={
                    "Host": urlparse(base_url).netloc,
                    "Authorization": f"Bearer {mta_token(body, [email], secret)}",
                    "Content-Type": "message/rfc822",
                },
                timeout=30,
            )
            if response.status_code == 200:
                self.stdout.write(self.style.SUCCESS(f"  {path.name}: delivered"))
            else:
                self.stdout.write(
                    self.style.ERROR(f"  {path.name}: {response.status_code} {response.text[:120]}")
                )

    def existing_subjects(self, email, password):
        """Subjects already in the mailbox, so re-running delivers nothing twice.

        Best effort: if Messages cannot be read (the account may not exist
        there yet), everything is treated as missing and delivery decides.
        """
        try:
            credential, _ = oidc_login.login("messages", email, password)
        except oidc_login.LoginFailed:
            return set()

        session = requests.Session()
        session.cookies.set(settings.DINUM_SERVICES["messages"]["cookie"], credential)
        try:
            messages = messages_client.list_items(
                session, base_url=settings.DINUM_SERVICES["messages"]["url"]
            )
        except requests.RequestException:
            return set()
        finally:
            session.close()
        return {message.get("subject") for message in messages if message.get("subject")}


def make_header_safe(value):
    """Decode a MIME-encoded header, falling back to its raw form."""
    from email.header import decode_header, make_header

    try:
        return make_header(decode_header(value))
    except (ValueError, UnicodeDecodeError):
        return value


def mta_token(body, recipients, secret):
    """An HS256 JWT for Messages' inbound channel.

    Signed by hand rather than with a JWT library: this is the only place the
    project needs one, and a dependency for eleven lines of HMAC is a poor
    trade. The claims are the ones Messages requires -- an expiry, the
    recipients, and a hash binding the token to this exact body so it cannot
    be replayed with another.
    """

    def b64(raw):
        return base64.urlsafe_b64encode(raw).rstrip(b"=")

    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64(
        json.dumps(
            {
                "exp": int(time.time()) + 300,
                "body_hash": hashlib.sha256(body).hexdigest(),
                "original_recipients": recipients,
            },
            separators=(",", ":"),
        ).encode()
    )
    signing_input = header + b"." + payload
    signature = b64(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return (signing_input + b"." + signature).decode()
