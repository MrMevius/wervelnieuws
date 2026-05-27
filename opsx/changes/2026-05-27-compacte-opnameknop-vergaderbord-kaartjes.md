# Title
Compacte opnameknop op Vergaderbord-kaartjes

## Context
De bestaande change `2026-05-27-recordknop-alle-vergaderbord-kaartjes.md` is afgerond en maakt opname mogelijk op alle Vergaderbord-kaarten met direct start/stop, upload via bestaande flow en backend-acceptatie voor alle kolommen/statussen.

Deze vervolgwijziging is een gerichte UI-tweak: de huidige brede/tekstuele opnamebediening op kaartniveau moet vervangen worden door een compacte, icoon-gebaseerde knop rechtsboven op elk kaartje. Functioneel gedrag moet gelijk blijven aan de afgeronde change.

## Goals / Non-goals
### Goals
- Vervang op elk Vergaderbord-kaartje de huidige opnamebediening door een kleine icon-only knop met microfoonicoon, gepositioneerd rechtsboven op de kaart.
- Tijdens actieve opname verandert de knop visueel naar een rode stopknop/-icoon.
- Tijdens actieve opname blijft de timer zichtbaar op de actieve kaart.
- Behoud duidelijke Nederlandstalige toegankelijkheidslabeling (`aria-label`/`title`) voor start/stop-opname.
- Behoud bestaand gedrag uit de vorige change:
  - opname beschikbaar op alle kaarten;
  - direct start/stop vanaf kaart;
  - klik op opnameknop opent geen detail;
  - maximaal één actieve opname tegelijk;
  - uploadflow ongewijzigd;
  - backend ongewijzigd;
  - Nederlandstalige foutmeldingen ongewijzigd;
  - detail-opname blijft werken.
- Werk tests bij als selectors of tekstassumpties wijzigen door de nieuwe UI.

### Non-goals
- Geen backendwijzigingen (API, services, validaties, opslag).
- Geen wijziging aan opnamebusinesslogica, concurrencylogica of upload-endpoints.
- Geen wijziging aan detailweergave-opnameflow, behalve regressiepreventie.
- Geen bredere redesign van Vergaderbord-kaartlayout buiten de opnameknopcomponent.

## Proposed approach
1. Pas alleen de kaart-UI voor opnamecontrols aan (presentatie + iconografie + positionering).
2. Hergebruik bestaande event-handling voor start/stop en click-isolatie (geen detail-opening bij opnameklik).
3. Koppel actieve-opname-state aan icon-swapping (microfoon → rode stop) zonder onderliggende flow te wijzigen.
4. Laat timerweergave op actieve kaart intact en controleer visuele samenhang met de compacte knop.
5. Update frontendtests op semantische selectors (rol/label/title) waar tekstknoppen zijn vervangen door icon-only controls.
6. Valideer dat backend en detail-opnamepad niet geraakt worden door deze wijziging.

## Implementation steps (ordered)
1. Inventariseer huidige kaartcomponent voor Vergaderborden en lokaliseer opnameknop-rendering, timer-rendering en disabled-state rendering.
2. Vervang de huidige full-width/tekstuele knop door een compacte icon-only knop op de kaart, rechtsboven gepositioneerd.
3. Voeg/waarborg Nederlandstalige toegankelijke naamgeving voor beide states:
   - inactief: microfoon/start opname;
   - actief: stop opname.
4. Implementeer state-afhankelijke visuele variant:
   - inactief: neutrale microfoonknop;
   - actief: duidelijk rode stopknop.
5. Behoud bestaande timerweergave op actieve kaart tijdens opname.
6. Controleer en borg dat click op opnameknop geen kaartdetail opent (event bubbling blijft geblokkeerd).
7. Borg dat bij één actieve opname de niet-actieve kaartknoppen zichtbaar disabled blijven.
8. Werk frontendtests bij voor nieuwe buttonstructuur/selectors en behoud bestaande gedragschecks.
9. Verifieer expliciet dat geen backendbestanden aangepast hoeven te worden.
10. Neem bij shipping een About/changelog-entry op conform repo Definition of Done.

## Acceptance criteria (measurable)
1. Elk Vergaderbord-kaartje toont rechtsboven een kleine icon-only opnameknop met microfoonicoon wanneer geen opname actief is op die kaart.
2. De opnameknop heeft een duidelijke Nederlandstalige toegankelijke naam/tooltip voor start en stop (bijv. via `aria-label` en/of `title`).
3. Klikken op de opnameknop opent de kaartdetailweergave niet.
4. Op de actief-opnemende kaart verandert de knop direct naar een rode stopknop/-icoon.
5. Tijdens actieve opname blijft de timer zichtbaar op de actieve kaart.
6. Terwijl één kaart opneemt, zijn opnameknoppen op andere kaarten zichtbaar disabled/niet bedienbaar.
7. Bestaande functionele opnameflow blijft gelijk: direct start/stop, maximaal één actieve opname, uploadgedrag ongewijzigd.
8. Er zijn geen backendwijzigingen in deze change.
9. Bestaande detail-opnamefunctionaliteit blijft werken.
10. Bestaande tests worden bijgewerkt waar nodig voor selector/tekstwijzigingen en slagen voor het aangepaste gedrag.
11. About/changelog-impact is vastgelegd wanneer de wijziging wordt geshipt.

