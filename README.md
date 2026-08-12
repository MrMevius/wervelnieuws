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
  - `docs/urenregistratie.md` explains inline hour entry, central project/global post management, filters, CSV, record-level restore, and operational database/storage rollback
- `opsx/changes/` active change specifications

## Quick start (Docker)

1. Maak servermappen aan voor data en config:

```bash
sudo mkdir -p /mnt/wervelwind/database/config
```

2. Plaats configbestand op de serverlocatie:

```bash
cp .env.example /mnt/wervelwind/database/config/.env
```

3. Build and run:

```bash
docker compose up --build
```

4. Seed admin user:

```bash
docker compose run --rm backend python app/tasks/seed_admin.py
```

5. Open services:
- Frontend: `http://localhost:5173`
- Backend API docs: `http://localhost:8000/docs`

### Server path permissions checklist

For bind mounts to work reliably, verify ownership and permissions on the host path:

```bash
sudo mkdir -p /mnt/wervelwind/database/config
sudo chown -R $USER:$USER /mnt/wervelwind/database
sudo chmod -R u+rwX,g+rX /mnt/wervelwind/database
```

If your Docker engine runs as a different user/group, set ownership accordingly.

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
8. n8n receives success/error notifications and can forward to Telegram.
9. Publication records, per-channel state, retries, and audit trail are persisted.

## Topic audio runtime

Topic audio is limited server-side to exactly `250000000` bytes and 180 minutes. The backend runtime image includes `ffprobe` and runs as the non-root `app` user (default UID/GID `1000`). Its default `TOPIC_AUDIO_TMP_ROOT` is owned by that user with mode `0700` and must remain outside `STORAGE_ROOT`.

For bind-mounted storage, build with `APP_UID`/`APP_GID` matching the host-directory owner (the Compose deployment currently uses UID/GID `1000`) and keep the directories owned by that identity instead of making them world-writable. If `TOPIC_AUDIO_TMP_ROOT` is overridden with a mounted path, pre-create it with the same ownership and mode `0700`. Before deployment run: `docker compose run --rm --no-deps backend sh -lc 'test "$(id -u)" -ne 0 && ffprobe -version >/dev/null && test -w /data && test -w "${TOPIC_AUDIO_TMP_ROOT:-/tmp/wervelnieuws-topic-audio}"'`.

## Environment variables

See `.env.example` for all required values (deploy path: `/mnt/wervelwind/database/config/.env`):
- auth and security keys
- OpenAI configuration
- Website/Facebook/Mailgun/Telegram adapter credentials
- storage and scheduler settings
- upload size and API rate-limit settings
- frontend API target via `VITE_API_BASE_URL` (Compose default: `http://localhost:8001/api`)

## Operational safeguards

- Basic per-route in-memory rate limiting is enabled for login and document upload endpoints.
- Uploads are validated for allowed types and maximum file size.
- Worker retry jobs are executed by flow and use exponential backoff until max attempts.

## Release-readiness checklist

- `/mnt/wervelwind/database/config/.env` values verified before deployment (secrets, endpoints, channel credentials). A clean-checkout Compose build/config preflight does not require a repository-root `.env` file.
- Run repository tests from the clean source checkout, never from a runtime image: `cd backend && .venv/bin/pytest -q tests/test_release_schema_preflight.py tests/test_project_visibility_migration.py tests/test_docker_image_isolation.py tests/test_boards_api.py`.
- Build release images only from a full immutable Git commit SHA, not from a developer worktree: `cd backend && python scripts/build_isolated_release_artifact.py <full-sha>`. The script rejects movable refs, exports the commit with `git archive` to a temporary context, builds the backend, worker and frontend runtime targets there, and reports commit, UTC build time and image IDs. A dirty worktree is therefore never a build input.
- `.dockerignore` excludes `.env`, local data/database/storage/config directories, virtual environments, generated `*.egg-info` metadata, dependency caches, tests, development metadata and generated output before Docker receives the context. The backend runtime uses a non-editable install so generated project metadata also stays out of `/app`; no test stage is available.
- After a build, assert each runtime filesystem is clean without starting it: `cd backend && .venv/bin/python scripts/verify_docker_image_isolation.py wervelnieuws-backend:<commit> wervelnieuws-worker:<commit> wervelnieuws-frontend:<commit>`. This blocks artifacts containing excluded local state, tests, caches or development metadata.
- Record the immutable commit/ref, clean/dirty source state before selecting the ref, SHA-256 digests of `.dockerignore`, Dockerfiles and `docker-compose.yml`, UTC build time and image IDs/digests. Only images built by the isolated-ref workflow are release-valid.
- Inspect canonical Compose only (do not start services for this preflight): `docker compose config` and `docker compose config --images`. The `migrate` service must retain `alembic upgrade head` and the canonical backend runtime Dockerfile/build context.
- After a verified database and storage backup, stop writers, apply `cd backend && .venv/bin/alembic upgrade head`, and smoke-check an authenticated project route. On failure, keep the release stopped and restore the database plus matching release artifact from that backup; do not downgrade or edit historical migrations in production.
- Frontend tests green: `cd frontend && npm test`.
- Frontend production build green: `cd frontend && npm run build`.
- Docker images build cleanly: `docker compose build backend frontend worker`.
- Scheduler behavior spot-check: create scheduled item and verify channel states/audit updates.

## CI

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Triggers on push and pull requests.
- Runs:
  - backend test suite (`pytest`, after installing dependencies in `backend/`)
  - frontend tests (`npm test`, in `frontend/`)
  - frontend production build (`npm run build`, in `frontend/`)
- Additional PR-only Docker workflow: `.github/workflows/docker-smoke.yml`
  - runs `docker compose build backend frontend worker` from a clean checkout without creating `.env`

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
- `GET /api/content/notifications`

## n8n notification integration

- Configure `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_TIMEOUT_SECONDS` in `.env`.
- Backend stores notification events with dedupe and delivery state in `notification_events`.
- Worker retries failed notification delivery with exponential backoff.
- See `docs/n8n-notifications.md` for payload details and operations.

## Known limitations and future v2 options

- Current scheduler is polling-based; v2 can use a queue broker for higher throughput.
- Frontend is functional but intentionally minimal; v2 can add richer side-by-side source tracing UX.
- Generation grounding enforcement is prompt-based + trace persistence; v2 can add stronger claim validation.
- Facebook update semantics may depend on page permissions and post types in production.
- SQLite is suitable for v1; v2 should migrate to PostgreSQL for concurrency and scale.
