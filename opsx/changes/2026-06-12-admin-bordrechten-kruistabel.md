# Admin Bordrechten kruistabel

## Context

De huidige Admin > Bordrechten-UI beheert rechten per bord/card en wordt onoverzichtelijk zodra er meerdere gebruikers en borden zijn. Gewenst is één matrix waarin admins direct zien en aanpassen welke niet-admin gebruiker toegang heeft tot welk bord.

## Goals / Non-goals

### Goals
- Eén matrix voor Admin > Bordrechten met rijen = alle niet-admin gebruikers, inclusief inactieve gebruikers als die bestaan, en kolommen = borden.
- Elke cel bevat een checkbox voor toegang.
- Admins hebben automatisch toegang, worden niet bewerkbaar getoond en blijven buiten de matrix.
- Eén centrale knop **Rechten opslaan**; wijzigingen worden pas opgeslagen na klik.
- Dirty state met duidelijke samenvatting.
- Succes- en foutfeedback; bij fout blijven onopgeslagen wijzigingen zichtbaar.
- Empty states voor geen niet-admin gebruikers en/of geen borden.
- Horizontale scroll bij veel borden; sticky header/eerste kolom waar haalbaar.
- Toegankelijke checkbox-labels en keyboardbediening.
- Bestaande bord-aanmaak- en archiveringsflows blijven werken als ze op deze pagina blijven staan.

### Non-goals
- Geen nieuwe rollen of rechtenniveaus.
- Geen wijziging aan adminrechten.
- Geen redesign van andere admin-tabs.
- Geen grote backendwijziging tenzij technisch noodzakelijk.
- Geen bulk-acties zoals alles selecteren, tenzij triviaal in te passen.

## Proposed approach

- Bouw de matrix client-side op uit de bestaande `BoardRightsOverviewResponse` (`users` + `projects`).
- Gebruik bestaande API-calls per bord voor opslaan; voer alleen de dirty rijen uit.
- Render de matrix als semantische tabel met horizontale scrollcontainer en sticky header/eerste kolom.
- Filter admins uit de rijen en toon een korte toelichting: “Admins hebben automatisch toegang tot alle borden.”
- Toon alle niet-admin users in de rijen, ook als ze inactief zijn; markeer inactieve users expliciet.
- Houd drafts lokaal bij per gebruiker/bord-combinatie of per rij, zodat wijzigingen pas na opslaan naar de server gaan.
- Toon een centrale save-CTA boven of onder de matrix; disabled zonder wijzigingen en terwijl opslaan bezig is.
- Bij fout: feedback tonen en drafts behouden; bij succes: query invalidaten en dirty state resetten.
- Laat bestaande create/delete-achtige acties op deze pagina onaangetast waar ze al bestaan.

## Implementation steps (ordered)

1. Inspecteer de huidige `BoardRightsAdminTab`, de bestaande board-rights API types en de bestaande tests.
2. Modelleer de matrixdata uit de huidige rights-response: alle niet-admin gebruikers als rijen, borden als kolommen.
3. Vervang de card-per-board UI door een matrix/tabel met checkboxes, sticky header en sticky eerste kolom waar haalbaar.
4. Voeg toegankelijke labels toe per checkbox (`geef <gebruiker> toegang tot <bord>`), inclusief toetsenbordfocus.
5. Implementeer dirty-state tracking en een samenvatting (bijv. aantal gewijzigde rijen/borden) naast de centrale **Rechten opslaan**-knop.
6. Implementeer save-flow die alle dirty boards opslaat via bestaande update-call(s); zet matrixcontrols tijdelijk op disabled tijdens opslaan en houdt wijzigingen zichtbaar bij gedeeltelijke of totale fout.
7. Voeg empty states toe voor (a) geen niet-admin gebruikers en (b) geen borden.
8. Behoud de bestaande bord-aanmaak-/verwijderflows op dezelfde pagina waar die nu bestaan, zonder de matrixlogica te breken.
9. Werk frontendtests bij voor matrixrendering, admins uitgesloten, checkbox-state, save-disabled, dirty summary, succes/fout en empty states.
10. Update de About/changelog-entry met een korte eindgebruikersvriendelijke melding.
11. Run gerichte verificatie en vul deze spec aan met resultaat/evidence.

## Acceptance criteria

- Alle niet-admin gebruikers staan als rijen; borden staan als kolommen.
- Elke cel bevat een checkbox en heeft een duidelijke, toegankelijke labeltekst.
- Admins worden niet bewerkbaar getoond en hebben automatisch toegang.
- **Rechten opslaan** is disabled zolang er geen wijzigingen zijn.
- **Rechten opslaan** en de matrixcontrols zijn disabled terwijl opslaan bezig is.
- Na een wijziging verschijnt een dirty-state samenvatting.
- Succesvolle opslag toont bevestiging en reset de dirty state.
- Mislukte opslag toont foutmelding en behoudt onopgeslagen wijzigingen.
- De matrix blijft bruikbaar bij veel borden via horizontale scroll.
- Sticky header/eerste kolom is aanwezig waar technisch haalbaar.
- Empty states werken voor geen niet-admin gebruikers en geen borden.
- Bestaande bord-aanmaak- en archiveringsflows blijven functioneren.

