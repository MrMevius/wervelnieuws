## Title
Vervang Trello-placeholder door Vergaderborden-functionaliteit

## Context
De frontend bevat nog een Trello-placeholder in navigatie en landingflow, terwijl er al werkende Vergaderborden-functionaliteit aanwezig is. Dit veroorzaakt een misleidende UX (doodlopende of semantisch verouderde entrypoint) en verhoogt onderhoudslast door dubbele/placeholder-gerichte code en tests.

## Goals / Non-goals
### Goals
- Vervang alle zichtbare Trello-placeholder entrypoints door consistente Vergaderborden UX-entrypoints.
- Gebruik `/vergaderborden` als primaire route voor gebruikersnavigatie.
- Verwijder de oude placeholderroute `/trello` zonder redirect.
- Behoud de landingpagina-card en herschrijf deze als echte Vergaderborden-functionaliteit.
- Hergebruik de reeds gebouwde Vergaderborden-pagina/API zonder functionele regressie.
- Ruim placeholder-gerelateerde frontend artifacts op (component/copy/tests/ongebruikte Trello-CSS).
- Werk relevante tests en About/changelog bij.

### Non-goals
- Geen nieuwe boardfeatures.
- Geen externe Trello-integratie.
- Geen redesign van het volledige menu of informatiearchitectuur.
- Geen backend-herbouw buiten strikt noodzakelijke routingkoppelingen.

## Proposed approach
Consistente UX-integratie: maak Vergaderborden de enige zichtbare en functionele board-entry in frontend navigatie en landing, met routeconsolidatie op `/vergaderborden`, verwijdering van `/trello`, en opschoning van placeholdercode. De bestaande Vergaderborden-functionaliteit blijft de functionele basis.

## Implementation steps (ordered)
1. Inventariseer en update frontend navigatie-items zodat het label overal `Vergaderborden` is.
2. Consolideer routing op `/vergaderborden` als primaire route naar de bestaande Vergaderborden-functionaliteit.
3. Verwijder de route-definitie voor `/trello` (zonder redirectgedrag).
4. Herschrijf de landingpagina-card van placeholdercopy naar echte Vergaderborden-entry, gekoppeld aan `/vergaderborden`.
5. Verwijder niet-meer-gebruikte placeholderartefacten:
   - placeholdercomponent(en)
   - placeholdercopy
   - placeholdertests
   - ongebruikte Trello-specifieke CSS
6. Pas relevante frontendtests aan zodat zij de echte Vergaderborden-entry, route en toegankelijkheid valideren i.p.v. placeholdertekst.
7. Voeg een eindgebruikersvriendelijke About/changelog-entry toe over de wijziging.

## Acceptance criteria
1. De topnavigatie toont `Vergaderborden` (niet `Trello`).
2. Klik op de navigatie-entry opent `/vergaderborden`.
3. `/trello` bestaat niet meer als werkende placeholderroute.
4. De landingpagina toont `Vergaderborden` als echte functie-entry (geen placeholderstatus/copy).
5. De bestaande Vergaderborden-functionaliteit blijft functioneel bereikbaar en bruikbaar via de nieuwe entrypoints.
6. Relevante frontendtests voor routing/navigatie slagen.
7. About/changelog bevat een bijgewerkte, eindgebruikersvriendelijke beschrijving van deze wijziging.

## Testing plan
- Gerichte frontend routing/navigatietest (verwacht):
  - `cd frontend && npm run test -- --run src/app/App.test.tsx`
- Frontend build/typecheck (verwacht):
  - `cd frontend && npm run build`
- Handmatige smoke-flow:
  - Landing openen → `Vergaderborden` entry gebruiken → bestaande boardfunctionaliteit verifiëren.

## Risk + rollback plan
### Risks
- Bestaande bookmarks of interne links naar `/trello` breken bewust door routeverwijdering.
- Bestaande tests kunnen falen wanneer ze nog placeholdertekst of oude route verwachten.
- Onvolledige opschoning kan dode imports/CSS-resten achterlaten.

### Rollback
- Herstel tijdelijk de eerdere `/trello` route en placeholdercomponent als regressie-overbrugging.
- Alternatief bij productie-incident: voeg alsnog een tijdelijke redirect `/trello` → `/vergaderborden` toe (afwijking van huidige keuze, alleen als noodmaatregel).
- Revert de specifieke frontend commits voor navigatie/routing/landing en herstel testbaseline.

## Notes / links
- Zichtbare naam (definitief): `Vergaderborden`.
- Primaire route (definitief): `/vergaderborden`.
- Oude route (definitief): `/trello` verwijderen, niet redirecten.
- Aanpak (definitief): Consistente UX-integratie.

## Current status
Completed

## What changed
- Topnavigatie bijgewerkt: `Trello` vervangen door `Vergaderborden`, gekoppeld aan `/vergaderborden`.
- Routing geconsolideerd op `/vergaderborden` naar de bestaande `VergaderbordenPage`.
- Oude placeholderroute `/trello` verwijderd (zonder redirect).
- Landingpagina-card behouden maar herschreven naar echte Vergaderborden-entry, inclusief link `Open Vergaderborden`.
- `TrelloPlaceholderPage` verwijderd uit `AppShell`.
- Trello-placeholderstyling en preview-CSS verwijderd uit `frontend/src/styles.css`.
- Frontendtests bijgewerkt voor nieuwe navigatielabels, routegedrag en afwezigheid van oude `/trello`-placeholder.
- API-mocks in `App.test.tsx` uitgebreid met bestaande vergaderborden-endpoints zodat route-/paginatests stabiel draaien.
- About/changelog bijgewerkt met een nieuwe eindgebruikersvriendelijke iteratie-entry (29) voor deze wijziging.

## How to verify
Na implementatie, voer uit:
1. `cd frontend && npm run test -- --run src/app/App.test.tsx`
2. `cd frontend && npm run build`
3. Handmatige smoke: landing → klik `Open Vergaderborden` of topnavigatie `Vergaderborden` → controleer dat de bestaande boardfunctionaliteit zichtbaar en bruikbaar is.
4. Controleer dat `/trello` niet meer als werkende placeholderpagina bestaat.

## Verification evidence
- ✅ `cd frontend && npm run test -- --run src/app/App.test.tsx`
  - Resultaat: **PASS** (`41 passed, 0 failed`)
- ✅ `cd frontend && npm run build`
  - Resultaat: **PASS** (`tsc -b` en `vite build` succesvol)
- ⚠️ `pytest backend/tests/test_boards_api.py`
  - Resultaat: **BLOCKED** in deze shell door ontbrekende Python dependency `fastapi` (`ModuleNotFoundError: No module named 'fastapi'`).
  - Impact: backend boardtest is meegeleverd, maar kon lokaal niet draaien zonder backend testomgeving/dependencies.
- ℹ️ Handmatige smoke-flow niet interactief uitgevoerd in deze CLI-sessie; testdekking is uitgebreid met route/navigatie-asserties voor `Vergaderborden` en legacy `/trello`-afwezigheid.

---
Status: completed  
Owner: n.v.t.  
Date: 2026-05-22
