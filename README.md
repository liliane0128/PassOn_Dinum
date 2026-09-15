# Pass‘on Dinum

## Run the whole app (`make up`)

nginx serves the built React app and proxies the API to Django, so everything
lives on a single port.

```bash
make up    # builds and starts nginx + Django
make down  # stops them
make logs  # follows both containers' logs
```

Everything is on **http://localhost:8090**:

| URL | Served by |
| --- | --- |
| `/`, `/manager`, `/moi` | the built React app (`src/frontend`) |
| `/api/...` | Django (`src/backend`, see the connectors doc below) |
| `/admin/`, `/static/` | Django admin |

Configuration lives in `src/backend/.env`, created from `.env.example` on the
first `make up`. It defaults to `DINUM_USE_MOCK=true`, so the app runs on demo
data without Docs/Drive/Messages running and without any credential.

The React build is baked into the nginx image, so **run `make up` again after
changing the frontend** — see [`src/server/README.md`](src/server/README.md)
for what the nginx layer does and why.

## Working on a single part

Backend alone — Django on **http://localhost:8000**, no frontend, no nginx.
From the repository root (this is `make`'s default target):

```bash
make run     # starts Django + the postgres container, opens the browser
make build   # rebuilds their images
make stop    # stops them
```

This stack reads the repository-root `.env` for the postgres credentials.
Copy `template.env` to `.env` on a fresh clone. Django itself still uses
SQLite, so the postgres service is in place for a future migration but is not
wired up yet.

Note that you cannot log in from this stack: the login screen is served by the
frontend, and the session cookies need the app and the API on one origin, which
is what `make up` provides.

Frontend alone — Vite dev server with hot reload on **http://localhost:5173**,
mock data, no backend:

```bash
cd src/frontend
npm install
npm run dev
```

See `src/frontend/PLAN.md` and `src/frontend/DOCUMENTATION.md` for the
project's scope and design decisions.

## Logging in

Pass‘on has no accounts of its own: users log in with their **Drive** email and
password, which is checked against the local Drive instance. A successful login
also yields the Drive session needed to read that person's documents.

| Route | Method |
| --- | --- |
| `/api/auth/login/` | POST `{"email": ..., "password": ...}` |
| `/api/auth/logout/` | POST |
| `/api/auth/me/` | GET |

The login screen of the app uses these routes, so signing in there signs you into
Drive's data as well.

With `DINUM_USE_MOCK=true`, demo accounts are accepted without Drive running. To check credentials against a real Drive, set `DINUM_USE_MOCK=false`
and `DRIVE_URL` in `src/backend/.env`, and start Drive separately.
See [the accounts doc](src/backend/accounts/README.md) for the routes, the CSRF
handshake the frontend needs, and the Keycloak quirks involved.

## Service APIs

Docs, Drive, and Messages share read-only Django routes under `/api/`.
See [connector setup, authentication, and limitations](src/backend/connectors/README.md).
Those routes are reachable at `http://localhost:8090/api/` through the full
stack, and at `http://localhost:8000/api/` when running the backend alone.
