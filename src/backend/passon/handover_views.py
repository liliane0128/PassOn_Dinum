"""Reading and writing a collaborator's handover sheet.

Until now this lived in the browser's memory: the AI summary, every manual
edit and the "validé" flag were lost on reload, and a manager never saw what
their collaborator had written. It is stored server-side now, which is what
makes it shared rather than personal.

Who may touch whose:

- your own handover, always;
- your direct team members', if you are their manager -- the manager view
  exists to read and correct them;
- validation is the collaborator's own act. A manager correcting a sheet must
  not be able to declare it validated in their place.
"""

import json

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from accounts.session import USER_KEY

from .models import Collaborator, Handover

# Kept in step with the frontend's SummaryContext.
EMPTY_SECTIONS = {
    "actions": [],
    "decisions": [],
    "deadlines": [],
    "blockers": [],
    "contactIds": [],
    "documents": [],
}


def _error(code, status):
    return JsonResponse({"error": code}, status=status)


def _as_json(handover):
    sections = {**EMPTY_SECTIONS, **(handover.sections or {})}
    return {
        "collaboratorId": str(handover.collaborator_id),
        "text": handover.text,
        "validated": handover.validated,
        "updatedAt": handover.updated_at.isoformat(),
        **sections,
    }


def _resolve(request, collaborator_id):
    """Return (collaborator, is_owner, None) or (None, None, error_response)."""
    user = request.session.get(USER_KEY)
    if not user:
        return None, None, _error("not_authenticated", 401)

    viewer = Collaborator.objects.filter(id=user.get("id")).first()
    if viewer is None:
        return None, None, _error("unknown_collaborator", 401)

    subject = Collaborator.objects.filter(id=collaborator_id).first()
    if subject is None:
        return None, None, _error("not_found", 404)

    if subject.id == viewer.id:
        return subject, True, None
    if subject.manager_id == viewer.id:
        return subject, False, None
    # Not yours and not your team's: indistinguishable from not existing.
    return None, None, _error("not_found", 404)


@require_http_methods(["GET", "PATCH"])
def handover(request, collaborator_id):
    subject, is_owner, error = _resolve(request, collaborator_id)
    if error:
        return error

    sheet, _ = Handover.objects.get_or_create(collaborator=subject)

    if request.method == "GET":
        return JsonResponse(_as_json(sheet))

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError, UnicodeDecodeError):
        return _error("invalid_request", 400)
    if not isinstance(payload, dict):
        return _error("invalid_request", 400)

    if "text" in payload:
        if not isinstance(payload["text"], str):
            return _error("invalid_request", 400)
        sheet.text = payload["text"]

    sections = {**EMPTY_SECTIONS, **(sheet.sections or {})}
    for key in EMPTY_SECTIONS:
        if key in payload:
            if not isinstance(payload[key], list):
                return _error("invalid_request", 400)
            sections[key] = payload[key]
    sheet.sections = sections

    # Any change puts the sheet back to "not validated": validated has to mean
    # "validated as it now reads", including when the manager did the editing.
    sheet.validated = False
    sheet.save()
    return JsonResponse(_as_json(sheet))


@require_http_methods(["POST"])
def validate(request, collaborator_id):
    subject, is_owner, error = _resolve(request, collaborator_id)
    if error:
        return error
    if not is_owner:
        # A manager may correct a sheet, but validating it is the
        # collaborator's own statement about their own work.
        return _error("only_the_owner_can_validate", 403)

    sheet, _ = Handover.objects.get_or_create(collaborator=subject)
    sheet.validated = True
    sheet.save()
    return JsonResponse(_as_json(sheet))
