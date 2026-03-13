## Title
Iteratie 10 - Planning uitbreiden met verplichte projectkoppeling

## Context
In iteratie 10 is gevraagd om de planning uit te breiden met projectkoppeling. In de huidige situatie hebben planningsregels (topics) nog geen expliciete koppeling met een project, terwijl databasebronnen wel per project zijn georganiseerd. Daardoor ontbreekt consistente projectsturing in planning, import en AI-context.

## Goals / Non-goals
### Goals
- Elke planningsregel heeft exact een gekoppeld project.
- Planning UI toont project per regel en ondersteunt filter/sort op project.
- Handmatig toevoegen van planningsregels vereist projectkeuze.
- CSV-import ondersteunt projectkolom en valideert projectnaam.
- AI-retrieval van databasebronnen volgt het project van de planningsregel.
- About changelog bevat een iteratie 10-entry in begrijpelijke taal.

### Non-goals
- Geen wijziging van publicatiekanalen of publicatiecontracten.
- Geen herontwerp van de planningsdetailpagina.
- Geen multi-project koppeling per planningsregel.

## Proposed approach
1. Breid topic-datamodel uit met verplichte `project_id` (FK naar `projects`).
2. Breid topic API/schemas uit met projectvelden en projectvalidatie.
3. Breid CSV-import uit met extra kolom `project` en naam-naar-id mapping.
4. Filter database-retrieval op `topic.project_id`.
5. Breid planningpagina uit met projectselectie, projectkolom en projectfilter.
6. Werk backend/frontend tests en About changelog bij.

## Implementation steps (ordered)
1. Alembic migratie toevoegen voor `topics.project_id` met backfill naar default project.
2. Models + repository uitbreiden met project-relatie op topics.
3. Topic schemas/API aanpassen voor projectvalidatie en projectweergave.
4. CSV-import aanpassen naar verplichte projectkolom.
5. RetrievalService aanpassen met projectfilter voor databasehits.
6. Frontend API types/calls aanpassen voor project op topics.
7. Planning UI aanpassen (verplicht project, filter, kolom, sort).
8. Backend- en frontendtests updaten/aanvullen.
9. About changelog iteratie 10 toevoegen.
10. Verificatie draaien en bewijs vastleggen.

## Acceptance criteria
- Een nieuwe planningsregel kan alleen met een geldig actief project worden aangemaakt.
- Planningoverzicht toont project per regel en ondersteunt projectfilter.
- CSV-import accepteert projectkolom en geeft duidelijke fout bij onbekend/inactief project.
- AI gebruikt bij database-retrieval alleen passages uit hetzelfde project als de planningsregel.
- About bevat een iteratie 10 changelog-entry.

## Testing plan
- Migrations:
  - `docker compose run --rm migrate`
- Backend targeted:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_auth_and_topics.py tests/test_planning_import_api.py tests/test_generation.py tests/test_retrieval.py -q"`
- Backend full:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`

## Risk + rollback plan
- Risico: bestaande topics zonder project in bestaande omgevingen.
  - Mitigatie: migratie backfillt bestaande topics naar default project.
- Risico: CSV-bestanden zonder projectkolom falen.
  - Mitigatie: duidelijke foutmelding met exact verwacht kolomformaat.
- Rollback:
  - Migratie downgraden,
  - projectvelden uit topic API/UI verwijderen,
  - retrievalfilter op project terugdraaien.

## Notes / links
- Bronwens: `ITERATIONS.md` (Iteratie #10)
- Vorige iteratie: `opsx/changes/2026-03-13-iteratie-9-tekstgeneratie-genai-config-websearch.md`

## Current status
Completed

## What changed
- Datamodel uitgebreid met verplichte projectkoppeling op topics:
  - `backend/app/models/entities.py`: `Topic.project_id` (FK), `Topic.project` relatie en `project_name` property.
  - `backend/alembic/versions/20260313_0011_topics_project_id.py`: migratie met backfill van bestaande topics naar default project `Windpark de Boldijk`, inclusief index en foreign key.
- Topic API/schemas uitgebreid met projectvelden en validatie:
  - `backend/app/schemas/topic.py`: `project_id` in create/update en `project_id` + `project_name` in response.
  - `backend/app/api/topics.py`: actieve projectvalidatie bij create/update, CSV-import uitgebreid met verplichte kolom `project`, en default project bootstrap.
  - `backend/app/repositories/topic_repository.py`: eager loading van projectrelatie voor lijst/detail.
- AI-retrieval projectbewust gemaakt:
  - `backend/app/services/retrieval_service.py`: databasehits gefilterd op `topic.project_id`.
- Frontend planning uitgebreid met projectfunctionaliteit:
  - `frontend/src/lib/api/client.ts`: `Topic` en `CreateTopicPayload` uitgebreid met projectvelden.
  - `frontend/src/app/App.tsx`: verplicht projectselect bij nieuwe planningsregel, projectkolom in tabel, sortering op project, projectfilter en bijgewerkte CSV-kolomhulp/fouttekst.
- Tests bijgewerkt en uitgebreid:
  - Backend tests aangepast voor verplichte `project_id` in topic-creatie (meerdere testmodules).
  - Nieuwe regressietest toegevoegd: projectfiltering van retrieval in `backend/tests/test_retrieval.py`.
  - Frontend testdata en planningverwachtingen bijgewerkt in `frontend/src/app/App.test.tsx`.
- About changelog uitgebreid met iteratie 10 entry:
  - `backend/app/api/meta.py`.

## How to verify
- `docker compose run --rm migrate`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_auth_and_topics.py tests/test_planning_import_api.py tests/test_generation.py tests/test_retrieval.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `docker compose run --rm migrate` -> geslaagd (Alembic context gestart zonder fouten).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_auth_and_topics.py tests/test_planning_import_api.py tests/test_generation.py tests/test_retrieval.py -q"` -> geslaagd (`8 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd (`58 passed`).
- `cd frontend && npm test -- --run` -> geslaagd (`27 passed`).
- `cd frontend && npm run build` -> geslaagd (Vite build afgerond).
