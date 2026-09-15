# Relais Dinum

## Backend (`src/backend`)

Django, run via Docker.

```bash
cd src/backend
make up    # builds and starts the container, opens http://localhost:8000
make down  # stops the container
```

Runs by default on **http://localhost:8000**.

## Frontend (`src/frontend`)

React + JavaScript (Vite), using the `@gouvfr-lasuite/ui-components` design system.

```bash
cd src/frontend
npm install
npm run dev
```

Runs by default on **http://localhost:5173**.

See `src/frontend/PLAN.md` and `src/frontend/DOCUMENTATION.md` for the project's scope and design decisions.

## Service APIs

Docs, Drive, and Messages now share read-only Django routes under `/api/`.
See [connector setup, authentication, and limitations](src/backend/connectors/README.md).