## Testing plan (canonical commands or approach)
- Frontend targeted tests voor Vergaderbord-kaarten:
  - icon-only microfoonknop aanwezig op alle kaarten;
  - Nederlandstalige a11y-label/title voor start/stop;
  - klik op opnameknop opent detail niet;
  - actieve kaart toont rode stopknop + timer;
  - niet-actieve kaarten disabled tijdens actieve opname.
- Regressietests:
  - één actieve opname tegelijk;
  - uploadflow blijft ongewijzigd;
  - detail-opnamepad blijft functioneel.
- Backend:
  - geen testuitbreiding vereist tenzij frontendtests impliciet API-contractassumpties wijzigen; backendcode blijft ongewijzigd.
- Tijdens implementatie exacte commando’s registreren onder **How to verify** en uitkomsten onder **Verification evidence**.

## Risk + rollback plan
### Risks
- Icon-only knop kan toegankelijkheid verslechteren als label/title ontbreekt of onduidelijk is.
- Visuele disabled-state kan te subtiel zijn waardoor gebruikers niet zien dat slechts één opname tegelijk kan.
- Positionering rechtsboven kan conflicteren met bestaande kaartcontent op kleinere schermen.

### Mitigation
- Verplicht Nederlandstalige a11y-attributen en test deze expliciet.
- Gebruik consistente disabled-styling met voldoende contrast/duidelijkheid.
- Verifieer layout op relevante breakpoints en met lange kaarttitels.

### Rollback
- Herstel vorige kaart-UI voor opnameknop (full-width/tekstueel) zonder wijziging aan opnameflow.
- Her-run frontend regressietests voor opname-interacties en detail-open gedrag.

## Notes / links
- Vorige afgeronde change (functionele basis): `opsx/changes/2026-05-27-recordknop-alle-vergaderbord-kaartjes.md`
- Scope-input en acceptance criteria door gebruiker expliciet goedgekeurd.
- Slug: `compacte-opnameknop-vergaderbord-kaartjes`.

## Current status
Completed

## What changed
- Frontend kaart-UI in `frontend/src/app/features/admin/VergaderbordenPage.tsx` aangepast van tekstuele opnameknop naar compacte icon-only knop rechtsboven per kaart.
- Opnameknop op kaartjes gebruikt nu state-afhankelijke visuele variant:
  - inactief: microfoonicoon;
  - actief: rode stopknop met stop-icoon.
- Toegankelijkheid op kaartknoppen geborgd met Nederlandstalige `aria-label` én `title` voor start/stop-opname.
- Timerweergave op actieve kaart behouden (`Timer: <n>s`) tijdens opname.
- Disabled state voor niet-actieve kaartknoppen tijdens actieve opname behouden.
- Styles bijgewerkt in `frontend/src/styles.css` voor compacte icon-button, actieve rode variant en zichtbare disabled-state.
- Frontend tests bijgewerkt in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx` voor:
  - icon-only gedrag (geen zichtbare knoptekst);
  - Nederlandstalige `title`/a11y labels voor start/stop;
  - bestaande gedragsgarantie dat recordklik geen kaartdetail opent.
- About/changelog bijgewerkt in `backend/app/api/meta.py` met iteratie 44 voor deze UI-verbetering.
- Geen backend-opnameflow, API-contracten of uploadlogica aangepast.

## How to verify
- `npm run test -- VergaderbordenPage.test.tsx`
- `npm run build`

## Verification evidence
- `npm run test -- VergaderbordenPage.test.tsx` (in `frontend/`) → ✅ **19 passed, 0 failed**.
- `npm run build` (in `frontend/`) → ✅ geslaagd (`tsc -b && vite build`, productiebundle opgebouwd).
- Review/finalize: automatische `opsx-review` subagent was niet beschikbaar (`ProviderModelNotFoundError`); handmatige no-edit review vond dat de knop echt rechtsboven gepositioneerd moest worden. Dit is gecorrigeerd met `position: absolute` + extra rechter padding op de kaart en opnieuw geverifieerd:
  - `npm run test -- VergaderbordenPage.test.tsx` (in `frontend/`) → ✅ **19 passed**.
  - `npm run build` (in `frontend/`) → ✅ geslaagd.

---
Status: completed
Owner: opsx-implement
Date: 2026-05-27
