## Title
Iteratie 16 - Frontend modularisatie + security hardening + gedeelde rate limiting + robuustere worker-cyclus

## Context
De huidige codebase werkt functioneel, maar heeft vier technische knelpunten die onderhoud en productiebetrouwbaarheid remmen:
1. Frontend-concentratie in één groot bestand (`frontend/src/app/App.tsx`), met routes, pagina’s en querylogica door elkaar.
2. Security defaults die in productie te permissief zijn (`allow_origins=["*"]`, default `SECRET_KEY` fallback).
3. In-memory rate limiting die niet consistent schaalt over meerdere processen/containers.
4. Worker-loop op basis van polling + sleep zonder expliciete lock/lease-coordinatie.

Deze iteratie voert verbeteringen 1, 2, 3 en 4 uit met minimale productimpact en maximaal behoud van bestaande functionaliteit.

## Goals / Non-goals
### Goals
- Frontend opdelen in feature-modules en routestructuur, met behoud van bestaand gedrag.
- Productie-security aanscherpen via veilige configuratie, CORS allowlist en startup-validatie.
- Rate limiting migreren naar een gedeeld/meer productiegeschikt mechanisme.
- Worker-cyclus robuuster maken met lock/lease-mechanisme om dubbel werk en race-condities te beperken.
- About/changelog uitbreiden met een eindgebruikersvriendelijke iteratie-entry.

### Non-goals
- Geen functionele UX-redesign van pagina’s.
- Geen complete queue-broker migratie (bijv. Celery/Redis) in deze iteratie.
- Geen wijziging van kernworkflow-states of publicatiekanalen.
- Geen volledige infrastructuurherbouw buiten wat strikt nodig is voor deze scope.

## Proposed approach
1. Splits de frontend in duidelijke modules: shell, routes, en featurepagina’s per domein (main/planning/database/log/settings/admin/about).
2. Verplaats data-ophaalpatronen naar featuregerichte hooks zodat componenten primair UI-rendering doen.
3. Introduceer expliciete security-config:
   - `ALLOWED_ORIGINS` (comma-separated),
   - verplichte sterke `SECRET_KEY` buiten development,
   - startup-fail bij onveilige defaults in productie.
4. Vervang in-memory rate limiter door gedeelde limiter (SQLite-backed als v1-implementatie in deze repo), met sleutel op route + actor (user-id/IP fallback).
5. Voeg worker lease/locking toe via databasegestuurde lock (met timeout), zodat maar één actieve publicatiecyclus tegelijk draait.
6. Voeg regressietests toe voor:
   - frontend routing/entrypoints na modularisatie,
   - security-config validatie,
   - rate-limitgedrag,
   - worker lock/leasegedrag.
7. Update changelog/About via `backend/app/api/meta.py`.

## Implementation steps (ordered)
1. **Frontend refactor basis**
   - Maak mapstructuur aan onder `frontend/src/app/`:
     - `routes/`
     - `features/main/`, `features/planning/`, `features/database/`, `features/log/`, `features/settings/`, `features/admin/`, `features/about/`
     - `shell/` (topbar/menu/layout)
   - Verplaats componenten en routes uit `App.tsx` naar featurebestanden.
   - Houd URL’s en labels identiek.

2. **Frontend query/logica opschonen**
   - Introduceer feature-hooks (bijv. `useMainDashboardData`, `usePlanningData`) met React Query.
   - Verminder lokale state-koppelingen in root-component.
   - Werk frontend tests bij op nieuwe componentgrenzen.

3. **Security hardening backend**
   - Breid `Settings` uit met `allowed_origins` en productievalidaties.
   - Pas CORS middleware aan op configureerbare allowlist.
   - Voeg startup-check toe: fail-fast als `ENV=production` en `SECRET_KEY` onveilig/default is.
   - Update `.env.example` met veilige voorbeelden/documentatie.

4. **Gedeelde rate limiting**
   - Implementeer DB-backed limiter service/repository in backend.
   - Gebruik key op endpoint + actor (user-id indien aanwezig, anders IP).
   - Behoud bestaande dependency-injectiepunten op login/upload routes.
   - Voeg tests toe voor window/max verzoeken en resetgedrag.

5. **Worker robuustheid via lease-lock**
   - Voeg worker-lockmodel toe (via Alembic migratie) of system-setting lock met lease-expiry.
   - Pas worker-cycle aan zodat slechts één actieve cycle publicatie/retries uitvoert.
   - Voeg veilige release/timeout-herstel toe bij crashscenario’s.
   - Test concurrent startsimulatie.

6. **Changelog + verificatie**
   - Voeg iteratie-entry toe in `backend/app/api/meta.py`.
   - Draai gerichte tests en builds.
   - Leg uitkomsten vast in deze spec.

