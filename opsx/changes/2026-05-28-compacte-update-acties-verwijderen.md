## Title
Compacte update-acties en verwijderen voor vergaderbord-kaartupdates

## Context
Deze wijziging is een follow-up op `opsx/changes/2026-05-28-trello-achtige-kaartactiviteiten.md`, waarin kaartupdates als activity cards zijn vormgegeven met een owner-only bewerkactie.

Nieuwe behoefte: onder elke niet-verwijderde eigen update moeten compacte, Trello-achtige tekstlinks zichtbaar zijn: `Bewerken • Verwijderen` (kleine tekst onder de update-bubble, geen grote knoppen). Daarnaast moet verwijderen functioneel worden toegevoegd met owner-only autorisatie, bevestigingsdialoog en directe verdwijning uit de activity-lijst.

Discovery bevestigt:
- Frontend heeft nu alleen `Bewerken` (owner-only), button-achtig, in `frontend/src/app/features/admin/VergaderbordenPage.tsx` met styling in `frontend/src/styles.css`.
- Er is nog geen delete-UI en geen frontend API-helper voor delete.
- Backend heeft PATCH voor edit, maar geen DELETE endpoint voor card updates.
- `CardUpdate` heeft nog geen soft-delete velden.

Gegeven repositoryverwachtingen rond audit/history en de gewenste UI-uitkomst (verdwijnen uit lijst), kiezen we een minimale maar veilige aanpak met soft delete indien haalbaar binnen beperkte scope; verwijderde updates worden in elk geval niet meer teruggegeven in kaartdetail-responses.

## Goals / Non-goals
### Goals
- Compacte action row tonen onder elke eigen, niet-verwijderde update: `Bewerken • Verwijderen` als tekstlinks.
- Niet-eigen updates tonen géén acties.
- Verwijderen werkt alleen voor eigenaar (server-side enforced).
- Verwijderen vraagt bevestiging via `window.confirm` of equivalent.
- Bij annuleren van bevestiging wordt geen delete API-call gedaan.
- Bij bevestigen wordt backend-delete uitgevoerd en verdwijnt update direct uit activity-lijst (geen tombstone in UI).
- Bestaande edit-flow voor niet-verwijderde updates blijft werken.
- 403 bij non-owner delete en 404 bij verkeerde card/update-combinatie.

### Non-goals
- Geen redesign van de volledige activity card-layout buiten compacte actiepresentatie.
- Geen uitbreiding van rechtenmodel buiten bestaande owner-regels.
- Geen herstel/undo-interface voor verwijderde updates in deze iteratie.
- Geen wijziging aan opnames/workflow buiten `card_updates`.

## Proposed approach
Implementeer delete end-to-end voor card updates met minimale impact op bestaande flows:

1. **Backend**
   - Voeg DELETE endpoint toe voor kaartupdate binnen bestaande board/card routestructuur.
   - Valideer dat update bij opgegeven card hoort; anders 404.
   - Valideer eigenaar op authenticated user; anders 403.
   - Voer verwijdering uit via soft delete (voorkeur) met filtering uit detailresponse; als soft delete niet haalbaar blijkt binnen bestaande model/migratiepatronen, documenteer expliciet en gebruik hard delete als fallback.
   - Zorg dat kaartdetail-query alleen niet-verwijderde updates retourneert.

2. **Frontend**
   - Vervang button-achtige `Bewerken` presentatie door compacte tekst action row `Bewerken • Verwijderen` onder eigen updates.
   - Voeg delete API-helper en mutatie toe.
   - Voeg confirm-stap toe vóór delete-call.
   - Bij succesvolle delete: bestaande query invalidation/refresh gebruiken zodat update verdwijnt.
   - Geen acties renderen voor niet-eigen updates.

3. **Tests**
   - Backend tests voor owner-only delete, 404 card/update mismatch, en filtergedrag van verwijderde updates.
   - Frontend tests voor compacte actierij, non-owner verborgen acties, confirm cancel zonder API-call, confirm delete met refresh en verdwijnen uit lijst, en regressie edit-flow.

