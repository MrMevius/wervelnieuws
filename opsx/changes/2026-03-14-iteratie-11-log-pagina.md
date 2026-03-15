## Title
Iteratie 11 - Logpagina uitwerken en logoverzicht op Main

## Context
Volgens `ITERATIONS.md` moet in Iteratie 11 de logfunctie op de hoofdpagina worden uitgewerkt en moet er steeds een losse featuresuggestie worden voorgesteld. In de huidige frontend is `/log` nog een dummy, terwijl er al audit-events in de backend aanwezig zijn.

## Goals / Non-goals
### Goals
- De route `/log` toont echte logregels vanuit de backend.
- Gebruikers kunnen logregels filteren op actie, onderwerp (zoekterm) en periode.
- De Main-pagina toont een compact blok met recente logregels.
- De Main-pagina toont exact 1 featuresuggestie in begrijpelijke taal.
- About/changelog bevat een eindgebruikersvriendelijke entry voor deze iteratie.

### Non-goals
- Geen wijziging van publicatiekanalen of publicatiecontracten.
- Geen aanpassing van worker/scheduler-engine.
- Geen grootschalig redesign buiten de Log- en Main-gerelateerde secties.

## Proposed approach
1. Backend uitbreiden met een activity-feed endpoint voor ingelogde gebruikers, inclusief basisfilters.
2. Frontend API-client uitbreiden met type en requestfunctie voor de gefilterde activity-feed.
3. Dummy `Log`-pagina vervangen door een echte `LogPage` met filters en loading/empty/error states.
4. Main uitbreiden met een compacte recente-log widget en een losse featuresuggestie.
5. Tests en About changelog bijwerken.

## Implementation steps (ordered)
1. Voeg backend schema en endpoint toe voor activity-feed met queryfilters.
2. Voeg frontend API type/functie toe voor logfeed met queryparams.
3. Vervang de huidige `/log` dummy door een echte logweergave.
4. Voeg op Main een compact recente-log blok en feature suggestie toe.
5. Werk backend en frontend tests bij.
6. Werk About/changelog bij met een nieuwe iteratie-entry.
7. Draai verificatiecommando's en leg bewijs vast.

## Acceptance criteria
- `/log` toont echte logregels in plaats van dummytekst.
- De logpagina ondersteunt filteren op actie, onderwerp en periode.
- Main toont recente logregels op basis van dezelfde backend feed.
- Main toont exact 1 nieuwe featuresuggestie.
- About bevat een nieuwe changelog-entry in begrijpelijke taal.
- `cd backend && pytest -q` en `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd backend && pytest tests/test_admin_api.py tests/test_auth_and_topics.py -q`
- `cd backend && pytest -q`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: eventtypen zijn technisch en minder duidelijk voor eindgebruikers.
  - Mitigatie: frontend mapping naar leesbare labels.
- Risico: grote loglijsten kunnen traag laden.
  - Mitigatie: limiet en periodefilter standaard toepassen.
- Rollback:
  - log-endpoint en frontend logweergave terugdraaien,
  - Main logblok/featuresuggestie verwijderen,
  - changelog-entry verwijderen.

## Notes / links
- Bron: `ITERATIONS.md` (Iteratie #11).
- Relevante bestaande bouwsteen: audit-events in backend (`AuditEvent`).

## Current status
Completed

## What changed
- Backend activity-feed toegevoegd voor ingelogde gebruikers:
  - `backend/app/api/content.py` heeft nu `GET /api/content/activity` met filters `event_type`, `topic`, `period` (`24h|7d|30d|all`) en `limit`.
  - Endpoint levert verrijkte rijen met actor, onderwerp en `details_json` vanuit `AuditEvent` + joins op `User` en `Topic`.
  - `backend/app/schemas/versioning.py` uitgebreid met `ActivityFeedItemResponse`.
- Frontend API uitgebreid:
  - `frontend/src/lib/api/client.ts` bevat `ActivityFeedItem`, `ActivityFeedFilters` en `listActivityFeed()`.
- Logpagina uitgewerkt:
  - `frontend/src/app/App.tsx` route `/log` gebruikt nu `LogPage` i.p.v. dummy.
  - `LogPage` ondersteunt filteren op actie, onderwerp en periode, toont loading/empty/error, en rendert logtabel.
  - Eventtypen worden vertaald naar leesbare labels via frontend mapping.
- Main-pagina uitgebreid:
  - `frontend/src/app/App.tsx` toont nu een blok `Recente logregels` op Main met snelle link naar volledig logboek.
  - Main toont exact 1 featuresuggestie (`Feature suggestie #1`).
- Styling toegevoegd:
  - `frontend/src/styles.css` uitgebreid met stijlen voor main-logblok, featuresuggestie en logfilterformulier.
- Tests bijgewerkt/uitgebreid:
  - `backend/tests/test_auth_and_topics.py` bevat nu tests voor activity-feed beschikbaarheid en filtering.
  - `frontend/src/app/App.test.tsx` bevat tests voor Main-logblok/featuresuggestie en Log-pagina filters.
- Backend tests gestabiliseerd op actieve thema's:
  - `backend/tests/test_generation.py` gebruikt voor websearch-trace test een actief thema (`Planning`).
  - `backend/tests/test_ingestion.py` gebruikt actieve thema's (`Omgeving`, `Planning`).
  - `backend/tests/test_review_endpoints.py` gebruikt actief thema (`Planning`) in beide topic-aanmaken.
- About changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat iteratie `16` met eindgebruikervriendelijke toelichting.

## How to verify
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_admin_api.py tests/test_auth_and_topics.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_admin_api.py tests/test_auth_and_topics.py -q"` -> geslaagd (`26 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> in een oude container-image deels mislukt (`5 failed, 64 passed`) door verouderde testdata met niet-actieve thema's.
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd (`71 passed`).
- `cd frontend && npm test -- --run` -> geslaagd (`32 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite productiebuild afgerond).
