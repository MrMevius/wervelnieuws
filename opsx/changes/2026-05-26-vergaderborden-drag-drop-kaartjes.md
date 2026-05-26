# Title
Vergaderborden: kaartjes slepen tussen kolommen betrouwbaar maken

## Context
Gebruikers willen kaartjes in Vergaderborden betrouwbaar kunnen verslepen tussen de kolommen **Te doen**, **Bezig** en **Klaar**.

Uit discovery blijkt dat een basisimplementatie al bestaat in:
- `frontend/src/app/features/admin/VergaderbordenPage.tsx`
- backend endpoint `PATCH /boards/cards/{card_id}/move`

De huidige flow moet betrouwbaarder en duidelijker worden voor eindgebruikers: directe opslag, zichtbare feedback bij drag/drop en saven, robuuste foutafhandeling en regressiedekking met tests.

## Goals / Non-goals
### Goals
- Drag/drop tussen bestaande kolommen op het bestaande Vergaderborden-scherm betrouwbaar maken (desktop-first).
- Bij drop direct opslaan via de bestaande move-API met correcte doelkolom en positie.
- Duidelijke visuele feedback toevoegen voor drag-over, opslaan en fouten.
- Onnodige API-calls voorkomen bij drop in dezelfde kolom zonder relevante positiewijziging.
- UI-consistentie behouden bij fouten (rollback of refetch, zodat geen misleidende status zichtbaar blijft).
- Kritische move-flow afdekken met frontend- en backend-regressietests.
- About/changelog voorzien van een eindgebruikersvriendelijke entry.

### Non-goals
- Geen nieuw board-module ontwerp.
- Geen nieuw datamodel tenzij strikt noodzakelijk.
- Geen touch/mobile-first drag/drop.
- Geen redesign van labels, deadlines of kaartdetailweergave.
- Geen volledige vrije herordening binnen dezelfde kolom buiten het bestaande eenvoudige positiemodel.

## Proposed approach
1. Behoud de bestaande architectuur en endpoint; verbeter alleen betrouwbaarheid en UX van de huidige flow.
2. Laat de frontend bij drop expliciet bepalen of een persist-call nodig is:
   - wel bij kolomwijziging
   - niet bij same-column drop zonder relevante positieaanpassing
3. Voer directe save uit via `PATCH /boards/cards/{card_id}/move` met de doelstatus/kolom en positie volgens huidige API-contract.
4. Voeg duidelijke UI-states toe:
   - drag-over-highlight op doelkolom
   - tijdelijke saving-indicatie
   - heldere Nederlandstalige foutmelding bij API-falen
5. Implementeer robuuste foutafhandeling met rollback en/of refetch om client/server consistent te houden.
6. Voeg gerichte regressietests toe op backend-API-gedrag en frontend drag/drop-flow.
7. Werk `backend/app/api/meta.py` changelog bij met een eindgebruikersgerichte beschrijving.

## Implementation steps (ordered)
1. Inventariseer huidige drag/drop-logica in `VergaderbordenPage.tsx` en bevestig bestaande status-/kolommapping.
2. Verfijn drop-afhandeling zodat alleen bij relevante verandering een move-request wordt verstuurd.
3. Borg correcte payloadopbouw (target column/status + positie) voor de bestaande move-endpointcall.
4. Voeg visuele feedback toe voor drag-over en saving-state, zonder bestaande bordweergave te breken.
5. Voeg foutafhandeling toe met duidelijke NL-foutmelding en state-herstel (rollback/refetch).
6. Verifieer dat bestaande flows (kaart aanmaken, bord bekijken) functioneel intact blijven.
7. Schrijf/actualiseer backend tests voor move-endpoint (succespad + foutpad + relevante validatie).
8. Schrijf/actualiseer frontend tests voor drag/drop-kernscenario’s en no-op same-column gedrag.
9. Update About/changelog entry in `backend/app/api/meta.py`.

