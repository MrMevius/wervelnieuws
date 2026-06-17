# Title
Voeg kaartbijlagen toe aan vergaderbord-kaarten

## Context
Gebruikers kunnen momenteel geen bijlagen toevoegen aan vergaderbord-kaarten. Er is geen generieke kaart-bijlagefunctionaliteit zichtbaar in de UI en de backend mist een expliciet model/API voor kaartbijlagen.

Vergaderborden ondersteunen nu kaarten, updates, opnames en update-afbeeldingen. Dit lijkt ontbrekende basisfunctionaliteit te zijn, niet een permissieprobleem.

Deze change levert de backend-basis voor kaartbijlagen (model, API, opslag, migratie en tests); een latere UX-follow-up kan die capability hergebruiken zonder nieuwe backend-scope.

## Goals / Non-goals
### Goals
- Voeg first-class kaartbijlagen toe aan vergaderbord-kaarten.
- Maak bijlagen zichtbaar op bestaande en nieuwe kaarten.
- Ondersteun lokaal uploaden, tonen/lijsten, downloaden en verwijderen van bijlagen.
- Houd rechten gelijk aan bestaand bord-/kaarttoegangsniveau.
- Voeg backend model/API/storage/tests toe die dit veilig ondersteunen.
- Werk changelog/About bij als de implementatie wordt uitgevoerd.

### Non-goals
- Geen volledig vergaderbord redesign.
- Geen publieke download- of deel-URL’s.
- Geen brede document-management herinrichting buiten vergaderbord-scope.
- Geen hergebruik van recordings of update-afbeeldingen als vervanging voor kaartbijlagen.
- Geen uitbreiding naar algemene projectbestanden tenzij dat expliciet en veilig kan worden aangesloten op een bestaand, helder gedefinieerd intern-bestandenmodel.

## Proposed approach
- Introduceer een dedicated `board card attachment` domein in plaats van bestaande recording/update-image modellen te hergebruiken.
- Sla metadata op in de database en bestanden lokaal op de filesystem storage, consistent met de huidige hybride opslagaanpak.
- Koppel attachments aan een kaart en valideer toegang via bestaande bord-/kaartpermissies.
- Toon attachments bij voorkeur in de kaartdetailweergave, met een duidelijke uploadknop en lijst per kaart.
- Als inline toevoegen in de kaartlijst te groot wordt, is een veilige post-create detailflow acceptabel, mits expliciet zichtbaar en testbaar.
- Voor “existing internal files” geldt een open vraag: als er al een intern file-object of uploadbibliotheek bestaat, kan selectie daarvan later worden toegevoegd; anders blijft v1 beperkt tot directe upload binnen de kaartdetailflow.

## Implementation steps (ordered)
1. Inspect current vergaderbord card model, services, repositories, schemas en API-routes om de juiste attachment-integratiepunten vast te leggen.
2. Definieer een dedicated attachment entity/model met minimaal: id, card_id, filename, stored_filename/path, mime type, size, created_at, created_by.
3. Voeg database-migratie toe voor de nieuwe attachment-relatie en benodigde indexen/constraints.
4. Breid backend API uit voor attachment create/list/download/delete, inclusief access checks op bord-/kaartniveau.
5. Implementeer veilige bestandsvalidatie en lokale opslagafhandeling.
6. Voeg frontend UI toe in kaartdetail voor uploaden, lijst tonen, downloaden en verwijderen.
7. Zorg dat bestaande kaartacties (updates, recordings, bewerken) ongewijzigd blijven functioneren.
8. Voeg backend- en frontendtests toe voor permissies, CRUD-flow en regressies.
9. Voeg changelog/About entry toe als onderdeel van de implementatie.

