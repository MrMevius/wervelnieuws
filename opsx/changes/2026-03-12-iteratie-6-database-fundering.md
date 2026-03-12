# Iteratie 6 Database-fundering voor bronbestanden (los van topics)

## Context
In `ITERATIONS.md` vraagt iteratie 6 om de uploadfunctionaliteit te verplaatsen van Main naar Database, met drag-and-drop upload, inzicht in bestanden (incl. uploader en tijdstip), projectkoppeling, en adminbeheer van projecten.

De gebruiker heeft expliciet bevestigd dat deze database los staat van Topics. Het doel van deze iteratie is de fundering neerzetten. AI-indexering/RAG-koppeling volgt in een latere iteratie.

## Goals / Non-goals
### Goals
- Verwijder uploadfunctionaliteit uit Main.
- Voeg op Database een drag-and-drop uploadflow toe.
- Toon een bestandoverzicht met minimaal: bestandsnaam, project, geuploade gebruiker, uploadtijdstip.
- Maak projectkoppeling mogelijk bij upload van bestanden.
- Voeg in Admin een bewerkbare projectenlijst toe.
- Seed standaardproject: `Windpark de Boldijk`.

### Non-goals
- Geen koppeling van deze databasebestanden aan `Topic` in deze iteratie.
- Geen AI-indexering/RAG of semantische retrieval op deze nieuwe database in deze iteratie.
- Geen herontwerp van bestaande topic-ingestie/generatieflow.

## Proposed approach
1. Introduceer een apart database-domein naast topics met `Project` en `KnowledgeDocument` entiteiten.
2. Maak backend API-routes voor:
   - projectenlijst voor Database-pagina;
   - upload + lijst van databasebestanden;
   - admin-only projectbeheer.
3. Pas frontend routes/pagina's aan:
   - verwijder upload op Main;
   - vervang Database dummy door echte upload + overzichtspagina.
4. Breid Admin-pagina uit met compact projectbeheer.
5. Voeg gerichte backend/frontend tests toe.
6. Werk About-changelog bij met iteratie 06 in eindgebruikers-taal.

## Implementation steps (ordered)
1. Datamodel uitbreiden met `Project` en `KnowledgeDocument` (incl. uploader/project-relaties).
2. Alembic migratie toevoegen en standaardproject `Windpark de Boldijk` backfillen.
3. Backend schemas/repositories toevoegen voor databasebestanden en projecten.
4. Backend routes toevoegen voor upload/list databasebestanden en projects-list.
5. Admin API uitbreiden met projectbeheer (list/create/update, admin-only).
6. Frontend API client uitbreiden met database/project endpoints.
7. Main-page upload verwijderen en Database-pagina implementeren met drag-and-drop + overzicht.
8. Admin UI uitbreiden met bewerkbare projectenlijst.
9. Tests uitbreiden (backend + frontend).
10. About-changelog iteratie 06 toevoegen.
11. Verificatie draaien en evidence opnemen.

## Acceptance criteria
- Main-pagina bevat geen uploadfunctionaliteit meer.
- Database-pagina ondersteunt drag-and-drop upload.
- Database-pagina toont een lijst van bestanden met bestandsnaam, project, geuploade gebruiker en uploadtijdstip.
- Bij upload kan een project gekozen worden en die koppeling wordt opgeslagen.
- Adminpagina bevat een bewerkbare projectenlijst.
- `Windpark de Boldijk` bestaat als standaardproject.
- Scope blijft fundering-only: geen AI-indexering/RAG op deze database in iteratie 6.
- Relevante backend- en frontend-tests dekken de nieuwe basisflow.

## Testing plan
- Backend tests:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Frontend tests:
  - `cd frontend && npm test`
- Frontend build:
  - `cd frontend && npm run build`

## Risk + rollback plan
- Risico: overlap/verwarring met bestaande topic-documenten.
  - Mitigatie: aparte entiteiten, aparte endpoints, duidelijke UI-labeling als databasebron.
- Risico: onjuiste projecttoewijzing bij upload.
  - Mitigatie: verplichte projectselectie en zichtbare projectkolom in overzicht.
- Rollback: nieuwe database-tabellen en routes terugdraaien via migratie rollback en frontend terugzetten naar dummy databasepagina.

