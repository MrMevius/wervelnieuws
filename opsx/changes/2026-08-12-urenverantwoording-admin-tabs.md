# Title
Urenverantwoording: historie, identiteiten en audit als Admin-submenu's

## Context
De urenverantwoordingspagina bevat momenteel naast de dagelijkse registratie- en overzichtsfuncties ook de UI-blokken **Historie en identiteiten**, **Audit** en **Verwijderde registraties**. Dit maakt de primaire urenworkflow onnodig breed. De bestaande UI voor historie/identiteiten en audit is al functioneel en moet volledig behouden blijven, maar onder afzonderlijke Admin-tabs als submenu's worden aangeboden.

Deze change betreft uitsluitend de frontendnavigatie en -presentatie. APIs, datamodel, opslag, autorisatie, backendgedrag en de bestaande algemene Admin-log blijven ongewijzigd.

## Goals / Non-goals

### Goals
- Verwijder het UI-blok **Verwijderde registraties** uit de urenverantwoordingspagina.
- Verplaats de volledige bestaande UI van **Historie en identiteiten** naar een afzonderlijke Admin-submenu-tab.
- Verplaats de volledige bestaande urenverantwoordings-**Audit**-UI naar een afzonderlijke Admin-submenu-tab.
- Maak beide nieuwe schermen uitsluitend zichtbaar en bereikbaar binnen de bestaande Admin-navigatie en volgens de bestaande Admin-autorisatie.
- Behoud de inhoud, interacties, filters, laad-/fouttoestanden en bestaande data-aanroepen van de verplaatste historie/identiteiten- en audit-UI.
- Behoud de bestaande algemene Admin-log volledig ongewijzigd en onderscheid deze duidelijk van de urenverantwoordingsaudit.

### Non-goals
- Geen backend-, API-, schema-, database-, migratie- of opslagwijzigingen.
- Geen wijziging aan rollen, permissies, authenticatie of server-side autorisatie.
- Geen verwijdering of wijziging van soft-delete-, herstel-, historie- of auditdata en -gedrag.
- Geen nieuw herstelmechanisme voor verwijderde urenregistraties.
- Geen herontwerp van overige urenverantwoording, andere Admin-tabs of de algemene applicatienavigatie.
- Geen wijziging aan de bestaande algemene Admin-log.

## Proposed approach
1. Inventariseer de huidige urenpagina, Admin-tabstructuur en route-/tabstate, inclusief de componentgrenzen en API-hooks voor historie/identiteiten, uren-audit en verwijderde registraties.
2. Isoleer de bestaande historie/identiteiten-UI en uren-audit-UI in herbruikbare frontendcomponenten of behoud hun bestaande componentgrenzen, zonder hun requestcontracten of gedragslogica te veranderen.
3. Voeg binnen het bestaande Admin-scherm twee Admin-submenu-tabs toe: één voor urenhistorie en identiteiten en één voor uren-audit. Gebruik de bestaande Admin-guard en bestaande navigatiepatronen; introduceer geen nieuw autorisatiemodel.
4. Render de geïsoleerde bestaande UI in de nieuwe tabs en verwijder uitsluitend de corresponderende weergave uit de urenpagina. Verwijder het blok voor verwijderde registraties alleen uit de urenpagina-UI; laat de onderliggende data, endpoints en backendacties intact.
5. Voeg gerichte regressietests toe voor tabzichtbaarheid, Admin-toegang, verplaatste functionaliteit, afwezigheid op de urenpagina en ongewijzigde algemene Admin-log. Actualiseer alleen documentatie die de gewijzigde navigatie daadwerkelijk beschrijft.

## Implementation steps (ordered)
1. **Inventarisatie en scopegrens**
   - Leg de huidige componenten, routes/tabstate, API-calls en tests voor urenverantwoording, Admin, historie/identiteiten, audit en verwijderde registraties vast.
   - Bevestig dat de algemene Admin-log een afzonderlijke UI en dataflow heeft en buiten de wijziging blijft.
2. **Presentatiecomponenten begrenzen**
   - Extraheer of herpositioneer uitsluitend frontendpresentatie voor de volledige bestaande historie/identiteiten- en uren-audit-UI.
   - Behoud bestaande hooks, querykeys, requestparameters, mutaties, foutafhandeling en loading/empty states.
3. **Admin-submenu's toevoegen**
   - Voeg twee toegankelijke submenu-tabs toe aan het bestaande Admin-scherm: **Urenhistorie en identiteiten** en **Uren-audit**.
   - Laat de bestaande Admin-navigatie en Admin-guard bepalen wie de tabs ziet en kan openen; voeg geen client- of server-side rechtenregel toe of wijzig deze niet.
4. **Urenpagina opschonen**
   - Verwijder de rendering van **Historie en identiteiten**, **Audit** en **Verwijderde registraties** uit de urenverantwoordingspagina.
   - Verwijder alleen de UI-toegang voor verwijderde registraties; behoud alle bestaande backenddata, API-routes, soft-delete- en herstelgedrag onaangetast.
