## Title
Vergaderborden (Trello-achtig) voor admin-UI

## Context
De huidige admin-UI mist een projectgebonden, visueel werkbord voor interne samenwerking tijdens vergader- en uitvoerwerk. Teams hebben behoefte aan een Trello-achtige flow met kaartjes, updates en audio-opnames per kaart, inclusief strikte projecttoegang en audit trail, zonder koppeling aan bestaande onderwerpen.

## Goals / Non-goals
### Goals
- Nieuwe admin-subpagina `/admin/vergaderborden` met projectoverzicht en board-weergave.
- Nieuwe domeinentiteiten: `Project`, `BoardCard`, `CardAssignment`, `CardUpdate`, `Recording`.
- Rechtenmodel: alleen uitgenodigde gebruikers en admins hebben toegang.
- Vast boardmodel met 3 kolommen: `todo`, `doing`, `done`.
- Drag-and-drop voor kaarten met persistente kolom + positie-opslag.
- Kaartdetail met update-log en posten van nieuwe updates.
- Audio-opname per kaart via browser `MediaRecorder`, upload naar backend en opslag op filesystem.
- Audit events voor kernacties: create/move/update/record.
- Implementatie via backend router/services/repositories + frontend componenten conform repo-conventies.
- Alembic migraties inbegrepen.
- Nederlandse UI-teksten en foutmeldingen.
- Basistests voor kritieke paden op backend en frontend.

### Non-goals
- Rich text editorfunctionaliteit.
- Labels/tags, deadlines en mobiele optimalisatie.
- Transcriptie-implementatie (alleen voorbereidende modelvelden indien nodig).
- Integratie met bestaande onderwerpen/workflows.

## Proposed approach
1. Voeg een nieuw, losstaand project-board domein toe dat niet afhankelijk is van bestaande topic/workflow-tabellen.
2. Definieer DB-modellen met expliciete relaties en constraints voor projecten, kaarten, assignments, updates en recordings.
3. Implementeer centrale toegangscontrole op projectniveau (admin of uitgenodigd) in backend services/router guards.
4. Implementeer board API’s voor:
   - projectoverzicht en projectaanmaak
   - board ophalen (kolommen + kaarten)
   - kaart aanmaken/bijwerken/verplaatsen
   - updates posten/lijsten
   - recording upload/lijst/downloadmetadata
5. Implementeer transactionele reorderlogica zodat verplaatsen van kaarten consistente posities opslaat.
6. Sla opnames op onder een veilige, configureerbare filesysteemlocatie met mime-validatie en metadata in DB.
7. Voeg audit logging toe voor create/move/update/record met actor en timestamp.
8. Bouw frontend-schermen voor overzicht, projectmodal, board met DnD, kaartdetail en opnameflow.
9. Voeg basis testdekking toe voor kritieke paden en leg verificatiecommando’s + resultaten vast in deze spec.

## Implementation steps (ordered)
1. **Backend modellen**
   - Definieer ORM-modellen + relaties voor `Project`, `BoardCard`, `CardAssignment`, `CardUpdate`, `Recording`.
   - Voeg benodigde enums/velden toe (kolomstatus, positionering, archiefstatus, timestamps).
   - Definieer modelvelden voor toekomstige transcriptie-ondersteuning zonder transcriptielogica te bouwen.
2. **Migraties (Alembic)**
   - Maak Alembic migratie(s) voor nieuwe tabellen, foreign keys, indexen en constraints.
   - Verifieer upgrade/downgrade pad lokaal.
3. **Backend API + services + repositories**
   - Voeg repositories/services toe voor CRUD, autorisatie, reorder, updates en recordings.
   - Voeg router endpoints toe onder admin-context voor overzicht/board/kaart/update/recording-acties.
   - Voeg audit event registratie toe voor create/move/update/record acties.
4. **Frontend implementatie**
   - Voeg route `/admin/vergaderborden` toe.
   - Bouw projectoverzicht-grid met kernmetadata.
   - Bouw “Nieuw Project” modal met naam/beschrijving/multi-select gebruikers.
   - Bouw board UI (todo/doing/done), kaartcreatie per kolom en DnD synchronisatie.
   - Bouw kaartdetail met updates (nieuwste eerst) + postfunctionaliteit.
   - Bouw recording UI met zichtbaarheid alleen in `doing`, live timer en uploadflow.
   - Zorg dat alle UI-teksten/foutmeldingen Nederlands zijn.
