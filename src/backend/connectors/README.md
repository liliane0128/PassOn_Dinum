# Connectors

## About this project

Pass‘on Dinum is an internal "business continuity" tool: given a colleague's
name, it gathers what they were working on -- their emails, documents, and
files -- from the different internal apps of the Suite Numérique (Docs,
Drive, Messages), so someone covering for them doesn't have to go hunting
across three separate logins. See the [frontend's
PLAN.md](../../frontend/PLAN.md) for the full product scope.

This `connectors/` module is the backend piece that makes that possible: it
talks to each of the three upstream services' own APIs, normalizes their very
different data shapes into one common format, and (optionally) asks an LLM to
turn that into a readable handover dossier with clickable links back to every
source.

## How it fits together

```
docs_client.py / drive_client.py / messages_client.py
        |  (login + list_items + get_item, one per service)
        v
   views.py  --  /api/<service>/items/        (raw per-service passthrough)
        |
        v
  extraction.py  --  normalize_items()          (unified id/title/author/
        |                                        date/content/source shape)
        |
        +---> views.py  --  /api/extraction/items/   (merged, partial-auth OK)
        |
        v
  generation.py  --  generate_dossier()          (single LLM call -> Markdown)
        |
        v
   views.py  --  /api/dossier/                  (downloadable .md file)
```

`mock_clients.py` / `mock_data.py` are drop-in replacements for the three
`*_client.py` files (same `list_items`/`get_item` signature), used when
`DINUM_USE_MOCK=true` so you can run and test the whole pipeline above
without any of the three upstream services actually running.

## Running this

1. **Install dependencies** (from `src/backend`):
   ```sh
   python3 -m venv venv
   source venv/bin/activate
   ./venv/bin/pip install -r requirements.txt
   ```
2. **Configure**: copy `.env.example` to `.env` and fill it in.
   - To just try the pipeline with fake data, set `DINUM_USE_MOCK=true` and
     skip straight to step 4 -- no upstream services or credentials needed.
   - To hit the real Docs/Drive/Messages, set `DOCS_URL`/`DRIVE_URL`/
     `MESSAGES_URL` to wherever those are running, and start those three
     projects separately (they are not part of this repo).
   - For `/api/dossier/`, set `GROQ_API_KEY` (a free key from
     https://console.groq.com/keys works fine for testing).
3. **Run the checks**:
   ```sh
   DINUM_USE_MOCK=true python manage.py check
   python manage.py test connectors
   ```
4. **Run the server** (Django does not load `.env` automatically -- either
   `export` the variables first, or prefix the command with them):
   ```sh
   DINUM_USE_MOCK=true python manage.py runserver
   ```
   Or via Docker: `docker compose up --build -d` (reads `.env` through
   Compose's `env_file`/`environment` interpolation, which does work).
5. **Try it**:
   ```sh
   curl http://localhost:8000/api/docs/items/ -H "X-Docs-Session: mock"
   curl http://localhost:8000/api/dossier/ -o handover_dossier.md
   ```
   (The `X-*-Session` header value is ignored in mock mode, but the request
   must still supply one -- see "Item routes" below.)

## Item routes: `/api/<service>/items/`

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

## Mock mode

Set `DINUM_USE_MOCK=true` to serve static demo data (`connectors/mock_data.py`)
instead of calling the upstream services -- useful when Docs/Drive/Messages
aren't running locally. In mock mode, `/api/<service>/items/` and
`/api/extraction/items/` don't require a credential. See `mock_clients.py`
for the swap-in clients (same `list_items`/`get_item` signature as the real
ones).

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
differ from `resource_url` (or be `null` for a Drive folder). In mock mode
(`DINUM_USE_MOCK=true`) this returns all three services' mock data with no
credential needed, same as the per-service item routes.

This endpoint always fetches real content, which costs one extra upstream
request per docs/drive item on top of the initial list call (Messages'
content is already inline, no extra request per item, but still one request
per mailbox and one per thread) -- fine for local/dev-sized data, not
something to point at a large account without pagination.

## Handover dossier (`/api/dossier/`)

`GET /api/dossier/` pulls each service's item list, normalizes them with
`extraction.normalize_items()` (unified `id/title/author/date/content/source`
shape, `source` being `{type, resource_id, resource_url, content_url}`),
sends them to Groq (`generation.py`, `groq` SDK, model `GROQ_MODEL`, default
`openai/gpt-oss-20b`), and returns the result as a downloadable Markdown file
(`Content-Disposition: attachment; filename="handover_dossier.md"`).

The prompt asks the model to sort items into six sections -- ongoing actions,
key decisions, deadlines, blockers, key contacts, important documents -- each
bullet ending in a Markdown link built from that item's `source.resource_url`
field, so every point in the file is clickable back to its source.

Requires the same per-service credentials as `/api/<service>/items/` (all
three), unless `DINUM_USE_MOCK=true`. Also requires `GROQ_API_KEY` for the
LLM call -- without it, the endpoint returns
`500 {"error": "llm_not_configured"}` instead of crashing.

Run `python manage.py check` and `python manage.py test connectors`.
