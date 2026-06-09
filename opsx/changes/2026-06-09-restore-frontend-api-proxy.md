# Title
Restore frontend nginx API proxy for login endpoints

## Context
After deployment, browser requests to `POST /api/auth/login` return HTTP 405 from the frontend nginx container, while the backend receives no login request. This indicates the request is being handled by the frontend static nginx server instead of being proxied to the FastAPI backend.

`frontend/nginx.conf` currently only serves the SPA fallback and lacks a `location /api/` proxy to `backend:8000`. A stashed prior nginx configuration contains the needed proxy block and should be used as a reference if available.

This is an urgent production login fix. The change should restore Docker-internal frontend-to-backend API proxying without redesigning authentication or unrelated routing.

## Goals / Non-goals
### Goals
- Update `frontend/nginx.conf` so requests under `/api/` are proxied to the backend service at `backend:8000/api/`.
- Include required forwarded headers so the backend receives the original host, client IP, protocol, and proxy chain where applicable.
- Set an appropriate `client_max_body_size` in the nginx config to support expected API/upload request sizes.
- Preserve SPA static serving and client-side route fallback behavior for non-API frontend routes.
- Rebuild and restart the frontend container as needed so the nginx config change is active in production.
- Verify `POST /api/auth/login` reaches the backend and no longer returns nginx HTTP 405.
- Verify protected `/api` calls are routed to the backend rather than handled by frontend nginx.
- Record verification evidence and any production commands used during implementation.

### Non-goals
- No authentication redesign.
- No remember-session or “remember me” code changes.
- No backend login behavior changes unless verification uncovers a separate backend-only defect that must be specified separately.
- No changes to reverse proxies outside Docker Compose unless strictly required to prove or activate this fix.
- No broad frontend routing redesign.
- No unrelated deployment, compose, or infrastructure refactor.

## Proposed approach
1. Inspect the current `frontend/nginx.conf` and the stashed prior nginx config, if accessible, to recover the smallest known-good `/api/` proxy block.
2. Add a `location /api/` block before the SPA fallback so nginx proxies API requests to `http://backend:8000/api/` instead of attempting static-file handling.
3. Preserve the existing SPA `try_files` fallback for all non-API routes.
4. Include standard proxy headers, for example `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`.
5. Configure `client_max_body_size` at the appropriate nginx scope, consistent with existing upload/API expectations.
6. Validate nginx syntax/config through the frontend Docker image/container path and rebuild/restart the frontend service as needed.
7. Verify via curl and browser that login/API requests reach the backend and frontend routes still render the SPA.

## Implementation steps (ordered)
1. Inspect `frontend/nginx.conf` and confirm it lacks a `location /api/` proxy block.
2. Inspect the stashed prior nginx config, if available, and identify the proxy directives to reuse.
3. Update only `frontend/nginx.conf` with:
   - `client_max_body_size` in the relevant `server` or `http` context;
   - `location /api/ { proxy_pass http://backend:8000/api/; ... }`;
   - forwarded/proxy headers required by the backend;
   - no regression to the existing SPA fallback.
4. Build the frontend image or run the project’s Docker Compose build path for the frontend service.
5. Restart/recreate the frontend container so the new nginx config is active.
6. Verify nginx no longer returns HTTP 405 for `POST /api/auth/login` and that the backend logs show the login endpoint is reached.
7. Verify at least one protected `/api` request is proxied to the backend.
8. Verify a static frontend route and a client-side SPA route still load correctly.
9. Update this spec with `What changed`, `How to verify`, `Verification evidence`, and final `Current status` during implementation.

## Acceptance criteria
1. `POST /api/auth/login` is proxied from frontend nginx to the backend service and no longer returns a frontend-nginx HTTP 405.
2. Backend access/application logs confirm the login request reaches the backend after the frontend config is active.
3. At least one protected `/api/...` request reaches the backend through the frontend nginx proxy.
4. Frontend static assets still load successfully after rebuild/restart.
5. Client-side SPA routes still fall back to `index.html` and render as before.
6. Docker Compose frontend build/rebuild succeeds, or a full Docker Compose build succeeds if that is the project’s chosen deployment path.
7. Frontend container restart/recreation succeeds with valid nginx configuration.
8. Logs confirm there is no frontend nginx HTTP 405 for the login request after the fix is deployed.

