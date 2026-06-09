# Title
Add per-device remember-me sessions with secure HTTP-only cookie authentication

## Context
Users currently need to log in again after refreshing or revisiting `windwilly.nl`. The existing authentication flow uses a JWT access token in an HTTP-only cookie with a finite TTL and no server-side refresh/session record. That improves baseline cookie security, but it does not provide the desired durable per-device login behavior or explicit server-side revocation for a remembered device.

The agreed change introduces an `Onthoud mij` login option backed by an opaque, high-entropy remember token stored in a secure HTTP-only cookie. Only a hash of the remember token is stored server-side in a session table. A remembered session should remain valid effectively indefinitely until the user explicitly logs out on that device. Logout must revoke the current device session and clear the remember cookie, while preserving existing bearer-token fallback behavior for compatible clients/tests.

This change builds on the earlier completed persistent-login work, but changes the contract from finite JWT-cookie persistence to server-side per-device remember sessions with revocable opaque tokens.

## Goals / Non-goals
### Goals
- Add an `Onthoud mij` option to the login UI.
- Extend the backend login request contract with a `remember_me` flag.
- When `remember_me` is enabled, issue an opaque high-entropy remember token in an HTTP-only, `Secure`, `SameSite=Lax` cookie.
- Store only a cryptographic hash of the remember token in a database-backed per-device session table; never persist plaintext remember tokens.
- Validate active remember sessions in `/auth/me` and in the shared auth dependency used by protected endpoints.
- Keep the existing bearer-token fallback for non-browser clients and compatibility with current tests/flows.
- Make logout revoke only the current device remember session and delete the remember cookie.
- Allow another browser/device with its own active remember session to remain logged in after logout on the current device.
- Add targeted backend and frontend tests for remembered login, refresh/revisit behavior, revocation, token storage, bearer fallback, and protected endpoint compatibility.
- Update environment examples/docs if new settings are added, and update the website About/changelog entry if required by the repo Definition of Done.

### Non-goals
- No admin UI for viewing or managing sessions.
- No “logout all devices” flow.
- No localStorage-based auth tokens.
- No broad authentication redesign, OAuth/OIDC introduction, role/permission change, or user-management redesign.
- No automatic cleanup UI for expired/revoked sessions beyond what is technically needed for safe validation.
- No newsletter/publication workflow changes.

## Proposed approach
1. Inspect the current auth implementation, including login/logout request and response contracts, `/auth/me`, cookie names/settings, auth dependency behavior, and frontend auth bootstrap.
2. Add a server-side remember-session model/table with fields sufficient for per-device validation and revocation, such as user id, token hash, created timestamp, last-used timestamp, revoked timestamp, and optional user-agent/IP metadata if already consistent with project patterns.
3. Generate remember tokens with a cryptographically secure random source and enough entropy for long-lived bearer-equivalent credentials.
4. Hash remember tokens before database storage using a suitable one-way construction for lookup/verification; do not log or persist plaintext tokens.
5. Extend login so `remember_me=true` creates an active session record and sets a remember cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, appropriate path, and an effectively indefinite/max practical expiry. Keep normal login behavior available when `remember_me=false`.
6. Update auth resolution so protected endpoints and `/auth/me` accept an active, non-revoked remember cookie session, while preserving bearer fallback behavior for existing API clients/tests.
7. Update logout so it identifies the current remember session from the cookie, marks only that session revoked, and deletes/expires the cookie. Other device/browser sessions must remain active.
8. Add the frontend login checkbox labelled `Onthoud mij`, include `remember_me` in the login request, and keep app bootstrap based on `/auth/me` without localStorage token storage.
9. Update tests and documentation/changelog for the new remembered-session behavior and security properties.

