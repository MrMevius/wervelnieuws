# Title
Vergaderborden: kaartcursor en inline kaarttitels bewerken

## Context
Op de Vergaderborden-pagina zijn kaarten interactief, maar tonen momenteel niet consequent een hand/pointer-cursor bij hover. Dat verlaagt de affordance dat kaarten klikbaar zijn.

Daarnaast ontbreekt inline, persistente bewerking van kaarttitels op bestaande kaarten in alle drie kolommen (`todo`, `doing`, `done`). Gebruikers moeten titels direct op het bord kunnen aanpassen zonder aparte detailflow, met duidelijke validatie en zonder regressies in bestaande bordinteracties (detail openen, drag/drop, kaart aanmaken, updates/recordings).

Deze wijziging richt zich op een beperkte maar complete UX/API-verbetering: visuele klik-indicatie + inline titelbewerking met backend-persistentie en audit/event-registratie.

## Goals / Non-goals
### Goals
- Kaarten op Vergaderborden tonen een pointer-cursor bij hover waar de kaart interactief is.
- Alle kaarttitels in `todo`, `doing`, `done` zijn inline bewerkbaar.
- Titelwijzigingen worden direct persistent opgeslagen via backend.
- Geldige, gewijzigde titels worden opgeslagen bij `Enter` en bij `blur`.
- `Escape` annuleert lopende bewerking en herstelt de vorige titel.
- Lege titel wordt niet opgeslagen; gebruiker ziet een duidelijke Nederlandse foutmelding.
- Titelbewerking opent niet onbedoeld de kaartdetailweergave.
- Bestaande gedragspaden blijven werken: kaartdetail openen, drag/drop, kaart aanmaken, updates/recordings.
- Frontend- en backend-testdekking wordt bijgewerkt voor de nieuwe titelbewerkingsflow.
- About/changelog wordt bijgewerkt conform repository Definition of Done.

### Non-goals
- Geen redesign van de Vergaderborden-layout of kaartcomponenten buiten cursor + titelbewerking.
- Geen inline bewerking van kolomtitels.
- Geen bewerking van andere kaartvelden (bijv. beschrijving, toewijzingen, labels, metadata) in deze wijziging.
- Geen nieuwe externe dependencies tenzij technisch strikt noodzakelijk.
- Geen brede herschrijving van drag/drop-mechaniek.

## Proposed approach
1. Voeg een gerichte CSS-regel toe zodat interactieve kaarten pointer-cursor tonen op hover.
2. Breid backend API-contract minimaal uit voor titelupdates:
   - voorkeursoptie: dedicated endpoint voor kaarttitelupdate; of
   - alternatief: zeer smalle card patch-route die alleen `title` ondersteunt.
3. Implementeer backend validatie: lege/whitespace-only titel afwijzen met Nederlandse foutboodschap.
4. Verwerk titelupdate in service/repository-laag inclusief audit/backend event volgens bestaande patronen.
5. Voeg frontend API-clientfunctie toe voor titelupdates.
6. Implementeer inline-edit modus in `VergaderbordenPage` voor alle kaarttitels:
   - invoer starten via titelklik en/of kleine toegankelijke edit-affordance;
   - tijdens edit geen detail-open click triggeren;
   - `Enter`/`blur` save (alleen bij geldige, gewijzigde titel);
   - `Escape` cancel.
7. Invalideer/refetch relevante board- en card-queries na succesvolle save.
8. Voeg gerichte backend- en frontend-tests toe voor validatie, events, interactie en regressiegedrag.
9. Werk About/changelog entry bij met eindgebruikersgerichte release-notitie.

## Implementation steps (ordered)
1. Inspecteer huidige render- en eventflow van kaarten/titels in Vergaderborden (klik, detail-open, drag-start, keyboard).
2. Voeg CSS cursor-regel toe voor interactieve kaarten.
3. Definieer/actualiseer backend schema voor titelupdate payload + validatie.
4. Implementeer backend route/controller, service en repository voor persistente titelupdate.
5. Registreer audit/backend event bij geslaagde titelwijziging volgens bestaande event-patronen.
6. Voeg backend tests toe voor: succesvolle update, lege titel-validatiefout, endpoint scope (alleen titel).
7. Voeg frontend API-client functie toe voor titelupdate.
8. Implementeer inline edit UI/UX in VergaderbordenPage (start edit, save op Enter/blur, cancel op Escape, foutmelding).
9. Borg event-handling zodat bewerken detail-open niet triggert en drag/drop niet regressief beïnvloedt.
10. Invalideer/refetch board/card data na save zodat titel na refresh correct zichtbaar blijft.
11. Voeg/actualiseer frontend tests voor inline editing, validatie, eventpropagatie en regressies.
12. Documenteer changelog/About update en werk spec-secties voor verificatie bij tijdens implementatie.

