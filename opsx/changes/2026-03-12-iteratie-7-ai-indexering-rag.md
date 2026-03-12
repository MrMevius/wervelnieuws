# Iteratie 7 AI-indexering en RAG op Database-bronbestanden

## Context
Iteratie 6 heeft de fundering gelegd voor een aparte Database-pagina met projectgebonden bronbestanden, los van Topics. De volgende stap is om deze bronbestanden doorzoekbaar te maken voor AI-generatie via indexering en retrieval.

De gebruiker wil dat AI topics/berichten (deels) op deze databron kan baseren met duidelijke bronverwijzing, zonder de bestaande topic-uploadflow te breken.

## Goals / Non-goals
### Goals
- Voeg indexering/chunking toe voor `KnowledgeDocument` bestanden uit de Database.
- Voeg retrieval toe die relevante passages kan ophalen voor een generatie-aanvraag.
- Combineer context gecontroleerd uit:
  - topic-bronnen (bestaande flow), en
  - database-bronnen (nieuwe flow).
- Leg brontraceability vast in output (`source_trace_json`) met herkomst (topic/database), document en passage.
- Maak zichtbaar in de review/generatieweergave welke bronpassages gebruikt zijn.

### Non-goals
- Geen vector database of externe search-engine in deze iteratie (SQLite-first aanpak behouden).
- Geen volledig herontwerp van de generatie-workflow of promptarchitectuur.
- Geen automatische claim-verificatie buiten huidige brongebaseerde guardrails.

## Proposed approach
1. Introduceer kennis-chunks voor databasebestanden (`KnowledgeChunk`) en een FTS-index (`knowledge_chunks_fts`).
2. Breid ingestieservice uit met een parallel pad voor `KnowledgeDocument` indexering.
3. Voeg retrievalservice toe die hits uit topic- en database-index kan combineren en ranken.
4. Werk generationservice bij zodat prompts broncontext uit beide stromen kunnen gebruiken.
5. Breid brontrace-formaat uit met expliciete herkomstvelden en passage-metadata.
6. Toon bronpassages in frontend waar redacteuren output reviewen.

## Implementation steps (ordered)
1. Datamodel uitbreiden met `KnowledgeChunk` en migratie + FTS virtual table.
2. Ingestieflow voor databasebestanden implementeren (extractie, chunking, index insert, status-updates).
3. Retrievalservice toevoegen voor gecombineerde zoekresultaten (topic + database).
4. Generationservice aanpassen voor gecombineerde context en verbeterde traceability.
5. API-contract voor brontrace waar nodig verduidelijken/uitbreiden.
6. Frontend reviewweergave uitbreiden met bronpassage-inzicht.
7. Tests toevoegen:
   - ingestie/indexering databasebestanden,
   - retrieval ranking/filters,
   - generatie gebruikt gecombineerde bronnen,
   - regressie op bestaande topic-only flow.
8. About-changelog iteratie 07 in eindgebruikers-taal toevoegen.
9. Verificatie draaien en bewijs vastleggen.

## Acceptance criteria
- Databasebestanden worden na upload gechunked en geïndexeerd.
- Generatie kan relevante passages uit databasebestanden ophalen.
- Bestaande topic-bronretrieval blijft werken.
- Gecombineerde retrieval bevat expliciete herkomst (`topic` of `database`) per passage.
- `source_trace_json` bevat voldoende metadata voor redactionele controle.
- Frontend toont gebruikte bronpassages leesbaar voor redacteuren.
- Testdekking bevat minimaal ingestie + retrieval + generatie regressie.