## Implementation steps (ordered)
1. Inventory current backend auth files, settings, database migration conventions, and frontend login/auth-provider files.
2. Define the remember-session table/schema and migration, including indexes for token-hash lookup and user/session revocation checks.
3. Define remember cookie settings: cookie name, `HttpOnly`, `Secure`, `SameSite=Lax`, path/domain, expiry/max-age behavior, and any environment-configurable values.
4. Implement secure remember-token generation and hashing helpers in the backend auth/security layer.
5. Extend the backend login schema to accept `remember_me` while keeping existing clients compatible when the flag is omitted.
6. Update login handling so successful `remember_me=true` logins create a session row and set the remember cookie; normal login behavior remains available for `remember_me=false`.
7. Update `/auth/me` and the shared auth dependency to authenticate via active remember session when appropriate, and keep bearer fallback behavior intact.
8. Update logout to revoke the current remembered session, clear/delete the remember cookie, and keep other sessions for the same user untouched.
9. Ensure revoked or missing session records cause the remember cookie path to fail authentication and do not silently recreate a session.
10. Add frontend login checkbox UI with Dutch label `Onthoud mij`, wire it into the login request, and preserve existing loading/error/accessibility behavior.
11. Confirm frontend requests include cookies where required and do not introduce localStorage auth-token usage.
12. Add or update backend tests, including `tests/test_meta_and_me.py`, for remember cookie issuance, session DB hash storage, `/auth/me`, protected endpoint auth, logout revocation, revoked token rejection, second-device independence, and bearer fallback.
13. Add or update frontend `App`/auth tests for the checkbox, request payload, refresh/revisit bootstrap through `/auth/me`, and logout behavior.
14. Update `.env.example` and docs only if new settings are introduced.
15. Update the About/changelog page with an end-user-friendly entry if required by the repository Definition of Done.
16. During implementation, record exact commands and outcomes under `How to verify` and `Verification evidence`.

## Acceptance criteria (measurable)
1. The login screen includes an `Onthoud mij` checkbox.
2. When `Onthoud mij` is checked, the frontend sends `remember_me=true` in the login request.
3. A successful remembered login sets an HTTP-only, `Secure`, `SameSite=Lax` remember cookie containing an opaque high-entropy token.
4. The database stores only a hash/derived representation of the remember token; plaintext remember tokens are never stored or logged.
5. After a remembered login, refreshing the page keeps the user logged in through `/auth/me` without re-entering credentials.
6. After revisiting `windwilly.nl` later from the same browser/device, the user remains logged in until explicit logout, subject only to browser cookie retention and any documented operational max-age.
7. Logout on the current browser/device revokes that current remember session and clears/deletes the remember cookie.
8. After logout, the revoked remember token no longer authenticates on `/auth/me` or protected endpoints.
9. Logging out in one browser/device does not revoke an active remembered session in a second browser/device.
10. Existing bearer-token authentication fallback still works for compatible clients/tests when no valid remember cookie is used.
11. Existing protected endpoints continue to authenticate correctly through the shared auth dependency.
12. No localStorage auth-token storage is introduced.
13. Relevant backend and frontend tests pass, and verification evidence is recorded in this spec during implementation.
14. If settings, docs, or user-facing changelog entries are affected, they are updated as part of the implementation.

## Testing plan (canonical commands or approach)
- Backend targeted auth tests:
  - `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
- Backend full test suite:
  - `cd backend && ./.venv/bin/pytest`
- Frontend targeted App/auth tests:
  - `cd frontend && npm test -- --run src/app/App.test.tsx`
- Frontend build/typecheck:
  - `cd frontend && npm run build`
- Manual production/staging verification on `https://windwilly.nl`:
  1. Log in with `Onthoud mij` checked and confirm the remember cookie has `HttpOnly`, `Secure`, and `SameSite=Lax` attributes.
  2. Refresh the page and confirm the user remains logged in.
  3. Close/reopen or revisit the site and confirm the user remains logged in.
  4. Log out and confirm the current browser/device becomes unauthenticated after refresh.
  5. Verify the revoked cookie/token no longer authenticates if replayed in a test client.
  6. Log in from two different browsers/devices, log out from one, and confirm the other remains logged in.
  7. Verify an existing bearer-token client/test flow still authenticates without a remember cookie.

## Risk + rollback plan
### Risks
- Cookie attributes (`Secure`, `SameSite`, domain/path, expiry) could be misconfigured and break login persistence on `windwilly.nl`.
- Long-lived remembered sessions increase risk if a device or cookie is compromised.
- Migration or schema errors could affect login for all users.
- Auth-resolution ordering between bearer, existing access cookie, and remember cookie could create compatibility regressions.
- Logout behavior could accidentally revoke all sessions instead of only the current device if session identification is wrong.

