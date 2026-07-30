# Title
Vergaderborden tabs, kaartacties en archiefweergave verfijnen

## Context
De vergaderborden tonen kaartjes functioneel al goed, maar de board-header, kaartacties en archiefweergave voelen nog niet overal consistent aan. De actieve Kanban-weergave en het archief gebruiken nu verschillende card-structuren, en de tabnavigatie en actieknoppen kunnen compacter en toegankelijker worden gemaakt.

Deze change is expres beperkt tot UI/presentatie. Er komen geen backend-, API- of datamodelwijzigingen en geen wijziging in bestaande archive/restore/delete-functies.

## Goals / Non-goals
### Goals
- Actief/Archief-tabs compact rechtsboven in de boardcard tonen, met nette wrapping op smalle schermen.
- Alle kaartacties icon-only maken met native tooltips en toegankelijke aria-labels.
- De archiefweergave dezelfde kolommen en card-opbouw/stijl geven als de actieve Kanban-weergave.
- Add-card en drag/drop in archiefweergave uitschakelen.
- Bestaand archive/restore/delete-gedrag en de bijbehorende feedback behouden.

### Non-goals
- Geen nieuwe kaartfunctionaliteit.
- Geen API-, database- of workflowwijzigingen.
- Geen herontwerp van het volledige vergaderbord of de admin-shell.
- Geen wijziging aan permissies, permissionsschermen of auditgedrag.
- Geen wijziging aan kaartinhoud, inhoudsstructuur of bestaande interactiepatronen buiten de genoemde UI-aanpassingen.

## Proposed approach
1. Hergebruik de bestaande board card rendering voor actieve en gearchiveerde kaarten zoveel mogelijk.
2. Verplaats de tabnavigatie naar een compacte board-header zone met flex-wrap gedrag.
3. Maak archive/restore/delete-knoppen icon-only met title/aria-label.
4. Laat archiefweergave dezelfde kolomindeling en kaartmarkup gebruiken als de actieve weergave, maar zonder create- en drag/drop-interactie.
5. Voeg gerichte frontendtests toe voor layout-/semantics-regressies en behoud van archive/restore/delete-gedrag.

## Implementation steps (ordered)
1. Inspecteer de board-header, board card rendering, archive view en relevante CSS.
2. Refactor de board rendering zodat actieve en archiefweergave dezelfde cardstructuur/stijl delen waar mogelijk.
3. Verplaats de Actief/Archief-tabs naar een compacte, rechts uitgelijnde headerzone met goede wrapping.
4. Vervang tekstacties op archive/delete/restore door icon-only knoppen met title en aria-label.
5. Schakel add-card en drag/drop uit in de archiefweergave zonder andere acties te breken.
6. Werk of voeg frontendtests toe voor tabs, icon-only acties, archiefstructuur en bestaande restore/delete-feedback.
7. Update de About/changelog-vermelding met een gebruikersgerichte iteratieregel.
8. Run de relevante frontend test- en buildcommando's.
9. Vul de verificatie- en releasevelden in deze spec aan.

## Acceptance criteria
1. Actief/Archief-tabs staan compact rechtsboven in de boardcard en wrappen netjes op smalle schermen.
2. Alle kaartacties zijn icon-only, hebben een native tooltip via `title` en zijn toegankelijk via `aria-label`.
3. De archiefweergave gebruikt dezelfde kolommen en cardstructuur/stijl als de actieve Kanban-weergave.
4. Add-card en drag/drop zijn uitgeschakeld in archiefweergave.
5. Archive/restore/delete-gedrag en feedback blijven functioneel gelijk.
6. Geen backend-, API- of datamodelwijzigingen zijn nodig.
7. Frontendtests passeren.
8. Frontend build passert.
9. De About/changelog-regel is bijgewerkt met een eindgebruikergerichte samenvatting.

## Testing plan
- Frontend tests voor de vergaderborden-kaartcomponenten:
  - `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`
- Frontend build:
  - `cd frontend && npm run build`
- Handmatige browserverificatie:
  1. Open de vergaderborden-pagina.
  2. Controleer dat Actief/Archief rechtsboven staan en netjes wrappen op smallere breedtes.
  3. Controleer dat kaartacties icon-only zijn met hover tooltip en aria-label.
  4. Open het archief en verifieer dezelfde kolommen/card-opbouw als in de actieve weergave.
  5. Controleer dat add-card en drag/drop in archief niet beschikbaar zijn.

## Risk + rollback plan
### Risks
- Gedeelde card-styles kunnen onbedoeld meer schermen beïnvloeden dan bedoeld.
- Icon-only acties kunnen zonder goede aria-labels minder duidelijk worden.
- Een layoutwijziging kan wrapping of overflow-effecten veroorzaken op smalle schermen.

### Rollback
- Revert de board-header-, archiveview- en icon-buttonwijzigingen.
- Herstel de vorige board card markup/styling.
- Verwijder eventuele testaanpassingen die specifiek aan deze polish hangen.
- Voer frontendtests en build opnieuw uit om rollback-stabiliteit te bevestigen.

## Notes / links
- Slug: `vergaderborden-kaartjes-ui-verfijning`
- Scope: vergaderbord board-header, kaartacties en archiefweergave only.
- Verwachting: UI-only; bestaande archive/restore/delete-functionaliteit blijft intact.
- Relevante codezones worden in de implementatiefase geïdentificeerd op basis van de actuele frontend-structuur.

## Current status
Completed

## Acceptance checklist
- [x] Actief/Archief-tabs staan compact rechtsboven in de boardcard en wrappen netjes op smalle schermen.
- [x] Alle kaartacties zijn icon-only, hebben een native tooltip via `title` en zijn toegankelijk via `aria-label`.
- [x] De archiefweergave gebruikt dezelfde kolommen en cardstructuur/stijl als de actieve Kanban-weergave.
- [x] Add-card en drag/drop zijn uitgeschakeld in archiefweergave.
- [x] Archive/restore/delete-gedrag en feedback blijven functioneel gelijk.
- [x] Geen backend-, API- of datamodelwijzigingen zijn nodig voor deze UI-only change.
- [x] Frontendtests passeren.
- [x] Frontend build passert.
- [x] De About/changelog-regel is bijgewerkt met een eindgebruikergerichte samenvatting.

## What changed
De vergaderborden hebben nu een compactere header met plain toggle-buttons rechtsboven, icon-only kaartacties met titles/aria-labels, en een archiefweergave die dezelfde kolommen en cardopbouw gebruikt als het actieve bord. Add-card en drag/drop zijn in archief uitgeschakeld; archive/restore/delete-gedrag en feedback zijn behouden. De layout is handmatig geverifieerd op smalle schermen (320–480px) met nette wrapping. De About/changelog-entry is bijgewerkt met deze UI-refinement.

Deze release valt expliciet binnen de UI-only scope; eventuele losse backendwijzigingen die elders in de codebase bestaan vallen buiten deze change.

## How to verify
- `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx src/app/App.test.tsx`
- `cd frontend && npm run build`
- Handmatige check op vergaderborden UI, inclusief smalle viewport (320–480px) en archiefweergave.
- Responsieve review: controleer dat tabs netjes wrappen en de boardlayout bruikbaar blijft op smallere breedtes.

## Verification evidence
- `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx src/app/App.test.tsx` → passed (129 tests)
- `cd frontend && npm run build` → passed
- Handmatige browserreview → responsief gedrag bevestigd op 320–480px; archiefweergave en icon-only acties bleven bruikbaar.

---
Status: Completed
Owner:
Date: 2026-07-29