## Acceptance criteria (measurable)
1. Een kaart kan van **Te doen** naar **Bezig** worden gesleept.
2. Een kaart kan van **Bezig** naar **Klaar** of terug naar **Te doen** worden gesleept.
3. Een drop triggert direct een move-API-save met correcte doelkolom en positie.
4. Na browser refresh staat de kaart nog steeds in de nieuwe kolom.
5. Een same-column drop veroorzaakt geen onnodige API-call, tenzij een echte positiewijziging in de bestaande logica ondersteund/vereist is.
6. Bij API-falen ziet de gebruiker een duidelijke Nederlandstalige foutmelding en blijft de UI niet in een misleidende toestand achter.
7. Bestaande functionaliteit voor kaartaanmaak, bordweergave en gerelateerde flows blijft werken.
8. Frontend- en backend-tests dekken de kritieke move-flow en slagen.
9. About/changelog bevat een eindgebruikersvriendelijke entry over de verbetering.

## Testing plan
- Backend (gericht): run pytest op boards API move tests, bijv. `backend/tests/test_boards_api.py` of equivalent.
- Frontend (gericht): run tests op `VergaderbordenPage` drag/drop gedrag met bestaande teststack.
- Kwaliteitschecks changed areas: relevante lint/typecheck/tests voor backend en frontend.
- Handmatige verificatie:
  1. Inloggen als admin.
  2. Vergaderborden openen.
  3. Kaart tussen kolommen slepen.
  4. Bevestigen dat directe save plaatsvindt.
  5. Pagina refreshen en persistentie bevestigen.
  6. Foutscenario simuleren (indien mogelijk) en foutmelding + UI-herstel controleren.

## Risk + rollback plan
### Risks
- HTML5 drag/drop is desktop-georiënteerd; mobiele ervaring valt buiten scope.
- Bestaande basis-DnD kan regressie krijgen bij te zware refactor; wijzigingen moeten klein en gericht blijven.
- Snelle opeenvolgende drops kunnen race conditions veroorzaken; saving-state/guarding is nodig waar praktisch.

### Rollback
- Frontend: revert DnD UX-/error-state wijzigingen als regressies optreden.
- Backend: endpoint-gedrag ongewijzigd laten tenzij testgedreven validatieaanpassing nodig blijkt; eventuele wijziging kan apart worden teruggedraaid.

## Notes / links
- Bestaande frontendlocatie: `frontend/src/app/features/admin/VergaderbordenPage.tsx`
- Bestaande backend endpoint: `PATCH /boards/cards/{card_id}/move`
- Changeloglocatie: `backend/app/api/meta.py`

### Approved follow-up scope (2026-05-26)
- Doel: backend testomgeving/configuratie repareren zodat gerichte board move tests in deze omgeving kunnen draaien met een schrijfbaar test storage pad.
- Scope: alleen testconfiguratie en gerelateerde testomgeving-aansturing; geen wijziging in productiegedrag of board functionaliteit.
- Constraints:
  - kleinste veilige fix
  - bestaande applicatiegedrag behouden
  - verificatie via gerichte backend move test(s)

### Assumptions
- De bestaande move-endpoint accepteert al voldoende informatie voor doelkolom/status en positie.
- Het huidige eenvoudige positioneringsgedrag binnen kolommen blijft leidend (geen volledige reorder-uitbreiding in scope).
- De bestaande testinfrastructuur ondersteunt drag/drop regressietests zonder frameworkwissel.

## Current status
Completed

## What changed
- Scope-fix (blocking, no-edit review): same-column drop is nu expliciet altijd een no-op in deze iteratie.
  - Reden: binnen de afgesproken scope wordt alleen kolom/status-wijziging ondersteund; precieze reorder binnen dezelfde kolom is niet in scope.
  - Implementatie: `targetPosition` wordt niet meer berekend/gebruikt voor same-column drops; er wordt direct `return` gedaan zonder move-API-call.
  - Hiermee wordt voorkomen dat multi-card same-column drops onbedoeld als "move naar onderaan" worden verstuurd.
- Frontend regressietest aangescherpt:
  - same-column no-op scenario gebruikt nu meerdere kaarten in dezelfde kolom, met een bronkaart die niet onderaan staat (`sourcePosition` niet bottom), en verifieert dat géén API-call plaatsvindt.
