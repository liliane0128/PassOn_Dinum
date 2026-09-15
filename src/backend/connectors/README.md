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
its cookie. Docs uses `docs_sessionid`, Drive uses `drive_sessionid`.
For Messages configure `MESSAGES_SESSION_COOKIE` to the actual deployment cookie
name (default `sessionid`; confirm this in the running Messages deployment).
Headers take precedence over cookies. No shared account or automatic demo login
is used by the Django API. Log into each upstream app first. The existing Docs
and Messages `login()` helpers remain unchanged and available for manual local
scripts; they are not exposed as web login endpoints.

Example after setting DRIVE_SESSION locally to your session value:

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" http://localhost:8000/api/drive/items/
```

Configuration: copy `src/backend/.env.example` to `.env` for Compose.
For host-run Django, export service URLs using `localhost` instead of
`host.docker.internal`; Django does not load `.env` automatically.

The existing Docs and Messages clients are preserved without modifications.
Docs and Drive lists return the first page only. Messages reads the first mailbox
as before. Query parameters are rejected with 400 instead of silently ignored.
Pagination, mailbox selection, unified login, writes, and frontend integration
are not implemented here.

Errors use `{"service": "...", "error": "..."}`. Missing credentials return
401; upstream 400/401/403/404/429 are preserved; timeouts return 504 and other
upstream failures return 502. Credentials and upstream bodies are not included
in errors. Requests have a timeout, do not follow redirects, and responses are
private/no-store. Only GET is supported.

Run `python manage.py check` and `python manage.py test connectors`.
