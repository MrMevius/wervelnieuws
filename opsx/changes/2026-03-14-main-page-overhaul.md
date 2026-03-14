## Title
Main page overhaul - intro, interessante stats en layout-opschoning

## Context
De huidige Main-pagina toont vooral statische demo-inhoud en voelt visueel onevenwichtig. Er is behoefte aan een duidelijke inleidende tekst bovenaan, relevante dashboardstatistieken en het verwijderen van een leeg ogend wit blok.

## Goals / Non-goals
### Goals
- Main toont bovenaan een heldere inleiding voor het communicatieteam.
- Main gebruikt dynamische, interessante statistieken op basis van bestaande topicdata.
- De layout van Main is opgeschoond zodat er geen leeg wit blok meer ontstaat.
- Main blijft goed bruikbaar op desktop en mobiel.
- About bevat een eindgebruikervriendelijke changelog-entry voor deze iteratie.

### Non-goals
- Geen wijziging aan backend businesslogica voor planning/publicatie.
- Geen wijziging aan API-contracten.
- Geen redesign van andere pagina's dan Main.

## Proposed approach
1. Gebruik bestaande `listTopics` data op Main voor realtime dashboardinformatie.
2. Vervang de huidige Main `panel-grid` door een doelgerichte dashboardlayout met hero, statcards en contextblokken.
3. Voeg empty/loading/error states toe zodat Main altijd betekenisvolle inhoud toont.
4. Update frontend tests op nieuwe Main-inhoud.
5. Voeg een nieuwe About changelog-entry toe in de backend meta-defaults.

## Implementation steps (ordered)
1. Main-route uitbreiden zodat `MainPage` toegang heeft tot topics en querystatus.
2. `MainPage` herschrijven met inleidend blok, dynamische stats en aanvullende overzichtsblokken.
3. Nieuwe CSS-klassen toevoegen voor opgeschoonde Main-layout en responsive gedrag.
4. Frontend tests aanpassen op de nieuwe Main-structuur en teksten.
5. About changelog aanvullen met nieuwe iteratie-entry.
6. Verificatie draaien en resultaten vastleggen.

## Acceptance criteria
- Main toont een inleidende tekst bovenaan.
- Main toont dynamische stats in plaats van hardcoded aantallen.
- Het visueel lege witte blok op Main is verwijderd door layout-opschoning.
- Main heeft duidelijke loading/lege/foutweergave waar relevant.
- Main werkt correct op mobiel en desktop.
- About bevat een nieuwe changelog-entry voor deze verbetering.
- `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: nieuwe Main-layout kan onbedoeld bestaande panelstijlen beinvloeden.
  - Mitigatie: gebruik Main-specifieke CSS-classes.
- Risico: dynamische tellingen kunnen verwarrend zijn bij onverwachte workflowstates.
  - Mitigatie: conservative telling op bekende states, onbekende states als actief behandelen.
- Rollback:
  - Frontend Main component en styles terugzetten naar vorige commit.
  - Changelog-entry uit default about-data verwijderen.

## Notes / links
- Gebruikerswens: "main page overhail - interessante stats - inleidende tekst bovenaan - opschoning van leeg wit blok".

## Current status
Completed

## What changed
- Main-route gekoppeld aan topicdata en querystatus:
  - `frontend/src/app/App.tsx` geeft nu `topics`, `isLoading` en `hasError` door aan `MainPage`.
- Main-pagina herwerkt naar een dashboard met inleidende bovenkant:
  - Intro/hero met duidelijke starttekst en snelle acties naar Planning en Database.
  - Hardcoded cijfers verwijderd en vervangen door dynamische statistieken op basis van `listTopics()` data.
  - Statcards toegevoegd voor totaal onderwerpen, met planningdatum, klaar voor publicatie en gepubliceerd.
  - Extra contextblokken toegevoegd voor workflowoverzicht, komende planning en topthema's.
  - Duidelijke loading-, error- en empty-state toegevoegd zodat de pagina niet meer als leeg wit vlak oogt.
- Main-styling opgeschoond met specifieke layoutclasses:
  - `frontend/src/styles.css` bevat nu `main-dashboard`, `main-hero`, `main-stats-grid`, `main-content-grid` en actie-link styling.
  - Responsive gedrag uitgebreid zodat de nieuwe dashboardblokken op mobiel naar 1 kolom schakelen.
- Frontend test aangepast op nieuwe Main-inhoud:
  - `frontend/src/app/App.test.tsx` controleert nu de nieuwe introductietekst en dashboardelementen.
- About changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat iteratie `12` met eindgebruikervriendelijke toelichting op de Main-overhaul.

## How to verify
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `cd frontend && npm test -- --run` -> geslaagd (`27 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite productiebuild afgerond).