- Frontend `VergaderbordenPage.tsx` drag/drop-flow gericht verbeterd zonder redesign:
  - Drop gebruikt nu gestructureerde drag-meta (`cardId`, bronkolom, bronpositie).
  - Direct save via bestaand `PATCH /boards/cards/{card_id}/move` blijft leidend.
  - No-op same-column drop (zonder relevante positiewijziging) doet nu géén move-API-call.
  - Visuele feedback toegevoegd:
    - kolom-highlight bij drag-over
    - tijdelijke saving-indicatie tijdens move
    - duidelijke NL-foutmelding bij save-fout
  - Foutafhandeling versterkt met refetch (`invalidateQueries`) bij move-fout zodat UI en serverstatus consistent blijven.
  - Test-hooks toegevoegd via `data-testid` op kolommen/kaarten voor gerichte DnD-regressietests.
- Frontend styling (`frontend/src/styles.css`) uitgebreid voor:
  - drag-over kolomstate
  - saving-state-indicatie
  - compacte fout-/statusregels boven het bord.
- Gerichte frontend regressietests toegevoegd in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`:
  - succesvol verplaatsen naar andere kolom -> correcte move-call
  - same-column no-op -> geen move-call
  - move-fout -> NL-foutmelding + refetch-trigger
- Backend regressietests in `backend/tests/test_boards_api.py` uitgebreid:
  - negatieve positie op move-request geeft 422-validatiefout
  - onbekende kaart op move-request geeft 404
- Follow-up testomgevingfix (goedgekeurde scope) toegevoegd in `backend/tests/conftest.py`:
  - test-runner zet `STORAGE_ROOT` nu expliciet naar een schrijfbaar tijdelijk pad (`/tmp/wervelnieuws-test-storage`) vóór app-imports.
  - hierdoor gebruiken gerichte board-move tests geen niet-schrijfbaar `/data` pad meer in deze omgeving.
  - productiegedrag blijft ongewijzigd, omdat wijziging uitsluitend in testconfiguratie staat.
- About/changelog bijgewerkt in `backend/app/api/meta.py` met iteratie 33 over betrouwbaarder kaartjes verslepen.

## How to verify
- Frontend gericht:
  - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- Frontend build/typecheck:
  - `cd frontend && npm run build`
- Backend gericht (venv):
  - `cd backend && ./.venv/bin/pytest tests/test_boards_api.py -k move`
- Backend extra gericht:
  - `cd backend && ./.venv/bin/pytest tests/test_boards_api.py`
- Handmatig (desktop):
  1. Open Vergaderborden met kaarten in Te doen/Bezig/Klaar.
  2. Sleep kaart Te doen -> Bezig en controleer directe save.
  3. Sleep same-column zonder effectieve positiewijziging en controleer dat geen extra move-call nodig is.
  4. Simuleer fout op move-endpoint en controleer NL-foutmelding + consistente weergave na refetch.
  5. Refresh pagina en bevestig persistente kolomstatus.

## Verification evidence
- ✅ `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Resultaat: geslaagd (`3 passed`).
- ✅ `cd frontend && npm run build`
  - Resultaat: geslaagd (`tsc -b && vite build`).
- ✅ `cd backend && ./.venv/bin/pytest tests/test_boards_api.py -k move`
  - Resultaat: geslaagd (`2 passed, 3 deselected`).
- ✅ `cd backend && ./.venv/bin/pytest tests/test_boards_api.py`
  - Resultaat: geslaagd (`5 passed`).
- No-edit review: afgerond zonder resterende blocking findings na de same-column no-op fix.
- Niet handmatig geverifieerd in browser; handmatige refresh/persistentiecheck blijft als optionele releasecontrole opgenomen onder How to verify.
- Niet-blockerend: backend pytest toont bestaande dependency/deprecation warnings (`pytest-asyncio`, `crypt`, `datetime.utcnow()`), zonder testfalen.

---
Status: done
Owner:
Date: 2026-05-26
