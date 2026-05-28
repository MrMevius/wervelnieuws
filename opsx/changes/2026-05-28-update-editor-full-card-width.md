# Title
Make update editor full card width

## Context
Het “Nieuwe update”-invoerveld in de kaartdetailweergave is momenteel te smal en benut de beschikbare breedte van de kaartinhoud niet volledig.

De gewenste wijziging is een kleine, gerichte frontend layout/CSS-fix zodat de update-editor de volledige beschikbare kaartbreedte gebruikt binnen de bestaande kaartpadding.

## Goals / Non-goals
### Goals
- Maak de update-editor even breed als de kaartinhoud (binnen bestaande padding/marges van de kaart).
- Houd toolbar en tekstgebied visueel en structureel netjes uitgelijnd.
- Behoud de bestaande kaart- en modal-layout zonder functionele wijzigingen.

### Non-goals
- Geen wijzigingen aan functionaliteit voor updates plaatsen/bewerken.
- Geen redesign van de modal of bredere UI-herstructurering.
- Geen backend/API/database-wijzigingen.

## Proposed approach
1. Lokaliseer de frontend component(en)/styles die de “Nieuwe update”-editor in de kaartdetailweergave renderen.
2. Pas alleen de noodzakelijke CSS/layout-constraints aan (bijv. width/max-width/display/flex-regels) zodat de editorcontainer de beschikbare kaartbreedte vult.
3. Controleer alignment van toolbar en tekstgebied na de breedte-aanpassing.
4. Verifieer dat bestaande kaart- en modal-structuur visueel intact blijft en geen functionele regressie introduceert.
5. Werk alleen tests of snapshots bij als selector-/DOM-verwachtingen direct geraakt worden door layout-gerelateerde class-aanpassingen.

## Implementation steps (ordered)
1. Inventariseer de relevante frontendbestanden voor de kaartdetail update-editor en bijbehorende CSS.
2. Identificeer de beperkende style-regel(s) die het updateveld te smal maken.
3. Voer minimale style-aanpassing(en) door zodat de editor de volledige inhoudsbreedte van de kaart benut.
4. Valideer toolbar/textarea-alignment op standaard desktopbreedte.
5. Valideer dat kaart/modal-layout intact blijft (geen ongewenste verschuivingen of overflow).
6. Run gerichte frontend checks (tests/build/lint indien beschikbaar) voor regressiebewaking.
7. Voeg indien vereist door repo-DOD een korte About/changelog-entry toe voor deze UI-fix.
8. Documenteer resultaten in `Verification evidence` en update status na implementatie.

## Acceptance criteria
1. Het updateveld is even breed als de kaartinhoud binnen de bestaande kaartpadding.
2. Toolbar en tekstgebied blijven netjes uitgelijnd over de volledige editorbreedte.
3. Bestaande kaart/modal-layout blijft intact zonder zichtbare layoutbreuk.
4. Er zijn geen functionele wijzigingen in updates plaatsen/bewerken.
5. Gerichte frontend-validatie (build/lint/tests waar beschikbaar) toont geen regressie voor dit scopegebied.

## Testing plan
- Statisch/inspectie:
  - Controleer relevante frontend component- en stylebestanden op correcte breedte-/layoutregels.
- Geautomatiseerd (indien beschikbaar in repo):
  - `cd frontend && npm run lint`
  - `cd frontend && npm test -- <relevante testbestanden>`
  - `cd frontend && npm run build`
- Handmatige smoke-check:
  1. Open kaartdetail met “Nieuwe update”-editor.
  2. Verifieer dat de editor de kaartinhoudbreedte vult.
  3. Verifieer alignment van toolbar + tekstgebied.
  4. Verifieer dat modal/kaartlayout ongewijzigd en stabiel is.

## Risk + rollback plan
### Risks
- Kleine CSS/layout-regressie in de kaartdetailweergave.
- Onbedoelde impact op nabijgelegen UI-elementen door te brede selector-scope.

### Mitigatie
- Gebruik zo specifiek mogelijke selectors binnen de update-editor-context.
- Houd de wijziging minimaal en uitsluitend layout-gerelateerd.
- Valideer expliciet op kaartdetail/modal regressies.