## Testing plan
- Backend targeted:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_ingestion.py tests/test_generation.py -q"`
- Backend full:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`
- Migraties:
  - `docker compose build migrate && docker compose run --rm migrate`

## Risk + rollback plan
- Risico: irrelevante passages in context verlagen outputkwaliteit.
  - Mitigatie: limieten/ranking en duidelijke scheiding van bronherkomst.
- Risico: bestaande generatieflow regressie.
  - Mitigatie: regressietests voor topic-only pad + gefaseerde merge van retrievallagen.
- Risico: traceability onduidelijk voor redacteuren.
  - Mitigatie: expliciet bronformat en UI-weergave met documentnaam/passage.
- Rollback: database-retrieval pad uitschakelen via feature flag/config en terugvallen op topic-only retrieval.

## Notes / links
- Input: `ITERATIONS.md` iteratie 07.
- Voorafgaande fundering: `opsx/changes/2026-03-12-iteratie-6-database-fundering.md`.
- Repo-regels: `AGENTS.md`.

## Current status
Completed

## What changed
- Nieuwe change spec aangemaakt voor iteratie 7 (AI-indexering + RAG op databasebronbestanden).
- Implementatiestap 1 uitgevoerd (datamodel + migratie + FTS):
  - `backend/app/models/entities.py`:
    - `KnowledgeDocument` uitgebreid met `chunks` relatie.
    - nieuw model `KnowledgeChunk` toegevoegd met:
      - `knowledge_document_id`
      - `project_id`
      - `chunk_index`
      - `text`
      - `metadata_json`.
  - `backend/app/models/__init__.py` exports uitgebreid met `KnowledgeChunk`.
  - Nieuwe migratie toegevoegd:
    - `backend/alembic/versions/20260312_0008_knowledge_chunks_fts.py`
    - maakt tabel `knowledge_chunks`
    - maakt FTS virtual table `knowledge_chunks_fts`.
- Implementatiestap 2 uitgevoerd (ingestieflow voor databasebestanden):
  - `backend/app/services/ingestion_service.py`:
    - nieuwe methode `ingest_knowledge_document(document: KnowledgeDocument)` toegevoegd;
    - statusflow: `parsing` -> `indexed` of `failed`;
    - extractie + chunking op `KnowledgeDocument`;
    - vervangt bestaande chunks voor hetzelfde document;
    - schrijft chunks naar `knowledge_chunks` en FTS-records naar `knowledge_chunks_fts`.
  - `backend/app/api/database.py`:
    - uploadflow triggert nu direct `IngestionService(db).ingest_knowledge_document(created)` na opslaan van het bestand.
  - `backend/tests/conftest.py`:
    - testdatabase maakt nu ook `knowledge_chunks_fts` aan.
  - `backend/tests/test_database_api.py`:
    - uploadtest controleert nu `status == indexed` en lege `extraction_error`;
    - nieuwe regressietest voor parserfout controleert `status == failed` met foutmelding.
- Implementatiestap 3 uitgevoerd (gecombineerde retrieval topic + database):
  - Nieuwe service toegevoegd:
    - `backend/app/services/retrieval_service.py`
    - `retrieve_context(topic, limit)` combineert:
      - topic-hits uit `document_chunks_fts` (met `source: "topic"`),
      - database-hits uit `knowledge_chunks_fts` (met `source: "database"`).
  - `backend/app/services/generation_service.py` aangepast:
    - gebruikt nu `RetrievalService` i.p.v. directe `IngestionService.search_chunks`.
    - gegenereerde `source_trace_json` bevat nu gemengde bronherkomst (topic/database) per hit.
  - `backend/tests/test_generation.py` uitgebreid:
    - nieuwe test valideert dat generatie beide bronnen in `source_trace_json` kan bevatten.
- Implementatiestap 4 uitgevoerd (generation context + traceability normalisatie):
  - `backend/app/services/retrieval_service.py` verrijkt retrieval-hits met metadata:
    - topic-hit bevat nu o.a. `document_name` en `chunk_index`.
    - database-hit bevat nu o.a. `document_name`, `project_name` en `chunk_index`.
  - `backend/app/services/generation_service.py` verbeterd:
    - context voor de prompt wordt nu opgebouwd met expliciete bronlabels per passage
      (`topic` vs `database`, met document/project/chunk info).
    - `source_trace_json` wordt genormaliseerd naar een consistent formaat met o.a.:
      - `source`/`source_type`
      - `chunk_id`/`chunk_index`
      - `document_id`/`document_name`
      - `topic_id`
      - `project_id`/`project_name`.
  - `backend/tests/test_generation.py` uitgebreid met extra asserts op genormaliseerde tracevelden.
- Implementatiestap 5 uitgevoerd (API-contract brontrace verduidelijkt):
  - `backend/app/schemas/versioning.py` uitgebreid met:
    - nieuw type `SourceTraceHitResponse`;
    - nieuw responseveld `source_trace` op `ContentVersionResponse`.
  - `ContentVersionResponse` parseert `source_trace_json` server-side naar getypeerde lijst
    zodat clients niet zelf hoeven te gokken/parsen.
  - Backward compatible behouden:
    - bestaand veld `source_trace_json` blijft aanwezig;
    - nieuw veld `source_trace` is aanvullende, expliciete API-contractlaag.
  - `backend/tests/test_generation.py` uitgebreid om te valideren dat `source_trace`
    aanwezig is en consistent blijft met `source_trace_json`.
- Implementatiestap 6 uitgevoerd (frontend reviewweergave met bronpassages):
  - `frontend/src/app/App.tsx` (Planning):
    - reviewpaneel toegevoegd onder de planningtabel;
    - bij selectie van een onderwerp wordt de laatste versie opgehaald via `listVersions`;
    - bronpassages worden leesbaar getoond met herkomstlabel (`topic`/`database`),
      documentnaam, projectnaam (indien database) en chunk-index.
  - `frontend/src/app/App.tsx`:
    - helper `extractSourceTrace(...)` toegevoegd voor fallback van `source_trace_json`.
  - `frontend/src/lib/api/client.ts`:
    - type `SourceTraceHit` toegevoegd;
    - `ContentVersion` uitgebreid met `source_trace`.
  - `frontend/src/styles.css`:
    - styling toegevoegd voor reviewpaneel, geselecteerde planningsrij en bronpassagekaarten.
  - `frontend/src/app/App.test.tsx`:
    - test toegevoegd die controleert dat bronpassages zichtbaar zijn in de planning-review.
- Implementatiestap 7 uitgevoerd (extra regressietests retrieval + topic-only pad):
  - `backend/tests/test_retrieval.py` toegevoegd met gerichte retrievaltests:
    - combineert topic- en databasehits met expliciete bronlabels;
    - bewaakt regressie dat topic-only retrieval blijft werken zonder databasehits.
  - `backend/tests/test_generation.py` en bestaande ingestie/database tests blijven onderdeel
    van de gerichte regressies op gecombineerde generatieflow.
- Implementatiestap 8 uitgevoerd (About-changelog iteratie 07):
  - `backend/app/api/meta.py` uitgebreid met iteratie `07` in eindgebruikers-taal.
  - Highlights benoemen indexering van databasebronnen, gecombineerde bronherkomst,
    en zichtbare bronpassages in review.
- Implementatiestap 9 uitgevoerd (eindverificatie):
  - gerichte en volledige testsets opnieuw gedraaid en vastgelegd.

## How to verify
- Draai migraties:
  - `docker compose build migrate && docker compose run --rm migrate`
- Controleer dat nieuwe tabellen bestaan:
  - `docker compose run --rm backend python -c "from sqlalchemy import create_engine,text; e=create_engine('sqlite:////data/app.db'); c=e.connect(); print(c.execute(text(\"select name from sqlite_master where name in ('knowledge_chunks','knowledge_chunks_fts') order by name\")).fetchall())"`
- Draai backend regressietests:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Draai gerichte ingestie/database tests:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py tests/test_ingestion.py -q"`
- Draai gerichte generatie+retrieval tests:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_ingestion.py tests/test_database_api.py -q"`
- Draai gerichte contract-regressie op content responses:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_auth_and_topics.py tests/test_admin_api.py -q"`
- Draai frontend tests:
  - `cd frontend && npm test -- --run`
