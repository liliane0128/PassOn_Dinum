"""Client for the local Messages (collaborative inbox) service.

Messages runs at http://localhost:8901 (confirmed via `docker compose ps` in
the messages project, `st-messages-backend-dev-light-1` container; the
frontend is on 8900, Keycloak on 8902 -- see `make bootstrap`'s own banner
and `deploy/env/backend.defaults`).

Auth is OIDC/Keycloak, same mechanism and same local quirk as Docs (see
docs_client.py for the full writeup): Keycloak's session cookies are marked
`Secure` even over plain http, so they must be stripped after the initial GET
or the login POST fails with "Restart login cookie not found".

Endpoints (from http://localhost:8901/api/v1.0/swagger.json):
- GET /api/v1.0/mailboxes/                       -> mailboxes owned by the user
- GET /api/v1.0/messages/?mailbox_id={mailbox_id} -> messages in that mailbox
- GET /api/v1.0/messages/{id}/                    -> single message

`mailbox_id` is required for the list endpoint: the IsAllowedToAccess
permission (core/api/permissions.py) rejects a plain list request with 403
("You do not have permission to perform this action.") unless a mailbox_id
(or thread_id) query param is given, even though `get_queryset` itself
already scopes results to the current user. list_items() below fetches the
user's first mailbox to supply this automatically.

Local test account: user1@example.local / user1 (created by `make superuser`
as part of `make bootstrap`).

Note: this local instance was only bootstrapped with the light stack
(`make bootstrap`, no demo data command exists for this project as it does
for Docs), so the test account's mailbox is genuinely empty. list_items()
below will correctly return an empty list -- that's real state, not a bug.
"""

import re

import requests

BASE_URL = "http://localhost:8901"
DEFAULT_USERNAME = "user1@example.local"
DEFAULT_PASSWORD = "user1"


def login(base_url=BASE_URL, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD):
    """Log in with the OIDC/Keycloak flow and return an authenticated session."""
    session = requests.Session()

    response = session.get(f"{base_url}/api/v1.0/authenticate/")

    # Work around Keycloak marking its cookies Secure on a plain-http local setup.
    for cookie in session.cookies:
        cookie.secure = False

    match = re.search(r'<form id="kc-form-login"[^>]*action="([^"]+)"', response.text)
    if not match:
        raise RuntimeError(
            "Could not find the Keycloak login form in the response. "
            "The login page markup may have changed."
        )
    action_url = match.group(1).replace("&amp;", "&")

    try:
        session.post(
            action_url,
            data={"username": username, "password": password},
        )
    except requests.exceptions.ConnectionError:
        # The final redirect after a successful login points at the frontend
        # (http://localhost:8900). If it isn't running, that's safe to ignore
        # here: the session cookie is already set by that point.
        pass

    check = session.get(f"{base_url}/api/v1.0/mailboxes/")
    if check.status_code != 200:
        raise RuntimeError(
            f"Login did not succeed: GET /api/v1.0/mailboxes/ returned "
            f"{check.status_code}: {check.text}"
        )

    return session


def _get_default_mailbox_id(session, base_url):
    response = session.get(f"{base_url}/api/v1.0/mailboxes/")
    response.raise_for_status()
    mailboxes = response.json()
    if not mailboxes:
        raise RuntimeError("This account has no mailboxes.")
    return mailboxes[0]["id"]


def list_items(session, base_url=BASE_URL):
    """Return the messages in the user's (first) mailbox."""
    mailbox_id = _get_default_mailbox_id(session, base_url)
    response = session.get(
        f"{base_url}/api/v1.0/messages/", params={"mailbox_id": mailbox_id}
    )
    response.raise_for_status()
    return response.json()


def get_item(session, item_id, base_url=BASE_URL):
    """Return a single message by id."""
    response = session.get(f"{base_url}/api/v1.0/messages/{item_id}/")
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    session = login()
    mailboxes = session.get(f"{BASE_URL}/api/v1.0/mailboxes/").json()
    print("Logged in, mailboxes:", mailboxes)

    items = list_items(session)
    print(f"\n{len(items)} messages in the first mailbox.")
    if items:
        for item in items[:3]:
            print(" -", item["id"], item.get("subject"))
        detail = get_item(session, items[0]["id"])
        print("\nFull detail of the first message:")
        print(detail)
    else:
        print(
            "No messages to show: this local instance was only bootstrapped "
            "with `make bootstrap` (light stack), which does not seed any "
            "demo mail data for the messages project. This is the real, "
            "current state of the account, not an error."
        )
