# Wervelnieuws

## Build status badges

Replace `OWNER/REPO` with your GitHub repository path.

- CI:

  [![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

- Docker smoke build:

  [![Docker Smoke Build](https://github.com/OWNER/REPO/actions/workflows/docker-smoke.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/docker-smoke.yml)

Wervelnieuws is a self-hosted communication automation platform for a Dutch local wind park project.
It supports topic management, local source ingestion, source-grounded AI generation, editorial review,
scheduled publication, multi-channel publishing, retries, notifications, and auditability.

## Stack

- Backend: FastAPI + SQLAlchemy + Alembic
- Frontend: React + TypeScript (Vite)
- Worker: Python scheduler/worker in a separate container
- Database: SQLite (v1), migration-friendly model for PostgreSQL later
- Storage: local filesystem for uploads and generated assets
- Deployment: Docker Compose

## Repository structure

- `backend/` API, domain models, services, integrations, migrations, tests
- `frontend/` React SPA for editorial dashboard
- `worker/` scheduler loop for publication and retries
- `docs/` architecture and operations notes
- `opsx/changes/` active change specifications

## Quick start (Docker)

1. Copy env template:

```bash
cp .env.example .env
```

2. Build and run:

```bash
docker compose up --build
```

3. Seed admin user:

```bash
docker compose run --rm backend python app/tasks/seed_admin.py
```

4. Open services:
- Frontend: `http://localhost:5173`
- Backend API docs: `http://localhost:8000/docs`

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
alembic upgrade head
python app/tasks/seed_admin.py
uvicorn app.main:app --reload
```

Run tests:

```bash
cd backend
pytest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Run tests:

```bash
cd frontend
npm test
```

## Core workflow

1. Create topic and add notes.
2. Upload local source documents (PDF, DOCX, XLSX, TXT, MD).
3. Ingestion extracts + chunks + indexes source text.
4. Generate Dutch article/summary/image from grounded source context.
5. Review/edit content and approve.
6. Schedule publication time.
7. Worker publishes to website, Facebook, and Mailgun at scheduled time.
8. Telegram sends success/error notifications.
9. Publication records, per-channel state, retries, and audit trail are persisted.

## Environment variables

See `.env.example` for all required values:
- auth and security keys
- OpenAI configuration
- Website/Facebook/Mailgun/Telegram adapter credentials
- storage and scheduler settings
- upload size and API rate-limit settings

## Operational safeguards

- Basic per-route in-memory rate limiting is enabled for login and document upload endpoints.
- Uploads are validated for allowed types and maximum file size.
- Worker retry jobs are executed by flow and use exponential backoff until max attempts.

## Release-readiness checklist

- `.env` values verified (secrets, endpoints, channel credentials).
- Migrations applied: `alembic upgrade head`.
- Backend tests green: `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`.
- Frontend tests green: `cd frontend && npm test`.
- Frontend production build green: `cd frontend && npm run build`.
- Docker images build cleanly: `docker compose build backend frontend worker`.
- Scheduler behavior spot-check: create scheduled item and verify channel states/audit updates.

## CI

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Triggers on push and pull requests.
- Runs:
  - backend test suite (`pytest`)
  - frontend tests (`npm test`)
  - frontend production build (`npm run build`)
- Additional PR-only Docker workflow: `.github/workflows/docker-smoke.yml`
  - prepares `.env` from `.env.example`
  - runs `docker compose build backend frontend worker`

## API highlights

- `POST /api/auth/login`
- `GET|POST|PATCH /api/topics`
- `POST /api/topics/{topic_id}/documents`
- `POST /api/content/{topic_id}/generate`
- `GET /api/content/{topic_id}/versions`
- `POST /api/content/{topic_id}/manual-edit`
- `POST /api/content/{topic_id}/rollback/{version_id}`
- `POST /api/content/{topic_id}/approve`
- `POST /api/content/{topic_id}/reject`
- `POST /api/content/{topic_id}/schedule`

## Known limitations and future v2 options

- Current scheduler is polling-based; v2 can use a queue broker for higher throughput.
- Frontend is functional but intentionally minimal; v2 can add richer side-by-side source tracing UX.
- Generation grounding enforcement is prompt-based + trace persistence; v2 can add stronger claim validation.
- Facebook update semantics may depend on page permissions and post types in production.
- SQLite is suitable for v1; v2 should migrate to PostgreSQL for concurrency and scale.
