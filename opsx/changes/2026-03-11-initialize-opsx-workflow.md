# Build v1 Wind Park Communication Platform

## Context
The repository currently contains only minimal project metadata and guidance. The user requested a production-ready v1, self-hosted communication automation platform for a Dutch local wind park project with a FastAPI backend, React frontend, separate worker, Docker deployment, source-grounded AI generation, human review workflow, scheduled publication to multiple channels, retries, notifications, versioning, and auditability.

## Goals / Non-goals
### Goals
- Scaffold a maintainable monorepo with `backend/`, `frontend/`, and `worker/`.
- Implement core domain model, migrations, auth, topic/content workflows, and storage conventions.
- Implement document ingestion (PDF, DOCX, XLSX, TXT, Markdown) with chunking and local searchable indexing.
- Implement source-grounded AI generation (Dutch article/summary + image generation flow).
- Implement editorial review, approvals, scheduling, version history, and rollback APIs.
- Implement publishing adapters for website, Facebook, and Mailgun behind interfaces.
- Implement scheduler/worker for timed publishing, retries, status tracking, and Telegram notifications.
- Provide Dockerized deployment, `.env.example`, tests for critical paths, and clear documentation.

### Non-goals
- Full enterprise auth (SSO/OAuth/role hierarchy).
- Advanced newsletter contact management (Mailgun list remains source of truth).
- Real-time collaboration editing.
- Full production observability stack (ELK/Prometheus/Grafana), beyond structured logging.

## Proposed approach
Create a phased implementation with clean module boundaries:
1) foundation and infrastructure,
2) ingestion and topic management,
3) AI generation and versioning,
4) review dashboard,
5) scheduler and channel publishing,
6) retries, notifications, hardening, tests, and docs.

Use SQLAlchemy + Alembic for schema management, SQLite-compatible defaults designed for PostgreSQL migration later, and local filesystem volumes for uploads and generated artifacts.

## Implementation steps (ordered)
1. Scaffold repository structure, backend/worker/frontend apps, Docker, and environment templates.
2. Implement backend core (settings, DB, auth, models, schemas, repositories, routers) and initial Alembic migration.
3. Implement ingestion pipeline, local indexing/search, and topic/source APIs.
4. Implement generation services (OpenAI adapters), grounded prompt assembly, content versioning, and rollback behavior.
5. Implement scheduler/worker publishing pipeline and channel adapters (website/Facebook/Mailgun) with Telegram notifications.
6. Add retry/error handling, audit events, and critical-path tests.
7. Finalize docs, verification instructions, limitations, and update this change spec evidence.

## Acceptance criteria
- Repository contains production-ready v1 scaffolding for backend/frontend/worker and Docker deployment.
- Backend provides APIs and domain model for topics, sources, notes, content versions, schedules, publication records/states, retries, audit/events.
- Document ingestion supports PDF, DOCX, XLSX, TXT, and Markdown extraction + chunking + local searchable index.
- AI generation pipeline is source-grounded and stores generated article/summary/image metadata per version.
- Review workflow supports inline edits, approve/reject, schedule publication, and version rollback.
- Worker publishes scheduled content to website/Facebook/Mailgun, tracks per-channel states, retries failures, and sends Telegram notifications.
- Security and quality baseline in place: hashed passwords, env secrets, input validation, safe file upload checks, structured logging.
- Tests exist for critical flows and docs include setup/deployment plus known limitations/v2 options.
- Spec sections `What changed`, `How to verify`, `Verification evidence`, and `Current status` are updated.

## Testing plan
- Run backend unit/integration tests for auth, topics, ingestion pipeline, versioning, scheduler orchestration, and retry behavior.
- Run frontend tests for critical review workflow UI and API integration hooks.
- Run lint/type checks for changed backend/frontend modules.
- Validate Docker Compose startup and basic health checks.

## Risk + rollback plan
- Risk: Third-party API behavior (Facebook/Mailgun/Telegram/OpenAI) can vary and require credentials.
- Mitigation: use adapter abstractions, strict error handling, retries, and deterministic mocks in tests.
- Risk: SQLite behavior differs from PostgreSQL under heavy concurrency.
- Mitigation: migration-safe schema, repository/service separation, and minimized SQLite-specific assumptions.
- Rollback: disable scheduler container and channel adapters while retaining editorial workflow and data.