## Notes / links
- User request: iteratie 6 als fundering, los van topics; RAG/indexering later.
- Bronnen: `ITERATIONS.md`, `AGENTS.md`, globale OPSX-regels.

## Current status
Completed

## What changed
- Backend datamodel uitgebreid met een los database-domein:
  - `backend/app/models/entities.py`:
    - `Project` toegevoegd (`name`, `is_active`, timestamps).
    - `KnowledgeDocument` toegevoegd met project- en uploader-koppeling plus bestandsmetadata.
    - relatie op `User` toegevoegd voor geuploade databasebestanden.
  - `backend/app/models/__init__.py` exports bijgewerkt.
- Database repository toegevoegd:
  - `backend/app/repositories/database_repository.py` met:
    - `ensure_default_project()` voor standaardproject `Windpark de Boldijk`;
    - projects list/create/update;
    - documents add/list.
- Nieuwe database schema's toegevoegd:
  - `backend/app/schemas/database.py` met:
    - `ProjectResponse`, `CreateProjectRequest`, `UpdateProjectRequest`;
    - `DatabaseDocumentResponse` (incl. project/uploader/uploadtijd).
- Nieuwe backend API-routes toegevoegd voor de Database-pagina:
  - `backend/app/api/database.py`:
    - `GET /api/database/projects`
    - `POST /api/database/documents`
    - `GET /api/database/documents`
  - Upload valideert formaat/omvang/lege upload en koppelt verplicht aan `project_id`.
  - Upload slaat metadata op inclusief uploader en timestamp.
- Admin API uitgebreid met projectbeheer:
  - `backend/app/api/admin.py`:
    - `GET /api/admin/projects`
    - `POST /api/admin/projects`
    - `PATCH /api/admin/projects/{project_id}`
  - Endpoints zijn admin-only en handelen naamconflicten af.
- Routerregistratie uitgebreid:
  - `backend/app/main.py`: `database.router` toegevoegd.
- Alembic migratie toegevoegd:
  - `backend/alembic/versions/20260312_0007_database_projects_knowledge_docs.py`
    - maakt tabellen `projects` en `knowledge_documents`;
    - voegt standaardproject `Windpark de Boldijk` toe.
- Frontend API client uitgebreid:
  - `frontend/src/lib/api/client.ts`:
    - types `Project`, `DatabaseDocument`;
    - admin project API-calls;
    - database projects/documents list en upload calls.
- Frontend app uitgebreid:
  - `frontend/src/app/App.tsx`:
    - upload verwijderd uit `MainPage`;
    - nieuwe `DatabasePage` met drag-and-drop upload + projectselectie;
    - database-overzichtstabel toont bestand, project, uploader, uploadtijd, status;
    - adminpagina uitgebreid met projectbeheer (toevoegen, naam wijzigen, active/deactive).
- Styling uitgebreid:
  - `frontend/src/styles.css`:
    - database dropzone en controls styling toegevoegd.
- Testdekking uitgebreid:
  - `backend/tests/test_database_api.py` toegevoegd voor database projects/upload/list.
  - `backend/tests/test_admin_api.py` uitgebreid met projectbeheer-tests.
  - `frontend/src/app/App.test.tsx` uitgebreid met tests voor:
    - upload verwijderd op Main,
    - database uploadflow,
    - admin projectbeheer.
- About-changelog bijgewerkt:
  - `backend/app/api/meta.py` uitgebreid met iteratie 06 item in eindgebruikers-taal.
- Iteratieplanning voor latere AI-indexering vastgelegd:
  - `ITERATIONS.md` aangevuld met `Iteratie #07` voor indexering/RAG.
