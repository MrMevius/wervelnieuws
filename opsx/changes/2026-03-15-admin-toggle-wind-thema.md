## Title
Admin-toggle voor globaal wind-thema

## Context
De UI krijgt subtiele windturbine-accenten. De gebruiker wil dat admins dit wind-thema centraal kunnen aan- of uitzetten voor alle gebruikers.

## Goals / Non-goals
### Goals
- Voeg een globale instelling toe voor wind-thema aan/uit.
- Maak beheer van deze instelling beschikbaar voor admins.
- Maak de instelling uitleesbaar voor alle ingelogde gebruikers.
- Laat frontend-accenten alleen zien wanneer de instelling aan staat.

### Non-goals
- Geen per-gebruiker voorkeur voor het wind-thema.
- Geen redesign van pagina-indeling of workflow.
- Geen wijzigingen in publicatie-, generatie- of schedulerlogica.

## Proposed approach
1. Backend: sla globale UI-setting op in `system_settings` als JSON.
2. Backend: voeg admin endpoint toe om de setting op te halen en te wijzigen.
3. Backend: voeg meta endpoint toe om de setting read-only op te halen voor ingelogde gebruikers.
4. Frontend: lees setting in App, zet root-attribuut en toon wind-accenten conditioneel.
5. Frontend: voeg adminbediening toe in Admin-tab.
6. Werk tests en About-changelog bij.

## Implementation steps (ordered)
1. Voeg schemas toe voor UI-settings request/response.
2. Implementeer `/api/admin/ui-settings` (GET/PATCH) met admin-check.
3. Implementeer `/api/meta/ui-settings` (GET) voor ingelogde gebruikers.
4. Breid frontend API-client uit met UI-settings calls.
5. Koppel App-root attribuut aan setting en voeg admin-toggle UI toe.
6. Voeg/actualiseer backend- en frontend-tests.
7. Update About-changelog entry.

## Acceptance criteria
- Admin kan via de Admin-pagina het globale wind-thema aan/uit zetten.
- Niet-admins kunnen deze instelling niet aanpassen (API geeft 403).
- Alle gebruikers zien wind-accenten alleen als de globale setting aan staat.
- De setting blijft bewaard via `system_settings`.
- `cd backend && pytest tests/test_admin_api.py tests/test_meta_and_me.py -q` slaagt.
- `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd backend && pytest tests/test_admin_api.py tests/test_meta_and_me.py -q`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: incorrecte default schakelt accent onverwacht uit.
  - Mitigatie: default `wind_theme_enabled = true`.
- Risico: frontend en admin-query raken uit sync.
  - Mitigatie: update beide query keys na admin wijziging.
- Rollback:
  - verwijder nieuwe endpoints,
  - verwijder frontend-toggle,
  - laat frontend altijd zonder wind-thema-attribuut renderen.

## Notes / links
- Aansluitend op wens: subtiele windturbines in thema met admin schakelaar.

## Current status
Completed

## What changed
- Backend UI-settings toegevoegd met globale opslag in `system_settings`:
  - Nieuwe admin endpoints in `backend/app/api/admin.py`:
    - `GET /api/admin/ui-settings`
    - `PATCH /api/admin/ui-settings`
  - Nieuwe read-only endpoint voor ingelogde gebruikers in `backend/app/api/meta.py`:
    - `GET /api/meta/ui-settings`
  - Nieuwe schemas:
    - `backend/app/schemas/admin.py`: `AdminUiSettingsResponse`, `UpdateAdminUiSettingsRequest`
    - `backend/app/schemas/meta.py`: `UiSettingsResponse`
- Frontend API-client uitgebreid in `frontend/src/lib/api/client.ts`:
  - Type `UiSettings`
  - Calls `getUiSettings`, `getAdminUiSettings`, `updateAdminUiSettings`
- Frontend gedrag en admin-bediening toegevoegd in `frontend/src/app/App.tsx`:
  - App leest globale setting via `/meta/ui-settings` en zet root-attribuut `data-wind-theme` op `on/off`.
  - Admin-tab Thema's bevat nu schakelaar `Wind-thema actief` die globale setting direct wijzigt.
  - Query-cache voor `ui-settings` en `admin-ui-settings` wordt synchroon bijgewerkt na admin-update.
- Subtiele windturbine-accenten conditioneel gemaakt in `frontend/src/styles.css`:
  - Nieuwe wind-accent CSS-variabelen voor light/dark.
  - Thema-accenten in body/topbar/hero.
  - Bij `data-wind-theme="off"` worden wind-accent variabelen transparant gezet.
- Tests uitgebreid:
  - `backend/tests/test_admin_api.py`: admin get/update + autorisatie voor UI-settings.
  - `backend/tests/test_meta_and_me.py`: read-only meta endpoint voor UI-settings.
  - `frontend/src/app/App.test.tsx`: admin kan globale wind-thema toggle bedienen.
- About/changelog aangevuld in `backend/app/api/meta.py` met iteratie `18` over wind-thema + adminschakelaar.

## How to verify
- `docker compose run --rm backend sh -lc "pip install -e .[dev] >/tmp/pip.log && pytest tests/test_admin_api.py tests/test_meta_and_me.py -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `docker compose run --rm backend sh -lc "pip install -e .[dev] >/tmp/pip.log && pytest tests/test_admin_api.py tests/test_meta_and_me.py -q"` -> geslaagd (`34 passed`).
- `cd frontend && npm test -- --run` -> geslaagd (`33 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite productiebuild afgerond).