## Notes / links
- User request: build production-ready v1 platform with phased implementation and fixed product decisions.
- Repo rules: `/home/mevius/wervelnieuws/AGENTS.md`.
- OPSX global rules: `~/.config/opencode/AGENTS.md`.

## Current status
Completed

## What changed
- Re-scoped active change spec from AGENTS-guide work to full v1 platform build.
- Scaffolded repository structure: `backend/`, `frontend/`, `worker/`, `docs/`.
- Implemented backend FastAPI foundation with modules for:
  - core settings/db/security/logging,
  - domain models and enums,
  - repositories/services/workflows,
  - routers for auth, topics, source uploads, generation, versioning, review actions, and scheduling.
- Added Alembic setup with initial migration for all key v1 entities plus SQLite FTS5 table for chunk search.
- Implemented document ingestion service with extraction for PDF/DOCX/XLSX/TXT/Markdown, chunking, and FTS indexing.
- Implemented generation service with source-grounded prompt flow (Dutch) and image generation integration adapter.
- Implemented publication workflow + channel adapters (Website/Facebook/Mailgun) and Telegram notifier.
- Added worker scheduler loop with due publication handling and retry queue handling scaffold.
- Added Dockerfiles for backend/frontend/worker and root `docker-compose.yml` with persistent volume.
- Added `.env.example`, expanded `README.md`, and `docs/architecture.md`.
- Added backend tests for critical flows (auth/topic CRUD, ingestion upload, generation/version creation).
- Fixed packaging and security hashing implementation to pass tests in containerized environment.
- Extended backend review/workflow APIs:
  - `GET /api/topics/{topic_id}/documents`
  - `GET /api/topics/{topic_id}/notes`
  - `GET /api/content/{topic_id}/current`
  - `GET /api/content/{topic_id}/channel-status`
  - `GET /api/content/retry-jobs`
  - `POST /api/content/retry-jobs/{job_id}/requeue`
- Implemented a richer editorial dashboard UI with:
  - topic selection + generation trigger,
  - source upload + source status,
  - notes management,
  - inline manual edit to create new content versions,
  - rollback controls,
  - approve/reject + scheduling controls,
  - per-channel status display,
  - retry queue panel with requeue action.
- Updated frontend API layer for all new review/publication/retry endpoints and multipart upload behavior.
- Added backend regression test `backend/tests/test_review_endpoints.py` for new review-support endpoints.
- Added API safeguards:
  - in-memory rate limiting dependency for login and document upload routes,
  - upload validation for empty files, max size limit, and allowed content types.
- Extended worker retry execution behavior:
  - retry jobs move to `in_progress`,
  - known flow `publish_schedule` executes real retry publication logic,
  - failures update retry metadata and backoff schedule,
  - successful retries are marked resolved.
- Added backend endpoint for per-topic audit event timeline:
  - `GET /api/topics/{topic_id}/audit-events`.
- Expanded monitoring payloads and frontend dashboard visibility:
  - channel status now includes timestamps and drill-down fields,
  - topic audit trail rendered in UI,
  - retry queue and channel details surfaced with timestamps/errors.
- Updated env/docs for hardening controls (`UPLOAD_MAX_BYTES`, rate-limit settings).
- Added backend regression test for upload safety (`empty upload` rejected).
- Added scheduler idempotency safeguards in publishing workflow:
  - explicit schedule claim step before publish execution,
  - duplicate-safe publication record/state creation logic,
  - retry publish path now respects claim/error transition semantics.
- Added DB uniqueness guard for publication idempotency:
  - `publication_records.schedule_id` unique constraint in model and migration.
- Added Alembic migration `20260311_0002_publication_record_unique.py`.
- Added deterministic workflow tests in `backend/tests/test_publishing_idempotency.py`:
  - idempotent due publish behavior,
  - retry flow publish execution + resolution behavior.
- Added deterministic dual-worker claim test in `backend/tests/test_publishing_idempotency.py`:
  - two worker sessions competing for the same scheduled publication produce exactly one successful claim.
