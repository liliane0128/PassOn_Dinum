<p align="center">
  <a href="https://github.com/liliane0128/Relais_Dinum">
    <img alt="Pass'on" src="src/frontend/src/assets/suite-logo.svg" width="120" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/liliane0128/Relais_Dinum/stargazers/">
    <img src="https://img.shields.io/github/stars/liliane0128/Relais_Dinum" alt="Stars" />
  </a>
  <a href="https://github.com/liliane0128/Relais_Dinum/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/liliane0128/Relais_Dinum" />
  </a>
</p>

<p align="center">
  <a href="#getting-started-">Getting started</a> ·
  <a href="src/backend/connectors/README.md">Connectors</a> ·
  <a href="src/backend/accounts/README.md">Accounts</a> ·
  <a href="src/backend/passon/README.md">Schema</a>
</p>

# Pass'on: Handover Assistant

**Pass'on reads a colleague's Docs, Drive and Messages to generate a structured handover sheet — powered by an LLM.**

## Why use Pass'on ❓

* 📋 Pulls documents, files and emails from the three La Suite services automatically
* 🤖 Extracts six structured handover sections via LLM (needs `GROQ_API_KEY`)
* 🔑 Login with your existing Drive account — no separate account needed
* 🛡️ Runs on mock data without any upstream service for quick local testing
* 🗄️ Stores collaborators and handover sheets in a local Postgres database

## Getting started 🔧

### Prerequisites

- Docker
- Docker Compose
- GNU Make

```bash
$ docker -v
$ docker compose version
```

### Bootstrap Pass'on

```bash
make up
```

Builds and starts nginx + Django + Postgres. The full app is on **http://localhost:8090**.

| URL | Served by |
|-----|-----------|
| `/`, `/manager`, `/moi` | React frontend |
| `/api/…` | Django backend |
| `/admin/`, `/static/` | Django admin |

On first run, copy the env template:

```bash
cp template.env .env
cp src/backend/.env.example src/backend/.env
```

By default `DINUM_USE_MOCK=true` — the app runs on demo data without Docs, Drive or Messages.

### Login

Pass'on has no accounts of its own. Log in with your **Drive** credentials:

```
POST /api/auth/login/   {"email": "...", "password": "..."}
```

With `DINUM_USE_MOCK=true`, demo accounts are accepted without Drive running.

### Useful commands

```bash
make up      # build and start the full stack
make down    # stop everything
make logs    # follow logs

make run     # backend only (Django on http://localhost:8000)
make stop    # stop backend stack
make build   # rebuild images
```

Frontend dev server (hot reload, mock data):

```bash
cd src/frontend && npm install && npm run dev
# → http://localhost:5173
```

## Running alongside upstream services 🔌

Pass'on reads real data from **Docs**, **Drive** and **Messages**. Each is an independent Docker Compose stack.

### Upstream ports

These are each project's own defaults, as published by their compose files:

| Service | API | Frontend | Keycloak |
|---------|-----|----------|----------|
| Drive | http://localhost:8071 | http://localhost:3000 | localhost:8083 (8080 direct) |
| Messages | http://localhost:8901 | http://localhost:8900 | localhost:8902 |
| Docs | http://localhost:8071 | http://localhost:3000 | — |

> [!WARNING]
> **Docs and Drive both default to 8071**, and both serve a frontend on 3000.
> Running the two together means moving one of them and setting `DOCS_URL` or
> `DRIVE_URL` accordingly — otherwise calls meant for one land on the other.
> Only Drive and Messages are needed for login and for generating a handover.

> [!NOTE]
> Drive's Keycloak occupies **8080**, which is why Pass'on serves on 8090.

> [!TIP]
> **[docs/deploiement.md](docs/deploiement.md)** covers this end to end: start-up
> order, creating an account that works in both Keycloaks (Messages disables
> registration and refuses to create a user whose email domain is not
> "autojoin"), and a table mapping each failure message to its cause. Most of it
> is not guessable.

### Start each service

```bash
# Docs
cd /path/to/docs && make bootstrap FLUSH_ARGS='--no-input' && make run

# Drive
cd /path/to/drive && make bootstrap && make demo && make run

# Messages
cd /path/to/messages && make bootstrap
# then seed demo mail:
docker compose exec -e DJANGO_CONFIGURATION=E2E backend-dev-light \
    python manage.py e2e_demo
```

### Default credentials

| Service | Username | Password |
|---------|----------|----------|
| Docs | `impress` | `impress` |
| Drive | `drive` | `drive` |
| Messages | `user1@example.local` | `user1` |

### Session cookies

| Service | Cookie name |
|---------|-------------|
| Docs | `docs_sessionid` |
| Drive | `drive_sessionid` |
| Messages | `st_messages_sessionid` |

> [!WARNING]
> Set `DINUM_USE_MOCK=false` and `DRIVE_URL` in `src/backend/.env` before connecting to a real Drive instance.
> See [the accounts doc](src/backend/accounts/README.md) for the CSRF handshake and Keycloak quirks.

## Database 🗄️

One Postgres instance, shared by both stacks (`make up` and `make run`).

| Table | What |
|-------|------|
| `Collaborator` | One row per person — role, team, reporting line |
| `Handover` | Handover sheet: free text + six structured sections, validated or not |

To seed demo data in Drive and Messages:

```bash
docker compose exec web python manage.py seed_demo --email ... --password ...
```

It uploads five documents to that person's Drive and delivers six mails to their
mailbox, written so every section of the generated handover has something to
find. See [demo_data](src/backend/passon/demo_data/README.md).

## Contributing 🙌

PRs are welcome — open an issue to discuss anything substantial first.

Per-area documentation: [connectors](src/backend/connectors/README.md) (the
upstream clients and the LLM pipeline), [accounts](src/backend/accounts/README.md)
(login), [schema](src/backend/passon/README.md) (collaborators and handovers),
[server](src/server/README.md) (nginx and the single-origin setup),
[frontend](src/frontend/DOCUMENTATION.md).

## License 📝

This work is released under the MIT License.

## Gov ❤️ open source

Pass'on is part of the **La Suite Numérique** ecosystem, a joint initiative led by [DINUM](https://www.numerique.gouv.fr/dinum/).
