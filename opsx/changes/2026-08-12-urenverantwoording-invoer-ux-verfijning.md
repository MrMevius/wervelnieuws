# Title
Urenverantwoording: compacte invoer en duidelijke deelnemersselectie

## Context
De urenverantwoordingspagina heeft al een permanente inline create-flow, groepsdeelnemers en opslag in `duration_half_hours`. De huidige invoer kan visueel compacter en beter uitgelijnd worden. Vooral het kiezen van deelnemers moet direct begrijpelijk zijn: WindWilly-gebruikers en externe personen zijn verschillende groepen, terwijl gekozen mensen als controleerbare selectie zichtbaar moeten blijven.

Deze change is een begrensde frontend-UX-verfijning van de bestaande urenmodule. Het bestaande API-contract, inclusief `duration_half_hours`, rechten, backendvalidatie en de huidige eligibility/selectability van gebruikers en externe personen, blijft ongewijzigd.

## Goals / Non-goals

### Goals
- Verbeter de visuele hiërarchie, compactheid en uitlijning van de urenregistratie-invoer op desktop, tablet en mobiel.
- Bied afzonderlijke, duidelijk gelabelde dropdowns voor **WindWilly-personen** en **externe personen**.
- Maak gekozen deelnemers zichtbaar als selecteerbare checkbox-items, zodat een gebruiker personen eenvoudig kan controleren en verwijderen zonder de selectie opnieuw op te bouwen.
- Laat de duur uitsluitend in stappen van 0,5 uur kiezen en toon waarden leesbaar als `0.5`, `1`, `1.5`, enzovoort.
- Behoud de bestaande create-payloadsemantiek: de gekozen duur wordt onveranderd als het bestaande integer-veld `duration_half_hours` verstuurd.
- Houd alle controls volledig Nederlandstalig, toetsenbordbedienbaar en toegankelijk gelabeld.

### Non-goals
- Geen wijziging aan backendcode, API-routes, API-schemas, database/migraties of `duration_half_hours`.
- Geen wijziging aan permissions, admin-grenzen, authenticatie of de huidige eligibility/selectability van live users en externe personen.
- Geen wijziging aan edit-, delete-, restore-, audit-, import/export- of masterdataflows, behalve gedeelde frontendpresentatie wanneer dit noodzakelijk is voor consistente duurweergave.
- Geen nieuw beheer voor externe personen en geen verandering aan de bestaande quick-add-semantieken.
- Geen breed herontwerp van de applicatieshell of andere pagina's.

## Proposed approach
1. Inventariseer de bestaande create-oppervlakken (desktop en mobiel), hun state en de bestaande API payloadconversie. Houd één canonieke deelnemerstate aan; introduceer geen parallel selectiecontract.
2. Herstructureer uitsluitend de frontendweergave rond de bestaande invoer: groepeer de deelnemersbediening in twee expliciete dropdowns en render de huidige geselecteerde deelnemers als checkboxlijst/badges met naam en type. Een checkbox-toggle voegt de bestaande participantdraft toe of verwijdert die; historische of niet-selecteerbare waarden blijven volgens het huidige contract alleen display-only.
3. Vervang vrije of onduidelijke duurinvoer door een toegankelijke select/control met vaste halve-uuropties binnen de huidige door de frontend ondersteunde range. Gebruik een gecentraliseerde formatter voor labels: gehele uren zonder `.0`, halve uren met `.5`. De value-to-payloadmapping blijft `hours × 2` naar `duration_half_hours`.
4. Verfijn componentstructuur en CSS voor een compacte grid/flex-layout met consistente label-, veld- en actie-uitlijning. Laat de mobiele createkaart bruikbaar blijven bij 320 CSS px en 200% zoom; voorkom horizontale overflow.
5. Voeg gerichte frontendregressietests toe voor beide participantgroepen, checkbox-toggle, duration-labels/payload, responsive structure en a11y. Actualiseer de gebruikersgerichte About/changelog alleen als de bestaande About-pagina volgens repositorybeleid een iteratie-entry vereist voor deze afgeronde wijziging.

## Implementation steps (ordered)
1. **Inventarisatie en begrenzing**
   - Leg de huidige desktop- en mobiele create-oppervlakken, participant-state, existing eligibility-meta en `duration_half_hours` mapping vast.
   - Bevestig in tests dat deze change geen nieuwe API-call, queryparameter of backendcontract vereist.
