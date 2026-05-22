# Title
Improve Vergaderborden frontend layout

## Context
De huidige opbouw van formulieren en bordsecties op de subpagina **Vergaderborden** voelt visueel onlogisch door inconsistente uitlijning, spacing en hiërarchie. Dit verlaagt scanbaarheid, maakt bediening minder voorspelbaar en zorgt voor inconsistent gedrag op mobiel, tablet en desktop.

## Goals / Non-goals
### Goals
- Verbeteren van structuur en uitlijning van het **Nieuw project**-formulier.
- Verbeteren van structuur en uitlijning van kaart-toevoegregels per kolom/sectie.
- Uniformeren van spacing, sizing en typografische hiërarchie binnen de betrokken Vergaderborden-UI.
- Correcte responsive herflow voor mobiel, tablet en desktop.
- Lichte visuele verfijning die aansluit op de bestaande stijl.

### Non-goals
- Geen backend- of API-wijzigingen.
- Geen nieuwe features of workflow-aanpassingen.
- Geen wijziging van datamodel, state-gedrag of businesslogica.

## Proposed approach
1. Inventariseer de huidige componentstructuur en stijlen van de Vergaderborden-subpagina (specifiek: Nieuw project en kaart-toevoegregels).
2. Herstructureer alleen frontend-layout en styling op componentniveau met behoud van bestaande interactie- en state-flow.
3. Introduceer consistente layoutregels (grid/flex), spacing tokens/patronen en typografische niveaus die al in het thema passen.
4. Pas responsive breakpoints toe zodat elementen logisch hergroeperen op mobiel/tablet/desktop zonder functionele regressie.
5. Voer visuele en functionele smoke-validatie uit op de betrokken user flows.

## Implementation steps (ordered)
1. Lokaliseer betrokken frontend-componenten en stylesheet(s) van de Vergaderborden-subpagina.
2. Definieer doel-layout per sectie:
   - Nieuw project-formulier (groepering, uitlijning, knoppositie).
   - Kaart-toevoegregel per kolom/sectie (input/actie-uitlijning).
3. Implementeer consistente spacing- en sizingregels voor inputs, labels en knoppen binnen deze scope.
4. Implementeer typografische hiërarchie (kop, subkop, label, hulptekst) volgens bestaand thema.
5. Implementeer responsive gedrag voor minimaal mobiel, tablet, desktop breakpoints.
6. Valideer dat functioneel gedrag identiek blijft (project aanmaken + kaart toevoegen).
7. Werk de website changelog/About-pagina bij met een gebruikersgerichte notitie over verbeterde vergaderbord-opbouw.

## Acceptance criteria
1. Formulierblokken op Vergaderborden zijn logisch gegroepeerd en onderling consistent uitgelijnd.
2. Inputs en knoppen binnen de aangepaste secties volgen uniforme spacing- en sizingregels.
3. Bestaande functionaliteit blijft identiek: gebruikers kunnen zonder gedragswijziging projecten aanmaken en kaarten toevoegen.
4. Layout blijft bruikbaar en visueel netjes op mobiel, tablet en desktop (geen overlap, afgekapt labels of onbruikbare CTA-positionering).
5. Visuele stijl sluit aantoonbaar aan op bestaand thema en oogt rustiger/helderder.
6. About/changelog bevat een duidelijke eindgebruikersnotitie over deze layoutverbetering.

## Testing plan
- Voer lint/typecheck/build uit voor frontend-gewijzigde delen met repository-standaardcommando’s.
- Handmatige visuele controle op minimaal drie viewportcategorieën:
  - Mobiel
  - Tablet
  - Desktop
- Functionele smoke test:
  - Nieuw project aanmaken werkt.
  - Kaart toevoegen per kolom/sectie werkt.
- Controleer dat geen backend-contracten, API-calls of state-overgangen zijn gewijzigd.

## Risk + rollback plan
### Risico’s
- Onbedoelde regressie in gedeelde componentstyling.
- Breakpoint-specifieke layoutfouten die pas op bepaalde schermgroottes zichtbaar zijn.

### Mitigatie
- Scope strikt beperken tot betrokken Vergaderborden-componenten/stijlen.
- Geen wijzigingen aan businesslogica/state-management.
- Gerichte visuele controles per breakpoint vóór afronding.

### Rollback
- Styling/componentwijzigingen per commit of per spec-stap terugdraaien.
- Bij regressie: laatste stabiele commit voor layoutwijziging herstellen.

