## Title
Bugfix - Artikelen genereren/regenereren faalt door kanaalvarianten en FTS-queryfout

## Context
In de planning-detailpagina faalt het opnieuw genereren van artikelen en laden van kanaalvarianten. De UI toont onder andere: "Kanaalvariant kon niet worden geladen" en "Opnieuw genereren is mislukt". Dit wijst op een backendfout in het content-pad (`/content/{topic_id}/regenerate` en `/content/{topic_id}/variants/current`).

Na de eerste fix is een tweede root cause gevonden in retrieval: een onderwerp met FTS-special syntax (bijv. `nacelle: onderhoud`) veroorzaakt een SQLite FTS-fout (`no such column: nacelle`) tijdens `MATCH :q`. Daardoor wordt geen contentversie aangemaakt en verschijnen meldingen als `No content version available`.

Aanvullende UX-wens: in planning detail moet een expliciete knop `Genereer content` altijd zichtbaar zijn, naast `Artikelen opnieuw genereren`.

## Goals / Non-goals
### Goals
- Root cause van de fout reproduceerbaar maken en oplossen.
- Regenereren en laden van huidige kanaalvarianten moeten weer betrouwbaar werken.
- Bij ontbrekende database-migratiestaat moet de API een duidelijke fout geven in plaats van een onduidelijke 500.
- Retrieval moet robuust omgaan met FTS-special tekens in onderwerp/query zonder runtime-crash.
- In planning detail is `Genereer content` altijd zichtbaar en bruikbaar.
- Regressietests dekken het bugpad af.

### Non-goals
- Geen functioneel herontwerp van planning- of reviewworkflow.
- Geen wijziging in publicatiekanalen of kanaallogica.
- Geen aanpassing van promptinhoud of tone-of-voice gedrag.
- Geen functionele wijziging aan backend endpointcontract voor genereren.

## Proposed approach
1. Reproduceer de fout op API-niveau en identificeer de exacte backend exception.
2. Maak het content-API pad defensiever voor schema-mismatch/migratieproblemen.
3. Sanitize retrieval-query voor SQLite FTS, zodat speciale tekens geen query-parsefout geven.
4. Voeg gerichte tests toe voor varianten laden/regenereren en FTS-queryfoutscenario.
5. Werk gebruikersgerichte changelogtekst bij op About-pagina.
6. Voeg in frontend planning detail een aparte `Genereer content`-actie toe, altijd zichtbaar.

## Implementation steps (ordered)
1. Reproduceren met bestaande test/API-call en traceback vastleggen.
2. Root-cause fix implementeren in backend content API/service.
3. RetrievalService aanpassen met veilige FTS-queryopbouw.
4. Tests toevoegen/aanpassen voor regressie in `test_channel_variants_api.py` en `test_retrieval.py`.
5. About changelog-entry toevoegen.
6. Relevante backend- en frontendverificatie draaien en bewijs noteren.
7. Frontend update: altijd-zichtbare knop `Genereer content` met API-call, feedback en query invalidation.

## Acceptance criteria
- `POST /api/content/{topic_id}/regenerate` faalt niet meer met onduidelijke fout in het geconstateerde bugscenario.
- `GET /api/content/{topic_id}/variants/current` levert weer bruikbare respons of een duidelijke actiegerichte foutmelding.
- Retrieval op onderwerp met speciale tekens (zoals `:`) veroorzaakt geen FTS-crash meer.
- In planning detail is knop `Genereer content` altijd zichtbaar (ook als al content bestaat).
- `Genereer content` triggert een normale generate-run en ververst varianten/versies zichtbaar in UI.
- De fout en fix zijn afgedekt met een backend regressietest.
- About bevat een eindgebruikervriendelijke changelog-entry voor deze bugfix.

## Testing plan
- `docker compose run --rm migrate`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_channel_variants_api.py tests/test_generation.py tests/test_retrieval.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: extra foutafhandeling maskeert echte programmeerfouten.
  - Mitigatie: alleen specifieke database-schemafouten afvangen met expliciete melding.
- Risico: regressie op bestaande generate/regenerate-flow.
  - Mitigatie: gerichte tests voor bestaande happy-flow en bugscenario.
- Rollback:
  - gerelateerde backendwijzigingen terugdraaien,
  - tests/changelog terugzetten,
  - vorige werkende release uitrollen.

## Notes / links
- Meldingen gezien in planning-detail UI: "Kanaalvariant kon niet worden geladen" en "Opnieuw genereren is mislukt".
- Waarschijnlijke probleemzone: `backend/app/api/content.py` en `content_channel_variants`-pad.
- Extra probleemzone: `backend/app/services/retrieval_service.py` met SQLite FTS `MATCH` op ruwe querystring.

## Current status
Completed

## What changed
- Root cause gereproduceerd: bij ontbrekende tabel `content_channel_variants` crashten endpoints met een onduidelijke SQLAlchemy `OperationalError` (500).
- Backend content API maakt nu schemafout expliciet en actiegericht:
  - `backend/app/api/content.py` vangt `DBAPIError` af op varianten-gerelateerde paden.
  - Bij ontbrekende `content_channel_variants` wordt nu `503` teruggegeven met duidelijke instructie om migraties te draaien (`docker compose run --rm migrate`) en services te herstarten.
  - Toegepast op `generate`, `regenerate`, `variants/current`, `variants/{channel}`, `variants/{channel}/approve`, `variants/{channel}/reject` en topic `approve`.