## Acceptance criteria
1. Interactieve Vergaderbord-kaarten tonen een pointer-cursor op hover.
2. Kaarttitels in alle kolommen (`todo`, `doing`, `done`) zijn inline bewerkbaar.
3. Een geldige gewijzigde titel wordt persistent opgeslagen en blijft zichtbaar na refresh.
4. Lege titel wordt niet opgeslagen en toont een Nederlandse foutmelding.
5. `Enter` slaat op bij geldige wijziging; `blur` slaat ook op bij geldige wijziging.
6. `Escape` annuleert bewerking en herstelt de oorspronkelijke titel.
7. Tijdens titelbewerking wordt kaartdetail niet geopend door dezelfde interactie.
8. Drag/drop blijft functioneel en gedraagt zich zoals vóór deze wijziging.
9. Bestaande flows voor kaart aanmaken, detail openen en updates/recordings blijven werken.
10. About/changelog bevat een eindgebruikersgerichte entry voor deze wijziging.

## Testing plan
- Backend (gericht):
  - Draai gerichte pytest(s) voor vergaderborden/kaartupdates (titelupdate endpoint/service/repository).
  - Verifieer validatiepad voor lege titel en foutrespons.
  - Verifieer audit/backend event-trigger bij succesvolle titelwijziging.
- Frontend (gericht):
  - Voeg/actualiseer test(s) rond `VergaderbordenPage` inline titelbewerking.
  - Cases: enter-save, blur-save, escape-cancel, validatiefout, geen detail-open tijdens edit.
  - Verifieer query invalidation/refetch gedrag na save.
- Build/regressie:
  - Frontend build command (`npm run build` in frontend).
  - Relevante frontend testsuite (`npm test` of projectconforme gerichte command).
- Handmatig:
  - Hover cursor-check op kaarten.
  - Inline edit doorlopen in alle kolommen.
  - Refresh-check op persistentie.
  - Drag/drop en detail-open regressiecheck.

## Risk + rollback plan
### Risico’s
- Event-propagatieconflict: klik voor edit kan detail-open of drag-start onbedoeld triggeren.
- Dubbele save-trigger bij combinatie `Enter` + `blur`.
- Query-inconsistentie (lokale state vs serverstate) na update.
- Endpoint scope creep naar algemene card patch i.p.v. alleen titel.

### Mitigatie
- Expliciete event-guarding en keyboard-handling voor editmodus.
- Debounce/lock of idempotente client/server afhandeling om dubbele submit te voorkomen.
- Strikte endpoint-contracttests die alleen titelveld accepteren.
- Gerichte regressietests op drag/drop + detail-open flows.

### Rollback
- Frontend: revert inline edit UI naar statische titelweergave + verwijder cursorwijziging indien nodig.
- Backend: endpoint kan achterwaarts compatibel gedeactiveerd of verwijderd worden met beperkte impact.
- Volledige rollback via revert van betrokken frontend/backend commits.

## Notes / links
- Bron: door gebruiker aangeleverde Draft Change Spec Outline in deze sessie.
- Voorgestelde slug: `vergaderborden-inline-kaarttitels`.
- Verwachte scopebestanden (indicatief):
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/styles.css`
  - Backend vergaderborden/card API + service/repository modules
  - Relevante frontend/backend testbestanden
  - `backend/app/api/meta.py` (About/changelog update)

## Current status
Completed

## What changed
- Backend: toegevoegd `PATCH /api/boards/cards/{card_id}/title` met smal titel-only contract, trimming, lege-titelvalidatie en audit-event `board.card.title_updated`.
- Backend: repository en schema uitgebreid voor persistente kaarttitelupdates; tests toegevoegd voor succesvolle update, persistentie in board-response, lege titel, extra veld en onbekende kaart.
- Frontend: API-clientfunctie `updateBoardCardTitle` toegevoegd.
- Frontend: Vergaderbord-kaarten tonen nu een pointer-cursor op hover.
- Frontend: kaarttitels in alle kolommen zijn inline bewerkbaar; Enter en blur slaan geldige wijzigingen op, Escape annuleert, lege titels tonen een Nederlandse foutmelding.
- Frontend: event-handling voorkomt dat titelbewerking per ongeluk kaartdetail opent; kaarten zijn niet draggable tijdens actieve titelbewerking.
- Tests: gerichte Vergaderborden-tests uitgebreid voor Enter-save, blur-save, alle kolommen, lege titel, Escape-cancel, geen detail-open en bestaande drag/drop-flow.
- About/changelog: entry toegevoegd als iteratie 35.

## How to verify
- Backend gericht: `cd backend && ./.venv/bin/pytest tests/test_boards_api.py`
- Frontend gericht: `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- Frontend build/typecheck: `cd frontend && npm run build`
- Handmatig aanbevolen: hover over een vergaderbord-kaart, wijzig titel inline, refresh het bord, open kaartdetail en test drag/drop.

## Verification evidence
- `cd backend && ./.venv/bin/pytest tests/test_boards_api.py` — PASS: 11 passed, 38 warnings.
- `cd frontend && npm test -- VergaderbordenPage.test.tsx` — PASS: 7 tests passed.
- `cd frontend && npm run build` — PASS: TypeScript build en Vite build geslaagd.
- OPSX test review uitgevoerd op aangeleverde evidence; geen falende suites gemeld.
- OPSX review stap geprobeerd met `opsx-review`, maar de tool faalde tweemaal met `ProviderModelNotFoundError`; geen review-edits uitgevoerd.

---
Status: completed
Owner: OpenCode
Date: 2026-05-26
