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

All commands below are run from `src/backend`:

```sh
cd src/backend
```

1. **Create the virtualenv and install dependencies:**
   ```sh
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ```
   (Using `./venv/bin/python` / `./venv/bin/pip` directly, as every command
   below does, avoids needing to remember whether you've `source
   venv/bin/activate`d in the current shell.)
2. **Configure**: copy `.env.example` to `.env`, then edit `.env`:
   ```sh
   cp .env.example .env
   ```
   - To just try the pipeline with fake data, leave `DINUM_USE_MOCK=true` (the
     `.env.example` default) and skip straight to step 5 -- no upstream
     services or credentials needed.
   - To hit the real Docs/Drive/Messages, set `DINUM_USE_MOCK=false` and point
     `DOCS_URL`/`DRIVE_URL`/`MESSAGES_URL` at wherever those are running (start
     those three projects separately -- they are not part of this repo).
   - For `/api/dossier/`, set `GROQ_API_KEY` (a free key from
     https://console.groq.com/keys works fine for testing).

   `settings.py` loads `.env` automatically (`load_dotenv()`) -- you do not
   need to `export` these variables yourself. The one exception: if a
   variable of the same name is *already* exported in your shell (from an
   earlier `export DINUM_USE_MOCK=...`, for example), that shell value wins
   over `.env` and silently shadows it. If a setting doesn't seem to be taking
   effect, run `echo $VAR_NAME` to check, or just open a fresh terminal.
3. **Set up the database:**
   ```sh
   ./venv/bin/python manage.py migrate
   ```
4. **Run the checks:**
   ```sh
   ./venv/bin/python manage.py check
   ./venv/bin/python manage.py test connectors
   ```
5. **Run the server:**
   ```sh
   ./venv/bin/python manage.py runserver
   ```
   Or via Docker: `docker compose up --build -d` (reads `.env` through
   Compose's `env_file`/`environment` interpolation).

   **After every edit to `.env`, restart this process** (Ctrl-C, then rerun)
   -- unlike `.py` file changes, which the dev server's autoreloader picks up
   by itself, a running process never re-reads `.env`; it only loads it once,
   at startup.
6. **Try it** (in another terminal, while the server from step 5 is running):
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
its cookie. For Drive and Messages there is a third source: the sessions stored
when the user logged in through `/api/auth/login/`, which walks each service's
OIDC flow and keeps the resulting cookies server-side (see
`../accounts/README.md`). A logged-in caller therefore needs no
`X-Drive-Session` or `X-Messages-Session` of its own. An explicit header or
cookie still takes precedence, so manual calls behave exactly as described here.
Docs has no login flow, so it still requires one explicitly.

Links leaving these routes are rewritten to the public host before they are
returned: items carry URLs built from `DRIVE_URL` and friends, which is how
*this process* reaches the services (`host.docker.internal` inside a
container), and that name means nothing in a browser. `DINUM_PUBLIC_HOST`
(default `localhost`) is substituted, ports and paths untouched. Docs uses `docs_sessionid`, Drive uses `drive_sessionid`, Messages
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

Note on `.env`'s `DOCS_URL`/`DRIVE_URL`/`MESSAGES_URL` defaults: they point at
`host.docker.internal`, which only resolves from *inside* a Docker container
(used when running via `docker compose up`). Running `manage.py runserver`
directly on the host instead, set them to `localhost` (e.g.
`DOCS_URL=http://localhost:8071`) or requests will fail to connect.

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
`openai/gpt-oss-20b`), and returns the summary as **JSON** -- the shape the
interface stores as a handover (`text` plus the six sections).

The prompt asks the model to sort items into six sections -- ongoing actions,
key decisions, deadlines, blockers, key contacts, important documents. Each
bullet carries an `evidence` array, and `documents` entries a title and a link:
both are filled in here from the trusted input items, never from what the model
wrote, so an invented id is dropped rather than shown. That is what lets the
interface open a bullet and show the text it came from -- a `resource_url` is
often a REST endpoint rather than a page a browser can display.

Uses whichever services the caller has a credential for and skips the others,
the same rule `/api/extraction/items/` follows; at least one is required,
unless `DINUM_USE_MOCK=true`. Demanding all three would make the endpoint
unusable wherever one is simply not deployed, which is the normal case for Docs
today. Also requires `GROQ_API_KEY` for the
LLM call -- without it, the endpoint returns
`500 {"error": "llm_not_configured"}` instead of crashing.

Run `./venv/bin/python manage.py check` and
`./venv/bin/python manage.py test connectors`.