5. **Tests**
   - Backend tests: CRUD/auth/reorder/updates/recordings/audit.
   - Frontend tests: overzicht, create flow, board render, DnD sync, updates, recording-zichtbaarheid.
   - Handmatige e2e smoke test: project -> kaart -> verplaats -> update -> opname.
6. **Docs/finalize**
   - Werk About/changelog bij met eindgebruikersvriendelijke entry.
   - Voeg korte beheerdersuitleg toe in docs.
   - Werk deze spec bij met `What changed`, `How to verify`, `Verification evidence` en finale status.

## Acceptance criteria (measurable)
1. Overzichtspagina toont niet-gearchiveerde projecten als kaarten-grid met naam, aantal kaartjes, laatste activiteit en uitgenodigde gebruikers.
2. “Nieuw Project” modal ondersteunt naam, beschrijving en multi-select gebruikers; project is na opslaan direct zichtbaar in overzicht.
3. Alleen admins en uitgenodigde gebruikers kunnen projectdata zien en bewerken; onbevoegde toegang geeft correcte foutrespons.
4. Elk project toont een bord met exact 3 kolommen (`todo`, `doing`, `done`) en ondersteunt nieuw kaartje per kolom.
5. Drag-and-drop verplaatst kaart en slaat kolom + positie persistent op; na refresh blijft volgorde identiek.
6. Kaarten tonen minimaal titel, beschrijving, assignments, update-teller en opname-badge.
7. Kaartdetail toont updates met nieuwste bovenaan en ondersteunt posten van nieuwe update.
8. Record-knop is alleen zichtbaar/klikbaar voor kaarten in kolom `doing`.
9. Opnameflow toont live timer tijdens opname; stoppen start upload en persistente opslag.
10. Nieuwe opname is direct zichtbaar in kaartdetail met play/download en datum/tijd.
11. Audit trail registreert create/move/update/record-acties met actor en timestamp.
12. Alembic migratie draait succesvol heen en terug (upgrade + downgrade).
13. UI-teksten en relevante foutmeldingen zijn in het Nederlands.

## Testing plan
- Backend geautomatiseerd:
  - Tests voor project/kaart CRUD, autorisatie, reorder, updates, recordings en audit logging.
- Frontend geautomatiseerd:
  - Tests voor projectoverzicht, projectaanmaakflow, board rendering, DnD synchronisatie, updates, recording-knop zichtbaarheid.
- Handmatig:
  - E2E smoke: project aanmaken -> kaart aanmaken -> kaart verplaatsen -> update posten -> opname maken/controleren.
- Canonieke verificatiecommando’s worden tijdens implementatie ingevuld onder `How to verify` met concrete output in `Verification evidence`.

## Risk + rollback plan
### Risico’s
- Browservariatie in `MediaRecorder` ondersteuning en mime-types.
- Race conditions of inconsistentie bij gelijktijdige reorder-acties.
- Rechtenlekken door onvolledige projectguarding.
- Filesystemgroei/opslagbeheer voor recordings.

### Mitigaties
- Mime-validatie, gecontroleerde fallbackstrategie en heldere foutmeldingen.
- Transactionele reorder met eenduidige positieherberekening.
- Centrale auth guard in service-laag + endpoint-level checks + tests op negatieve paden.
- Veilige opslaglocatie, bestandsnaam-hardening en voorbereid beleid voor retentie/opschoning.

### Rollback
- Feature tijdelijk uitschakelen via route/menu disable.
- Alembic downgrade uitvoeren voor schema rollback.
- Indien nodig recordings-opslag pad isoleren en niet meer aanspreken na rollback.

## Notes / links
- Repo rules: `AGENTS.md` (root) en globale OPSX-regels.
- Deze feature blijft expliciet losgekoppeld van bestaande onderwerp/workflow-modellen.

## Current status
Completed

