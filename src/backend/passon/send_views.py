"""Send a handover sheet by mail.

Sent through **Messages**, as the person asking, using the session stored when
they logged in -- the same credential the rest of the application uses. The
mail therefore comes from their real address and lands in their sent folder,
rather than from some application account nobody recognises.

Messages sends in two steps: a draft carrying the recipients and the subject,
then the send itself carrying the body.
"""

import json

import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from accounts import oidc_login
from accounts.session import CREDENTIAL_KEYS, USER_KEY

from .handover_views import EMPTY_SECTIONS
from .models import Collaborator, Handover

SECTION_TITLES = [
    ("actions", "Actions en cours"),
    ("decisions", "Décisions importantes"),
    ("deadlines", "Échéances"),
    ("blockers", "Points de blocage"),
]


def _error(code, status):
    return JsonResponse({"error": code}, status=status)


def _label(entry):
    """One line of a section, whatever shape the frontend stored it in."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return entry.get("label") or entry.get("text") or entry.get("title") or ""
    return str(entry)


def as_text(collaborator, handover):
    """The sheet as a plain-text mail body.

    Plain text on purpose: it has to stay readable in any client, and a
    handover is read as much in a mail app as in ours.
    """
    lines = [f"Passation — {collaborator.full_name}", ""]
    if handover.text:
        lines += [handover.text.strip(), ""]

    sections = {**EMPTY_SECTIONS, **(handover.sections or {})}
    for key, title in SECTION_TITLES:
        entries = [_label(entry) for entry in sections.get(key) or []]
        entries = [entry for entry in entries if entry]
        if not entries:
            continue
        lines.append(f"{title} :")
        lines += [f"  - {entry}" for entry in entries]
        lines.append("")

    documents = sections.get("documents") or []
    if documents:
        lines.append("Documents importants :")
        for document in documents:
            title = document.get("title") if isinstance(document, dict) else str(document)
            url = document.get("url") if isinstance(document, dict) else None
            lines.append(f"  - {title}{f' — {url}' if url else ''}")
        lines.append("")

    state = "validée par le collaborateur" if handover.validated else "non validée"
    lines.append(f"(Passation {state}, envoyée depuis Pass'on.)")
    return "\n".join(lines)


def _messages_session(request):
    """The user's Messages session, ready to write with.

    Messages runs with CSRF_USE_SESSIONS, so there is no csrftoken cookie to
    reuse: the token is handed out in the body of /users/me/, and writes are
    refused without it in the X-CSRFToken header. Fetching it here also
    confirms the stored session is still valid before we start composing.
    """
    credential = request.session.get(CREDENTIAL_KEYS["messages"])
    if not credential:
        return None

    session = requests.Session()
    session.cookies.set(settings.DINUM_SERVICES["messages"]["cookie"], credential)
    session.headers["Referer"] = oidc_login.public_base_url("messages") + "/"
    whoami = oidc_login.service_request(
        session, "messages", "GET",
        f"{oidc_login.public_base_url('messages')}/api/v1.0/users/me/",
    )
    if whoami.status_code != 200:
        session.close()
        return None
    session.headers["X-CSRFToken"] = whoami.json().get("csrf_token") or ""
    return session


@require_POST
def send(request, collaborator_id):
    user = request.session.get(USER_KEY)
    if not user:
        return _error("not_authenticated", 401)
    sender = Collaborator.objects.filter(id=user.get("id")).first()
    if sender is None:
        return _error("unknown_collaborator", 401)

    subject_of = Collaborator.objects.filter(id=collaborator_id).first()
    if subject_of is None or (
        subject_of.id != sender.id and subject_of.manager_id != sender.id
    ):
        return _error("not_found", 404)

    try:
        payload = json.loads(request.body)
        recipients = [str(address).strip() for address in payload["to"]]
    except (json.JSONDecodeError, TypeError, KeyError, UnicodeDecodeError, ValueError):
        return _error("invalid_request", 400)
    recipients = [address for address in recipients if "@" in address]
    if not recipients:
        return _error("no_recipients", 400)

    handover = Handover.objects.filter(collaborator=subject_of).first()
    if handover is None or not (handover.text or handover.sections):
        # Nothing written yet: sending an empty sheet would look like the mail
        # failed, which is exactly the confusion worth avoiding.
        return _error("empty_handover", 409)

    if "messages" not in settings.DINUM_ENABLED_SERVICES:
        # Not "you are not connected": this deployment does not do mail.
        return _error("messages_disabled", 409)

    session = _messages_session(request)
    if session is None:
        return _error("messages_not_connected", 409)

    body = as_text(subject_of, handover)
    base_url = oidc_login.public_base_url("messages")
    try:
        mailboxes = oidc_login.service_request(
            session, "messages", "GET", f"{base_url}/api/v1.0/mailboxes/"
        )
        if mailboxes.status_code != 200 or not mailboxes.json():
            return _error("no_mailbox", 409)
        sender_id = mailboxes.json()[0]["id"]

        draft = oidc_login.service_request(
            session, "messages", "POST", f"{base_url}/api/v1.0/draft/",
            json={
                "senderId": sender_id,
                "subject": f"Passation — {subject_of.full_name}",
                "draftBody": body,
                "to": recipients,
            },
        )
        if draft.status_code not in (200, 201):
            return _error("draft_refused", 502)

        sent = oidc_login.service_request(
            session, "messages", "POST", f"{base_url}/api/v1.0/send/",
            json={
                "messageId": draft.json()["id"],
                "senderId": sender_id,
                "textBody": body,
            },
        )
        if sent.status_code not in (200, 201, 202):
            return _error("send_refused", 502)
    except requests.Timeout:
        return _error("messages_timeout", 504)
    except (requests.RequestException, ValueError, KeyError, TypeError):
        return _error("messages_unreachable", 502)
    finally:
        session.close()

    return JsonResponse({"sent_to": recipients})
