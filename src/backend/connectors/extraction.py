"""
Extraction pipeline: normalize raw connector data, then extract structured
handover information with an LLM.
"""

from connectors import docs_client, drive_client, messages_client


# ---------------------------------------------------------------------------
# Step 1 – normalisation
# ---------------------------------------------------------------------------

def _extract_author(user):
    """Return a display name from a user sub-object (Drive / Docs style)."""
    if not user:
        return ""
    if isinstance(user, str):
        return user
    return user.get("full_name") or user.get("short_name") or user.get("email") or ""


def _normalize_doc(item, base_url):
    """Normalize one Docs (Impress) document."""
    return {
        "id": str(item.get("id", "")),
        "source_type": "docs",
        "title": item.get("title") or "",
        "author": _extract_author(item.get("creator")),
        "date": item.get("updated_at") or item.get("created_at") or "",
        "content": item.get("excerpt") or "",
        "reference": f"{base_url.rstrip('/')}/api/v1.0/documents/{item.get('id')}/",
    }


def _normalize_drive(item, base_url):
    """Normalize one Drive item (file or folder)."""
    return {
        "id": str(item.get("id", "")),
        "source_type": "drive",
        "title": item.get("title") or item.get("filename") or "",
        "author": _extract_author(item.get("creator")),
        "date": item.get("updated_at") or item.get("created_at") or "",
        "content": item.get("description") or "",
        "reference": (
            item.get("url_permalink")
            or item.get("url")
            or f"{base_url.rstrip('/')}/api/v1.0/items/{item.get('id')}/"
        ),
    }


def _normalize_message(item, base_url):
    """Normalize one Messages email."""
    sender = item.get("sender") or item.get("from") or {}
    if isinstance(sender, dict):
        author = sender.get("name") or sender.get("email") or ""
    else:
        author = str(sender)

    return {
        "id": str(item.get("id", "")),
        "source_type": "mail",
        "title": item.get("subject") or "",
        "author": author,
        "date": (
            item.get("sent_at")
            or item.get("received_at")
            or item.get("date")
            or item.get("created_at")
            or ""
        ),
        "content": item.get("body") or item.get("excerpt") or item.get("preview") or "",
        "reference": f"{base_url.rstrip('/')}/api/v1.0/messages/{item.get('id')}/",
    }


def _as_list(raw):
    """Handle both paginated {'results': [...]} and plain list responses."""
    if isinstance(raw, dict):
        return raw.get("results") or []
    return raw or []


def normalize_items(raw_docs, raw_drive, raw_messages,
                    docs_base_url=docs_client.BASE_URL,
                    drive_base_url=drive_client.BASE_URL,
                    messages_base_url=messages_client.BASE_URL):
    """
    Convert raw connector payloads into a unified list of item dicts.

    Each item has:
        id           – unique identifier (str)
        source_type  – "docs" | "drive" | "mail"
        title        – document title or email subject
        author       – creator full name or sender name
        date         – ISO 8601 string (updated_at / sent_at / …)
        content      – body text, excerpt, or description
        reference    – URL or path to reconstruct a deep link
    """
    result = []
    for raw in _as_list(raw_docs):
        result.append(_normalize_doc(raw, docs_base_url))
    for raw in _as_list(raw_drive):
        result.append(_normalize_drive(raw, drive_base_url))
    for raw in _as_list(raw_messages):
        result.append(_normalize_message(raw, messages_base_url))
    return result