- Draai frontend build:
  - `cd frontend && npm run build`
- Draai gerichte retrieval-regressie:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_retrieval.py tests/test_generation.py tests/test_ingestion.py -q"`

## Verification evidence
- Specbestand aangemaakt: `opsx/changes/2026-03-12-iteratie-7-ai-indexering-rag.md`.
- `docker compose build migrate && docker compose run --rm migrate`
  - Resultaat: upgrade succesvol naar `20260312_0008`.
- `docker compose run --rm backend python -c "from sqlalchemy import create_engine,text; e=create_engine('sqlite:////data/app.db'); c=e.connect(); print(c.execute(text(\"select name from sqlite_master where name in ('knowledge_chunks','knowledge_chunks_fts') order by name\")).fetchall())"`
  - Resultaat: `[("knowledge_chunks",), ("knowledge_chunks_fts",)]`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `39 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py tests/test_ingestion.py -q"`
  - Resultaat: `5 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_ingestion.py tests/test_database_api.py -q"`
  - Resultaat: `6 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `39 passed` (na stap 4 wijzigingen opnieuw bevestigd).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_auth_and_topics.py tests/test_admin_api.py -q"`
  - Resultaat: `18 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `39 passed` (na stap 5 contractwijziging opnieuw bevestigd).
- `cd frontend && npm test -- --run`
  - Resultaat: `19 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_retrieval.py tests/test_generation.py tests/test_ingestion.py -q"`
  - Resultaat: `6 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `43 passed` (inclusief nieuwe retrieval tests).
