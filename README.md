# Pass‘on Dinum

## Run the whole app (`make up`)

nginx serves the built React app and proxies the API to Django, so everything
lives on a single port.

```bash
make up    # builds and starts nginx + Django
make down  # stops them
make logs  # follows both containers' logs
```

Everything is on **http://localhost:8080**:

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

Backend alone — Django on **http://localhost:8000**, no frontend, no nginx:

```bash
cd src/backend
make up
make down
```

Frontend alone — Vite dev server with hot reload on **http://localhost:5173**,
mock data, no backend:

```bash
cd src/frontend
npm install
npm run dev
```

See `src/frontend/PLAN.md` and `src/frontend/DOCUMENTATION.md` for the
project's scope and design decisions.

## Service APIs

Docs, Drive, and Messages share read-only Django routes under `/api/`.
See [connector setup, authentication, and limitations](src/backend/connectors/README.md).
Those routes are reachable at `http://localhost:8080/api/` through the full
stack, and at `http://localhost:8000/api/` when running the backend alone.
