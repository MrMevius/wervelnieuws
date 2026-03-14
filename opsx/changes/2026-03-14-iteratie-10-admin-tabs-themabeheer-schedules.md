## Title
Iteratie 10 - Admin tabs, themabeheer en planningssjablonen

## Context
In `ITERATIONS.md` staat voor Iteratie 10 een aanvullende wens naast de reeds afgeronde projectkoppeling: het adminmenu opdelen in logische tabjes, themabeheer toevoegen op de admin/AI-kant, enkele logische schedules toevoegen, en nog een extra bruikbare adminfeature.

De huidige app heeft al adminfuncties (gebruikers, projecten, GenAI) en een losse schedulerpagina, maar geen tabstructuur binnen Admin, geen centraal beheerde themalijst en geen snel toepasbare planningssjablonen.

## Goals / Non-goals
### Goals
- Adminpagina werkt met duidelijke tabjes: `Gebruikers`, `Projecten`, `Thema's`, `AI`, `Scheduler`.
- Admin kan thema's beheren (toevoegen, hernoemen, activeren/deactiveren).
- Planning kan logische planningssjablonen ophalen en toepassen als voorinvulling.
- Extra adminfeature: tab met recent admin-activiteitsoverzicht.
- About/changelog bevat een eindgebruikervriendelijke Iteratie 10-entry.

### Non-goals
- Geen herontwerp van publicatiekanalen of publicatiecontracten.
- Geen wijziging van worker- of scheduler-engine.
- Geen ingrijpende datamodelwijziging van topics (theme blijft string op topic).

## Proposed approach
1. Voeg backend endpoints toe voor admin-thema's, schedule templates en admin-activiteiten op basis van `SystemSetting` + `AuditEvent`.
2. Voeg publieke endpoint toe voor actieve themaopties in planning (`/api/topics/themes`).
3. Breid planning UI uit met template-selectie en themaopties uit backend.
4. Herstructureer Admin UI naar tabnavigatie en verplaats bestaande secties naar tabs.
5. Werk tests en About changelog bij.

## Implementation steps (ordered)
1. Backend schemas uitbreiden voor thema's, templates en admin-activiteiten.
2. Backend admin API uitbreiden met:
   - `GET/POST/PATCH /api/admin/themes`
   - `GET /api/admin/schedule-templates`
   - `GET /api/admin/activity`
