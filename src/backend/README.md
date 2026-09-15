# Docs / Drive API bridge

Start from this directory with `docker compose up --build -d`.
The API is available at http://localhost:8000/api/.
Start the upstream Docs and Drive stacks separately.

| GET route | Upstream path |
| --- | --- |
| /api/docs/me/ | /api/v1.0/users/me/ |
| /api/docs/documents/ | /api/v1.0/documents/ |
| /api/docs/documents/<uuid>/ | /api/v1.0/documents/<uuid>/ |
| /api/drive/me/ | /api/v1.0/users/me/ |
| /api/drive/items/ | /api/v1.0/items/ |
| /api/drive/items/<uuid>/ | /api/v1.0/items/<uuid>/ |

Query parameters, including pagination, pass through unchanged. JSON response bodies
are preserved. Absolute pagination URLs still point to the upstream service; clients
should use their query parameters on the corresponding local list route.

## Authentication

Each request must carry the upstream user's `docs_sessionid` or `drive_sessionid`
cookie. For manual API calls, `X-Docs-Session` / `X-Drive-Session` headers also work.
Never commit or share session values. There is no shared server-side account.

Log into each upstream app first. On localhost, cookies can be shared across ports
if their path and security attributes permit it. If they are not sent, inspect the
upstream cookie settings or use the headers for a manual test. This bridge does not
implement an OIDC login flow or refresh expired sessions.

Example, with DRIVE_SESSION already set locally:

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" 'http://localhost:8000/api/drive/items/?is_creator_me=true'
```

## Configuration

Copy `.env.example` to `.env` for Docker Compose overrides. Inside Docker, use
`host.docker.internal`; when running Django directly on the Mac, export `DOCS_URL`
and `DRIVE_URL` using `localhost`. Direct Django execution does not load `.env`.

Missing credentials return 401. Upstream 400/401/403/404/429 statuses are preserved
with a generic error body. Connection errors return 502 and timeouts return 504.
Upstream redirects are not followed. API responses are marked private/no-store.
Only GET is supported in this first integration; edits require a separate CSRF-aware flow.
Use a same-origin frontend proxy for `/api/` during development.

Run checks: `python manage.py check` and `python manage.py test integrations`.
