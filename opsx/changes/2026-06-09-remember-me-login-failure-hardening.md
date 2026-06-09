# Title
Fix remember-me login failure when session migration is unavailable

## Context
After remember-me sessions were added, the UI can show the generic login error `Inloggen mislukt. Controleer of de backend bereikbaar is en probeer opnieuw.` when logging in with `Onthoud mij` checked.

The most likely production cause is an unapplied deployment database migration: the backend is missing the `remember_sessions` table from migration `20260609_0022`. In that state, a valid username/password login with `remember_me=true` can authenticate the user, then fail while inserting the `RememberSession`, returning HTTP 500. The frontend currently hides the specific backend failure behind a broad availability/login message.

The primary operational fix remains applying the migration and restarting the deployed services. This follow-up hardens the backend so a remember-session persistence failure does not catastrophically fail an otherwise valid login.

## Goals / Non-goals
### Goals
- Document immediate production operator remediation: run migrations and restart the relevant Docker Compose services.
- Keep normal username/password login working when `remember_me=false`.
- Keep remembered login working when the `remember_sessions` table/migration exists.
- If remember-session insertion/persistence fails after valid credentials, return a successful normal login session instead of HTTP 500.
- Do not set the remember cookie when remember-session persistence fails.
- Log the remember-session persistence failure clearly enough for operators to diagnose missing migration/table issues.
- Ensure logs do not contain remember-token values, plaintext credentials, cookies, or other secrets.
- Add or adjust backend tests, including a simulated remember-session database failure.
- Update verification evidence in this spec during implementation.
- Optionally improve the frontend user-facing error message only if the backend response contract makes that small and low-risk.

### Non-goals
- No authentication redesign.
- No session administration UI.
- No weakening of production secure cookie behavior.
- No change to the opaque remember-token model, token hashing, or revocation semantics.
- No automatic workaround that creates/migrates production tables at request time.
- No broad frontend login redesign.

## Proposed approach
1. Treat deployment remediation and code hardening as complementary: operators should still apply migration `20260609_0022`, but the backend should degrade gracefully if remember-session persistence fails.
2. Inspect the existing login handler and remember-session creation path to identify the narrow transaction/error boundary around `RememberSession` insertion and cookie setting.
3. After username/password credentials are validated and the normal access/session response can be issued, isolate remember-session persistence errors from the rest of login.
4. On remember-session persistence failure, log a structured warning/error with exception context and an operator-oriented message, but omit token values, cookie values, passwords, and other secrets.
5. Return the same successful response as a non-remembered login and ensure the remember cookie is not set in that fallback path.
6. Keep existing successful remember-me behavior unchanged when persistence succeeds.
7. Add targeted tests that simulate the missing table/insert failure and verify success response, absence of remember cookie, and safe logging.
8. Document production remediation commands and manual verification steps.

## Implementation steps (ordered)
1. Inspect backend auth login flow, remember-session model/repository usage, response cookie setting, and existing auth tests.
2. Identify the exact code path where `remember_me=true` creates the remember session and sets the remember cookie.
3. Refactor minimally so remember-session creation and remember-cookie setting happen only after persistence succeeds.
4. Catch only expected persistence/database exceptions around remember-session creation; do not catch credential validation failures or unrelated login errors that should still fail.
5. On persistence failure, log a clear warning/error such as missing `remember_sessions` table / migration not applied, with safe metadata only.
6. Return a normal successful login session in the fallback path and verify no remember cookie is included.
7. Add or update backend auth tests for:
   - login without remember-me succeeds;
   - login with remember-me succeeds and sets cookie when the table/migration exists;
   - simulated remember-session insert failure still returns a successful normal login;
   - fallback response does not set remember cookie;
   - failure is logged without token values or secrets.
8. If frontend changes are made, keep them limited to improving the error display for small, well-defined backend error responses and add/update App tests.
9. Add production operator instructions to relevant documentation or the spec verification notes: run migration, restart services, verify login with and without `Onthoud mij`.
10. During implementation, record exact commands and outcomes under `How to verify` and `Verification evidence`.

## Acceptance criteria (measurable)
1. Login with valid credentials and `remember_me=false` succeeds.
2. Login with valid credentials and `remember_me=true` succeeds and sets the remember cookie when the `remember_sessions` table exists and insertion succeeds.
3. If remember-session insertion fails after valid credentials, login still succeeds as a normal non-remembered session.
4. In the remember-session insertion failure path, the response does not set a remember cookie.
5. In the failure path, backend logs include a clear warning/error that enables operators to identify remember-session persistence/migration issues.
6. Failure logs do not include plaintext remember tokens, remember cookie values, passwords, access tokens, or other secrets.
7. Existing remember-me behavior still works, including refresh/revisit authentication and logout revocation, when persistence succeeds.
8. Targeted backend auth tests pass, including a simulated remember-session database failure.
9. Broader backend tests pass as feasible or any blockers are documented in verification evidence.
10. If frontend code changes, the relevant frontend App test/build passes or blockers are documented.
11. Production operator instructions are documented, including migration, restart, and manual login verification steps.

