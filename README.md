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

Data lives in **postgres**, started as part of both stacks. The full stack keeps
its database in a Docker-managed volume (`passon-db`) rather than the
`./database` directory the backend-only stack uses, so the two never write to
the same files; credentials come from the repository-root `.env` (copy
`template.env` on a fresh clone).

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
make run     # starts postgres + Django, opens the browser
make build   # rebuilds the images
make stop    # stops everything
```

Same `docker-compose.yml`, same postgres, same data as `make up` — it just
leaves nginx and the compiled frontend out.

Note that you cannot log in *from the interface* this way: the login screen is
served by the frontend, and the session cookies need the app and the API on one
origin, which is what `make up` provides. The API itself works on :8000 for
curl.

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

The login screen of the app uses these routes, so signing in there also gives
the app access to that person's Drive files and, when the same account exists in
Messages' own Keycloak, their mail. The response's `services` field says which
ones answered.

Once logged in, the app shows that user's **real** items (`/api/extraction/items/`)
and can generate the AI handover from them (`/api/dossier/`, needs `GROQ_API_KEY`).
Other collaborators in the manager view keep showing mock data — we can only read
files for the account whose session we hold.

With `DINUM_USE_MOCK=true`, demo accounts are accepted without Drive running. To check credentials against a real Drive, set `DINUM_USE_MOCK=false`
and `DRIVE_URL` in `src/backend/.env`, and start Drive separately.
See [the accounts doc](src/backend/accounts/README.md) for the routes, the CSRF
handshake the frontend needs, and the Keycloak quirks involved.

## Database

One postgres, started by both `make up` and `make run`. Besides Django's own
tables (sessions, admin), it holds the project's two:

| Table | What |
| --- | --- |
| `Collaborator` | one row per person — role, team, and who they report to |
| `Handover` | their handover sheet: text, the six structured sections, validated or not |

See [the schema and why it looks like that](src/backend/passon/README.md).
To rebuild the demo documents and mails in Drive and Messages:
`python manage.py seed_demo --email ... --password ...`.
Nothing writes to these yet — login still does not create a collaborator.

## Service APIs

Docs, Drive, and Messages share read-only Django routes under `/api/`.
See [connector setup, authentication, and limitations](src/backend/connectors/README.md).
Those routes are reachable at `http://localhost:8090/api/` through the full
stack, and at `http://localhost:8000/api/` when running the backend alone.
