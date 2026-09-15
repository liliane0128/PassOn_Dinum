"""Client for the local Drive service.

Drive runs at http://localhost:8072. It authenticates through Keycloak (OIDC
authorization code flow), same mechanism as Docs and Messages (see
docs_client.py for the full writeup on the Keycloak login quirk with Secure
cookies over plain http).

The Keycloak realm for Drive is "drive" (not "impress"), served at
http://localhost:8083/realms/drive/...

Endpoints:
- GET /api/v1.0/items/                    -> paginated list of items
- GET /api/v1.0/items/?is_creator_me=true -> only items created by the user
- GET /api/v1.0/items/{id}/              -> single item's metadata

Session cookie name: drive_sessionid (set in Drive's Django settings).

Local test account: admin@example.com / admin (created by `make superuser`).
"""

import os
import re

import requests

BASE_URL = os.getenv("DRIVE_URL", "http://localhost:8072")
DEFAULT_USERNAME = "admin@example.com"
DEFAULT_PASSWORD = "admin"


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
        # (http://localhost:3000), which may not be running. The session
        # cookie is already set by that point, so this is safe to ignore.
        pass

    check = session.get(f"{base_url}/api/v1.0/items/")
    if check.status_code != 200:
        raise RuntimeError(
            f"Login did not succeed: GET /api/v1.0/items/ returned "
            f"{check.status_code}: {check.text}"
        )

    return session


def list_items(session, base_url=BASE_URL):
    """Return the list of items created by the logged-in user."""
    response = session.get(
        f"{base_url.rstrip('/')}/api/v1.0/items/",
        params={"is_creator_me": "true"},
    )
    response.raise_for_status()
    return response.json()["results"]


def get_item(session, item_id, base_url=BASE_URL):
    """Return a single item's metadata by id."""
    response = session.get(f"{base_url.rstrip('/')}/api/v1.0/items/{item_id}/")
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    session = login()
    print("Logged in, checking items...")

    items = list_items(session)
    print(f"\n{len(items)} items on this page, first few:")
    for item in items[:3]:
        print(" -", item["id"], item.get("title") or item.get("name"))

    if items:
        detail = get_item(session, items[0]["id"])
        print("\nFull detail of the first item:")
        print(detail)
