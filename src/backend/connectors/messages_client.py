"""Client for the local Messages (collaborative inbox) service.

Messages runs at http://localhost:8901 (confirmed via `docker compose ps` in
the messages project, `st-messages-backend-dev-light-1` container; the
frontend is on 8900, Keycloak on 8902 -- see `make bootstrap`'s own banner
and `deploy/env/backend.defaults`).

Auth is OIDC/Keycloak, same mechanism and same local quirk as Docs (see
docs_client.py for the full writeup): Keycloak's session cookies are marked
`Secure` even over plain http, so they must be stripped after the initial GET
or the login POST fails with "Restart login cookie not found".

Session cookie name: st_messages_sessionid (SESSION_COOKIE_NAME in Messages'
settings.py -- not the generic "sessionid" the unified API's .env.example
used to default to; that mismatch made the unified /api/messages/ proxy
401 with a valid session until MESSAGES_SESSION_COOKIE was corrected).

Endpoints (from http://localhost:8901/api/v1.0/swagger.json):
- GET /api/v1.0/mailboxes/                        -> mailboxes owned by the user
- GET /api/v1.0/threads/?mailbox_id={mailbox_id}  -> threads in that mailbox
- GET /api/v1.0/messages/?thread_id={thread_id}   -> messages in that thread
- GET /api/v1.0/messages/{id}/                    -> single message

`mailbox_id` satisfies the IsAllowedToAccess permission on /threads/, but
does *not* actually filter /messages/ -- GET /messages/?mailbox_id=... is
accepted (200) and always returns an empty list, even for a mailbox with
real threads, because mailbox_id there is only a permission check, not a
queryset filter (see IsAllowedToAccess in core/api/permissions.py); only
thread_id filters it. So list_items() below fans out across *every*
mailbox the user has (personal identity, plus any shared mailbox they've
been given access to -- Messages is a "collaborative inbox", shared
mailboxes are a first-class feature, not an edge case): for each mailbox
it lists threads (GET /threads/?mailbox_id=..., which does return real
data), then for each thread fetches its messages by thread_id, and
flattens everything into one list. An earlier version only looked at
`mailboxes[0]` ("the user's first mailbox") -- for a single-mailbox
account (the default test account below) that's the whole picture, but
for any account with shared mailboxes it silently missed every message
outside whichever mailbox happened to sort first, with no error to signal
it. Request count now scales with mailbox and thread count (one round
trip per mailbox for its threads, one more per thread for its messages);
fine for local/dev-sized inboxes, not something to point at production
scale without pagination.

Local test account: user1@example.local / user1 (created by `make superuser`
as part of `make bootstrap`). Its mailbox is genuinely empty -- the light
bootstrap seeds no demo mail data for this project (unlike Docs' `make
demo`). For an account with real threads/messages to test against, run
(against the already-running light stack, no separate e2e compose stack
needed):

    docker compose exec -e DJANGO_CONFIGURATION=E2E backend-dev-light \
        python manage.py e2e_demo

(DJANGO_CONFIGURATION=E2E is required one-off: the `e2e` app that provides
this command is only registered under Messages' E2E settings class, not
Development, which the light stack normally runs under.) This creates
user.e2e.{chromium,firefox,webkit}@example.local / password "e2e", each
with ~5 real threads (outbox delivery-status fixtures, inbox threads, and
for firefox/webkit a real inbound-delivered message with an HTML body).
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


def _list_mailboxes(session, base_url):
    response = session.get(f"{base_url}/api/v1.0/mailboxes/")
    response.raise_for_status()
    return response.json()


def _list_threads(session, mailbox_id, base_url):
    response = session.get(
        f"{base_url}/api/v1.0/threads/", params={"mailbox_id": mailbox_id}
    )
    response.raise_for_status()
    return response.json()["results"]


def list_items(session, base_url=BASE_URL):
    """Return the messages across all of the user's mailboxes.

    See the module docstring: mailbox_id doesn't filter /messages/, and a
    user can have more than one mailbox (personal + shared), so this walks
    every mailbox -> its threads -> each thread's messages, and flattens
    the result.
    """
    items = []
    for mailbox in _list_mailboxes(session, base_url):
        for thread in _list_threads(session, mailbox["id"], base_url):
            response = session.get(
                f"{base_url}/api/v1.0/messages/", params={"thread_id": thread["id"]}
            )
            response.raise_for_status()
            items.extend(response.json())
    return items


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
    print(f"\n{len(items)} messages across all mailboxes.")
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
