"""
Extraction pipeline: normalize raw connector data, then extract structured
handover information with an LLM.

Content fetching note: neither service puts real body content on its
list/detail payloads --
  - Docs: `excerpt` is always null in practice; the actual text lives in a
    separate base64-encoded Yjs CRDT blob at .../content/ (see
    docs_client.get_content()).
  - Drive: `description` is a user-editable note field, not the file body;
    the actual bytes live at .../download/ for files (drive_client.
    download_item()) and there is no single-document "content" for a
    folder at all.
Passing `docs_session` / `drive_session` into normalize_items() below opts
into fetching real content for docs and drive items (one extra request per
item). Without a session, content falls back to the metadata field, which
in practice is almost always empty -- callers that only need titles/dates/
references (e.g. a quick listing) can skip the sessions and the extra
requests.
"""

import requests

from connectors import docs_client, drive_client


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


def _extract_author_email(user, directory=None):
    """The author's address: from the payload, or from a directory.

    Kept beside `author`, never folded into it: `author` is what reaches the
    model, and its prompt is left exactly as it was. The address is what the
    interface needs -- to list a document's owner as a contact worth writing
    to, and to tell whether that owner is the person looking at the page.

    Docs carries a creator's address when it has one, so the first branch is
    enough there. Drive does not: its item listing gives a creator's name and
    id and no address at all, which left a document owner matchable only by
    name and reachable not at all. `directory` closes that gap -- a map of
    user id to address that the caller builds from Drive's user search (see
    `connectors.views._drive_directory`). The lookup is by id, so it is exact
    rather than a name match, and an id that is absent simply yields nothing,
    exactly as before.
    """
    if not user or isinstance(user, str):
        return ""
    email = user.get("email") or ""
    if email:
        return email
    if directory:
        return directory.get(user.get("id")) or ""
    return ""


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
        "author_email": _extract_author_email(item.get("creator")),
        "date": item.get("updated_at") or item.get("created_at") or "",
        "content": content,
        "source": source,
    }


def _normalize_drive(item, base_url, session=None, directory=None):
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
        "author_email": _extract_author_email(item.get("creator"), directory),
        "date": item.get("updated_at") or item.get("created_at") or "",
        "content": content,
        "source": source,
    }


def _as_list(raw):
    """Handle both paginated {'results': [...]} and plain list responses."""
    if isinstance(raw, dict):
        return raw.get("results") or []
    return raw or []


def normalize_items(raw_docs, raw_drive,
                    docs_base_url=docs_client.BASE_URL,
                    drive_base_url=drive_client.BASE_URL,
                    docs_session=None, drive_session=None,
                    drive_directory=None):
    """
    Convert raw connector payloads into a unified list of item dicts.

    Each item has:
        id       – global id, "{source.type}:{source.resource_id}"; unique
                   even across sources, since raw upstream ids from
                   different services are never guaranteed distinct
        title    – the document's title
        author   – the creator's full name
        author_email
                 – the creator's address. Separate from `author`, which
                   keeps the display name: generation._trimmed() sends the model
                   id/title/author/date/content and nothing else, so this
                   field never reaches it. Drive publishes no address on its
                   items, so for those it is filled from `drive_directory`
                   and is empty without one
        date     – ISO 8601 string (updated_at / created_at)
        content  – body text (see module docstring for how each source is
                   actually fetched)
        source   – provenance block:
            type         – "docs" | "drive" (matches each connector
                           module's own name, not an abbreviation)
            resource_id  – the raw id from the upstream service
            resource_url – where to look this item up in its native system
            content_url  – where `content` came from; differs from
                           resource_url (neither service's metadata
                           endpoint can return the body at all), or is
                           None (a Drive folder, which has no
                           single-resource body of its own)

    Pass `docs_session` / `drive_session` (authenticated sessions from
    docs_client.login() / drive_client.login()) to fetch real content for
    docs and drive items -- one extra request per item.

    `drive_directory` maps a Drive user id to an address (see
    `drive_client.list_users`). Without it, Drive items come back with an
    empty `author_email`, since nothing in their own payload carries one.
    """
    result = []
    for raw in _as_list(raw_docs):
        result.append(_normalize_doc(raw, docs_base_url, docs_session))
    for raw in _as_list(raw_drive):
        result.append(
            _normalize_drive(raw, drive_base_url, drive_session, drive_directory)
        )
    return result
