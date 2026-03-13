## Title
Iteratie 9 - Tekstgeneratie verfijning met GenAI-config en optionele websearch

## Context
Iteratie 8 levert multichannel redactie en kanaalspecifieke varianten op. Voor iteratie 9 is behoefte aan betere aansturing van generatiekwaliteit en beheer van GenAI-instellingen vanuit de admin-interface, zonder afhankelijk te blijven van alleen omgevingsvariabelen.

Daarnaast is gevraagd om een mogelijkheid voor websearch, maar met behoud van de v1-regel dat feiten primair uit lokale bronnen moeten komen en review transparant moet blijven.

## Goals / Non-goals
### Goals
- GenAI-configuratie beheerbaar maken vanuit Admin (backend API + frontend UI).
- Tekstgeneratie per doelmedium verder sturen via configureerbare prompts.
- Informatie uit `editorial_notes` en lokale bronbestanden (topic + database) expliciet blijven meenemen.
- Optionele websearch toevoegen als schakelbare uitbreiding, standaard uit.
- Bronherkomst transparant maken wanneer websearch gebruikt is.
- About changelog bijwerken met iteratie 09.

### Non-goals
- Geen herontwerp van de planningflow of publicatieworkflow.
- Geen vervanging van huidige RAG/indexering; alleen aanvullen.
- Geen automatische feitvalidatie-engine op webresultaten in deze iteratie.
- Geen nieuwe publicatiekanalen.

## Proposed approach
1. Introduceer een centrale GenAI-config (met veilige defaults) opgeslagen in `system_settings`.
2. Voeg admin-only endpoints toe voor ophalen en aanpassen van GenAI-config.
3. Refactor generatie zodat prompts en modelkeuze uit runtime-config komen.
4. Voeg optionele websearch-context toe aan promptopbouw, met duidelijke trace-markering.
5. Breid Admin UI uit met een GenAI-config sectie.
6. Dek de wijziging af met gerichte backend/frontend tests en update de About changelog.

## Implementation steps (ordered)
1. Backend schemas/service voor GenAI-config toevoegen (inclusief defaults, validatie, secret handling).
2. Admin API uitbreiden met `GET/PATCH /api/admin/genai-config`.
3. `OpenAIClient` en `GenerationService` aanpassen voor runtime-config en websearch-toggle.
4. `source_trace_json` uitbreiden met `websearch` bronitems wanneer gebruikt.
5. Frontend API-client uitbreiden met GenAI-config calls.
6. Admin pagina uitbreiden met GenAI-config formulier en opslagfeedback.
7. Backend tests uitbreiden voor GenAI-config endpoints en generatie/websearch gedrag.
8. Frontend tests uitbreiden voor Admin GenAI-config interacties.
9. About changelog iteratie 09 toevoegen.
10. Verificatie draaien en vastleggen.

## Acceptance criteria
- Admin kan GenAI-config ophalen en aanpassen via een beveiligde API.
- Admin UI bevat een bruikbare GenAI-config sectie met opslaan en validatiefeedback.
- Generatie voor website/facebook/nieuwsbrief gebruikt configureerbare systeem- en kanaalprompts.
- `editorial_notes` en lokale bronpassages blijven onderdeel van generatiecontext.
- Websearch is configureerbaar en standaard uit.
- Als websearch aan staat, wordt gebruikte webcontext traceerbaar vastgelegd als bronherkomst.
- About bevat een iteratie 09 changelog-entry in begrijpelijke eindgebruikers-taal.

