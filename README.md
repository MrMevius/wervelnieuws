# Wervelnieuws

[![CI](https://github.com/MrMevius/wervelnieuws/actions/workflows/ci.yml/badge.svg)](https://github.com/MrMevius/wervelnieuws/actions/workflows/ci.yml)
[![Docker Smoke Build](https://github.com/MrMevius/wervelnieuws/actions/workflows/docker-smoke.yml/badge.svg)](https://github.com/MrMevius/wervelnieuws/actions/workflows/docker-smoke.yml)

Wervelnieuws is a self-hosted communication platform for a local wind-energy project. It combines source management, AI-assisted content generation, editorial review, scheduling and publication in one application.

The application is designed for a small editorial team. Generated content remains subject to human review before publication, and factual output must be grounded in uploaded source material or explicit topic notes.

## Source availability

This repository is publicly visible for transparency and reference purposes. Public visibility does not make the project open source and does not grant permission to copy, modify, redistribute, publish, sublicense or commercially use the source code.

Unless separately agreed in writing, all rights are reserved.

## What it does

The main workflow is:

1. Create a topic and add notes or source documents.
2. Extract and index relevant information from uploaded files.
3. Generate Dutch articles, summaries and illustrations with OpenAI.
4. Review and edit the generated content.
5. Approve and schedule publication.
6. Publish through configured channels such as the website, Facebook and Mailgun.
7. Track publication state, retries, notifications, versions and audit history.

Supported source formats include PDF, DOCX, XLSX, TXT and Markdown.

## Technology

| Component | Technology |
| --- | --- |
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Frontend | React, TypeScript, Vite |
| Worker | Python scheduler/worker |
| Database | SQLite in v1, structured for later PostgreSQL migration |
| Storage | Local filesystem for uploads and generated assets |
| Deployment | Docker Compose |

## Repository structure

- `backend/` — API, domain logic, integrations, migrations and backend tests
- `frontend/` — React editorial dashboard
- `worker/` — scheduled publication and retry processing
- `docs/` — architecture, operations and feature-specific documentation
- `opsx/changes/` — active change specifications
- `docker-compose.yml` — production/server Compose definition
- `docker-compose.dev.yml` — isolated local development environment
- `CONTRIBUTING.md` — development and collaboration guide
- `SECURITY.md` — vulnerability reporting guidance
- `AGENTS.md` — repository rules for AI-assisted development

## Development setup

The following instructions are intended for maintainers and explicitly approved collaborators.

### Requirements

Install:

- Git
- Docker Desktop, or Docker Engine with Docker Compose v2
- repository access appropriate to your role

No production server, production data, VPN or production credentials are required for normal development.

### Start the local environment

Clone the repository:

```bash
git clone https://github.com/MrMevius/wervelnieuws.git
cd wervelnieuws
```

Create a local environment file.

Linux/macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the development stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The first start automatically prepares isolated local storage, applies database migrations and creates a development administrator.

Open:

- application: `http://localhost:5173`
- API documentation: `http://localhost:8001/docs`

Local development login:

- username: `admin`
- password: `admin12345`

These credentials are only for the isolated local development database.

Stop the environment while keeping local data:

```bash
docker compose -f docker-compose.dev.yml down
```

Reset the complete local development environment, including its database:

```bash
docker compose -f docker-compose.dev.yml down -v
```

The `-v` command deletes local development data.

## Development workflow

For maintainers and approved collaborators:

1. update your local `main` branch;
2. create a short-lived feature or fix branch;
3. make and test the change;
4. push the branch;
5. open a Pull Request to `main`.

The complete workflow, test commands, secrets policy and reset instructions are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Configuration and secrets

`.env.example` documents the supported environment variables and contains development-safe defaults or empty integration values.

Do not commit:

- `.env` files;
- API keys or access tokens;
- passwords or private keys;
- local databases;
- uploaded or generated production data.

External integrations such as OpenAI, website publishing, Facebook, Mailgun, Telegram and n8n are configured through environment variables. Most are not required simply to start and inspect the local application.

## Testing and CI

Backend tests:

```bash
cd backend
pytest
```

Frontend tests and production build:

```bash
cd frontend
npm test
npm run build
```

GitHub Actions runs the main backend/frontend checks on pushes and Pull Requests. The Docker smoke workflow also validates the local development Compose configuration and production image builds.

## Production and operations

Production deployment is deliberately separate from local development. Do not use production data or credentials for development and do not use `docker-compose.dev.yml` as the production deployment definition.

Production lifecycle, migration, backup and rollback procedures are documented in [docs/docker-compose-operations.md](docs/docker-compose-operations.md). Operational database/storage rollback guidance is documented in [docs/urenregistratie.md](docs/urenregistratie.md). Release preflight requirements are documented separately in [docs/release-readiness.md](docs/release-readiness.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Docker Compose operations](docs/docker-compose-operations.md)
- [Release readiness](docs/release-readiness.md)
- [n8n notifications](docs/n8n-notifications.md)
- [Hour registration](docs/urenregistratie.md)
- [Changelog guidelines](docs/changelog-guidelines.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [AI-assisted repository rules](AGENTS.md)
