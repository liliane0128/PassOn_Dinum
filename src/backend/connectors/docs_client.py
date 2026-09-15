"""Client for the local Docs (Impress) service.

Docs runs at http://localhost:8071 (confirmed via `docker compose ps` in the
docs project, see `docs-app-dev-1` container). It authenticates through
Keycloak (OIDC authorization code flow) rather than a plain username/password
API endpoint; there is no REST login route in its OpenAPI schema
(http://localhost:8071/api/v1.0/swagger.json).

Login flow, reverse-engineered by following it step by step with a
requests.Session and reading the real responses (not guessed):

1. GET /api/v1.0/authenticate/ redirects to the Keycloak login page at
   http://localhost:8083/realms/impress/protocol/openid-connect/auth (nginx
   proxies Keycloak on port 8083 in this local setup).
2. That page's HTML contains a login form (id="kc-form-login") whose `action`
   attribute is the URL to POST username/password to.
3. Keycloak sets its session cookies (AUTH_SESSION_ID, KC_RESTART, ...) with
   the `Secure` flag, even though this local instance is served over plain
   http. requests will not send `Secure` cookies over http, which makes the
   login POST fail with "Restart login cookie not found" (HTTP 400). Clearing
   `secure=False` on the cookies right after the first GET works around this
   for local development.
4. On success, Keycloak redirects back to /api/v1.0/callback/, which Django
   exchanges the code for tokens and sets a `docs_sessionid` session cookie.
   That cookie is enough to call the rest of the API (SessionAuthentication).
5. The final redirect after that points at the frontend (http://localhost:3000),
   which may not be running locally; that's expected and can be ignored.

Endpoints (from the schema above):
- GET /api/v1.0/documents/        -> paginated list of the user's documents
- GET /api/v1.0/documents/{id}/   -> single document's metadata

Local test account: impress / impress.
"""

import base64
import re

import pycrdt
import requests
from bs4 import BeautifulSoup

BASE_URL = "http://localhost:8071"
DEFAULT_USERNAME = "impress"
DEFAULT_PASSWORD = "impress"


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

    check = session.get(f"{base_url}/api/v1.0/users/me/")
    if check.status_code != 200:
        raise RuntimeError(
            f"Login did not succeed: GET /api/v1.0/users/me/ returned "
            f"{check.status_code}: {check.text}"
        )

    return session


def list_items(session, base_url=BASE_URL):
    """Return the list of documents visible to the logged-in user."""
    response = session.get(f"{base_url}/api/v1.0/documents/")
    response.raise_for_status()
    return response.json()["results"]


def get_item(session, item_id, base_url=BASE_URL):
    """Return a single document's metadata by id."""
    response = session.get(f"{base_url}/api/v1.0/documents/{item_id}/")
    response.raise_for_status()
    return response.json()


def get_content(session, item_id, base_url=BASE_URL):
    """Return a document's plain-text body.

    Document bodies live outside the metadata endpoints entirely: neither
    list_items() nor get_item() above returns any text (Impress's
    DocumentSerializer has no content field, and demo/unedited documents
    leave `excerpt` null too). The body is fetched separately from
    GET /documents/{id}/content/, which streams a base64-encoded Yjs CRDT
    update straight from S3, not JSON or Markdown.

    This mirrors Impress's own base64_yjs_to_text() helper
    (core/utils/yjs.py): decode the base64, replay the update into a fresh
    pycrdt.Doc, read the BlockNote structure out of the "document-store"
    XmlFragment (that key name is a BlockNote/Impress convention, see
    frontend's getXmlFragment('document-store')), then strip the XML tags.
    """
    response = session.get(
        f"{base_url.rstrip('/')}/api/v1.0/documents/{item_id}/content/"
    )
    response.raise_for_status()
    if not response.content:
        return ""

    raw_update = base64.b64decode(response.content)
    doc = pycrdt.Doc()
    doc.apply_update(raw_update)
    xml_fragment = str(doc.get("document-store", type=pycrdt.XmlFragment))
    return BeautifulSoup(xml_fragment, "lxml-xml").get_text(separator=" ", strip=True)


if __name__ == "__main__":
    session = login()
    print("Logged in as:", session.get(f"{BASE_URL}/api/v1.0/users/me/").json())

    items = list_items(session)
    print(f"\n{len(items)} documents on this page, first few:")
    for item in items[:3]:
        print(" -", item["id"], item["title"])

    if items:
        detail = get_item(session, items[0]["id"])
        print("\nFull detail of the first document:")
        print(detail)

        content = get_content(session, items[0]["id"])
        print("\nContent of the first document:")
        print(content if content else "(empty document)")