- Frontend feedback verbeterd:
  - `frontend/src/app/App.tsx` toont nu API-detail bij mislukte regeneratie en bij fout in laden van kanaalvarianten.
- Regressietest toegevoegd:
  - `backend/tests/test_channel_variants_api.py` bevat nu een scenario waarin de tabel expres wordt verwijderd en beide endpoints (`variants/current` en `regenerate`) een duidelijke `503` moeten geven.
- Tweede root cause opgelost in retrieval:
  - `backend/app/services/retrieval_service.py` bouwt nu een veilige FTS-query op uit genormaliseerde tokens (quoted OR-terms), zodat speciale tekens zoals `:` geen SQLite FTS parsefout meer veroorzaken.
  - Hierdoor crasht generatie/regeneratie niet meer op onderwerpen zoals `nacelle: onderhoud`.
- Extra regressietest toegevoegd:
  - `backend/tests/test_retrieval.py` bevat nu een test die bevestigt dat een onderwerp met `:` geen FTS-crash meer veroorzaakt en topic-hits oplevert.
- Migratie-drift structureel opgelost voor projectkoppeling:
  - `backend/alembic/versions/20260313_0011_topics_project_id.py` is idempotenter gemaakt voor omgevingen waar `topics.project_id` al bestaat.
  - De migratie controleert nu bestaande kolom/index/constraint en slaat dubbele DDL veilig over.
  - Voor SQLite wordt geen niet-ondersteunde FK-constraint-wijziging geforceerd, maar backfill en index blijven wel toegepast.
- Runtime OpenAI SDK-compatibiliteit opgelost:
  - `backend/app/integrations/openai_client.py` ondersteunt nu zowel `responses.create(...)` als fallback naar `chat.completions.create(...)` wanneer `responses` niet beschikbaar is.
  - Daardoor crasht regenereren niet meer met `AttributeError: 'OpenAI' object has no attribute 'responses'` op SDK `openai==1.65.4`.
  - Bij ingeschakelde websearch en chat-fallback wordt expliciete tracecontext toegevoegd dat websearch via Responses API niet beschikbaar is.
- Nieuwe regressietest voor SDK-fallback:
  - `backend/tests/test_openai_client.py` valideert fallback naar chat-completions wanneer de client geen `responses` attribuut heeft.
- Frontend planning-detail actie uitgebreid:
  - `frontend/src/app/App.tsx` toont nu altijd een extra knop `Genereer content` naast `Artikelen opnieuw genereren`.
  - De nieuwe knop triggert `triggerGeneration(topicId)` (`POST /content/{topicId}/generate`), toont duidelijke succes/foutfeedback en ververst versions/variants/topics queries.
  - Beide genereerknoppen zijn onderling guarded tegen gelijktijdige klikacties (`isPending`).
- About changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat iteratie `11` met deze bugfix in begrijpelijke taal.

## How to verify
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_retrieval.py tests/test_generation.py tests/test_channel_variants_api.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_openai_client.py tests/test_generation.py tests/test_channel_variants_api.py tests/test_retrieval.py -q"`
- `docker compose build migrate && docker compose run --rm migrate`
- `docker compose up -d --build backend worker`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- Optioneel reproduceren van historisch bugpad: verwijder `content_channel_variants` in een testdatabase en controleer dat API nu `503` met migratie-instructie teruggeeft.
- Optioneel reproduceren van FTS-bugpad: maak onderwerp met `:` (bijv. `nacelle: onderhoud`) en controleer dat regenereren niet crasht.

## Verification evidence
- Repro vóór fix (ad-hoc script in backend container): na `DROP TABLE content_channel_variants` gaf `GET /api/content/{topic_id}/variants/current` een ongehandelede `sqlalchemy.exc.OperationalError: no such table: content_channel_variants`.
- Repro vóór tweede fix (runtime logs): onderwerp met `:` in retrieval-query veroorzaakte `sqlite3.OperationalError: no such column: nacelle` vanuit SQLite FTS `MATCH`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_retrieval.py tests/test_generation.py tests/test_channel_variants_api.py -q"` -> geslaagd (`9 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd (`60 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_retrieval.py -q"` -> geslaagd (`4 passed`).
- `docker compose build migrate && docker compose run --rm migrate` -> geslaagd; migratie `20260313_0010 -> 20260313_0011` loopt nu door zonder `duplicate column name: project_id` crash.
- Runtime diagnose in compose-stack bevestigde root cause vóór fix: `POST /api/content/{topic_id}/regenerate` -> `500` met `AttributeError: 'OpenAI' object has no attribute 'responses'` uit `backend/app/integrations/openai_client.py`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_openai_client.py tests/test_generation.py tests/test_channel_variants_api.py tests/test_retrieval.py -q"` -> geslaagd (`11 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd (`62 passed`).
- `docker compose up -d --build backend worker` -> geslaagd; backend en worker herstart met nieuwe image.
- `docker compose logs backend --tail 120` -> schone startup, geen nieuwe runtime exception tijdens opstart.
- `cd frontend && npm test -- --run` -> geslaagd (`27 passed`).
- `cd frontend && npm run build` -> geslaagd (Vite productiebuild afgerond).
