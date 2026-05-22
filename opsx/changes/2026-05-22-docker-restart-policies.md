## Title
Add Docker restart policies for runtime services

## Context
The production site returned a 502 Bad Gateway because the Wervelnieuws runtime containers were not running. The stack had to be manually started.

## Goals / Non-goals
### Goals
- Improve runtime resilience by automatically restarting key services after daemon or host restarts.
- Reduce risk of prolonged downtime caused by stopped containers.

### Non-goals
- No architecture changes.
- No application code changes.
- No changes to unrelated infrastructure (reverse proxy, DNS, TLS).

## Proposed approach
Add `restart: unless-stopped` to the runtime services in `docker-compose.yml`: `backend`, `frontend`, and `worker`.

## Implementation steps (ordered)
1. Update `docker-compose.yml` with restart policies for backend/frontend/worker.
2. Apply the compose configuration with `docker compose up -d`.
3. Verify service health and public endpoint availability.

## Acceptance criteria
1. `docker-compose.yml` includes `restart: unless-stopped` for `backend`, `frontend`, and `worker`.
2. `docker compose up -d` completes successfully.
3. `docker compose ps` shows backend/frontend/worker as running.
4. `curl -I https://windwilly.nl` returns HTTP 200.

## Testing plan
- Run `docker compose up -d`.
- Run `docker compose ps`.
- Run `curl -I https://windwilly.nl`.

## Risk + rollback plan
### Risks
- Minimal risk; compose-level policy change only.

### Rollback
- Remove added `restart` keys from `docker-compose.yml` and rerun `docker compose up -d`.

## Notes / links
- Incident symptom: browser showed `502 Bad Gateway (nginx)`.

## Current status
Completed

## What changed
- Updated `docker-compose.yml` to add `restart: unless-stopped` for:
  - `backend`
  - `frontend`
  - `worker`
- Applied the updated compose configuration using `docker compose up -d`.

## How to verify
1. `docker compose up -d`
2. `docker compose ps`
3. `curl -I https://windwilly.nl`

## Verification evidence
- `docker compose up -d` completed successfully and recreated backend/frontend/worker containers.
- `docker compose ps` shows:
  - `wervelnieuws-backend-1` → Up
  - `wervelnieuws-frontend-1` → Up
  - `wervelnieuws-worker-1` → Up
- `curl -I https://windwilly.nl` result:
  - `HTTP/2 200`