## Notes / links
- Draft gebaseerd op goedgekeurde outline van gebruiker.
- Slug: `improve-vergaderborden-layout`.

## Current status
Completed (automated verification passed; manual browser QA recommended after deploy)

## What changed
- Frontend Vergaderborden-structuur visueel verfijnd in `frontend/src/app/features/admin/VergaderbordenPage.tsx` zonder state/API-gedrag aan te passen:
  - Header met subtitel toegevoegd voor duidelijkere hiërarchie.
  - CTA `Nieuw project` voorzien van gerichte styling hook.
  - Bordkolommen voorzien van expliciete layout class voor consistente kaartsectie-opbouw.
  - `Nieuw project`-formulier semantisch heringedeeld met labels, veldgroepering, hulptekst en vaste actierij.
  - Inline kaart-toevoegformulier opgesplitst in primaire en secundaire rij voor betere uitlijning van input + actie.
- Styling uitgebreid in `frontend/src/styles.css` (purely visual):
  - Consistente spacing/sizing/typografie voor Vergaderborden-secties, formulierblokken en kaart-toevoegregels.
  - Rustigere kolom/cards-opbouw met subtiele thema-conforme modernisering (randen, achtergrondmix, hiërarchie).
  - Responsive herflow toegevoegd voor desktop/tablet/mobiel (3→2→1 kolom en formulierhergroepering).
  - Modal-overlay en formuliercontainer van `Nieuw project` visueel gestabiliseerd binnen bestaande stijl.
- About/changelog bijgewerkt in `backend/app/api/meta.py` met iteratie **30** en eindgebruikersnotitie over de Vergaderborden layoutverbetering.

## How to verify
Voer (nog uit te voeren) verificatie in deze volgorde uit:
1. Frontend checks voor gewijzigde delen volgens repo-standaard:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
2. Handmatige visuele controle op Vergaderborden (`/vergaderborden`):
   - Mobiel viewport: geen overlap, CTA en formulier acteerbaar, kaart-toevoegregels netjes onder elkaar.
   - Tablet viewport: kolommen/herflow logisch, invoervelden en knoppen consistent uitgelijnd.
   - Desktop viewport: 3-koloms board stabiel, uniforme spacing en leesbare hiërarchie.
3. Functionele smoke zonder gedragswijziging:
   - Nieuw project aanmaken werkt.
   - Kaart toevoegen per kolom werkt.
4. Controleer About-pagina changelog op nieuwe eindgebruikersnotitie (iteratie 30).

## Verification evidence
- Frontend verificatie (eerder uitgevoerd in deze sessie):
  - `npm test` ✅ (41/41 tests geslaagd)
  - `npm run build` ✅ (TypeScript build + Vite productiebuild geslaagd)
  - `npm run lint` ❌ script ontbreekt in `frontend/package.json`
  - `npm run typecheck` ❌ script ontbreekt in `frontend/package.json`
- Backend verificatie (eerste poging met standaard tooling):
  - `pip install -e .[dev]` ❌ `pip: command not found`
  - `python3 -m pip install -e .[dev]` ❌ `No module named pip`
  - `python3 -m ensurepip --upgrade` ❌ `No module named ensurepip`
  - `pytest` ❌ `ModuleNotFoundError: No module named 'fastapi'`
- Backend verificatie (omgeving hersteld met beschikbare repo-tooling):
  - `uv run --extra dev pytest` ❌ dependencies beschikbaar, maar standaard `STORAGE_ROOT=/data` niet schrijfbaar in deze CLI-omgeving (`PermissionError: /data`).
  - `STORAGE_ROOT="/tmp/opencode/wervelnieuws-test-data" DATABASE_URL="sqlite:////tmp/opencode/wervelnieuws-test.db" uv run --extra dev pytest` ✅ 90/90 tests geslaagd (209 waarschuwingen; geen failures).
- Conclusie:
  - Backend tests zijn succesvol uitgevoerd via `uv` met schrijfbare testpaden voor storage/database.
  - Frontend geautomatiseerde checks die beschikbaar zijn, zijn groen (`npm test`, `npm run build`).
  - Frontend lint/typecheck scripts ontbreken; TypeScript compile is wel gedekt via build.
  - Handmatige responsive/smoke-validatie blijft open (niet uitgevoerd via CLI).
- Resterend voor volledige afronding:
  - Handmatige `/vergaderborden` responsive + smoke-check blijft aanbevolen na deploy omdat deze CLI-sessie geen browser-QA kan uitvoeren.

---
Status: completed  
Owner: n.t.b.  
Date: 2026-05-22