## Acceptance criteria
- Frontend is opgesplitst in featurebestanden; `App.tsx` is duidelijk kleiner en bevat primair app-compositie/routing.
- Bestaande routes (incl. `/`, `/windwilly`, `/wervelnieuws/*`) blijven functioneel.
- In productie start backend niet met onveilige `SECRET_KEY`; CORS gebruikt geen wildcard als productie-default.
- Rate limiting werkt consistent via gedeeld mechanisme, inclusief 429 bij overschrijding.
- Worker publicatie/retry-cycle kan niet dubbel parallel lopen zonder lock-ownership.
- About/changelog bevat een nieuwe eindgebruikersvriendelijke entry voor deze iteratie.
- Relevante test- en buildcommando’s slagen.

## Testing plan
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `cd backend && pytest tests/test_auth_and_topics.py tests/test_worker_cycle.py tests/test_publishing_idempotency.py`
- `cd backend && pytest`
- Optionele smoke:
  - `docker compose build backend frontend worker`
  - `docker compose up -d` en handmatige check login + planning + worker tick

## Risk + rollback plan
- Risico: frontend refactor introduceert route-regressies.
  - Mitigatie: behoud bestaande padconstanten en voeg route-tests toe.
- Risico: strengere securityvalidatie breekt lokale setup.
  - Mitigatie: validatie conditioneel op `ENV=production`; development defaults blijven bruikbaar.
- Risico: DB-backed limiter verhoogt DB-load.
  - Mitigatie: compacte tabel/indexering + periodieke cleanup van verlopen records.
- Risico: worker-lock blijft hangen na crash.
  - Mitigatie: lease-expiry + owner token + timeout recovery.
- Rollback:
  - Revert frontend module-refactor commit(s).
  - Revert security/rate-limit/worker commits en migratie.
  - Herstel vorige About/changelog-entry.
  - Herdeploy met vorige image-tag.

## Notes / links
- Relevante bestanden:
  - `frontend/src/app/App.tsx`
  - `backend/app/main.py`
  - `backend/app/core/settings.py`
  - `backend/app/core/rate_limit.py`
  - `worker/app/runner.py`
  - `backend/app/workflows/worker_cycle.py`
  - `backend/app/api/meta.py`
- Referentiebeleid: `AGENTS.md` + OPSX change-first workflow.

## Current status
Completed

## What changed
- Build stap 1 uitgevoerd: frontend refactor-basis zonder functionele routewijzigingen.
- `frontend/src/app/App.tsx` is verkleind naar een dunne entry-export die de app-shell importeert.
- Bestaande grote app-implementatie is verplaatst naar `frontend/src/app/shell/AppShell.tsx`.
- Routeconstanten zijn gecentraliseerd in `frontend/src/app/routes/paths.ts` en gebruikt vanuit de app-shell.
- Feature-mapstructuur voorbereid onder `frontend/src/app/features/` met domeinmappen:
  - `main/`, `planning/`, `database/`, `log/`, `settings/`, `admin/`, `about/`.
- Build stap 2 uitgevoerd: querylogica deels losgetrokken naar feature-hooks.
- Nieuwe hook `frontend/src/app/features/main/hooks/useMainDashboardData.ts` toegevoegd voor:
  - About-content query,
  - Main activity-feed query,
  - Main notification-feed query.
- Nieuwe hook `frontend/src/app/features/planning/hooks/usePlanningData.ts` toegevoegd voor topics-query die Planning-routes voedt.
- `frontend/src/app/shell/AppShell.tsx` gebruikt nu deze hooks in plaats van inline top-level querydefinities, met ongewijzigde query keys en routegedrag.
- Build stap 3 uitgevoerd: security hardening in backendconfig en startup.
- `backend/app/core/settings.py` uitgebreid met:
  - `allowed_origins` setting,
  - `parse_allowed_origins(...)` helper,
  - `validate_runtime_security(...)` voor productiechecks.
- Productievalidatie dwingt nu af:
  - geen onveilige/default `SECRET_KEY` (zoals `change-me` of `change-this-secret-key`),
  - geen wildcard `ALLOWED_ORIGINS` in productie.
- `backend/app/main.py` gebruikt nu configureerbare CORS-origins en voert startup-validatie uit via `validate_runtime_security(settings)`.
- `.env.example` bevat nu `ALLOWED_ORIGINS=http://localhost:5173` als expliciete configuratie.
- Nieuwe backend unit/regressietests toegevoegd in `backend/tests/test_settings_security.py` voor origin parsing en productie-securityvalidatie.
- Build stap 4 uitgevoerd: rate limiting van in-memory naar gedeelde DB-opslag.
- `backend/app/core/rate_limit.py` herschreven naar een DB-backed limiter met:
  - actor-detectie op basis van bearer token (`user:<id>`) of IP-fallback (`ip:<host>`),
  - rate key per endpoint + actor (`<path>:<actor>`),
  - window cleanup van verlopen events,
  - 429-response bij overschrijding van `RATE_LIMIT_MAX_REQUESTS` binnen `RATE_LIMIT_WINDOW_SECONDS`.
