"""Session login backed by the local Suite Numérique services.

The password is never stored: it is checked once against Drive (see
oidc_login.py) and what we keep in our own session is the session cookie that
check produced, plus the identity Drive reported. connectors/views.py falls
back to those stored cookies, so a logged-in user's documents can be read
without the frontend ever handling a session value.

Drive is the service that decides whether the login succeeds. Messages runs a
separate Keycloak with its own user list, so the same credentials are tried
there as well but on a best-effort basis: a user who exists only in Drive still
logs in, and simply gets no mail in their handover. `services` in the response
says which ones answered, so the interface can explain a partial result rather
than silently showing less.
"""

import json

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from . import mock_accounts, oidc_login
from .session import CREDENTIAL_KEYS, USER_KEY


def _error(code, status):
    return JsonResponse({"error": code}, status=status)


def _connected(request):
    """Which services this session holds a usable credential for."""
    return {name: key in request.session for name, key in CREDENTIAL_KEYS.items()}


def _public_user(user):
    """Keep the response to what the interface needs to show someone."""
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "full_name": user.get("full_name") or user.get("short_name") or user.get("email"),
    }


@require_POST
def login(request):
    try:
        payload = json.loads(request.body)
        email = payload["email"]
        password = payload["password"]
    except (json.JSONDecodeError, TypeError, KeyError, UnicodeDecodeError):
        return _error("invalid_request", 400)
    if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
        return _error("invalid_request", 400)

    backend = mock_accounts if settings.DINUM_USE_MOCK else oidc_login
    try:
        credential, user = backend.login("drive", email, password)
    except oidc_login.LoginFailed as failure:
        return _error(failure.code, failure.status)

    # A new session id for the newly authenticated user, so a session id
    # obtained before logging in cannot be reused afterwards.
    request.session.cycle_key()
    request.session[CREDENTIAL_KEYS["drive"]] = credential
    request.session[USER_KEY] = _public_user(user)

    # Best effort, never fatal: the account may not exist in Messages' own
    # Keycloak, or Messages may not be running at all.
    try:
        messages_credential, _ = backend.login("messages", email, password)
        request.session[CREDENTIAL_KEYS["messages"]] = messages_credential
    except oidc_login.LoginFailed:
        request.session.pop(CREDENTIAL_KEYS["messages"], None)

    return JsonResponse({"user": request.session[USER_KEY], "services": _connected(request)})


@require_POST
def logout(request):
    """Drop our session. Drive's own session is left alone: we did not create
    it on the user's browser and other tabs may still be using it."""
    request.session.flush()
    return JsonResponse({}, status=200)


@require_GET
@ensure_csrf_cookie
def me(request):
    """Who is logged in, and the endpoint that hands out the CSRF cookie.

    The frontend calls this on startup: it restores the session after a page
    reload, and sets the csrftoken cookie that the two POST routes above
    require.
    """
    user = request.session.get(USER_KEY)
    if not user:
        return _error("not_authenticated", 401)
    return JsonResponse({"user": user, "services": _connected(request)})