### Rollback
- Draai de CSS/layout-wijziging terug naar de vorige werkende stijl.
- Geen rollback in backend/API/database nodig.

## Notes / links
- Bron: door gebruiker aangeleverde Draft Change Spec Outline (goedgekeurd).
- Docs impact: geen gebruikersdocumentatie; About/changelog alleen toevoegen als repo-proces dit vereist voor elke UI-wijziging.
- Beoogd specpad: `opsx/changes/2026-05-28-update-editor-full-card-width.md`.

## Current status
Completed

## What changed
- Voor implementatie expliciet herbevestigd:
  - Acceptatiecriterium 1: updateveld even breed als kaartinhoud (binnen bestaande padding).
  - Acceptatiecriterium 2: toolbar en tekstgebied blijven netjes uitgelijnd.
  - Acceptatiecriterium 3: bestaande kaart/modal-layout blijft intact.
- Scope bevestigd: alleen frontend layout/CSS, geen updategedrag/backend/modal-redesign.
- Testaanpak bevestigd: statische inspectie + gerichte frontend-checks waar nodig, geen volledige suite tenzij noodzakelijk.
- Frontend CSS aangepast in `frontend/src/styles.css`:
  - `.board-update-editor-shell` kreeg `width: 100%` en `min-width: 0` zodat de editorcontainer de volledige beschikbare kaartbreedte vult binnen bestaande padding.
  - `.board-update-textarea` kreeg `width: 100%` en `min-width: 0` zodat het tekstgebied de shell-breedte volledig volgt en uitlijning met toolbar behoudt.
- Geen wijzigingen in updatefunctionaliteit, backendlogica of modal-structuur.

## How to verify
1. Open een vergaderbordkaart in de detailmodal met het formulier “Nieuwe update”.
2. Controleer visueel dat de editor (toolbar + tekstgebied) de volle kaartinhoudbreedte gebruikt binnen bestaande padding.
3. Controleer dat toolbar en tekstgebied netjes op elkaar uitgelijnd blijven over de volledige breedte.
4. Controleer dat de kaartdetailmodal verder ongewijzigd blijft (geen layoutbreuk/overflow).
5. (Optioneel via test-runner) voer gerichte frontend checks uit zoals lint/build of relevante tests.

## Verification evidence
- Code-inspectie uitgevoerd op:
  - `frontend/src/styles.css` (relevante selectorregels voor update-editorbreedte).
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx` (context van “Nieuwe update”-editor bevestigd).
- Uitgevoerde wijziging:
  - Alleen CSS-layoutregels aangepast (geen TS/logic wijzigingen).
- Geautomatiseerde verificatie:
  - `npm test` in `frontend/`: PASS (73 passed / 0 failed across `src/app/App.test.tsx` and `src/app/features/admin/VergaderbordenPage.test.tsx`).
  - `npm run build` in `frontend/`: PASS (TypeScript + Vite production build completed; `✓ built in 1.23s`).
  - `npm run lint`: not run because no `lint` script exists in `frontend/package.json`.
- Review:
  - PASS by direct/orchestrator review after the `opsx-review` subagent was unavailable (`ProviderModelNotFoundError`).
  - Checked `frontend/src/styles.css` selector scope and spec alignment; no scope creep or obvious CSS regression found.
- Docs/changelog:
  - Added About changelog iteration 52 in `backend/app/api/meta.py` with an end-user-friendly entry for the full-width update field.
- Extra targeted check after changelog update:
  - `pytest backend/tests/test_meta_and_me.py`: BLOCKED/FAIL in this local environment because Python dependencies are unavailable (`ModuleNotFoundError: No module named 'fastapi'` while loading `backend/tests/conftest.py`). This does not indicate an assertion failure in the changed code.
- Verwachte AC-dekking:
  - AC1: gedekt via `width: 100%` op shell + textarea.
  - AC2: gedekt doordat toolbar binnen dezelfde full-width shell blijft en textarea nu dezelfde breedte volgt.
  - AC3: gedekt door minimale, lokaal gescopeerde CSS-wijziging zonder modal/card-structuuraanpassing.

---
Status: completed
Owner:
Date: 2026-05-28