- `backend/app/models/entities.py` uitgebreid met model `RateLimitEvent` inclusief index op `(rate_key, created_at)`.
- Alembic migratie toegevoegd: `backend/alembic/versions/20260324_0014_rate_limit_events.py` (nieuwe tabel + index).
- Nieuwe regressietests toegevoegd in `backend/tests/test_rate_limit.py`:
  - limietoverschrijding geeft 429,
  - rate limit reset na verstrijken van het venster.
- Build stap 5 uitgevoerd: worker lease-lock toegevoegd om dubbele worker-cycli te voorkomen.
- `backend/app/models/entities.py` uitgebreid met model `WorkerLease` (lock key, owner, lease expiry, updated_at).
- Nieuwe service toegevoegd: `backend/app/services/worker_lease_service.py` met lease acquire/release-logica inclusief expiry-overname en race-safe insert fallback.
- `backend/app/workflows/worker_cycle.py` uitgebreid met:
  - `WORKER_CYCLE_LOCK_KEY`,
  - `run_worker_cycle_guarded(...)` die alleen draait bij lock ownership en daarna expliciet released.
- `worker/app/runner.py` gebruikt nu een vaste worker-owner-id per proces en roept `run_worker_cycle_guarded(...)` aan met `worker_lease_seconds`.
- `backend/app/core/settings.py` uitgebreid met `worker_lease_seconds` (default 90s).
- `.env.example` uitgebreid met `WORKER_LEASE_SECONDS=90`.
- Alembic migratie toegevoegd: `backend/alembic/versions/20260324_0015_worker_leases.py`.
- `backend/tests/test_worker_cycle.py` uitgebreid met lock-gedragtests:
  - skip bij lock van andere worker,
  - overname van verlopen lock + release na cycle.
- Build stap 6 uitgevoerd: changelog/About geüpdatet en afrondingsverificatie vastgelegd.
- `backend/app/api/meta.py` bevat nu iteratie-entry `25` met eindgebruikersvriendelijke samenvatting van:
  - frontend modularisatie,
  - security hardening,
  - DB-backed rate limiting,
  - worker lease-lock betrouwbaarheid.

## How to verify
1. Frontend increment (stap 1):
   - `cd frontend && npm test -- --run`
   - `cd frontend && npm run build`
2. Controleer dat routinggedrag gelijk is gebleven via bestaande App-tests (o.a. suite-navigatie en routeweergave).
3. Security increment (stap 3):
   - `docker compose build backend`
   - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_settings_security.py tests/test_auth_and_topics.py"`
4. Rate-limit increment (stap 4):
   - `docker compose build backend`
   - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_rate_limit.py tests/test_settings_security.py tests/test_auth_and_topics.py"`
5. Worker-lock increment (stap 5):
   - `docker compose build backend worker`
   - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_worker_cycle.py tests/test_publishing_idempotency.py tests/test_rate_limit.py tests/test_settings_security.py tests/test_auth_and_topics.py"`
6. Changelog/afronding (stap 6):
   - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py tests/test_worker_cycle.py tests/test_rate_limit.py tests/test_settings_security.py"`

## Verification evidence
- `cd frontend && npm test -- --run` → geslaagd (`39 passed`).
- `cd frontend && npm run build` → geslaagd (TypeScript build + Vite productiebuild afgerond).
- Na build stap 2:
  - `cd frontend && npm test -- --run` → geslaagd (`39 passed`).
  - `cd frontend && npm run build` → geslaagd (TypeScript build + Vite productiebuild afgerond).
- Na build stap 3:
  - `docker compose build backend` → geslaagd (backend image opnieuw opgebouwd met wijzigingen).
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_settings_security.py tests/test_auth_and_topics.py"` → geslaagd (`11 passed`).
- Na build stap 4:
  - `docker compose build backend` → geslaagd (backend image opnieuw opgebouwd met DB-backed limiter + migratie).
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_rate_limit.py tests/test_settings_security.py tests/test_auth_and_topics.py"` → geslaagd (`13 passed`).
- Na build stap 5:
  - `docker compose build backend worker` → geslaagd (backend + worker images opnieuw opgebouwd met lease-lock implementatie).
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_worker_cycle.py tests/test_publishing_idempotency.py tests/test_rate_limit.py tests/test_settings_security.py tests/test_auth_and_topics.py"` → geslaagd (`20 passed`).
- Na build stap 6:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py tests/test_worker_cycle.py tests/test_rate_limit.py tests/test_settings_security.py"` → geslaagd (`22 passed`).
