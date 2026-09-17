"""A collaborator's documents, for them and for their manager.

Drive answers only for the session it is given, and we hold exactly one: the
person who logged in. So a manager cannot be shown a
collaborator's files live -- there is no credential to ask with.

What happens instead: when someone lists their own items, the result is
snapshotted against their collaborator row (passon.CollaboratorItem), and their
manager reads that snapshot. It is a cache, so every response says when it was
taken, and the interface shows it.
"""

import json

from django.db import transaction
from django.utils.dateparse import parse_datetime
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from accounts.session import USER_KEY
from connectors import views as connector_views

from .models import Collaborator, CollaboratorItem


def _error(code, status):
    return JsonResponse({"error": code}, status=status)


def _as_json(item):
    return {
        "type": item.kind,
        "id": item.reference.split(":", 1)[-1],
        "refId": item.reference,
        "icon": "description",
        "title": item.title,
        "subtitle": item.author or item.source,
        "authorEmail": item.author_email or None,
        "preview": item.preview,
        "date": item.date.isoformat() if item.date else None,
        "url": item.url or None,
    }


@transaction.atomic
def _snapshot(collaborator, items, failed_sources=()):
    """Replace this collaborator's snapshot with what the services just said.

    Replaced rather than merged: an item that has disappeared upstream must
    disappear here too, otherwise a manager keeps seeing files that no longer
    exist.

    Except for a service that just failed. `/api/extraction/items/` answers
    partially on purpose -- one service down still returns the others, with
    the failure listed in `errors` -- and taking that answer as the whole
    truth deleted everything the failed service had contributed. Drive being
    briefly unreachable would wipe every document from the snapshot, and the
    manager would then read a colleague's handover as though they had none,
    with nothing saying why. Those rows are kept until that service answers
    again.
    """
    stale = CollaboratorItem.objects.filter(collaborator=collaborator)
    if failed_sources:
        stale = stale.exclude(source__in=list(failed_sources))
    stale.delete()
    CollaboratorItem.objects.bulk_create(
        [
            CollaboratorItem(
                collaborator=collaborator,
                reference=item.get("id") or "",
                kind=CollaboratorItem.Kind.DOCUMENT,
                source=(item.get("source") or {}).get("type") or "",
                title=(item.get("title") or "")[:512],
                author=(item.get("author") or "")[:255],
                author_email=(item.get("author_email") or "")[:320],
                url=((item.get("source") or {}).get("resource_url") or "")[:1024],
                preview=(item.get("content") or "")[:2000],
                date=parse_datetime(item.get("date") or "") if item.get("date") else None,
            )
            for item in items
            if item.get("id")
        ]
    )


@require_GET
def items(request, collaborator_id):
    user = request.session.get(USER_KEY)
    if not user:
        return _error("not_authenticated", 401)
    viewer = Collaborator.objects.filter(id=user.get("id")).first()
    if viewer is None:
        return _error("unknown_collaborator", 401)

    subject = Collaborator.objects.filter(id=collaborator_id).first()
    if subject is None or (subject.id != viewer.id and subject.manager_id != viewer.id):
        # Not yours and not your team's: indistinguishable from not existing.
        return _error("not_found", 404)

    if subject.id == viewer.id:
        # Our own session is the only one that can ask the services, so this is
        # also the moment the snapshot is refreshed. The connectors' view is
        # reused as-is rather than reimplemented: it owns the credential
        # resolution and the partial-failure rules.
        response = connector_views.extraction_items(request)
        if response.status_code != 200:
            return response
        payload = json.loads(response.content)
        errors = payload.get("errors", {})
        _snapshot(subject, payload.get("items", []), failed_sources=errors.keys())
    else:
        errors = {}

    stored = list(CollaboratorItem.objects.filter(collaborator=subject))
    fetched_at = max((item.fetched_at for item in stored), default=None)
    return JsonResponse(
        {
            "items": [_as_json(item) for item in stored],
            "errors": errors,
            # None when nothing was ever captured for this person: the
            # interface says "jamais synchronisé" rather than showing an empty
            # list as though they had no documents.
            "fetchedAt": fetched_at.isoformat() if fetched_at else None,
            "isOwn": subject.id == viewer.id,
        }
    )
