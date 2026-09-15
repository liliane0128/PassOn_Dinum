# Server (nginx)

## What this is for

The project is two separate programs: a React app built by Vite
(`src/frontend`) and a Django API (`src/backend`). Run on their own they sit on
two different ports, which means the browser treats them as two different
origins — the frontend would need CORS headers to call the API, session cookies
would not be shared, and every API URL would have to be configured per
environment.

nginx removes that problem by putting both behind one origin. It serves the
compiled frontend from disk and forwards everything Django owns to the `web`
container, so the browser only ever talks to **http://localhost:8080** and the
frontend can call `/api/...` as a plain relative URL.

```
browser ---> nginx (:8080) ---> /           static files (React build)
                           \--> /api/       web:8000  (Django)
                            \-> /admin/     web:8000
                             \> /static/    web:8000  (admin CSS/JS)
```

## Files

| File | Role |
| --- | --- |
| `conf.d/default.conf` | the nginx site: what is served, what is proxied |
| `Dockerfile` | two stages — build the React app with Node, then serve it with nginx |

The stack itself is wired up in the repository root: `docker-compose.yml`
(services `web` and `nginx`) and `Makefile` (`make up` / `down` / `logs`).

## Running it

From the repository root, `make up`. See the [root README](../../README.md).

The frontend is compiled **into the image** (`npm run build` in the Dockerfile's
first stage), so frontend changes only appear after another `make up`, which
rebuilds it. For day-to-day frontend work, run the Vite dev server directly
(`cd src/frontend && npm run dev`) and keep hot reload.

## Decisions worth knowing

- **`try_files $uri $uri/ /index.html`** — React Router owns the routes
  (`/`, `/manager`, `/moi`). Without this fallback, nginx would look for a file
  called `manager` on disk and return 404 whenever someone refreshes the page
  or pastes a URL. Sending `index.html` instead lets the app boot and resolve
  the route itself.
- **`proxy_read_timeout 300s` on `/api/`** — `/api/dossier/` lists items from
  three upstream services and then waits on an LLM call. nginx's 60s default
  would cut that off and return 504.
- **`proxy_set_header Host $host`** — `$host` drops the `:8080` port, which
  matches Django's `DEBUG` fallback for `ALLOWED_HOSTS` (`localhost`,
  `127.0.0.1`, `[::1]`). Passing `$http_host` instead would send
  `localhost:8080` and require an explicit `ALLOWED_HOSTS` entry.
- **`expires 1y` on `/assets/`, not `add_header Cache-Control`** — Vite writes
  content-hashed filenames there, so they can be cached hard. A location-level
  `add_header` would drop the `X-Frame-Options` and `X-Robots-Tag` headers
  inherited from the server block; `expires` does not. `/index.html` is
  explicitly not cached, otherwise a rebuilt app would keep asking for the
  previous build's hashed filenames.
- **Django is not published on a host port** — the compose file exposes it to
  nginx only, so there is a single way in and no second URL to keep in sync.
  `src/backend/docker-compose.yml` still publishes port 8000 for backend-only
  work; the two stacks use different project and container names and can run at
  the same time.
- **No `environment:` block for `web` in the root compose file** — `settings.py`
  calls `load_dotenv("/app/.env")` and `/app` is the bind mount, so
  `src/backend/.env` stays the single place configuration lives. Compose-level
  variables would take priority over that file and silently blank out anything
  it defines (`GROQ_API_KEY: ${GROQ_API_KEY:-}` being the obvious trap).

## Not done here

- **Upstream services are still on their own origins.** The connectors API asks
  for `X-Docs-Session` / `X-Drive-Session` / `X-Messages-Session` headers
  because Docs/Drive/Messages cookies do not cross ports. nginx could proxy
  those three under this origin as well and make their cookies work directly,
  but that changes the API's authentication contract, so it has not been done
  unilaterally.
- **Django still runs through `runserver`**, the development server. nginx does
  not change that; a real deployment would put gunicorn (or similar) behind it
  and serve collected static files from disk rather than proxying `/static/`.
- **No TLS.** Everything is plain HTTP on localhost.