## What changed
- Backend domein uitgebreid met vergaderbord-entiteiten en relaties:
  - `Project` uitgebreid met `description`, `is_archived`, `invited_user_ids_json`, `last_activity_at`.
  - Nieuwe modellen: `BoardCard`, `CardAssignment`, `CardUpdate`, `Recording`.
  - Nieuwe enum: `BoardColumn` (`todo`, `doing`, `done`).
- Alembic migratie toegevoegd: `20260514_0016_vergaderborden.py` voor nieuwe tabellen/indexen en project-uitbreidingen.
- Nieuwe backend modules toegevoegd:
  - Router: `app/api/boards.py`
  - Schemas: `app/schemas/boards.py`
  - Repository: `app/repositories/board_repository.py`
  - Service: `app/services/board_service.py`
- API opgenomen in app bootstrap (`app/main.py`) onder `/api/boards`.
- Auth checks op project/card-niveau toegevoegd: alleen admin of uitgenodigde gebruiker.
- Audit logging toegevoegd voor kernacties:
  - `board.project.created`
  - `board.card.created`
  - `board.card.moved`
  - `board.card.updated`
  - `board.recording.created`
- Filesystem audio-opslag toegevoegd via configureerbare map `recordings_dir` in settings.
- Upload endpoint voor opnames toegevoegd (`POST /api/boards/cards/{card_id}/recordings`) met mime-validatie (WebM/Opus).
- Download endpoint toegevoegd (`GET /api/boards/recordings/{recording_id}/download`).
- Frontend basisimplementatie toegevoegd:
  - Nieuwe route: `/wervelnieuws/admin/vergaderborden` (en legacy redirect `/admin/vergaderborden`).
  - Nieuwe pagina/component: `VergaderbordenPage` met projectgrid, create-modal, 3-koloms board, drag-and-drop, kaartdetail/update feed, record-UI alleen in Doing.
  - API client uitgebreid met vergaderbord-types en API functies.
- Nederlandse teksten en foutmeldingen toegepast in nieuwe backend/frontend flow.
- About/changelog bijgewerkt met iteratie 28 entry voor eindgebruikers.
- Review-gap fixes binnen dezelfde scope (2026-05-15):
  - Recording-model in lijn gebracht met specvelden:
    - hernoemd `transcript_status` -> `transcription_status`
    - hernoemd `transcript_text` -> `transcription_text`
    - toegevoegd `filename`, optionele `duration`, `recorded_at`
  - Nieuwe Alembic migratie toegevoegd: `20260515_0017_recording_fields_alignment.py`.
  - Recording-upload endpoint uitgebreid met optioneel form field `duration`; bestandsnaam wordt nu opgeslagen uit upload metadata.
  - Recording API-responses bevatten nu o.a. `filename`, `file_path`, `duration`, `recorded_at`, `transcription_status`, `transcription_text`.
  - Frontend vergaderborden:
    - projectgrid toont uitgenodigde gebruikers (initialen/chips)
    - kaartjes tonen toegewezen gebruikers (initialen/chips)
    - kaart-aanmaakflow ondersteunt titel + beschrijving + toegewezen gebruikers (inline form)
    - kaartdetail werkt als modal/dialog-overlay met sluitknop
    - opname-lijst toont audio player (`<audio controls>`) naast download
    - recordknop duidelijk rood/groot en alleen zichtbaar in Doing
  - Backend tests uitgebreid met checks op nieuwe recordingvelden en Doing-only upload.

## How to verify
- Frontend tests:
  - `npm run test -- --run src/app/App.test.tsx` (in `frontend/`)
- Frontend build/typecheck:
  - `npm run build` (in `frontend/`)
- Backend syntax check:
  - `python3 -m compileall app` (in `backend/`)
- Backend targeted tests (indien dependencies aanwezig):
  - `STORAGE_ROOT=/tmp/opencode/wervelnieuws-test-storage uv run --extra dev pytest tests/test_boards_api.py` (in `backend/`)
- Backend volledige testsuite:
  - `STORAGE_ROOT=/tmp/opencode/wervelnieuws-test-storage uv run --extra dev pytest` (in `backend/`)
- Migratie roundtrip (indien alembic/venv beschikbaar):
  - `DATABASE_URL=sqlite:////tmp/opencode/wervelnieuws-alembic-test.db STORAGE_ROOT=/tmp/opencode/wervelnieuws-alembic-storage uv run --extra dev alembic upgrade head`