### Mitigations
- Keep cookie settings explicit, tested, and production-safe; reject or document unsafe production configuration.
- Use opaque high-entropy tokens and store only hashed tokens server-side.
- Preserve bearer fallback and cover precedence/compatibility with tests.
- Add focused tests for per-device isolation and revoked-token rejection.
- Keep the change scoped to auth/session handling and avoid unrelated auth redesign.

### Rollback
- Revert the remember-session code and migration if the new flow causes critical login failures.
- If feasible during incident response, disable the remember flow while preserving normal login and bearer-token auth.
- Remove/expire the remember cookie from responses and stop validating remember sessions.
- Keep or safely ignore the added session table until a follow-up cleanup migration is approved.
- Revert docs/changelog entries if the feature is not rolled out.

## Notes / links
- Source: user-provided draft outline for the agreed change in this session.
- Related prior completed spec: `opsx/changes/2026-05-27-persist-admin-login.md`.
- This spec intentionally replaces finite cookie-only persistence with revocable per-device remembered sessions.
- Docs impact: update `.env.example`/docs only if implementation adds or changes settings; update About/changelog per repo Definition of Done when application code changes are implemented.

## Current status
Completed — implemented and verified locally on 2026-06-09. Manual production verification remains a rollout follow-up. No commit or push performed.

## What changed
- Added a `remember_sessions` database table/model and Alembic migration for per-device server-side session records with user id, token hash, timestamps, revocation timestamp, and optional user-agent/IP metadata.
- Added secure remember-token helpers that generate opaque high-entropy tokens and store only an HMAC-SHA256 derived token hash server-side.
- Extended `/auth/login` to accept optional `remember_me`; remembered logins now create a session row and set a `wervel_remember` HTTP-only, `Secure`, `SameSite=Lax` cookie with a documented operational max age.
- Updated shared auth resolution for `/auth/me` and protected endpoints to keep explicit bearer tokens first, then existing access-cookie behavior, then active remember-cookie sessions.
- Updated `/auth/logout` to revoke only the current remember session, clear the remember cookie, and preserve other device sessions.
- Added the frontend `Onthoud mij` checkbox and wired it into the login request without introducing localStorage auth-token storage.
- Added targeted backend and frontend tests for remember-cookie issuance, hash-only storage, `/auth/me`, protected endpoint compatibility, revocation/replay rejection, second-device independence, and bearer fallback preservation.
- Updated `.env.example` for the remember-cookie name/max-age settings and added an end-user-facing About/changelog entry.

## How to verify
- Backend targeted auth tests: `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
- Backend full test suite: `cd backend && ./.venv/bin/pytest`
- Frontend targeted App/auth tests: `cd frontend && npm test -- --run src/app/App.test.tsx`
- Frontend build/typecheck: `cd frontend && npm run build`
- Database migration: `cd backend && STORAGE_ROOT=<temporary-writable-directory> ./.venv/bin/alembic upgrade head`
- Manual production/staging cookie inspection on `https://windwilly.nl` remains a rollout follow-up because this implementation was verified locally only.

## Verification evidence
- PASS — `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
  - Result: 23 passed.
- PASS — `cd backend && ./.venv/bin/pytest`
  - Result: 129 passed.
- PASS — `cd frontend && npm test -- --run src/app/App.test.tsx`
  - Result: 55 passed.
- PASS — `cd frontend && npm run build`
  - Result: TypeScript build and Vite production build completed successfully.
- PASS after retry — `cd backend && STORAGE_ROOT=<temporary-writable-directory> ./.venv/bin/alembic upgrade head`
  - Result: Alembic upgraded successfully to head with a temporary writable `STORAGE_ROOT` override.
  - Note: the first Alembic attempt failed because the local `/data` storage path was not writable in this environment; retrying with the temporary `STORAGE_ROOT` override passed.
- Not run — manual production/staging verification on `https://windwilly.nl`; requires deployed environment/browser inspection.

---
Status: completed
Owner: n/a
Date: 2026-06-09
