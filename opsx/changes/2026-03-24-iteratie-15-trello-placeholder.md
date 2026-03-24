## Title
Iteratie 15 - Trello hoofdpagina als suite-placeholder

## Context
Volgens `ITERATIONS.md` iteratie 15 moet er een extra hoofdpagina komen naast `Urenverantwoording` met de naam `Trello`. Deze pagina is een placeholder voor een toekomstige interne Trello-achtige module voor projectwerk. De pagina moet visueel al een Trello-achtige achtergrond krijgen.

## Goals / Non-goals
### Goals
- Voeg een nieuwe hoofdnavigatie-tab `Trello` toe in de Windwilly-suite, naast `Urenverantwoording`.
- Voeg route `/trello` toe met een duidelijke placeholderpagina.
- Geef de Trello-placeholderpagina een Trello-achtige board-achtergrond.
- Houd de suite-navigatie bruikbaar met 5 hoofditems.
- Voeg een eindgebruikersvriendelijke About/changelog-entry toe voor deze iteratie.

### Non-goals
- Geen functionele Trello-bordlogica (kolommen, drag-and-drop, kaartenbeheer, opslag).
- Geen backend API-uitbreidingen buiten About/changelog.
- Geen wijziging van bestaande Wervelnieuws workflows.

## Proposed approach
1. Breid de topnavigatie uit met een nieuwe `Trello` link en route.
2. Maak een specifieke Trello-placeholdercomponent met tekst die aangeeft dat nabouw later volgt.
3. Voeg Trello als extra kaart toe aan de Windwilly landing-overzichtspagina.
4. Voeg gerichte CSS toe voor een Trello-achtige achtergrond/board-sfeer.
5. Pas suite-tab lay-out aan zodat 5 hoofditems netjes passen.
6. Werk frontend tests bij voor de nieuwe link en route.
7. Werk About/changelog bij met een begrijpelijke iteratie-entry.

## Implementation steps (ordered)
1. Update `frontend/src/app/App.tsx` (navigatielink + route + Trello placeholder + landing-card).
2. Update `frontend/src/styles.css` (5-tab layout en Trello placeholder styling).
3. Update `frontend/src/app/App.test.tsx` voor Trello in suite-navigatie en routeweergave.
4. Update `backend/app/api/meta.py` met nieuwe changelog-entry.
5. Voer verificatie uit met frontend test + build.

## Acceptance criteria
- In de hoofdnavigatie staat naast `Urenverantwoording` een tab `Trello`.
- Navigeren naar `/trello` toont een placeholderpagina met duidelijke Trello-moduletekst.
- De Trello-pagina heeft een visuele achtergrond die lijkt op een Trello-boardstijl.
- De suite-navigatie blijft leesbaar/bruikbaar met vijf hoofdtabs.
- About/changelog bevat een nieuwe eindgebruikersvriendelijke iteratie-entry voor deze wijziging.
- `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: topnavigatie wordt te vol op kleinere schermen.
  - Mitigatie: responsive grid voor suite-tabs behouden en desktopgrid op 5 kolommen zetten.
- Risico: Trello-styling beïnvloedt generieke panel-opmaak.
  - Mitigatie: alle stijlen scopen onder een specifieke Trello-class.
- Rollback:
  - Verwijder `/trello` route en `Trello` nav-link.
  - Verwijder Trello-placeholdercomponent en bijbehorende CSS.
  - Verwijder changelog-entry van deze iteratie.

## Notes / links
- Bron: `ITERATIONS.md` Iteratie #15.

## Current status
Completed

## What changed
- `frontend/src/app/App.tsx`:
  - In de suite-topnavigatie is een extra hoofdtab toegevoegd: `Trello` (naast `Urenverantwoording`).
  - Nieuwe route toegevoegd: `/trello`.
  - Nieuwe component `TrelloPlaceholderPage` toegevoegd met duidelijke placeholdertekst en eenvoudige board-preview (kolommen + kaarten).
  - Windwilly landing-overzicht uitgebreid met een extra modulekaart `Trello`.
- `frontend/src/styles.css`:
  - `.suite-tabs` aangepast naar 5 kolommen op desktop, zodat alle hoofdmodules netjes passen.
  - Trello-specifieke stijlen toegevoegd (`.trello-placeholder-page`, `.trello-board-preview`, `.trello-lane`, `.trello-card`) met board-achtige visuele achtergrond.
  - Responsive regel toegevoegd zodat de board-preview op small screens terugvalt naar 1 kolom.
- `frontend/src/app/App.test.tsx`:
  - Suite-navigatietest uitgebreid met verificatie op de nieuwe `Trello` link.
  - Nieuwe test toegevoegd die navigeert naar `/trello` en placeholder + pagina-class controleert.
- `backend/app/api/meta.py`:
  - About/changelog uitgebreid met iteratie-entry `24` over de nieuwe Trello-placeholderpagina.
- Visual fine-tune (15b) in `frontend/src/styles.css`:
  - Trello-achtergrond verfijnd naar rustiger, dieper blauw met subtielere lichtvlekken.
  - Board-gevoel versterkt met een lichte verticale grid-overlay via pseudo-element.
  - Lanes iets transparanter/strakker gemaakt met subtiele blur voor een Trello-achtige kaartlaag.
- Feedback-update (15c):
  - `frontend/src/styles.css`: Trello-pagina teruggebracht naar dezelfde kleurenstijl als de rest van de website (licht, rustig, met bestaande surface/line variabelen).
  - `frontend/src/app/App.tsx`: menu-item `Trello` één positie naar links geplaatst (nu vóór `Urenverantwoording`).
- Herstel op gebruikersfeedback (15d):
  - `frontend/src/styles.css`: Trello-placeholderachtergrond hersteld van te wit/te licht naar een duidelijke groene board-achtergrond in lijn met de wind/brand-kleuren van de website.
  - Lane- en kaartstijlen opnieuw afgestemd op het donkerdere board zodat het geheel visueel consistent en leesbaar blijft.

## How to verify
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `cd frontend && npm test -- --run` → geslaagd (`39 passed`).
- `cd frontend && npm run build` → geslaagd (TypeScript build + Vite productiebuild afgerond).
- Na visual fine-tune:
  - `cd frontend && npm test -- --run` → geslaagd (`39 passed`).
  - `cd frontend && npm run build` → geslaagd (TypeScript build + Vite productiebuild afgerond).
- Na feedback-update (kleurenstijl + menupositie):
  - `cd frontend && npm test -- --run` → geslaagd (`39 passed`).
  - `cd frontend && npm run build` → geslaagd (TypeScript build + Vite productiebuild afgerond).
- Na herstel op witte achtergrond:
  - `cd frontend && npm test -- --run` → geslaagd (`39 passed`).
  - `cd frontend && npm run build` → geslaagd (TypeScript build + Vite productiebuild afgerond).