## Testing plan
- Backend targeted:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_admin_api.py -q"`
- Backend full:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`

## Risk + rollback plan
- Risico: websearch introduceert ruis of minder betrouwbare context.
  - Mitigatie: standaard uit, alleen expliciet aan via admin-config, bronherkomst zichtbaar.
- Risico: onjuist gebruik van API key in responses/logs.
  - Mitigatie: key write-only behandelen en nooit teruggeven in API response.
- Rollback:
  - Admin GenAI-endpoints en UI-sectie verwijderen,
  - generatie fallbacken op bestaande hardcoded/default prompts,
  - setting key laten bestaan zonder functioneel effect.

## Notes / links
- Bronwens: `ITERATIONS.md` (Iteratie #09).
- Vorige iteratie: `opsx/changes/2026-03-13-iteratie-8-planning-detail-multichannel.md`.

## Current status
Completed

## What changed
- Backend: nieuw GenAI-config domein toegevoegd met defaults, validatie en veilige secret-afhandeling via:
  - `backend/app/schemas/genai.py`
  - `backend/app/services/genai_config_service.py`
- Backend API: admin-only configuratie-endpoints toegevoegd in `backend/app/api/admin.py`:
  - `GET /api/admin/genai-config`
  - `PATCH /api/admin/genai-config`
- OpenAI integratie aangepast naar runtime-config in `backend/app/integrations/openai_client.py`:
  - modelkeuze en API key komen uit effectieve GenAI-config
  - websearch kan optioneel worden ingeschakeld
  - API key blijft write-only in admin response (`has_api_key` indicator)
- Generatieflow aangepast in `backend/app/services/generation_service.py`:
  - systeemprompt + kanaalprompts uit config
  - `editorial_notes` en lokale bronnen blijven in promptcontext
  - bij websearch worden webbronnen als `source_type=websearch` opgenomen in `source_trace_json`
- Frontend API-client uitgebreid in `frontend/src/lib/api/client.ts` met:
  - `getAdminGenAIConfig`
  - `updateAdminGenAIConfig`
  - nieuwe `GenAIConfig` types
- Frontend Admin UI uitgebreid in `frontend/src/app/App.tsx`:
  - nieuwe sectie “GenAI configuratie” met promptvelden, modelvelden, websearch-toggle, max resultaten, API key update en opslagfeedback
- UI-verfijning op basis van feedback in `frontend/src/app/App.tsx` en `frontend/src/styles.css`:
  - GenAI-sectie compacter gemaakt met 2-koloms formulierlayout
  - systeemprompt vergroot (meer verticale invoerruimte)
  - tekstmodel en afbeeldingsmodel omgezet van vrije invoer naar dropdown-keuzes
  - checkbox-uitlijning voor websearch gecorrigeerd
- Modelkeuzes worden nu dynamisch opgehaald in plaats van frontend-hardcoded:
  - nieuw admin endpoint `GET /api/admin/genai-model-options` in `backend/app/api/admin.py`
  - nieuw response model `GenAIModelOptionsResponse` in `backend/app/schemas/genai.py`
  - service-uitbreiding in `backend/app/services/genai_config_service.py` om beschikbare modellen op te halen via OpenAI API (met veilige fallback als API key ontbreekt of ophalen faalt)
  - frontend query-koppeling in `frontend/src/lib/api/client.ts` en `frontend/src/app/App.tsx`
- Styling toegevoegd in `frontend/src/styles.css` voor de nieuwe Admin GenAI-form.
- Tests uitgebreid:
  - backend: `backend/tests/test_admin_api.py`, `backend/tests/test_generation.py`
  - frontend: `frontend/src/app/App.test.tsx`
- About changelog bijgewerkt met iteratie 09 in `backend/app/api/meta.py`.

## How to verify
- `docker compose run --rm migrate`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_admin_api.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `docker compose run --rm migrate` -> geslaagd (SQLite alembic migratiecontext gestart zonder fouten).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_admin_api.py -q"` -> geslaagd, `18 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd, `53 passed`.
- `cd frontend && npm test -- --run` -> geslaagd, `27 passed`.
- `cd frontend && npm run build` -> geslaagd, Vite build afgerond.
- Na UI-feedback opnieuw gedraaid:
  - `cd frontend && npm test -- --run` -> geslaagd, `27 passed`.
  - `cd frontend && npm run build` -> geslaagd.
- Na model-opties update opnieuw gedraaid:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_admin_api.py -q"` -> geslaagd, `18 passed`.
  - `cd frontend && npm test -- --run` -> geslaagd, `27 passed`.
  - `cd frontend && npm run build` -> geslaagd.