## Testing plan
- Config inspection:
  - Confirm `frontend/nginx.conf` contains a `/api/` proxy block before SPA fallback handling.
  - Confirm `proxy_pass` targets `http://backend:8000/api/`.
  - Confirm forwarded headers and `client_max_body_size` are present.
- Docker build/restart:
  - `docker compose build frontend`
  - `docker compose up -d frontend`
  - If needed by deployment flow: `docker compose up -d --build frontend`
- Endpoint checks:
  - Use curl against the deployed/frontend origin for `POST /api/auth/login` with test credentials or a safe malformed payload and confirm response comes from backend behavior, not frontend nginx 405.
  - Check frontend nginx logs and backend logs for the same request.
  - Check a protected `/api` endpoint and confirm it reaches backend authentication/authorization handling.
- Browser checks:
  - Open the frontend application and verify static assets load.
  - Navigate to at least one client-side route directly and verify the SPA renders.
  - Attempt login in the browser and verify the request no longer fails with frontend nginx 405.

## Risk + rollback plan
- Risk: Invalid nginx syntax can prevent the frontend container from starting.
  - Mitigation: Build/recreate through Docker Compose and inspect container logs immediately.
  - Rollback: Restore the previous `frontend/nginx.conf` and rebuild/restart the previous frontend image.
- Risk: Incorrect `proxy_pass` path handling can duplicate or strip `/api` unexpectedly.
  - Mitigation: Verify actual backend logs for `/api/auth/login` and protected API paths.
  - Rollback: Restore previous config or use the stashed known-good proxy block exactly.
- Risk: API proxy block placed after SPA fallback may still route API requests incorrectly.
  - Mitigation: Ensure `location /api/` is explicit and takes precedence over `try_files` SPA fallback.
- Risk: Changing `client_max_body_size` too low can break uploads.
  - Mitigation: Use an existing known-good project value from prior config or current deployment expectations.

## Notes / links
- Related file: `frontend/nginx.conf`
- Related runtime services: Docker Compose `frontend` and `backend`
- Related symptom: browser `POST /api/auth/login` returns HTTP 405 from frontend nginx; backend receives no request.
- Reference: stashed prior nginx config with the expected `/api/` proxy block, if still available in git stash.

## Current status
Completed.

## What changed
- Shipped the frontend nginx API proxy restoration for production login/API routing.
- `frontend/nginx.conf` now includes a `/api/` proxy to the backend service so API requests are handled by FastAPI instead of the frontend static nginx fallback.
- The frontend service was rebuilt and restarted so the updated nginx configuration is active.
- No backend authentication behavior was changed; invalid login credentials still correctly return backend HTTP 401.
- No additional documentation updates were required by this change spec.

## How to verify
- Inspect `frontend/nginx.conf` and confirm it contains a `location /api/` block that proxies to `http://backend:8000/api/`, with forwarded headers and `client_max_body_size` configured.
- Rebuild and restart the frontend service, then confirm the frontend container starts successfully with the updated nginx configuration.
- Send a local `POST /api/auth/login` request with fake credentials through the frontend origin. Expected result: backend-auth HTTP 401, not frontend-nginx HTTP 405.
- Send a public `POST https://windwilly.nl/api/auth/login` request with fake credentials. Expected result: backend-auth HTTP 401, not frontend-nginx HTTP 405.
- Inspect backend logs after the login request. Expected result: logs show `POST /api/auth/login` reaching the backend.
- Run the frontend test suite. Expected result: all frontend tests pass.
- Run the frontend production build. Expected result: build succeeds.
- Run backend tests from the backend virtual environment. Expected result: all backend tests pass.

## Verification evidence
- Frontend nginx config contains the `/api` proxy required for login/API requests.
- Frontend rebuild/restart completed successfully.
- Local `POST /api/auth/login` with fake credentials returned HTTP 401 from backend behavior, not HTTP 405 from frontend nginx.
- Public `POST https://windwilly.nl/api/auth/login` with fake credentials returned HTTP 401 from backend behavior, not HTTP 405 from frontend nginx.
- Backend logs showed `POST /api/auth/login`, confirming the request reached FastAPI.
- Frontend tests passed: 94 passed.
- Frontend build passed.
- Backend tests passed from the backend virtual environment: `.venv` pytest reported 130 passed.
- System `pytest` failed because `fastapi` was missing from the system Python environment; this was replaced by the backend `.venv` pytest command, which passed.

---
Status: Completed  
Owner: optional  
Date: 2026-06-09
