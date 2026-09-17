"""The picture shown beside a person's name, when they have one.

Served from its own endpoint rather than inlined in the session payload: an
avatar is tens of kilobytes, `/api/auth/me/` is fetched on every page load,
and base64 in JSON would make every one of those responses carry the image
again. A URL is a few dozen bytes and the browser caches it.

Who may see it follows the same rule as someone's documents (item_views):
yourself, or a member of your team. A picture is not more public than the
handover it illustrates.
"""

from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from accounts.session import USER_KEY

from .models import Collaborator


@require_GET
def avatar(request, collaborator_id):
    user = request.session.get(USER_KEY)
    if not user:
        return JsonResponse({"error": "not_authenticated"}, status=401)

    viewer = Collaborator.objects.filter(id=user.get("id")).first()
    subject = Collaborator.objects.filter(id=collaborator_id).first()
    if viewer is None or subject is None:
        return JsonResponse({"error": "not_found"}, status=404)
    if subject.id != viewer.id and subject.manager_id != viewer.id:
        # Not yours and not your team's: indistinguishable from not existing.
        return JsonResponse({"error": "not_found"}, status=404)

    if not subject.avatar:
        return JsonResponse({"error": "no_avatar"}, status=404)

    response = HttpResponse(
        bytes(subject.avatar), content_type=subject.avatar_type or "image/png"
    )
    # Private: it is behind a session, and a shared cache must not keep it.
    response["Cache-Control"] = "private, max-age=300"
    return response