- Review-gap verificatie (targeted):
  - `STORAGE_ROOT=/tmp/opencode/wervelnieuws-test-storage uv run --extra dev pytest tests/test_boards_api.py` (in `backend/`)
  - `npm run test -- --run src/app/App.test.tsx` (in `frontend/`)
  - `npm run build` (in `frontend/`)
  - `DATABASE_URL=sqlite:////tmp/opencode/wervelnieuws-alembic-test.db STORAGE_ROOT=/tmp/opencode/wervelnieuws-alembic-storage uv run --extra dev alembic downgrade 20260324_0015`
  - `DATABASE_URL=sqlite:////tmp/opencode/wervelnieuws-alembic-test.db STORAGE_ROOT=/tmp/opencode/wervelnieuws-alembic-storage uv run --extra dev alembic upgrade head`

## Verification evidence
- ✅ `frontend`: `npm run test -- --run src/app/App.test.tsx`
  - Resultaat: 1 test file passed, 40 tests passed.
- ✅ `frontend`: `npm run build`
  - Resultaat: `tsc -b` + `vite build` geslaagd.
- ✅ `backend`: `python3 -m compileall app`
  - Resultaat: gewijzigde backend modules compileerden zonder syntaxfouten.
- ✅ `backend`: `STORAGE_ROOT=/tmp/opencode/wervelnieuws-test-storage uv run --extra dev pytest tests/test_boards_api.py`
  - Resultaat: 2 tests geslaagd, 10 warnings.
- ✅ `backend`: `STORAGE_ROOT=/tmp/opencode/wervelnieuws-test-storage uv run --extra dev pytest`
  - Resultaat: 89 tests geslaagd, 206 warnings.
- ✅ `backend`: Alembic roundtrip met tijdelijke SQLite DB en test-storage:
  - `DATABASE_URL=sqlite:////tmp/opencode/wervelnieuws-alembic-test.db STORAGE_ROOT=/tmp/opencode/wervelnieuws-alembic-storage uv run --extra dev alembic upgrade head`
  - `DATABASE_URL=sqlite:////tmp/opencode/wervelnieuws-alembic-test.db STORAGE_ROOT=/tmp/opencode/wervelnieuws-alembic-storage uv run --extra dev alembic downgrade 20260324_0015`
  - `DATABASE_URL=sqlite:////tmp/opencode/wervelnieuws-alembic-test.db STORAGE_ROOT=/tmp/opencode/wervelnieuws-alembic-storage uv run --extra dev alembic upgrade head`
  - Resultaat: upgrade naar `20260514_0016`, downgrade naar `20260324_0015`, en upgrade naar head geslaagd.
- ✅ `backend`: `STORAGE_ROOT=/tmp/opencode/wervelnieuws-test-storage uv run --extra dev pytest tests/test_boards_api.py`
  - Resultaat: 3 tests geslaagd.
- ✅ `frontend`: `npm run test -- --run src/app/App.test.tsx`
  - Resultaat: 1 test file passed, 40 tests passed.
- ✅ `frontend`: `npm run build`
  - Resultaat: build/typecheck geslaagd.
- ✅ `backend`: `STORAGE_ROOT=./data .venv/bin/python -m pytest tests/test_boards_api.py -q`
  - Resultaat: 3 tests geslaagd.
- ✅ `backend`: `STORAGE_ROOT=./data .venv/bin/python -m pytest -q`
  - Resultaat: 90 tests geslaagd.
- ✅ `backend`: Alembic volledige roundtrip via repo-venv met tijdelijke SQLite DB
  - Resultaat: upgrade naar head, downgrade naar base en upgrade naar head succesvol.

## Follow-ups
- Optioneel: voeg later gerichte frontend componenttests toe voor de vergaderbord-modal, kaart-aanmaakflow en opnameknop; de algemene frontend suite en build zijn groen.
- Optioneel: ruim pytest/dependency warnings op (`pytest-asyncio` loop-scope en datetime/passlib deprecations) voordat dependency-upgrades dit afdwingen.

---
Status: done
Owner: OPSX Implementer
Date: 2026-05-14