## Implementation steps (ordered)
1. Analyseer bestaand `CardUpdate` model, repository/service en kaartdetail-responsepad om kleinste veilige delete-aanpassing te bepalen (soft delete voorkeur).
2. Voeg benodigde persistence-aanpassing toe voor delete-status (bij soft delete) inclusief migratie waar nodig.
3. Implementeer backend delete-functionaliteit in board/card update API (DELETE route + service/repository).
4. Implementeer server-side validaties:
   - owner-only -> 403,
   - update hoort niet bij card -> 404,
   - niet-bestaande update -> 404.
5. Pas kaartdetail-ophaalpad aan zodat verwijderde updates niet meer in response zitten.
6. Voeg frontend API helper/mutatie toe voor update-delete.
7. Pas `VergaderbordenPage.tsx` action row aan naar compacte tekstlinks `Bewerken • Verwijderen` voor eigen niet-verwijderde updates.
8. Implementeer confirm-flow: bij cancel geen API-call; bij confirm wel delete-mutatie en query refresh.
9. Verifieer en borg dat bestaande edit-flow ongewijzigd blijft werken voor niet-verwijderde updates.
10. Werk tests bij/uit (backend + frontend) en voeg waar nodig regressietests toe.
11. Werk About/changelog entry bij met eindgebruikersvriendelijke beschrijving van compacte acties en verwijdergedrag.

## Acceptance criteria
1. Onder elke eigen, niet-verwijderde update staat een compacte actierij met exact `Bewerken • Verwijderen` als kleine tekstlinks.
2. Niet-eigen updates tonen geen actie-elementen.
3. Klik op `Verwijderen` toont een bevestigingsdialoog.
4. Bij annuleren van bevestiging wordt geen delete API-call uitgevoerd.
5. Bij bevestigen wordt backend-delete aangeroepen en kaartdetail/activity-lijst ververst.
6. Verwijderde update is na succesvolle delete niet meer zichtbaar in activity-lijst (geen tombstone-placeholder).
7. Server-side owner-only regel is afgedwongen: non-owner delete geeft 403.
8. Verkeerde card/update-combinatie geeft 404.
9. Bestaande edit-flow (`Bewerken`, opslaan/annuleren) blijft werken voor niet-verwijderde eigen updates.
10. Geautomatiseerde tests dekken backend- en frontend-scenario’s voor bovenstaande criteria.

## Testing plan
- **Backend (targeted):**
  - `pytest backend/tests -k "board and update and delete"`
  - Indien specifieke file bestaat: `pytest backend/tests/test_boards_api.py -k "update and delete"`
- **Frontend (targeted):**
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- **Breder regressie (na targeted groen):**
  - `cd frontend && npm test`
  - `cd frontend && npm run build`

Te dekken testcases:
- Owner ziet `Bewerken • Verwijderen`.
- Non-owner ziet geen acties.
- Cancel in confirm -> geen delete-call.
- Confirm -> delete-call + update verdwijnt uit lijst.
- Edit-regressie blijft groen.
- API 403 voor non-owner delete.
- API 404 voor card/update mismatch.

## Risk + rollback plan
### Risico’s
- Soft-delete introductie kan queryfilters op andere plekken missen, waardoor verwijderde updates onbedoeld zichtbaar blijven.
- UI regressie: compacte tekstlinks kunnen toegankelijkheid/klikbaarheid verminderen als styling te minimaal is.
- Race-condition in UI-refresh kan kortstondig oude lijst tonen.

### Mitigaties
- Centraliseer filter voor verwijderde updates in relevante read-paden en dek af met tests.
- Houd action row semantisch klikbaar (buttons/links met duidelijke focus states) ondanks compacte stijl.
- Gebruik bestaande query invalidation/refetch patronen na mutaties.

### Rollback
- Revert delete endpoint + modelwijzigingen + frontend actierij/mutatie in één commitreeks.
- Bij soft-delete migratieproblemen: tijdelijke rollback naar vorige schema/API-versie en herdeploy.
- About/changelog-entry terugdraaien indien feature wordt ingetrokken.

