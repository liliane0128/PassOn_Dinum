"""Session login backed by the local Drive instance.

The credential is never stored: it is checked once against Drive (see
drive_auth.py) and what we keep in our own session is the Drive session cookie
that check produced, plus the identity Drive reported. connectors/views.py
falls back to that stored cookie, so a logged-in user's documents can be read
without the frontend ever handling a session value.
"""

import json

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from . import drive_auth, mock_accounts
from .session import CREDENTIAL_KEY, USER_KEY


def _error(code, status):
    return JsonResponse({"error": code}, status=status)


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

    try:
        if settings.DINUM_USE_MOCK:
            credential, user = mock_accounts.login(email, password)
        else:
            credential, user = drive_auth.login(email, password)
    except drive_auth.LoginFailed as failure:
        return _error(failure.code, failure.status)

    # A new session id for the newly authenticated user, so a session id
    # obtained before logging in cannot be reused afterwards.
    request.session.cycle_key()
    request.session[CREDENTIAL_KEY] = credential
    request.session[USER_KEY] = _public_user(user)
    return JsonResponse({"user": request.session[USER_KEY]})


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
    return JsonResponse({"user": user})