2. **Canonieke presentatielogica**
   - Voeg kleine, lokaal herbruikbare frontendhelpers toe voor deelnemersgroepering en voor het formatteren/converteren van halve uren.
   - Laat bestaande geselecteerde participantdrafts de enige bron van waarheid blijven; voorkom dubbele deelnemers en behoud bestaande quick-add en resetgedrag.
3. **Deelnemersselectie**
   - Render aparte toegankelijke dropdowns met de labels `WindWilly-personen` en `Externe personen`.
   - Toon per dropdown alleen de reeds door de bestaande meta/eligibilitylaag geleverde, selecteerbare opties van die groep.
   - Toon gekozen personen als checkbox-items met toegankelijke naam en type; togglen voegt exact één bestaande participantdraft toe of verwijdert deze. Behoud bestaande display-only behandeling van historische/inactieve gekoppelde personen.
4. **Halve-ureninvoer**
   - Lever uitsluitend geldige 0,5-uursstappen aan de gebruiker en toon labels als `0.5`, `1`, `1.5` enzovoort, met passende Nederlandse context (bijvoorbeeld `1.5 uur`).
   - Behoud de bestaande validatiegrenzen en zet de gekozen waarde vóór submit exact om naar het bestaande `duration_half_hours`-integercontract.
5. **Compacte layout**
   - Pas alleen urenpagina-frontendmarkup en -styling aan voor consistente kolombreedtes, label/veld-uitlijning, beperkte tussenruimte en uitgelijnde primaire/secundaire acties.
   - Bewaak bruikbaarheid van desktop-, tablet- en mobiele create-oppervlakken, inclusief keyboardfocus en foutweergave.
6. **Tests en documentatie**
   - Breid de urenpagina-tests uit met de acceptancecriteria hieronder en actualiseer eventuele snapshots/mocks zonder API-contractwijziging.
   - Voeg een gebruikersgerichte About/changelogregel toe wanneer de wijziging volgens de repository Definition of Done wordt afgerond; documenteer de nieuwe invoer alleen als bestaande gebruikersdocumentatie hierdoor feitelijk wijzigt.
7. **Verificatie en evidence**
   - Draai de exacte commands uit het Testing plan, noteer werkelijke uitkomsten onder `Verification evidence` en markeer de spec pas als Completed wanneer alle criteria zijn aangetoond.

## Acceptance criteria
1. De create-oppervlakken op desktop én mobiel bevatten afzonderlijk toegankelijke controls met de namen `WindWilly-personen` en `Externe personen`.
2. De WindWilly-control toont uitsluitend de al door de huidige eligibility-meta geleverde selecteerbare live users; de externe-control toont uitsluitend de huidige selecteerbare externe personen. De change wijzigt de ontvangen datasets of backendbeslissing niet.
3. Een gebruiker kan in beide controls een persoon aanvinken om die precies één keer aan de bestaande geselecteerde deelnemers toe te voegen en uitvinken om die te verwijderen; de create-payload bevat daarna precies dezelfde participantidentities als de aangevinkte selectie.
4. Reeds gekoppelde historische, gearchiveerde, inactieve of niet-selecteerbare deelnemers blijven de bestaande display-only semantiek volgen en kunnen niet via deze nieuwe dropdowns als nieuwe deelnemer worden toegevoegd.
5. De duurcontrol biedt uitsluitend stappen van 0,5 uur binnen de reeds ondersteunde frontendrange; zichtbare labels gebruiken geen `.0` voor gehele uren en tonen halve waarden als `.5` (minimaal `0.5`, `1`, `1.5`).
6. Bij submit wordt iedere gekozen duur correct en zonder afrondingsverlies naar het bestaande `duration_half_hours`-integercontract omgerekend; bijvoorbeeld `0.5 → 1`, `1 → 2` en `1.5 → 3`.
7. De bestaande create-, reset-, validatie- en externe-person-quick-addflows blijven functioneren; deze change veroorzaakt geen additionele API-routes of gewijzigde payloadvelden.
8. De invoer heeft op desktop consistente label/veld/actie-uitlijning en aantoonbaar minder overbodige witruimte dan de uitgangssituatie; op mobiel ontstaat bij 320 CSS px en 200% zoom geen horizontale viewportoverflow en blijven alle primaire invoervelden en save/resetacties bereikbaar.
9. Nieuwe controls hebben toegankelijke namen, zijn keyboardbedienbaar, behouden zichtbare focus en koppelen bestaande foutfeedback aan het juiste veld.
10. De gerichte urenpaginatests en frontendproductiebouw slagen. Wanneer een About/changelog-entry nodig is, slagen ook de direct geraakte About-tests.

