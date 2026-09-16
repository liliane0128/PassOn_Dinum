"""Managing a team: the collaborators reporting to the logged-in manager.

Adding someone here creates a row with no `external_id`: that person may not
have a Drive account at all yet. Their first login claims the row by email
(accounts/collaborators.py), which is what makes "add a collaborator now,
they log in later" work.
"""

import json

import requests
from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from accounts import oidc_login
from accounts.collaborators import as_json
from accounts.session import CREDENTIAL_KEYS, USER_KEY

from .models import Collaborator


def _would_create_a_cycle(manager, candidate):
    """True if making `candidate` report to `manager` closes a loop.

    Walking up from the manager, we must never meet the person we are about to
    put underneath them -- otherwise the hierarchy stops being a tree and any
    later traversal of it can run forever.
    """
    seen = set()
    current = manager
    while current is not None and current.id not in seen:
        if current.id == candidate.id:
            return True
        seen.add(current.id)
        current = current.manager
    return False


def _error(code, status):
    return JsonResponse({"error": code}, status=status)


def _current_manager(request):
    """The logged-in collaborator, if they are a manager.

    Returns (collaborator, None) or (None, error_response). Only a manager may
    change a team, and only their own: the session says who is asking, never
    the request body.
    """
    user = request.session.get(USER_KEY)
    if not user:
        return None, _error("not_authenticated", 401)
    manager = Collaborator.objects.filter(id=user.get("id")).first()
    if manager is None:
        return None, _error("unknown_collaborator", 401)
    if manager.role != Collaborator.Role.MANAGER:
        return None, _error("not_a_manager", 403)
    return manager, None


@require_http_methods(["GET", "POST"])
def team(request):
    manager, error = _current_manager(request)
    if error:
        return error

    if request.method == "GET":
        return JsonResponse(
            {"team": [as_json(member) for member in manager.team_members.all()]}
        )

    try:
        payload = json.loads(request.body)
        first_name = str(payload["firstName"]).strip()
        last_name = str(payload["lastName"]).strip()
        email = str(payload["email"]).strip().lower()
    except (json.JSONDecodeError, TypeError, KeyError, UnicodeDecodeError, ValueError):
        return _error("invalid_request", 400)
    if not first_name or not last_name or "@" not in email:
        return _error("invalid_request", 400)

    existing = Collaborator.objects.filter(email__iexact=email).first()
    if existing is not None:
        # Someone already known: most often a colleague who has simply logged
        # in before their manager got around to building the team. Attaching
        # them is the expected outcome, not an error -- refusing it would make
        # it impossible to put an existing user on a team at all.
        if existing.id == manager.id:
            return _error("cannot_manage_yourself", 400)
        if existing.manager_id == manager.id:
            return JsonResponse(as_json(existing), status=200)
        if existing.manager_id is not None:
            # Taking someone off another manager's team is a different
            # decision, and not one to make silently on their behalf.
            return _error("collaborator_has_manager", 409)
        if _would_create_a_cycle(manager, existing):
            return _error("would_create_a_cycle", 400)

        existing.manager = manager
        # Only fill in what is missing: the identity fields belong to Drive,
        # which knows them better than whoever typed this form.
        existing.job_title = existing.job_title or str(payload.get("jobTitle") or "").strip()
        existing.team = existing.team or str(payload.get("team") or manager.team or "").strip()
        existing.save()
        return JsonResponse(as_json(existing), status=200)

    member = Collaborator.objects.create(
        email=email,
        first_name=first_name,
        last_name=last_name,
        job_title=str(payload.get("jobTitle") or "").strip(),
        team=str(payload.get("team") or manager.team or "").strip(),
        role=Collaborator.Role.EMPLOYEE,
        manager=manager,
    )
    return JsonResponse(as_json(member), status=201)


@require_http_methods(["DELETE"])
def team_member(request, collaborator_id):
    manager, error = _current_manager(request)
    if error:
        return error

    member = manager.team_members.filter(id=collaborator_id).first()
    if member is None:
        # Either no such collaborator, or not on this manager's team. The
        # distinction is not the caller's business.
        return _error("not_found", 404)

    member.delete()
    return JsonResponse({}, status=200)


# Drive's directory is the authority on who exists: an address typed by hand
# reaches someone only if it matches an account there. Searching it instead of
# typing removes the whole class of mistake -- a typo, a personal address, a
# colleague who left.
SEARCH_MIN_LENGTH = 2
SEARCH_LIMIT = 10


def _drive_directory(request, query):
    """Accounts matching `query` in Drive, as [(email, full_name)].

    Uses the Drive session stored at login: Drive answers for the person
    asking, and that is the only credential we hold. If it is missing or the
    call fails, the search falls back to what we already know locally rather
    than failing outright.
    """
    credential = request.session.get(CREDENTIAL_KEYS["drive"])
    if not credential:
        return []

    config = settings.DINUM_SERVICES["drive"]
    session = requests.Session()
    session.cookies.set(config["cookie"], credential)
    try:
        response = oidc_login.service_request(
            session,
            "drive",
            "GET",
            f"{oidc_login.public_base_url('drive')}/api/v1.0/users/",
            params={"q": query},
        )
        if response.status_code != 200:
            return []
        return [
            (user["email"], user.get("full_name") or user["email"])
            for user in response.json()
            if user.get("email")
        ]
    except (requests.RequestException, ValueError, KeyError, TypeError):
        return []
    finally:
        session.close()


@require_GET
def search(request):
    """People a manager could add to their team, by name or address.

    Two sources, merged on the email address: Drive's directory (anyone with
    an account, whether or not they have ever opened Pass'on) and our own
    collaborators (including those a manager added by hand, who may have no
    Drive account yet). Each result says whether they can actually be added,
    so the interface can explain rather than let the click fail.
    """
    manager, error = _current_manager(request)
    if error:
        return error

    query = (request.GET.get("q") or "").strip()
    if len(query) < SEARCH_MIN_LENGTH:
        return JsonResponse({"results": []})

    known = {
        person.email.lower(): person
        for person in Collaborator.objects.filter(
            Q(email__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )[: SEARCH_LIMIT * 2]
    }

    found = {}
    for email, full_name in _drive_directory(request, query):
        found[email.lower()] = {"email": email, "fullName": full_name}
    for email, person in known.items():
        found.setdefault(email, {"email": person.email, "fullName": person.full_name})

    results = []
    for email, entry in sorted(found.items()):
        person = known.get(email)
        if person is not None and person.id == manager.id:
            status = "yourself"
        elif person is not None and person.manager_id == manager.id:
            status = "on_your_team"
        elif person is not None and person.manager_id is not None:
            status = "on_another_team"
        else:
            status = "available"
        results.append({**entry, "status": status})

    return JsonResponse({"results": results[:SEARCH_LIMIT]})
