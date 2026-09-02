# Contributing to Wervelnieuws

This guide is intended for developers working on Wervelnieuws from their own workstation. Local development must not depend on production infrastructure, production data or production credentials.

## Prerequisites

Install:

- Git
- Docker Desktop, or Docker Engine with Docker Compose v2
- access to the private `MrMevius/wervelnieuws` repository

No production server, SSH or VPN access is required for normal development.

## First-time setup

Clone the repository and enter the project directory:

```bash
git clone https://github.com/MrMevius/wervelnieuws.git
cd wervelnieuws
```

Create a local environment file from the committed example.

Linux/macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

The committed `.env.example` contains development-safe defaults and empty integration credentials. Never copy production secrets into the repository.

Start the isolated development stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The development stack:

- uses its own Docker volume for SQLite and generated/uploaded data;
- runs migrations automatically before the application starts;
- creates the local development admin account idempotently;
- bind-mounts backend and worker source code from the checkout;
- runs the FastAPI backend with reload enabled;
- runs the Vite frontend development server;
- exposes the frontend and API only on localhost.

Open:

- frontend: `http://localhost:5173`
- backend API documentation: `http://localhost:8001/docs`

Development login:

- username: `admin`
- password: `admin12345`

These credentials are for the isolated local development database only and must never be used in production.

## Development data lifecycle

Stop the stack while preserving local development data:

```bash
docker compose -f docker-compose.dev.yml down
```

Reset the complete local development environment, including the SQLite database and frontend dependency volume:

```bash
docker compose -f docker-compose.dev.yml down -v
```

The `-v` variant is destructive for local development data only.

## Code changes

Create a branch for each logical change:

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Do not use production infrastructure as a development environment. Do not commit `.env`, databases, uploaded data, generated assets, API keys, tokens, passwords or other secrets.

Backend changes are reloaded automatically by Uvicorn. Frontend changes are reloaded by Vite. Restart the worker after changing worker behavior:

```bash
docker compose -f docker-compose.dev.yml restart worker
```

## Tests

Run backend tests:

```bash
cd backend
pytest
```

Run frontend tests and a production build before submitting significant frontend changes:

```bash
cd frontend
npm test
npm run build
```

GitHub Actions also runs the repository CI on pushes and Pull Requests.

## Pull Request workflow

Push the feature branch:

```bash
git add .
git commit -m "Describe the change"
git push -u origin HEAD
```

Open a Pull Request to `main`. Normal collaboration should use feature branches and Pull Requests rather than direct pushes to `main`.

Before requesting review:

- keep the change scoped to one logical purpose;
- run relevant tests;
- update documentation/config examples when behavior changes;
- update the website changelog when completing an iteration, as required by `AGENTS.md`;
- verify that no secrets or local runtime data are included.

## Production boundary

The normal development workflow deliberately stops at GitHub. Production deployment, production credentials and production data are separate concerns and are not required for contributors.

Production lifecycle, release, migration, backup and rollback procedures are maintained in [docs/docker-compose-operations.md](docs/docker-compose-operations.md) and [docs/release-readiness.md](docs/release-readiness.md). Do not substitute `docker-compose.dev.yml` for the production deployment procedure.
