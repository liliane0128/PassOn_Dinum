# Unified read-only API

Start the backend with `docker compose up --build -d` from `src/backend`.
Start the three upstream services separately.

| Service | List | Detail | Session header |
| --- | --- | --- | --- |
| Docs | `/api/docs/items/` | `/api/docs/items/<uuid>/` | `X-Docs-Session` |
| Drive | `/api/drive/items/` | `/api/drive/items/<uuid>/` | `X-Drive-Session` |
| Messages | `/api/messages/items/` | `/api/messages/items/<uuid>/` | `X-Messages-Session` |

Docs also supports `/api/docs/documents/`; Messages supports
`/api/messages/messages/`, including the corresponding detail routes.
Responses use `{"service": "docs", "data": ...}`. The data is the existing
connector result, without changing its schema.

Each call uses the caller's upstream session, supplied by the header above or
its cookie. Docs uses `docs_sessionid`, Drive uses `drive_sessionid`, Messages
uses `st_messages_sessionid` (its `SESSION_COOKIE_NAME`; override via
`MESSAGES_SESSION_COOKIE` if a deployment changes it). Headers take precedence
over cookies. No shared account or automatic demo login is used by the Django
API. Log into each upstream app first. The existing Docs and Messages
`login()` helpers remain unchanged and available for manual local scripts;
they are not exposed as web login endpoints.

Example after setting DRIVE_SESSION locally to your session value:

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" http://localhost:8000/api/drive/items/
```

Configuration: copy `src/backend/.env.example` to `.env` for Compose.
For host-run Django, export service URLs using `localhost` instead of
`host.docker.internal`; Django does not load `.env` automatically.

Docs and Drive lists return the first page only. Messages reads every mailbox
the caller has access to (personal plus any shared mailbox), not just the
first one. Query parameters are rejected with 400 instead of silently
ignored. Pagination, unified login, writes, and frontend integration are not
implemented here.

Errors use `{"service": "...", "error": "..."}`. Missing credentials return
401; upstream 400/401/403/404/429 are preserved; timeouts return 504 and other
upstream failures return 502. Credentials and upstream bodies are not included
in errors. Requests have a timeout, do not follow redirects, and responses are
private/no-store. Only GET is supported.

## Normalized extraction API

`GET /api/extraction/items/` merges docs/drive/messages into one list of
LLM-ready items, each with real body content (not just metadata) and a
`source` block for traceability:

```json
{
  "id": "docs:b8eb2e3a-1a76-4026-af30-91da9eb7cb80",
  "title": "...", "author": "...", "date": "...", "content": "...",
  "source": {
    "type": "docs", "resource_id": "b8eb2e3a-...",
    "resource_url": "http://.../documents/b8eb2e3a-.../",
    "content_url": "http://.../documents/b8eb2e3a-.../content/"
  }
}
```

Send one or more of `X-Docs-Session` / `X-Drive-Session` / `X-Messages-Session`
(or their cookies) -- at least one is required, but not all three: a service
with no credential is skipped, not treated as an error. A service whose
credential *was* given but whose upstream call failed gets an entry in
`errors` (same codes as above) instead of failing the whole request, so a
partial result still comes back. See `extraction.py`'s module docstring for
where each source's `content` actually comes from and why `content_url` can
differ from `resource_url` (or be `null` for a Drive folder).

This endpoint always fetches real content, which costs one extra upstream
request per docs/drive item on top of the initial list call (Messages'
content is already inline, no extra request per item, but still one request
per mailbox and one per thread) -- fine for local/dev-sized data, not
something to point at a large account without pagination.

Run `python manage.py check` and `python manage.py test connectors`.