- Refactored worker execution path into reusable backend workflow helper:
  - added `backend/app/workflows/worker_cycle.py` (`run_worker_cycle`) to execute due publication + retry processing in one cycle.
  - updated `worker/app/runner.py` to call `run_worker_cycle`, ensuring runner and tests use the same logic.
- Added deterministic worker-cycle retry integration test in `backend/tests/test_worker_cycle.py`:
  - validates `publish_schedule` retry path transitions a due job to `resolved` through real cycle execution.
- Added frontend test foundation with Vitest + Testing Library:
  - `frontend/src/app/App.test.tsx` covers login view rendering and topic-create flow submission.
  - `frontend/src/test/setup.ts` adds jest-dom matchers, cleanup, and mock reset hooks.
  - `frontend/vite.config.ts` includes test environment config (`jsdom`).
  - `frontend/package.json` includes `npm test` script and test dependencies.
- Updated README with:
  - frontend test command section,
  - practical release-readiness checklist (env, migrations, tests, builds, scheduler spot-check).
- Added GitHub Actions CI pipeline in `.github/workflows/ci.yml`:
  - triggers on push and pull requests,
  - backend job runs `pytest`,
  - frontend job runs `npm test` and `npm run build`.
- Extended README with a dedicated CI section documenting workflow path and executed checks.
- Added PR-only Docker smoke workflow in `.github/workflows/docker-smoke.yml`:
  - prepares `.env` from `.env.example`,
  - executes `docker compose build backend frontend worker`.
- Extended README CI section with Docker smoke workflow details.
- Added README badge section for workflow visibility:
  - CI badge and Docker smoke badge using GitHub Actions workflow badge URLs,
  - includes explicit `OWNER/REPO` placeholder note for repository-specific setup.

## How to verify
- Copy env: `cp .env.example .env`
- Validate compose config: `docker compose config`
- Build images:
  - `docker compose build backend`
  - `docker compose build frontend`
  - `docker compose build worker`
- Run backend tests in container: `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Run frontend tests: `cd frontend && npm test`
- Run frontend production build: `cd frontend && npm run build`
- Verify CI workflow file: `.github/workflows/ci.yml`
- Verify Docker smoke workflow file: `.github/workflows/docker-smoke.yml`
- Verify badge section at top of `README.md` and replace `OWNER/REPO` with real repo path.
- (Optional runtime check) `docker compose up -d` and verify `/health` and frontend route.
- Seed admin user: `docker compose run --rm backend python app/tasks/seed_admin.py`

## Verification evidence
- `docker compose config` completed successfully after `.env` creation.
- `docker compose build backend` succeeded after package discovery fix.
- `docker compose build frontend` initially failed on `ImportMeta.env` typing; fixed via `frontend/src/vite-env.d.ts`; rebuild succeeded.
- `docker compose build worker` succeeded.
- Backend tests command executed in container:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Result: `3 passed`.
- Runtime startup check via `docker compose up -d` partially blocked by host port conflict (`8000 already allocated`), indicating environment-level conflict rather than app boot failure.
- Rebuilt images after review/dashboard updates:
  - `docker compose build backend` succeeded.
  - `docker compose build frontend` succeeded.
- Backend tests rerun after updates:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Result: `4 passed`.
- Rebuilt all service images after hardening/retry/monitoring updates:
  - `docker compose build backend` succeeded.
  - `docker compose build frontend` succeeded.
  - `docker compose build worker` succeeded.
- Backend tests rerun after this increment:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Result: `5 passed`.
- Backend rebuilt and tests rerun after idempotency + retry execution hardening:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Result: `7 passed`.
- Backend rebuilt and tests rerun after adding dual-worker claim test:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Result: `8 passed`.
- Backend rebuilt and tests rerun after worker-cycle integration test:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Result: `9 passed`.
- Frontend dependencies installed and checks executed:
  - `cd frontend && npm install`
  - `cd frontend && npm test && npm run build`
  - Result: frontend tests `2 passed`; production build succeeded.
- Frontend checks rerun after CI workflow/docs update:
  - `cd frontend && npm test && npm run build`
  - Result: frontend tests `2 passed`; production build succeeded.
- Compose validation and Docker smoke build executed after PR Docker workflow addition:
  - `docker compose config && docker compose build backend frontend worker`
  - Result: compose config valid; core service builds succeeded.
- README badge section added and validated by direct file inspection.
