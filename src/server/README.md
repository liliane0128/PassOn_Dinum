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
container, so the browser only ever talks to **http://localhost:8090** and the
frontend can call `/api/...` as a plain relative URL.

```
browser ---> nginx (:8090) ---> /           static files (React build)
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
- **`proxy_set_header Host $http_host`, never `$host`** — `$host` drops the
  port, and Django compares the browser's `Origin` header
  (`http://localhost:8090`) against its own host when checking CSRF on a POST.
  Without the port that check fails with *"Origin checking failed"* and every
  login is rejected with a 403 before the credentials are even read. `curl`
  sends no `Origin` header, so it never reveals this — testing a POST route
  from the terminal alone will happily pass while the app is broken. Use
  `curl -H "Origin: http://localhost:8090"` to reproduce what a browser does.
  `ALLOWED_HOSTS` is unaffected either way: Django strips the port before
  validating the host.
- **`expires 1y` on `/assets/`, not `add_header Cache-Control`** — Vite writes
  content-hashed filenames there, so they can be cached hard. A location-level
  `add_header` would drop the `X-Frame-Options` and `X-Robots-Tag` headers
  inherited from the server block; `expires` does not. `/index.html` is
  explicitly not cached, otherwise a rebuilt app would keep asking for the
  previous build's hashed filenames.
- **Port 8090, not the more obvious 8080** — Drive's Keycloak publishes on
  8080, and the login flow needs Drive running (see
  `src/backend/accounts/README.md`), so the two would collide on any machine
  where both are up.
- **Django is published on 127.0.0.1:8000 as well** — `make run` serves the API
  without nginx for backend-only work, and curl and the tests use that port.
  The browser still goes through :8090, which is the only place the app and the
  API share an origin; anything that needs a session cookie has to use it.
- **One postgres, one compose file** — Django moved off SQLite, and sessions
  (so, logins) live in the database. There is a single definition at the
  repository root and a single named volume, so `make up` and `make run` are
  two service selections over the same database rather than two stacks with
  rival copies of the data.
- **Only the database credentials are set in `environment:` for `web`** — `settings.py`
  — everything else stays in `src/backend/.env`, which `settings.py` loads
  through the bind mount. Compose-level variables take priority over that file
  and would silently blank out anything it defines (`GROQ_API_KEY:
  ${GROQ_API_KEY:-}` being the obvious trap); the `POSTGRES_*` keys are safe
  because that file has no entry for them.

## Not done here

- **Docs and Messages are still on their own origins.** The connectors API asks
  for `X-Docs-Session` / `X-Messages-Session` headers because those services'
  cookies do not cross ports. Drive no longer needs one — logging in stores its
  session server-side (`src/backend/accounts/README.md`) — but the same is not
  yet done for the other two. nginx could alternatively proxy them under this
  origin, which changes the API's authentication contract, so it has not been
  done unilaterally.
- **Django still runs through `runserver`**, the development server. nginx does
  not change that; a real deployment would put gunicorn (or similar) behind it
  and serve collected static files from disk rather than proxying `/static/`.
- **No TLS.** Everything is plain HTTP on localhost.