## Testing plan (canonical commands or approach)
- Backend targeted auth tests:
  - `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
- Backend full test suite as feasible:
  - `cd backend && ./.venv/bin/pytest`
- Frontend targeted tests only if frontend login/error handling changes:
  - `cd frontend && npm test -- --run src/app/App.test.tsx`
- Frontend build/typecheck only if frontend changes:
  - `cd frontend && npm run build`
- Manual production remediation and verification:
  1. `docker compose run --rm migrate`
  2. `docker compose restart backend worker frontend`
  3. Verify login with `Onthoud mij` unchecked.
  4. Verify login with `Onthoud mij` checked.
  5. Confirm remembered login survives refresh/revisit.
  6. Confirm backend logs do not show remember-session persistence errors after migration is applied.

## Risk + rollback plan
### Risks
- Graceful fallback could hide a deployment migration problem from users and reduce urgency to apply the missing migration.
- Overly broad exception handling could mask unrelated auth bugs.
- Incorrect cookie ordering could accidentally set a remember cookie even when persistence failed.
- Logging too much context could expose sensitive authentication data.

### Mitigations
- Keep operator-facing logs explicit about remember-session persistence and likely migration/table issues.
- Catch only expected persistence/database exceptions in the narrow remember-session creation boundary.
- Add tests that assert no remember cookie is set on persistence failure.
- Review logs/tests to ensure no token, cookie, password, or secret values are emitted.
- Document that applying migration `20260609_0022` remains the primary production remediation.

### Rollback
- Primary remediation: apply the missing migration and restart services.
- If hardening causes regressions, revert the hardening change while retaining the migration and existing remember-me implementation.
- As a temporary incident workaround, disable or hide the remember-me UI while preserving normal login.
- Do not weaken production secure cookie settings as a rollback mechanism.

## Notes / links
- Follow-up to `opsx/changes/2026-06-09-remember-me-sessions.md`.
- Suspected migration/table: `20260609_0022` / `remember_sessions`.
- User-visible symptom: `Inloggen mislukt. Controleer of de backend bereikbaar is en probeer opnieuw.` when `Onthoud mij` is checked.
- Production remediation commands supplied in request: `docker compose run --rm migrate`; `docker compose restart backend worker frontend`.

## Current status
Completed — backend hardening implemented and verified. No frontend code changes were needed for this hardening follow-up; existing frontend login behavior was re-verified.

## What changed
- Backend login now isolates remember-session persistence from the already-valid username/password login path.
- When `remember_me=true`, the remember cookie is only set after the `RememberSession` row is added and committed successfully.
- If SQLAlchemy persistence fails while storing the remember session, the backend rolls back that failed persistence attempt, logs a safe operator-oriented warning with non-sensitive exception-type context, and returns the normal successful login response with the standard auth cookie only.
- The warning points operators to migration `20260609_0022` / the `remember_sessions` table and does not log remember-token values, cookie values, passwords, or access tokens.
- Added a regression test that simulates a missing `remember_sessions` table, verifies HTTP 200 login fallback, verifies no remember cookie is set, and checks that sensitive values are absent from captured log messages.
- Added an About changelog entry for the completed iteration, per repository definition of done.

## How to verify
- Backend targeted auth tests:
  - `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
- Backend full test suite:
  - `cd backend && ./.venv/bin/pytest`
- Frontend App tests:
  - `cd frontend && npm test -- --run src/app/App.test.tsx`
- Frontend production build:
  - `cd frontend && npm run build`
- Alembic migration graph:
  - `cd backend && ./.venv/bin/alembic heads`
  - Expected result: a single head, `20260609_0022`.
- Rollout instructions / manual production remediation and verification:
  1. `docker compose run --rm migrate`
  2. `docker compose restart backend worker frontend`
  3. Verify login with `Onthoud mij` unchecked.
  4. Verify login with `Onthoud mij` checked.
  5. Confirm remembered login survives refresh/revisit.
  6. Confirm backend logs do not show remember-session persistence errors after migration is applied.

## Verification evidence
- `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py` — PASS, 24 passed, 18 warnings.
- `cd backend && ./.venv/bin/pytest` — PASS, 130 passed, 317 warnings.
- `cd frontend && npm test -- --run src/app/App.test.tsx` — PASS, 55 passed.
- `cd frontend && npm run build` — PASS.
- `cd backend && ./.venv/bin/alembic heads` — PASS, single head: `20260609_0022`.
- Warnings observed are existing deprecation warnings from pytest-asyncio loop-scope configuration, passlib `crypt`, and python-jose `datetime.utcnow()` usage; they did not fail verification.

---
Status: Completed
Owner: n/a
Date: 2026-06-09