- Feedbackronde Database-pagina verwerkt:
  - `backend/app/core/settings.py`:
    - uploadlimiet verhoogd van 10 MB naar 100 MB per bestand (`upload_max_bytes`).
    - extra safeguard toegevoegd: ingestelde limiet wordt minimaal 100 MB, ook als oudere `.env` nog 10 MB bevat.
  - `.env.example`:
    - `UPLOAD_MAX_BYTES` geactualiseerd naar `104857600`.
  - `frontend/src/app/App.tsx`:
    - tekst "Upload bronbestanden per project. Deze database staat los van Topics." verwijderd;
    - uploadveld ondersteunt nu meerdere bestanden tegelijk (`multiple`);
    - drag-and-drop verwerkt nu meerdere bestanden in een batch;
    - upload toont direct voortgangsfeedback zodat meteen zichtbaar is dat upload gestart is;
    - feedback toont batchresultaat (aantal succesvol geuploade bestanden) en duidelijke foutmelding.
    - UI vermeldt expliciet de limiet: "max 100 MB per bestand".
    - uploadtijd in database-overzicht gebruikt nu vaste notatie `YYYY-MM-DD HH:MM` in tijdzone Amsterdam (24-uurs).
  - `frontend/src/app/App.test.tsx`:
    - test uitgebreid voor limietvermelding en verwijderde tekst;
    - nieuwe test toegevoegd voor upload van meerdere bestanden in 1 actie;
    - test toegevoegd/uitgebreid voor datumweergave in format `YYYY-MM-DD HH:MM`.
- Extra feedbackronde Database-pagina verwerkt:
  - `frontend/src/app/App.tsx`:
    - upload toont nu een voortgangsbalk (`progress`) met percentage tijdens upload;
    - tabel toont nu extra kolom `Grootte` met leesbare bestandsgrootte (B/KB/MB/GB);
    - tabel toont nu `Acties` met verwijderknop alleen voor admins.
  - `frontend/src/lib/api/client.ts`:
    - nieuwe uploadfunctie met voortgang toegevoegd (`uploadDatabaseDocumentWithProgress` via XHR);
    - nieuwe delete-call toegevoegd (`deleteDatabaseDocument`).
  - `backend/app/api/database.py`:
    - `DELETE /api/database/documents/{document_id}` toegevoegd;
    - endpoint is admin-only (`require_admin`) en verwijdert metadata plus bestand op disk.
  - `backend/app/repositories/database_repository.py`:
    - `get_document()` en `delete_document()` toegevoegd.
  - `backend/tests/test_database_api.py`:
    - tests toegevoegd voor admin delete toegestaan en non-admin delete geblokkeerd.
  - `frontend/src/app/App.test.tsx`:
    - tests uitgebreid voor voortgangsbalk, groottekolom en admin-only verwijderactie.
- Nieuwe feedbackronde Database-pagina verwerkt:
  - Verwijderbevestiging:
    - `frontend/src/app/App.tsx`: single delete en bulk delete vragen nu expliciet
      "Weet u het zeker?" via bevestigingsdialoog.
  - Sorteerbare kolommen:
    - `frontend/src/app/App.tsx`: tabelkolommen `Bestand`, `Project`, `Geupload door`,
      `Geupload op`, `Grootte`, `Status` zijn sorteerbaar (asc/desc toggle).
  - Bestandstype-indicator:
    - `frontend/src/app/App.tsx`: extra eerste indicator-kolom toegevoegd (zonder label)
      met compacte typebadge (PDF/DOC/XLS/TXT/MD).
  - Selecteerbare bestanden + bulkacties:
    - `frontend/src/app/App.tsx`: checkbox per rij + "selecteer alles" toegevoegd.
    - bulkacties toegevoegd: `Verplaats`, `Kopieer`, `Verwijder`.
    - bulk delete vereist admin; move/copy gebruiken gekozen doelproject.
  - Backend API voor bulkacties:
    - `backend/app/api/database.py`:
      - `POST /api/database/documents/bulk/delete` (admin-only)
      - `POST /api/database/documents/bulk/move`
      - `POST /api/database/documents/bulk/copy`
    - `backend/app/schemas/database.py`: request/response schema's voor bulkacties toegevoegd.
    - `backend/app/repositories/database_repository.py`: helpermethodes toegevoegd voor
      bulk ophalen, bewaren, delete en chunk-project update bij verplaatsen.
  - Frontend API client uitgebreid:
    - `frontend/src/lib/api/client.ts`:
      - bulk calls voor delete/move/copy;
      - upload met voortgang via XHR blijft actief.
  - Styling uitgebreid:
    - `frontend/src/styles.css`: styles toegevoegd voor bulkcontrols, sorteerknoppen,
      bestandstypebadge.
  - Tests uitgebreid:
    - `backend/tests/test_database_api.py`: bulk move/copy en bulk delete autorisatietests toegevoegd.
  - `frontend/src/app/App.test.tsx`: geactualiseerd voor nieuwe database-UI structuur.