5. **Regressietests**
   - Test dat beide Admin-submenu-tabs de volledige bestaande functies tonen en dat de urenpagina deze drie blokken niet meer rendert.
   - Test Admin-toegang volgens bestaand gedrag, behoud van bestaande historie-/audit-aanroepen en dat de algemene Admin-log ongewijzigd beschikbaar en functioneel blijft.
6. **Documentatie en verificatie**
   - Werk relevante gebruikers- of Admin-documentatie bij als die de navigatie voor urenverantwoording beschrijft. Voeg bij afronding een korte eindgebruikersgerichte About/changelog-vermelding toe volgens `AGENTS.md`.
   - Voer de opdrachten uit het Testing plan uit en leg daadwerkelijke resultaten vast onder **Verification evidence**.

## Acceptance criteria
1. De urenverantwoordingspagina toont geen UI-blok, knop, lijst of herstelactie voor **Verwijderde registraties**.
2. De UI-verwijdering van **Verwijderde registraties** verwijdert of wijzigt geen backendroute, API-clientcontract, databasegegeven, soft-deletegedrag of bestaand herstelgedrag.
3. Het bestaande volledige blok **Historie en identiteiten** is niet langer op de urenverantwoordingspagina zichtbaar en is volledig beschikbaar via de Admin-submenu-tab **Urenhistorie en identiteiten**.
4. Het bestaande volledige urenverantwoordingsblok **Audit** is niet langer op de urenverantwoordingspagina zichtbaar en is volledig beschikbaar via de Admin-submenu-tab **Uren-audit**.
5. De verplaatste historie/identiteiten- en audit-UI behouden hun bestaande filters, resultaten, lege-/laad-/fouttoestanden en interacties; hun bestaande API-aanroepen en requestsemantiek wijzigen niet.
6. Beide nieuwe submenu-tabs volgen de bestaande Admin-autorisatie: een gebruiker zonder bestaande Admin-toegang krijgt geen nieuwe toegang, en een bestaande Admin kan beide tabs openen.
7. De algemene Admin-log blijft zichtbaar, bereikbaar en functioneel zoals vóór deze change; deze wordt niet hernoemd, verplaatst, gefilterd of inhoudelijk gewijzigd.
8. De nieuwe tabs zijn toetsenbordbedienbaar, hebben toegankelijke namen en volgen het bestaande Admin-tabpatroon.
9. Gerichte frontendtests, de frontendproductiebouw en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Gerichte urenpagina-, Admin-navigatie- en algemene Admin-log-regressies
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige frontendregressieset en productiebuild
cd frontend
npm test -- --run
npm run build

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Open de urenverantwoordingspagina als Admin en bevestig dat historie/identiteiten, uren-audit en verwijderde registraties daar niet worden getoond.
- Open Admin en navigeer met muis en toetsenbord naar **Urenhistorie en identiteiten** en **Uren-audit**; controleer de bestaande filters, gegevens, lege toestanden en foutmeldingen.
- Bevestig als niet-Admin dat de bestaande Admin-grens ongewijzigd blijft.
- Open de algemene Admin-log en bevestig dat de bestaande route/tab, inhoud en bediening ongewijzigd zijn.
- Controleer in browser developer tools dat het openen/gebruiken van de verplaatste UI geen nieuwe of gewijzigde API-requestvorm veroorzaakt.

## Risk + rollback plan

### Risks and mitigations
- **UI-herstel van verwijderde registraties verdwijnt:** de gebruiker kan via de urenpagina geen verwijderde registraties meer bekijken of herstellen. Beperk dit bewust tot UI-verwijdering; verwijder geen backendgedrag, data, endpoints of herstelcode. Leg dit functionele verlies expliciet vast in release-/gebruikerscommunicatie indien van toepassing.
- **Verplaatsing laat delen van historie of audit achter:** gebruik de bestaande volledige UI als eenheid en voeg tests toe voor filters, resultaten en toestanden in de nieuwe tabs.
- **Onbedoelde autorisatiewijziging:** hergebruik uitsluitend bestaande Admin-route/tabguards en wijzig geen API of permissioncode.
- **Verwarring met algemene Admin-log:** gebruik duidelijke labels voor uren-specifieke tabs en test expliciet dat de algemene log ongemoeid blijft.
- **Navigatie- of toegankelijkheidsregressie:** volg bestaande tabsemantiek en toets toetsenbordnavigatie, focus en toegankelijke namen handmatig en geautomatiseerd.

### Rollback
1. Deze change is frontend-only en vereist geen migratie of dataherstel.
2. Bij regressie revert de gewijzigde frontendcomponenten, Admin-tabnavigatie, styling en tests als één change.
3. Na rollback herhaal minimaal de gerichte frontendtests, `npm run build` en `git diff --check`.
4. Omdat backendgedrag voor verwijderde registraties niet wordt verwijderd, zijn soft-deleted gegevens en eventueel herstelgedrag na rollback direct weer via de teruggezette UI bereikbaar.