## Notes / links
- Follow-up spec: `opsx/changes/2026-05-28-trello-achtige-kaartactiviteiten.md`
- Frontend: `frontend/src/app/features/admin/VergaderbordenPage.tsx`
- Frontend styles: `frontend/src/styles.css`
- Backend board API (te bepalen exacte files): vermoedelijk `backend/app/api/*board*` + service/repository/model lagen voor `CardUpdate`.

## Current status
Done

## What changed
- **Backend**
  - `CardUpdate` uitgebreid met soft-delete velden: `deleted_at` en `deleted_by_user_id`.
  - Nieuwe migratie toegevoegd: `20260528_0019_card_update_soft_delete.py`.
  - DELETE endpoint toegevoegd: `DELETE /api/boards/cards/{card_id}/updates/{update_id}`.
  - Server-side autorisatie en validatie toegevoegd:
    - non-owner delete -> `403`,
    - update ontbreekt / verkeerde card-update-combinatie / al verwijderd -> `404`.
  - Soft delete geïmplementeerd in repository en filtering op reads:
    - verwijderde updates worden niet meer geretourneerd in kaartdetail,
    - `updates_count` telt alleen niet-verwijderde updates.
  - Edit endpoint hardening: verwijderde updates zijn niet meer bewerkbaar (`404`).
  - SQLAlchemy-relatieambiguiteit opgelost na soft-delete FK-uitbreiding:
    - `CardUpdate.author` gebruikt expliciet `foreign_keys=[author_user_id]`.
    - `CardUpdate.deleted_by` relatie toegevoegd met `foreign_keys=[deleted_by_user_id]`.
- **Frontend**
  - Compacte actierij onder eigen updates: `Bewerken • Verwijderen`.
  - Geen acties voor updates van andere gebruikers (owner-only rendering).
  - Delete API-helper toegevoegd (`deleteBoardCardUpdate`).
  - Confirm-flow toegevoegd:
    - annuleren -> geen API-call,
    - bevestigen -> delete-call + invalidation van card/detail en projectlijst.
  - Bestaande edit-flow (`Bewerken`, opslaan/annuleren) intact gelaten.
- **Tests**
  - Frontend tests uitgebreid voor compacte actierij, confirm-cancel en confirm-delete + refresh/disappear.
  - Backend tests toegevoegd voor owner-only delete, wrong card/update 404 en verdwijnen uit detail.
- **About/changelog**
  - Nieuwe eindgebruikersvriendelijke changelog-entry toegevoegd (iteratie 49) voor compacte update-acties en verwijderen.

## How to verify
- Frontend targeted:
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- Frontend regressie:
  - `cd frontend && npm test`
- Frontend productiebuild:
  - `cd frontend && npm run build`
- Backend targeted:
  - `cd backend && ./.venv/bin/python -m pytest tests/test_boards_api.py -k "update and delete"`
  - (of) `pytest backend/tests -k "board and update and delete"`

Handmatige checks in UI/API:
- Eigen update toont compacte `Bewerken • Verwijderen`.
- Niet-eigen update toont geen acties.
- Klik `Verwijderen` toont confirm.
- Cancel in confirm doet geen delete-call.
- Confirm verwijdert update en na refresh/invalidation is update weg uit activity-lijst.
- Non-owner delete geeft 403.
- Verkeerde card/update-combinatie geeft 404.
- Bestaande edit-flow van eigen update werkt nog.

## Verification evidence
- ✅ `cd frontend && npm test -- VergaderbordenPage.test.tsx`
  - Resultaat: **PASS** (`1 file`, `23 tests passed`), inclusief nieuwe update-actie/delete tests.
- ✅ `cd frontend && npm test`
  - Resultaat: **PASS** (`2 files`, `71 tests passed`).
- ✅ `cd frontend && npm run build`
  - Resultaat: **PASS** (TypeScript build en Vite productiebuild succesvol afgerond).
- ✅ `cd backend && ./.venv/bin/python -m pytest tests/test_boards_api.py -k "update and delete"`
  - Resultaat: **PASS** (`2 passed, 18 deselected`).

---
Status: done
Owner: n.v.t.
Date: 2026-05-28
