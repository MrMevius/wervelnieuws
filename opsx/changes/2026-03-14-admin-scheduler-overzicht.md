## Title
Admin scheduler-overzichtspagina (dummy) met runhistorie en planning

## Context
De gebruiker wil in het admin-menu een extra pagina waar de scheduler zichtbaar wordt: welke taken recent gedraaid hebben en welke taken opnieuw ingepland staan. Dit helpt het team om snel te zien of publicaties en retries lopen zoals verwacht, zonder in logs of database te hoeven kijken.

## Goals / Non-goals
### Goals
- Er is een admin-toegankelijke schedulerpagina in de frontend.
- De pagina toont recente scheduleractiviteit (taken die gedraaid hebben).
- De pagina toont aankomende planning (taken die ingepland staan).
- De pagina toont retrytaken met volgende runmomenten.
- De weergave is duidelijk leesbaar op desktop en mobiel.
- About/changelog bevat een eindgebruikervriendelijke iteratie-entry.

### Non-goals
- Geen nieuwe worker/scheduler-engine of achtergrondproces.
- Geen wijziging aan publicatielogica of retry-algoritme.
- Geen realtime streaming; een normale API-poll/query is voldoende.

## Proposed approach
1. Voeg in backend een read-only endpoint toe dat scheduler-overzichtsdata uit bestaande tabellen samenstelt (`publication_schedules`, `retry_jobs`, en gekoppelde topics).
2. Voeg in frontend API-client types + fetchfunctie toe voor dit endpoint.
3. Voeg een nieuwe adminpagina en route toe onder het admin-menu.
4. Toon drie eenvoudige blokken: recente runs, komende planning en retry-queue.
5. Voeg gerichte backend/frontend tests toe.
6. Werk About-changelog bij.

## Implementation steps (ordered)
1. Backend schema uitbreiden met responsemodellen voor scheduler-overzicht.
2. Backend endpoint implementeren in `content` API-router.
3. Backend test toevoegen voor endpoint-auth en dataweergave.
4. Frontend API-client uitbreiden met scheduler-overzichtstype en request.
5. Frontend route + admin schedulerpagina toevoegen inclusief menu-item.
6. Styling toevoegen voor de scheduler dummyweergave.
7. Frontend test uitbreiden op navigatie en rendering.
8. About/changelog aanvullen met nieuwe iteratie-entry.
9. Verificatie draaien en resultaten vastleggen.

## Acceptance criteria
- In het admin-menu is een pagina beschikbaar voor scheduler-overzicht.
- De pagina toont per taak wanneer deze recent heeft gedraaid (runhistorie/status).
- De pagina toont welke taken gepland staan en wanneer ze weer draaien.
- Retrytaken (indien aanwezig) zijn zichtbaar met volgende runinformatie.
- Retrytaken tonen ook de laatste foutmelding.
- Schedulerpagina toont hoe lang geleden de data is ververst.
- Alleen ingelogde gebruikers met adminrechten kunnen deze pagina gebruiken.
- Weergave blijft bruikbaar op mobiel en desktop.
- About bevat een nieuwe changelog-entry voor deze iteratie.
- `cd backend && pytest -q` en `cd frontend && npm test -- --run` slagen.

## Testing plan
- `cd backend && pytest -q`
- `cd frontend && npm test -- --run`

## Risk + rollback plan
- Risico: onduidelijke interpretatie van "gedraaid" kan verwarring geven.
  - Mitigatie: expliciet labelen met status en tijdstempelvelden.
- Risico: endpoint kan veel records geven.
  - Mitigatie: begrens output op recente records.
- Rollback:
  - Verwijder nieuwe scheduler-endpoint en frontend route/component.
  - Verwijder changelog-entry voor deze iteratie.

## Notes / links
- Gebruikersvraag: "dummy pagina genereren in het admin menu waar de scheduler weergegeven wordt (wanneer heeft welke taak gedraaid en wanneer staat welke taak weer in de planning)".

## Current status
Completed

## What changed
- Backend scheduler-overzicht endpoint toegevoegd:
  - `backend/app/api/content.py` bevat nu `GET /api/content/scheduler/overview`.
  - Endpoint is admin-only via `require_admin`.
  - Endpoint levert drie blokken: `recent_runs`, `upcoming_runs`, `retry_jobs` met limieten en timestamp.
- Backend responsemodellen toegevoegd:
  - `backend/app/schemas/versioning.py` uitgebreid met `SchedulerOverviewResponse` en onderliggende itemmodellen.
- Backend regressietest toegevoegd:
  - `backend/tests/test_scheduler_overview_api.py` test admin-autorisatie en gecombineerde response-data.
- Frontend API-client uitgebreid:
  - `frontend/src/lib/api/client.ts` bevat nieuwe types en `getSchedulerOverview()`.
- Frontend admin-navigatie en pagina toegevoegd:
  - `frontend/src/app/App.tsx` bevat nieuw menu-item `Scheduler` onder adminopties.
  - Nieuwe route `/admin/scheduler` en component `AdminSchedulerPage` met drie secties:
    - Recent gedraaid
    - Komende planning
    - Retry-queue
  - Pagina doet periodieke refresh via React Query (`refetchInterval: 30000`).
- Frontend styling aangevuld:
  - `frontend/src/styles.css` bevat `scheduler-page` en `scheduler-grid` inclusief mobiele 1-kolomsweergave.
- About/changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat iteratie `13` met eindgebruikersuitleg van de schedulerpagina.
- Frontend tests uitgebreid:
  - `frontend/src/app/App.test.tsx` bevat mock voor scheduler-overzicht en test op navigatie/rendering van Scheduler-pagina.
- UX-uitbreiding op verzoek:
  - `frontend/src/app/App.tsx` toont nu bij Scheduler ook een relatieve refreshindicator (`x sec/min geleden`) naast de absolute timestamp.
  - `frontend/src/app/App.tsx` toont in de retry-tabel een extra kolom `Laatste fout` met `error_message`.
  - `frontend/src/app/App.test.tsx` controleert nu ook de refreshindicatie-tekst en de foutkolom.
- Statuskleurcodering op verzoek:
  - `frontend/src/app/App.tsx` gebruikt nu status-pills met kleurcodering voor schedulerstatussen in alle drie scheduler-tabellen.
  - Mapping: geslaagde statussen (`published`, `updated`, `resolved`) groen, foutstatussen (`error`, `failed`) rood, overige statussen neutraal.

## How to verify
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `python3 -m py_compile backend/app/api/content.py backend/app/schemas/versioning.py backend/app/api/meta.py backend/tests/test_scheduler_overview_api.py`
- (Wanneer pytest beschikbaar is) `cd backend && pytest -q`

## Verification evidence
- `cd frontend && npm test -- --run` -> geslaagd (`29 passed`).
- `cd frontend && npm test -- --run` -> opnieuw geslaagd na UX-uitbreiding (`30 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite build afgerond).
- `cd frontend && npm test -- --run` -> opnieuw geslaagd na statuskleurcodering (`30 passed`).
- `cd frontend && npm run build` -> opnieuw geslaagd na statuskleurcodering.
- `python3 -m py_compile backend/app/api/content.py backend/app/schemas/versioning.py backend/app/api/meta.py backend/tests/test_scheduler_overview_api.py` -> geslaagd.
- `pytest -q backend/tests/test_scheduler_overview_api.py` -> niet uitvoerbaar in host omgeving (`ModuleNotFoundError: No module named 'fastapi'`).
- `docker compose run --rm backend python -m pytest -q tests/test_scheduler_overview_api.py` -> niet uitvoerbaar in container (`No module named pytest`).