3. Topics API uitbreiden met `GET /api/topics/themes` (actieve thema's).
4. Frontend API client uitbreiden met typen/functies voor thema's, templates en activiteit.
5. Planningpagina uitbreiden met sjabloonselector en backend-themaopties.
6. Adminpagina omzetten naar tabstructuur met aparte sectiecomponenten.
7. Backend en frontend tests updaten/aanvullen.
8. About changelog aanvullen met Iteratie 10 update.
9. Verificatie draaien en bewijs vastleggen.

## Acceptance criteria
- Admin toont tabjes voor `Gebruikers`, `Projecten`, `Thema's`, `AI`, `Scheduler`.
- Admin kan thema's toevoegen en bestaande thema's hernoemen en activeren/deactiveren.
- Planning gebruikt actieve themaopties vanuit backend en blijft bruikbaar.
- Planning biedt ten minste drie logische planningssjablonen die formulierwaarden invullen.
- Admin toont een overzicht van recente admin-activiteiten.
- About bevat een nieuwe Iteratie 10 changelog-entry in begrijpelijke taal.
- `cd backend && pytest -q` en `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd backend && pytest tests/test_admin_api.py tests/test_auth_and_topics.py -q`
- `cd backend && pytest -q`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: thema's via settings kunnen vervuilde waarden bevatten.
  - Mitigatie: strikte normalisatie, deduplicatie en validatie op API-niveau.
- Risico: grote `App.tsx` kan kwetsbaar zijn bij UI-herstructurering.
  - Mitigatie: wijziging beperken tot duidelijke sectiecomponenten binnen bestaand bestand.
- Rollback:
  - Nieuwe admin/topics endpoints verwijderen,
  - frontend tab/sjabloon/themawijzigingen terugdraaien,
  - changelog-entry verwijderen.

## Notes / links
- Bron: `ITERATIONS.md` (Iteratie #10: admin-tabjes, thema's beheren, logische schedules, extra adminfeature).
- Bestaande afgeronde Iteratie 10 (projectkoppeling): `opsx/changes/2026-03-13-iteratie-10-planning-project-koppeling.md`.

## Current status
Completed

## What changed
- Backend uitgebreid met beheerde thema's, planningssjablonen en activiteitsoverzicht:
  - `backend/app/schemas/admin.py` bevat nu thema-, schedule-template- en admin-activiteit-response/requestmodellen.
  - `backend/app/api/admin.py` bevat nu:
    - `GET/POST/PATCH /api/admin/themes`
    - `GET /api/admin/schedule-templates`
    - `GET /api/admin/activity`
    - opslag/normalisatie via `SystemSetting` met defaults voor thema's en templates.
  - `backend/app/schemas/topic.py` uitgebreid met `TopicThemeOptionResponse` en `TopicScheduleTemplateResponse`.
  - `backend/app/api/topics.py` uitgebreid met:
    - `GET /api/topics/themes`
    - `GET /api/topics/schedule-templates`
    - validatie op actieve thema's bij topic create/update/CSV-import.
- Frontend API uitgebreid:
  - `frontend/src/lib/api/client.ts` bevat nieuwe types en requests voor admin-thema's, admin-activiteit, topic-thema's en topic-schedule-templates.
- Planningpagina uitgebreid:
  - `frontend/src/app/App.tsx` gebruikt nu backend-themaopties i.p.v. alleen lokale fallback,
  - nieuwe sjabloonselector vult onderwerp/thema/opmerkingen/planning voor,
  - opmerkingenveld toegevoegd aan handmatige planningsregel.
- Adminpagina omgezet naar tabstructuur met extra features:
  - `frontend/src/app/App.tsx` heeft tabs `Gebruikers`, `Projecten`, `Thema's`, `AI`, `Scheduler`, `Activiteit`.
  - Nieuwe tab `Thema's` ondersteunt toevoegen, hernoemen en activeren/deactiveren.
  - Nieuwe tab `Scheduler` toont recente runs en komende planning in admin.
  - Nieuwe tab `Activiteit` toont recente audit-events.
- Styling bijgewerkt:
  - `frontend/src/styles.css` uitgebreid met admin-tabstyling en planningformulier-aanpassingen.
- Tests bijgewerkt/uitgebreid:
  - `backend/tests/test_admin_api.py` bevat nieuwe tests voor thema-endpoints, schedule templates en activity endpoint.
  - `backend/tests/test_auth_and_topics.py` bevat tests voor topic-themaopties/templates en afwijzing van inactief thema.
  - `frontend/src/app/App.test.tsx` mocks en admin-tabtests aangepast aan nieuwe API-calls/tabgedrag.
- About changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat iteratie `10B` in begrijpelijke eindgebruikers-taal.

## How to verify
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_admin_api.py tests/test_auth_and_topics.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- (optioneel host-syntaxcheck) `python3 -m py_compile backend/app/api/admin.py backend/app/api/topics.py backend/app/schemas/admin.py backend/app/schemas/topic.py backend/app/api/meta.py backend/tests/test_admin_api.py backend/tests/test_auth_and_topics.py`

## Verification evidence
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_admin_api.py tests/test_auth_and_topics.py -q"` -> geslaagd (`21 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd (`64 passed`).
- `cd frontend && npm test -- --run` -> geslaagd (`30 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite productiebuild afgerond).
- `python3 -m py_compile ...` (gewijzigde backendbestanden) -> geslaagd.