## Testing plan

- Frontend tests:
  - `cd frontend && npm test -- App.test.tsx`
- Frontend build/typecheck:
  - `cd frontend && npm run build`
- Backend alleen als de About/changelog-data wordt aangepast:
  - `cd backend && uv run pytest tests/test_meta_and_me.py`
- Handmatige verificatie:
   1. Log in als admin.
   2. Open **Admin > Bordrechten**.
   3. Controleer matrix, admin-toelichting, sticky gedrag en horizontale scroll bij veel borden.
   4. Toggle enkele checkboxes, controleer dirty state en disabled/enabled save-knop.
   5. Sla op; controleer succesfeedback en reset van dirty state.
   6. Simuleer een fout; controleer dat de wijzigingen zichtbaar blijven.
   7. Controleer empty states en keyboard/focusgedrag.
   8. Controleer dat matrixcontrols tijdens opslaan disabled zijn en tussentijdse toggles niet kunnen wegvallen.

## Risk + rollback plan

### Risico's
- Matrix kan te breed worden; mitigatie: compacte cellen, scrollcontainer, sticky kolommen/headers.
- Meervoudig opslaan kan gedeeltelijk falen; mitigatie: per dirty bord opslaan en wijzigingen behouden bij fout.
- Adminrechten kunnen onduidelijk zijn; mitigatie: admins expliciet uitsluiten en toelichten.
- Gedeelde pagina-componenten kunnen bestaande bordflows raken; mitigatie: scope beperken tot de Bordrechten-tab.

### Rollback
- Zet de oude card-gebaseerde Bordrechten-weergave terug.
- Revert lokale frontend-wijzigingen en de About/changelog-entry.
- Geen data-migratie verwacht; rollback is daarom vooral UI/API-call-revert.

## Notes / links

- Bron: goedgekeurde Nederlandse draft outline uit de user request.
- Relevante bestanden:
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/lib/api/client.ts`
  - `frontend/src/app/App.test.tsx`
  - `backend/app/api/boards.py`
  - `backend/app/schemas/boards.py`
  - `backend/app/api/meta.py`
- Aannames:
  - De bestaande `/boards/admin/rights` response bevat genoeg data voor de matrix.
  - De bestaande per-bord update-call blijft voldoende; geen bulk-endpoint nodig.
  - De actieve tab-styling in de admin-navigatie komt uit de eerdere `2026-06-12-admin-bordrechten-ux-polish`-wijziging en blijft hier ongemoeid; deze change beperkt zich tot Bordrechten-matrix, save-race en data-clarificatie.

## Current status

Completed.

## What changed

- Admin > Bordrechten toont nu een matrix met alle niet-admin gebruikers als rijen, inclusief inactieve gebruikers, en borden als kolommen.
- Checkboxwijzigingen worden lokaal bijgehouden, met dirty-state samenvatting, centrale opslagknop, en matrixcontrols die tijdens opslaan tijdelijk vergrendeld zijn.
- Admins blijven buiten de matrix; de bord-aanmaak- en archiveringsacties blijven als aparte bordbeheersectie beschikbaar.
- De backend rights-overview response levert nu ook inactieve niet-admin gebruikers aan, zodat de matrix alle benodigde rijen kan tonen; admins blijven gemarkeerd via `is_admin` en worden in de UI buiten de matrix gefilterd.
- De actieve admin-tab styling is niet aangepast in deze change; die valt onder de eerdere UX-polish en is bewust buiten scope gehouden.
- Follow-up: geen open blockers; eventuele verdere verfijning zit alleen nog in bredere admin-UX-tuning buiten deze change.

## How to verify

- `cd backend && uv run pytest tests/test_boards_api.py -k "board_rights or manage_board_rights"`
- `cd backend && uv run pytest tests/test_meta_and_me.py`
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- Handmatig: matrix, admins buiten de matrix, inactieve niet-admin gebruikers, dirty state, save success/failure, disabled matrix tijdens opslaan, empty states, horizontale scroll en keyboardbediening controleren.

## Verification evidence

- `cd backend && uv run pytest tests/test_boards_api.py -k "board_rights or manage_board_rights"` → passed (3 passed, 26 deselected).
- `cd backend && uv run pytest tests/test_meta_and_me.py` → passed (24 passed).
- `cd frontend && npm test -- App.test.tsx` → passed (73 tests passed).
- `cd frontend && npm run build` → passed.

---
Status: Completed
Owner: —
Date: 2026-06-12