- Verdere UX-feedbackronde Database-pagina verwerkt:
  - `frontend/src/app/App.tsx`:
    - per-bestand verwijderknop verwijderd uit de tabel;
    - labels "Bulkactie" en "Doelproject" niet meer als zichtbare tekst getoond;
    - bulkactieblok wordt alleen getoond zodra er minimaal 1 bestand geselecteerd is;
    - projectkeuze wordt alleen getoond bij bulkactie `Verplaats` of `Kopieer`;
    - bestandstype-indicator visueel aangepast naar herkenbare extensie-badges
      (`PDF`, `DOCX`, `XLSX`, `TXT`, `MD`) met type-specifieke kleuren.
  - `frontend/src/styles.css`:
    - styling verfijnd voor compacte bulkcontrols en vernieuwde type-indicatoren.
  - `frontend/src/app/App.test.tsx`:
    - tests aangepast op de nieuwe zichtbaarheid/gedrag van bulkcontrols en verwijderde rij-actie.

## How to verify
- Backend tests draaien:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Frontend tests draaien:
  - `cd frontend && npm test -- --run`
- Frontend productiebuild draaien:
  - `cd frontend && npm run build`
- Migraties draaien:
  - `docker compose build migrate && docker compose run --rm migrate`
- Controleer seeded standaardproject:
  - `docker compose run --rm backend python -c "from sqlalchemy import create_engine,text; e=create_engine('sqlite:////data/app.db'); c=e.connect(); print(c.execute(text('select name, is_active from projects order by name')).fetchall())"`
- Handmatig controleren in UI:
  - Main bevat geen uploadveld meer.
  - Database ondersteunt drag-and-drop upload en projectselectie.
  - Database-lijst toont bestand + project + uploader + uploadtijd.
  - Admin > Projecten laat projecten toevoegen/bewerken/(de)activeren.
- Feedbackronde verifiëren:
  - Database toont "max 100 MB per bestand" bij uploadzone.
  - Database toont niet meer de verwijderde informatieve tekst over losstaan van topics.
  - Meerdere bestanden selecteren/uploaden in 1 keer werkt.
- Extra feedbackronde verifiëren:
  - Tijdens upload wordt een voortgangsbalk met percentage getoond.
  - Alleen admins zien de verwijderknop in de tabel en kunnen verwijderen.
  - Tabel toont bestandsgrootte per document.
- Nieuwe feedbackronde verifiëren:
  - Single en bulk verwijderen tonen een bevestigingsvraag.
  - Kolommen zijn sorteerbaar.
  - Eerste indicator-kolom toont bestandstypebadge.
  - Selectievakjes en bulkacties (verplaats/kopieer/verwijder) werken.
- Verdere UX-feedbackronde verifiëren:
  - Geen per-bestand verwijderknop meer zichtbaar.
  - Bulkactieblok verschijnt pas na selectie van minimaal 1 bestand.
  - Doelproject-selector verschijnt alleen bij `Verplaats` of `Kopieer`.
  - Type-indicatoren tonen herkenbare extensie-badges.

## Verification evidence
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py tests/test_admin_api.py -q"`
  - Resultaat: `19 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `39 passed`.
- `cd frontend && npm test -- --run`
  - Resultaat: `18 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (Vite productiebuild).
- `docker compose build migrate && docker compose run --rm migrate`
  - Resultaat: migratie `20260312_0007` succesvol uitgevoerd.
- `docker compose run --rm backend python -c "from sqlalchemy import create_engine,text; e=create_engine('sqlite:////data/app.db'); c=e.connect(); print(c.execute(text('select name, is_active from projects order by name')).fetchall())"`
  - Resultaat: `[("Windpark de Boldijk", 1)]`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py -q"`
  - Resultaat: `4 passed`.
- `cd frontend && npm test -- --run`
  - Resultaat: `20 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
- `cd frontend && npm test -- --run`
  - Resultaat: `21 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py -q"`
  - Resultaat: `6 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `45 passed`.
- `cd frontend && npm test -- --run`
  - Resultaat: `21 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py -q"`
  - Resultaat: `4 passed`.
- `cd frontend && npm test -- --run`
  - Resultaat: `21 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_database_api.py tests/test_generation.py -q"`
  - Resultaat: `6 passed`.
- `cd frontend && npm test -- --run`
  - Resultaat: `20 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