## Testing plan

### Automated tests
```bash
# Gerichte urenpagina-regressies
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx

# Direct geraakte applicatieshell/About-regressies wanneer changelog of route-mocks wijzigen
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# TypeScript- en Vite-productiebouw
cd frontend
npm run build

# Volledige frontendregressieset voor gedeelde styling/componenten
cd frontend
npm test -- --run

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Controleer desktop, tablet en 320 CSS px mobiel met toetsenbord: open beide dropdowns, selecteer en deselecteer per groep, controleer focus en sla een registratie op.
- Controleer de labels `0.5`, `1`, `1.5`, een gehele hogere waarde en de resulterende requestpayload in browser developer tools of een gemockte test.
- Controleer dat een bestaande externe quick-add nog steeds leidt tot een expliciet selecteerbare externe persoon en niet automatisch een andere persoon kiest.
- Controleer bij 200% zoom dat labels, checkboxen, foutmeldingen en save/resetacties niet overlappen of buiten beeld vallen.

## Risk + rollback plan

### Risks and mitigations
- **Stateverschil tussen dropdown en geselecteerde lijst:** gebruik één bestaande participantdraft-state en test toggle/add/remove plus payloadinhoud.
- **Onbedoelde eligibility- of rechtenwijziging:** filter alleen op reeds bestaande meta-eigenschappen; wijzig geen API-clientcontract of backendcode.
- **Foute duurconversie:** centraliseer formatter en conversie, test representatieve halve en gehele waarden en behoud integeropslag.
- **Compacte layout schaadt a11y of mobiel:** maak toegankelijke namen/focus en 320 px/200%-zoom expliciete handmatige en geautomatiseerde gates.
- **Regressie in quick-add/reset:** behoud bestaande stateflow en voeg gerichte regressies toe vóór afronding.

### Rollback
1. Deze change bevat uitsluitend frontendpresentatie en lokale state; er zijn geen database- of API-migraties nodig.
2. Bij regressie revert de gewijzigde frontendcomponent-, styling- en testcommit(s) als één change.
3. Herhaal na rollback minimaal de gerichte urenpaginatest en `npm run build`.

## Notes / links
- Bestaande urenmodule: `opsx/changes/2026-07-30-urenverantwoordingsmodule.md`.
- Gerelateerde compacte urenregistratie: `opsx/changes/2026-08-09-compacte-urenregistratie-centraal-beheer.md`.
- Waarschijnlijke implementatiepunten:
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - bestaande uren-gerelateerde frontend-CSS-bestanden, uitsluitend indien noodzakelijk
  - `frontend/src/app/App.test.tsx` alleen bij geraakte route-/About-mocks
- **Docs/changelog impact:** voeg bij afgeronde implementatie een korte eindgebruikersgerichte About/changelog-vermelding toe conform `AGENTS.md`; pas gebruikersdocumentatie alleen aan wanneer die de bediening van urenregistratie beschrijft.

### Assumptions
- De bestaande frontend hanteert al een geldige duur-range en verstuurt `duration_half_hours`; deze change verandert alleen de invoer- en labelpresentatie binnen die grens.
- “Checkboxes voor gekozen mensen” betekent een zichtbare, togglebare selectie per persoon, niet een wijziging naar een nieuw backend bulk-selectiecontract.
- De bestaande desktop- en mobiele create-oppervlakken blijven beide ondersteund en krijgen functioneel equivalente deelnemer- en duurbediening.

## Current status
Newest approved adjustment implemented; automated verification passed. Manual responsive/200%-zoom and real-browser accessibility checks remain pending because they were not performed and the repository has no browser/a11y tooling.

## What changed
- Added separate accessible `WindWilly-personen` and `Externe personen` disclosure controls with checkbox multi-selection, backed by the existing canonical participant state. Only existing eligible users and active external persons are listed; selected people remain visibly summarized.
- Replaced create-form number duration fields with fixed 0.5-hour options from `0.5 uur` through `24 uur`, while preserving the submitted integer `duration_half_hours` value and validation range.
- Added compact responsive participant selector styling, including a single-column small-screen layout without horizontal overflow.
- Preserved reset, validation, quick-add and existing desktop/mobile participant controls; additionally prevented duplicate external draft additions in the existing quick-add/select path.
- Added focused regression coverage for grouped checkbox selection, deselection, duration labels and the integer payload; updated affected mobile-duration and About changelog expectations.
- Updated `docs/urenregistratie.md` and added About changelog iteration 101 for the user-facing workflow refinement.
- Repaired the mobile create surface to use the same separate accessible WindWilly/external checkbox disclosures and canonical participant state as desktop, removing its legacy singular selects and add buttons while retaining mobile quick-add, validation, reset, duration and create-payload behavior.
- Updated focused mobile regressions to cover both labels, checkbox select/deselect, exact participant identity payload, duration conversion and reset.
- Rescue repair: removed the submit-time implicit current-user fallback. The current user is now visibly checked in the canonical participant state on initial load and after reset; submit serializes only that state and blocks an explicitly empty selection with linked Dutch feedback.
- Rescue repair: removed the legacy singular create selectors/add buttons and detached desktop selector. The grouped checkbox controls now render only inside the expanded desktop create row, directly beside the retained accessible quick-add flow; mobile uses the equivalent grouped control.
- Rescue repair: duplicate-candidate selection and newly quick-added external people now enter the same canonical participant state, with nearby desktop/mobile assertions updated for payload and reset truth.
- Rescue repair round 2: participant option derivation now excludes both users and external people whose existing metadata explicitly has `selectable === false`; canonical selected snapshots remain displayed independently of the selectable option lists.
- Rescue repair round 2: successful checkbox additions, external quick-add and selectable duplicate-candidate resolution immediately clear stale participant validation feedback.
- Rescue repair round 2: the focusable mobile participant region now receives `aria-invalid` and `aria-describedby` while participant validation feedback is present.
- Added targeted regressions for non-selectable option filtering with retained selected display, all three validation-clear paths, and mobile participant error focus/ARIA wiring.
- Replaced the native create-row participant disclosure on both desktop and mobile with a compact `Deelnemer(s) ▾` button that exposes the selected count only when non-zero. It opens one direct floating checkbox picker containing both participant groups, retaining the canonical selection and create payload.
- Added dialog semantics, expanded/controls state, checkbox initial focus and normal native checkbox keyboard operation; Escape and outside pointer/tap close the picker without changing selection and return focus to its trigger. The viewport-fixed, scrollable picker remains within viewport bounds; opening one surface closes the other.
- Updated focused regressions for trigger/count, direct picker structure, Space keyboard selection, Escape/outside close, focus return, persisted selection and existing payload behavior.

## How to verify
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`
- `cd frontend && npm run build`
- `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
- `git diff --check`
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
- `cd frontend && npm run build`
- `cd frontend && npm test -- --run`
- `git diff --check`
- Still perform the manual desktop/tablet/320 CSS px at 200% zoom keyboard and overflow checks before marking this change Completed.
- `cd backend && tmp_root=$(mktemp -d /tmp/wervel-work-hours-XXXXXX) && STORAGE_ROOT="$tmp_root" .venv/bin/pytest tests/test_work_hours_api.py; result=$?; rm -rf "$tmp_root"; exit $result`

## Verification evidence
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 files passed, 105 tests passed.
- PASS — `cd frontend && npm run build` → TypeScript and Vite production build completed. Vite reported the pre-existing informational warning that a minified chunk exceeds 500 kB.
- PASS — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload` → 1 passed. Pytest reported existing deprecation warnings from `pytest_asyncio`, `crypt`, and `datetime.utcnow`.
- PASS — `git diff --check` → no whitespace errors.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → 1 file passed, 17 tests passed.
- PASS — `cd frontend && npm run build` → TypeScript and Vite production build completed. Vite reported the pre-existing informational warning that a minified chunk exceeds 500 kB.
- PASS — `cd frontend && npm test -- --run` → 5 files passed, 168 tests passed.
- PASS — `git diff --check` → no whitespace errors.
- Pending manual check — desktop/tablet/320 CSS px at 200% zoom keyboard and overflow verification was not run in this invocation.
- PASS (rescue targeted) — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 files passed, 106 tests passed.
- PASS (rescue full frontend) — `cd frontend && npm test -- --run` → 5 files passed, 169 tests passed.
- PASS (rescue build) — `cd frontend && npm run build` → TypeScript/Vite build passed; only the pre-existing >500 kB chunk warning remained.
- PASS (rescue backend API) — from `backend/`, temporary `STORAGE_ROOT`, `.venv/bin/pytest tests/test_work_hours_api.py` → 81 passed; existing pytest-asyncio/passlib/Jose deprecation warnings only. An initial root-directory invocation failed 14 migration tests because relative `alembic` resolves from `backend/`; rerunning from the repository-conventional backend working directory passed completely.
- PASS (rescue diff) — `git diff --check` → no whitespace errors. Full diff/status was inspected before and after repair; unrelated dirty-worktree files were not edited by this rescue.
- Automated accessibility/responsive limitation — no Playwright, Axe, Lighthouse, browser binary/config, or equivalent dependency is present, so a truthful 320 CSS px/200% zoom visual overflow run could not be captured. jsdom regressions do prove accessible region/checkbox names, native keyboard-capable controls, linked participant validation, desktop adjacency/absence of legacy selectors, mobile structure, canonical payload, quick-add, and reset; they do not prove rendered geometry or visible focus in a real browser.
- Required manual steps: at desktop and tablet widths and at a 320 CSS px viewport, zoom to 200%; Tab/Shift+Tab through the participant button, both disclosure summaries, every checkbox, quick-add fields, save and reset; use Space/Enter to open/toggle; verify visible focus, no overlap/clipping/horizontal viewport scrollbar, all controls remain reachable, deselect-all feedback focuses/identifies the participant selector, quick-add visibly checks the created external person, and request payload identities exactly match checked people.
- Root causes (rescue round 2): selectable option derivation relied only on active/deleted state and did not honor an explicit `selectable: false`; participant mutations updated canonical state without clearing the field-level validation state; mobile rendered the error beside the selector but did not pass its invalid/description relationship to the focus target.
- PASS (rescue round 2 targeted) — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → 1 file passed, 21 tests passed. One newly added assertion initially ran before asynchronous current-user initialization and was repaired to await the selected snapshot; the rerun passed.
- PASS (rescue round 2 affected) — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 files passed, 109 tests passed.
- PASS (rescue round 2 full frontend) — `cd frontend && npm test -- --run` → 5 files passed, 172 tests passed.
- PASS (rescue round 2 build) — `cd frontend && npm run build` → TypeScript/Vite production build passed; only the existing informational >500 kB chunk warning remained.
- PASS (rescue round 2 backend API) — from `backend/`, with a temporary `STORAGE_ROOT`, `.venv/bin/pytest tests/test_work_hours_api.py` → 81 passed; existing pytest-asyncio/passlib/Jose deprecation warnings only, and the temporary root was removed.
- PASS (rescue round 2 diff) — `git diff --check` → no whitespace errors. The complete dirty-worktree diff/status and the affected frontend diff were inspected; unrelated files were not edited in this round.
- No manual browser evidence is claimed for rescue round 2.
- PASS (newest adjustment, focused) — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → 1 file passed, 32 tests passed.
- PASS (newest adjustment, frontend build) — `cd frontend && npm run build` → TypeScript/Vite build passed; only the existing informational >500 kB chunk warning remained.
- PASS (newest adjustment, backend API) — from `backend/`, with a temporary `STORAGE_ROOT`, `.venv/bin/pytest tests/test_work_hours_api.py` → 84 passed; existing pytest-asyncio/passlib/Jose deprecation warnings only, and the temporary root was removed.
- Pending manual check remains unchanged: desktop/tablet/320 CSS px at 200% zoom, real-browser visible-focus and floating-picker placement/scrolling verification.
- Superseded bookkeeping note (2026-08-13): the latest floating-picker implementation summary and evidence belong to `opsx/changes/2026-08-12-urenregistratie-vervolg-ux-en-externe-personenbeheer.md`; they are recorded there as the active scope. This older spec remains otherwise unchanged.

---
Status: newest approved adjustment implemented; automated verification passed, manual responsive/real-browser accessibility verification pending
Owner: —
Date: 2026-08-12