## Notes / links
- Gerelateerde urenmodule: `opsx/changes/2026-07-30-urenverantwoordingsmodule.md`.
- Gerelateerde uren-UX-change: `opsx/changes/2026-08-12-urenverantwoording-invoer-ux-verfijning.md`.
- Waarschijnlijke implementatiepunten:
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/app/App.test.tsx`
  - bestaande Admin-shell-, tab- en navigatiecomponenten
- **Docs impact:** werk alleen documentatie bij die deze uren- of Admin-navigatie beschrijft; voeg bij afgeronde implementatie de verplichte, korte gebruikersgerichte About/changelog-entry toe volgens `AGENTS.md`.

### Assumptions
- “Admin tabs gelden als submenu” betekent tabs binnen de bestaande Admin-sectie, niet nieuwe top-level navigatie, routes of een nieuw permissiemodel.
- “Volledige bestaande UI” betekent functionele pariteit voor de huidige historie/identiteiten- en uren-auditweergave, zonder uitbreiding of gedragsherontwerp.
- De bestaande backend biedt behoudens de te verwijderen UI nog steeds de data en acties rond verwijderde registraties; deze spec maakt die niet opnieuw bereikbaar via Admin.

## Current status
Completed — twee gegroepeerde IN_SCOPE_REPAIR-rondes voor de gemelde reviewfindings zijn uitgevoerd en volledig geverifieerd.

## What changed
- Deze actieve change spec beschrijft de goedgekeurde, begrensde frontendherindeling van urenhistorie/identiteiten en uren-audit naar Admin-submenu's, plus het verwijderen van de UI voor verwijderde registraties uit urenverantwoording.
- De urenpagina bevat niet langer de historie-/identiteiten-, uren-audit- of verwijderde-registraties-UI en bijbehorende queries/state.
- Admin bevat toegankelijke tabs **Urenhistorie en identiteiten** en **Uren-audit** met de bestaande functies en requestcontracten; **Admin log** is ongemoeid gelaten.
- De urenhandleiding en de verplichte eindgebruikersgerichte About/changelog-entry zijn bijgewerkt.
- IN_SCOPE_REPAIR: de modals voor externe persoon bewerken en samenvoegen hergebruiken nu dezelfde geportalde, focus-beherende `AccessibleModal` als de oorspronkelijke urenflows. Dit herstelt focus-trap, Escape, achtergrondisolatie en focusherstel.
- IN_SCOPE_REPAIR: regressies dekken gegroepeerd historie-filters/paging/historische identiteit, externe-personinteracties en modaltoegankelijkheid, audit-resultaat/paging, Admin-guard, behoud van Admin log en changelogmock/-assertie.
- IN_SCOPE_REPAIR: mergefouten worden binnen de actieve `AccessibleModal` als `role="alert"` getoond; tijdens een lopende merge zijn zowel Samenvoegen als Annuleren uitgeschakeld.
- IN_SCOPE_REPAIR: de verplaatste externe-persoonsmutaties hanteren weer exact hun bestaande invalidatiecontract: bewerken, archiveren en herstellen invalideren alleen `work-hours-meta`; samenvoegen invalideert `work-hours-meta` en `work-hours-groups`, zonder generieke extra invalidaties.

## How to verify
- Gerichte validatie: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`.
- Productiebouw: `cd frontend && npm run build`.
- Repositorycontrole: `git diff --check`.
- Voer daarnaast de manual checks uit het **Testing plan** uit, met nadruk op toetsenbordnavigatie tussen de nieuwe Admin-tabs en niet-Admin-toegang.

## Verification evidence
- PASS — `git diff --check`.

## Review result
- APPROVED — eindreview bevestigt functionele pariteit, bestaande requestsemantiek en mutatie-invalidaties, modaltoegankelijkheid, Admin-guard, behoud van **Admin log** en afwezigheid van de beheerblokken op de urenpagina.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 testbestanden, 113 tests geslaagd.
- PASS — `cd frontend && npm test -- --run` → 5 testbestanden, 176 tests geslaagd.
- PASS — `cd frontend && npm run build` → TypeScript-controle en Vite-productiebouw geslaagd; alleen de bestaande Vite-bundlegroottewaarschuwing (>500 kB).
- PASS — `git diff --check`.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 testbestanden, 109 tests geslaagd.
- PASS — `cd frontend && npm run build` → TypeScript-controle en Vite-productiebouw geslaagd. Vite meldt alleen de bestaande bundlegroottewaarschuwing (>500 kB).
- Niet uitgevoerd — volledige frontendregressieset (`npm test -- --run`) en de handmatige browserchecks uit het Testing plan.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 testbestanden, 111 tests geslaagd.
- PASS — `cd frontend && npm test -- --run` → 5 testbestanden, 174 tests geslaagd.
- PASS — `cd frontend && npm run build` → TypeScript-controle en Vite-productiebouw geslaagd; alleen de bestaande Vite-bundlegroottewaarschuwing (>500 kB).
- PASS — `git diff --check`.

---
Status: Completed
Owner: —
Date: 2026-08-12
