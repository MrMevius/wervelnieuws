# Release readiness

This document contains production-specific preflight requirements that are intentionally kept out of the general project README.

Use it together with [Docker Compose operations](docker-compose-operations.md).

## Release-readiness checklist

Before a production release:

- Verify the production `.env` values, including secrets, endpoints and publication-channel credentials.
- Run repository tests from a clean source checkout, never from a runtime image:

  ```bash
  cd backend
  .venv/bin/pytest -q tests/test_release_schema_preflight.py tests/test_project_visibility_migration.py tests/test_docker_image_isolation.py tests/test_boards_api.py
  ```

- Build release images only from a full immutable Git commit SHA, not from a developer worktree:

  ```bash
  cd backend
  .venv/bin/python scripts/build_isolated_release_artifact.py <full-commit-sha>
  ```

  The script rejects movable refs, exports the commit with `git archive` to a temporary context, builds the backend, worker and frontend runtime targets there, and reports the commit, UTC build time and image IDs. A dirty worktree is therefore never a release build input.

- Confirm `.dockerignore` excludes `.env`, local data/database/storage/config directories, virtual environments, dependency caches, tests, development metadata and generated output before Docker receives the build context.
- Verify each runtime filesystem after the build without starting it:

  ```bash
  cd backend
  .venv/bin/python scripts/verify_docker_image_isolation.py \
    wervelnieuws-backend:<commit> \
    wervelnieuws-worker:<commit> \
    wervelnieuws-frontend:<commit>
  ```

- Record the immutable commit/ref, clean/dirty source state before selecting the ref, SHA-256 digests of `.dockerignore`, Dockerfiles and `docker-compose.yml`, UTC build time and image IDs/digests.
- Inspect canonical production Compose without starting services:

  ```bash
  docker compose config
  docker compose config --images
  ```

  The `migrate` service must retain `alembic upgrade head` and the canonical backend runtime Dockerfile/build context.

- Create and verify a database and storage backup before applying a production migration.
- Stop SQLite writers before migration and follow [Docker Compose operations](docker-compose-operations.md) for the controlled migration/start sequence.
- After migration, smoke-check an authenticated project route. If migration fails, keep the release stopped and restore the database, matching storage and previous release artifact. Do not downgrade or edit historical migrations in production.
- Confirm frontend tests pass:

  ```bash
  cd frontend
  npm test
  npm run build
  ```

- Confirm production images build successfully:

  ```bash
  docker compose build backend frontend worker
  ```

- Spot-check scheduler behavior by creating a scheduled item and verifying channel states and audit updates.

## Topic audio runtime

Topic audio is limited server-side to `250000000` bytes and 180 minutes. The backend runtime image includes `ffprobe` and runs as the non-root `app` user, with default UID/GID `1000`.

The default `TOPIC_AUDIO_TMP_ROOT` is `/tmp/wervelnieuws-topic-audio`. It is owned by the application user with mode `0700` and must remain outside `STORAGE_ROOT`.

For bind-mounted storage, build with `APP_UID`/`APP_GID` matching the host-directory owner and keep the directories owned by that identity instead of making them world-writable. If `TOPIC_AUDIO_TMP_ROOT` is overridden with a mounted path, pre-create it with the same ownership and mode `0700`.

Before deployment, verify the runtime identity, `ffprobe` and writable paths:

```bash
docker compose run --rm --no-deps backend sh -lc 'test "$(id -u)" -ne 0 && ffprobe -version >/dev/null && test -w /data && test -w "${TOPIC_AUDIO_TMP_ROOT:-/tmp/wervelnieuws-topic-audio}"'
```
