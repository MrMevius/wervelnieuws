# Release readiness

This document contains production-specific preflight requirements that are intentionally kept out of the general project README.

Use it together with [Docker Compose operations](docker-compose-operations.md).

## Security and upgrade notes (September 2026)

- Use `ENV=production` (`prod` is also recognized), a randomly generated `SECRET_KEY` of at least 32 characters, and `AUTH_COOKIE_SECURE=true`. Production startup rejects weak defaults, wildcard CORS, HTTP origins and origins containing paths or credentials.
- `ALLOWED_ORIGINS` must contain the exact HTTPS browser origin(s), including a non-default port if applicable. Cookie-authenticated writes and login validate browser Origin/Referer headers against this list. Include the public frontend origin even when the backend is behind a reverse proxy. Bearer API clients without browser cookies continue to work.
- Production builds default to the same-origin `/api` reverse proxy, not port 8001. Use `VITE_API_BASE_URL` only for an intentional alternate API deployment. Vite development continues to use the separate backend on port 8001.
- The first administrator requires an explicit `BOOTSTRAP_ADMIN_PASSWORD` (12–128 characters); remove it from the environment after bootstrap. Existing accounts are not changed automatically. Change any demo password created by older releases before exposing the application.
- Access tokens now include a password-bound fingerprint. Existing access tokens without it are rejected after upgrade: users may need to sign in once again. No additional database migration is required for this session change. Remember-me sessions still require the existing `remember_sessions` migration.
- Changing a password (including administrator resets) invalidates previous access tokens and all remembered sessions for that user. The browser changing its own password receives a new access cookie; bearer clients must log in again. Successful account switches revoke the old remember cookie, preventing a later fallback to the previous account.
- Remembered sessions have an absolute server-side lifetime based on `REMEMBER_COOKIE_MAX_AGE_DAYS`, not an indefinitely sliding lifetime. Their activity timestamp is written at most once per five minutes to reduce SQLite write contention.
- Disabling an account blocks all authentication modes immediately. Access tokens remain stateless: logout revokes the current remembered session and clears cookies, but a copied access token remains valid until expiry or a password change. Choose `ACCESS_TOKEN_EXPIRE_MINUTES` deliberately (for example 60 in production); the legacy default follows `AUTH_COOKIE_TTL_DAYS=30`.
- Private API responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Validation responses omit submitted input and validator context so passwords and API keys are not echoed.
- News previews and the rich-text editor sanitize HTML with [DOMPurify](https://github.com/cure53/DOMPurify), using an explicit formatting allowlist. Scripts, event handlers, embedded media, styles and form controls are removed before insertion into the DOM; pasted HTML follows the same path. Stored content is not bulk-rewritten. External publishing destinations must still sanitize their own rendering inputs.

These changes are a hardening pass, not production certification. Before external release, still perform a dependency/advisory audit, verify a database-and-files restore, test under realistic concurrent uploads/transcriptions, and validate the final reverse-proxy/TLS setup. Review publication retry recovery across partial external successes before enabling automatic publishing. Splitting the large frontend shell and board module, plus route-level code splitting, remains maintainability/performance work.

Verification for this pass: 337 backend tests and 222 frontend tests pass; TypeScript and the Vite production build pass. Backend tests ran against temporary databases in a separate temporary source copy, including migration roundtrips and upgrades from older versions. The build still warns about a JavaScript chunk larger than 500 kB; that warning is not suppressed. No production deployment, existing-user password change, live publication or real-provider transcription was performed as part of this verification.

## Release-readiness checklist

### Participation module (September 2026)

The participation register requires migration `20260909_0031` (parent `20260909_0029`). It adds three tables and does not rewrite existing records. See [Participatiemomenten](participatiemomenten.md) for access rules, export behavior and historical identities.

Verification after this addition: 361 backend tests and 229 frontend tests pass, plus TypeScript and the Vite production build. This includes multi-project visibility, stale-edit conflicts, transactional rollback when audit recording fails, retained names after deleted references, archive/restore, export filters and spreadsheet-formula escaping. The local development upgrade was applied after a verified database-and-files backup; all 49 pre-existing tables were compared with the backup and remained unchanged. API health returned OK and unauthenticated participation requests returned 401. A visual check of the authenticated screen still requires the user to sign in; the test suite does not replace that check. No production rollout was performed. The existing large-JavaScript-chunk warning remains.

### Minute-accurate hours registration (September 2026)

The redesigned hours register requires migration `20260910_0032` (parent `20260909_0031`). It replaces half-hour storage with integer minutes, adds an optional local starting time and makes the category/post optional. Existing durations are multiplied by 30 exactly; historical starting times remain empty. See [Urenregistratie](urenregistratie.md) for the new workflow and compatibility/rollback rules. Stop database writers and verify database/storage backups before upgrading. A downgrade explicitly refuses data that the former schema cannot represent.

Verification: 381 backend tests and 224 frontend tests pass, plus TypeScript and the Vite production build. Coverage includes exact single-minute durations, decimal-hour input, optional/cleared posts, multi-person totals, CSV exports, retained historical participants, stale edits, failed saves and migration roundtrips. Desktop dark/light themes and narrow 320/390 px mobile layouts were checked against the real components using isolated fixture data, without creating real registrations. An authenticated browser save still requires a signed-in user.

The local development upgrade was rehearsed on a verified restore copy before applying it to the database. All 53 tables were compared, the 6 existing registrations were preserved exactly (apart from the intended duration transformation), and SQLite integrity and foreign-key checks passed. API and worker were restarted after verification. No production rollout was performed. The existing large-JavaScript-chunk warning remains.

### Production checklist

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