## Acceptance criteria
1. Gebruikers met toegang tot een vergaderbord zien op toegankelijke kaarten een duidelijke mogelijkheid om bijlagen toe te voegen.
2. Bestaande kaarten tonen hun bijlagen en bieden download- en verwijderacties waar toegestaan.
3. Nieuwe kaarten kunnen via de afgesproken flow bijlagen krijgen.
4. Onbevoegde gebruikers kunnen bijlagen niet lezen, downloaden, toevoegen of verwijderen.
5. Kaartupdates, opnames en kaartbewerking blijven werken zoals voorheen.
6. Bijlagen worden lokaal opgeslagen en zijn gekoppeld aan een kaart via een expliciet backend model/API.
7. Relevante backend- en frontendtests slagen.

## Testing plan
- Backend tests voor:
  - create/list/download/delete
  - access control en permissies
  - invalid file input en edge cases
- Frontend tests voor:
  - zichtbaarheid van add-attachment control voor geautoriseerde gebruikers
  - geen zichtbaarheid of actie voor onbevoegde gebruikers
  - lijstweergave en verwijder/download-acties
- Handmatige verificatie op bestaand en nieuw kaartdetail als uitgenodigde gebruiker.

## Risk + rollback plan
### Risks
- Onzekerheid over wat precies bedoeld wordt met “existing internal files”.
- Bestandsvalidatie, groottebeperkingen en MIME-type handling kunnen security-risico’s introduceren.
- UX-overlap met recordings en update-afbeeldingen kan verwarring geven.
- Nieuwe attachment-routes kunnen bestaande kaartflows beïnvloeden als de scope te breed wordt.

### Rollback
- Revert de backend attachment model/API/migratie/test changes als één afgeronde capability.
- Verwijder of disable de attachment-UI alleen waar die aan deze backend-capability is gekoppeld.
- Laat bestaande board/card data, updates en recordings ongemoeid.
- Bewaar attachment-data indien nodig, zodat een latere herintroductie mogelijk blijft.

## Notes / links
- User request en aangeleverde Draft Change Spec Outline zijn de functionele bron van waarheid voor scope en acceptatie.
- Relevante startpunten: `frontend/src/app/features/admin/VergaderbordenPage.tsx`, `frontend/src/lib/api/client.ts`, `backend/app/api/boards.py`, `backend/app/services/board_service.py`, `backend/app/repositories/board_repository.py`, `backend/app/models/entities.py`, `backend/app/schemas/boards.py`.
- Mogelijk relevante migraties: `backend/alembic/versions/20260514_0016_vergaderborden.py`, `backend/alembic/versions/20260528_0018_card_update_edit_revision_fields.py`, `backend/alembic/versions/20260616_0023_board_card_attachments.py`.
- De follow-up van 2026-06-17 gebruikt expliciet deze reeds opgeleverde backend-attachmentcapability en hoort daardoor niet opnieuw onder backend-scope te vallen.

## Current status
Completed

## What changed
- Backend card-attachment capability shipped: dedicated `board_card_attachments` model/table, repository/service/API-routes, local file storage handling, permissions, and audit logging.
- Backend attachment regression coverage shipped in `backend/tests/test_boards_api.py` for upload/list/download/delete, permissions, and validation.
- Attachment API-responses en mirrored frontend/client types geven geen interne `file_path` meer terug.
- De bestaande attachment upload/list/download/delete flow en overige kaartfunctionaliteit zijn ongewijzigd gebleven.

## How to verify
1. Open een toegankelijke vergaderbord-kaart en bevestig dat uploaden/lijst/download/verwijderen beschikbaar zijn.
2. Controleer dat bestaande kaarten bestaande bijlagen tonen.
3. Controleer dat onbevoegde gebruikers geen toegang hebben.
4. Run:
   - `uv run pytest tests/test_boards_api.py -q` (backend attachment CRUD/permissions; expected: all tests pass)
   - `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` from `frontend/` (frontend)

## Verification evidence
- `uv run pytest tests/test_boards_api.py -q` → 33 passed.
- `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` from `frontend/` → 41 passed.

---
Status: completed
Owner: 
Date: 2026-06-16
