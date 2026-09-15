"""
Extraction pipeline: normalize raw connector data, then extract structured
handover information with an LLM.

Content fetching note: none of the three services put real body content on
their list/detail payloads --
  - Docs: `excerpt` is always null in practice; the actual text lives in a
    separate base64-encoded Yjs CRDT blob at .../content/ (see
    docs_client.get_content()).
  - Drive: `description` is a user-editable note field, not the file body;
    the actual bytes live at .../download/ for files (drive_client.
    download_item()) and there is no single-document "content" for a
    folder at all.
  - Messages: the list-by-thread payload *does* already carry the body
    inline, just not under `body`/`excerpt`/`preview` -- it's
    `textBody[0]["content"]` / `htmlBody[0]["content"]` (JMAP-style), so no
    extra request is needed there, only the right field path.
Passing `docs_session` / `drive_session` into normalize_items() below opts
into fetching real content for docs and drive items (one extra request per
item). Without a session, content falls back to the metadata field, which
in practice is almost always empty -- callers that only need titles/dates/
references (e.g. a quick listing) can skip the sessions and the extra
requests.
"""

from bs4 import BeautifulSoup
import requests

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


def _make_source(source_type, resource_id, resource_url, content_url):
    """Build the nested provenance block and the global id derived from it.

    `resource_url` is where to look up this thing in its native system;
    `content_url` is specifically where the `content` field's text came
    from, which for Docs and Drive is a *different* endpoint than
    `resource_url` (see module docstring) -- None when there genuinely
    isn't a single-resource content endpoint (a Drive folder).
    """
    return f"{source_type}:{resource_id}", {
        "type": source_type,
        "resource_id": resource_id,
        "resource_url": resource_url,
        "content_url": content_url,
    }


def _normalize_doc(item, base_url, session=None):
    """Normalize one Docs (Impress) document."""
    content = item.get("excerpt") or ""
    if session is not None and item.get("id"):
        try:
            content = docs_client.get_content(session, item["id"], base_url=base_url) or content
        except (requests.RequestException, RuntimeError):
            pass

    resource_id = str(item.get("id", ""))
    resource_url = f"{base_url.rstrip('/')}/api/v1.0/documents/{resource_id}/"
    global_id, source = _make_source(
        "docs", resource_id, resource_url, f"{resource_url}content/"
    )

    return {
        "id": global_id,
        "title": item.get("title") or "",
        "author": _extract_author(item.get("creator")),
        "date": item.get("updated_at") or item.get("created_at") or "",
        "content": content,
        "source": source,
    }


def _normalize_drive(item, base_url, session=None):
    """Normalize one Drive item (file or folder)."""
    content = item.get("description") or ""
    is_file = item.get("type") == "file"
    is_text_file = is_file and (item.get("mimetype") or "").startswith("text/")
    if session is not None and is_text_file:
        # Only decode text files -- images/PDFs/office docs would need OCR
        # or format-specific parsing to turn into LLM-readable text, which
        # is out of scope here.
        try:
            raw_bytes = drive_client.download_item(session, item["id"], base_url=base_url)
            content = raw_bytes.decode("utf-8", errors="replace") or content
        except (requests.RequestException, UnicodeDecodeError):
            pass

    resource_id = str(item.get("id", ""))
    resource_url = (
        item.get("url_permalink")
        or item.get("url")
        or f"{base_url.rstrip('/')}/api/v1.0/items/{resource_id}/"
    )
    # Folders have no single-resource content endpoint of their own
    # (download_folder_export() gives a zip of *children*, not one body).
    content_url = f"{base_url.rstrip('/')}/api/v1.0/items/{resource_id}/download/" if is_file else None
    global_id, source = _make_source("drive", resource_id, resource_url, content_url)

    return {
        "id": global_id,
        "title": item.get("title") or item.get("filename") or "",
        "author": _extract_author(item.get("creator")),
        "date": item.get("updated_at") or item.get("created_at") or "",
        "content": content,
        "source": source,
    }


def _extract_body_text(item):
    """Pull plain text out of a JMAP-style message's textBody/htmlBody parts."""
    for key in ("textBody", "htmlBody"):
        parts = item.get(key) or []
        if parts and parts[0].get("content"):
            return BeautifulSoup(parts[0]["content"], "html.parser").get_text(
                separator=" ", strip=True
            )
    return item.get("snippet") or ""


def _normalize_message(item, base_url):
    """Normalize one Messages email."""
    sender = item.get("sender") or item.get("from") or {}
    if isinstance(sender, dict):
        author = sender.get("name") or sender.get("email") or ""
    else:
        author = str(sender)

    resource_id = str(item.get("id", ""))
    # Unlike Docs/Drive, Messages has no separate content endpoint -- the
    # message resource itself already carries htmlBody/textBody, so
    # content_url and resource_url are genuinely the same URL here, not a
    # stand-in for a missing one.
    resource_url = f"{base_url.rstrip('/')}/api/v1.0/messages/{resource_id}/"
    global_id, source = _make_source("messages", resource_id, resource_url, resource_url)

    return {
        "id": global_id,
        "title": item.get("subject") or "",
        "author": author,
        "date": (
            item.get("sent_at")
            or item.get("received_at")
            or item.get("date")
            or item.get("created_at")
            or ""
        ),
        "content": _extract_body_text(item),
        "source": source,
    }


def _as_list(raw):
    """Handle both paginated {'results': [...]} and plain list responses."""
    if isinstance(raw, dict):
        return raw.get("results") or []
    return raw or []


def normalize_items(raw_docs, raw_drive, raw_messages,
                    docs_base_url=docs_client.BASE_URL,
                    drive_base_url=drive_client.BASE_URL,
                    messages_base_url=messages_client.BASE_URL,
                    docs_session=None, drive_session=None):
    """
    Convert raw connector payloads into a unified list of item dicts.

    Each item has:
        id       – global id, "{source.type}:{source.resource_id}"; unique
                   even across sources, since raw upstream ids from
                   different services are never guaranteed distinct
        title    – document title or email subject
        author   – creator full name or sender name
        date     – ISO 8601 string (updated_at / sent_at / …)
        content  – body text (see module docstring for how each source is
                   actually fetched)
        source   – provenance block:
            type         – "docs" | "drive" | "messages" (matches each
                           connector module's own name, not an abbreviation)
            resource_id  – the raw id from the upstream service
            resource_url – where to look this item up in its native system
            content_url  – where `content` came from; may differ from
                           resource_url (Docs/Drive's metadata endpoint
                           can't return the body at all), may equal it
                           (Messages, whose one endpoint returns both), or
                           be None (a Drive folder, which has no
                           single-resource body of its own)

    Pass `docs_session` / `drive_session` (authenticated sessions from
    docs_client.login() / drive_client.login()) to fetch real content for
    docs and drive items -- one extra request per item. Messages content is
    already in the list payload, no session needed for it.
    """
    result = []
    for raw in _as_list(raw_docs):
        result.append(_normalize_doc(raw, docs_base_url, docs_session))
    for raw in _as_list(raw_drive):
        result.append(_normalize_drive(raw, drive_base_url, drive_session))
    for raw in _as_list(raw_messages):
        result.append(_normalize_message(raw, messages_base_url))
    return result
