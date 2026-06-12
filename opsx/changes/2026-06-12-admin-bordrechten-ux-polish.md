# Title
Admin Bordrechten UX-polish

## Context
De pagina **Admin > Bordrechten** werkt al functioneel, maar mist op meerdere punten duidelijke visuele hiërarchie en consistente UX. In dark mode is de actieve tab niet scherp genoeg zichtbaar, bordkaarten lezen niet altijd snel, primaire en destructieve acties ogen te gelijkwaardig, en lege/succes-/foutstates geven nog te weinig richting. Daardoor kost beheer van bordrechten onnodig tijd en is de kans op misclicks groter.

Deze wijziging is een gerichte UX-polish voor alleen deze admin-pagina. De bestaande rechtenlogica en API-contracten blijven intact.

## Goals / Non-goals
### Goals
- Maak de bovenkant van de pagina duidelijker met titel, korte uitleg en een zichtbare primaire actiezone.
- Versterk de actieve tabweergave in dark mode.
- Herstructureer bordkaarten zodat bordnaam, status, metadata en acties sneller scanbaar zijn.
- Maak de CTA-hiërarchie expliciet: één primaire actie, rustigere secundaire acties, destructieve acties visueel gescheiden.
- Voeg of verbeter empty states met een duidelijke vervolgstap.
- Voeg of verbeter zoeken/filteren op bordnaam, status en rechten, inclusief reset.
- Geef loading-, saving-, success- en errorfeedback expliciet weer.
- Harmoniseer labels, spacing, focus states en toegankelijkheid.
- Behoud bestaande beheergedrag en permissielogica.

### Non-goals
- Geen redesign van de volledige admin-UI.
- Geen wijzigingen aan andere admin-tabs.
- Geen backendwijzigingen aan permissielogica of datamodel.
- Geen nieuwe rollenstructuur of navigatiestructuur.
- Geen brede informatiearchitectuurwijziging buiten deze pagina.

## Proposed approach
1. Inspecteer de huidige `Bordrechten`-tab, bijbehorende state, filters, card markup, feedbackcomponenten en bestaande tests.
2. Verbeter de paginakop met een compactere uitleg, betere uitlijning en een duidelijke primaire actiezone boven de lijst.
3. Pas tabstyling aan zodat de actieve tab in dark mode sterker contrasteert zonder de overige tabs te overheersen.
4. Herstructureer de bordkaart in een vaste layout: bordnaam bovenaan, daaronder status/rechten/meta, en acties logisch gegroepeerd.
5. Maak primaire acties duidelijker door knopvarianten, positie en spacing te verscherpen; zet risicovolle/destructieve acties apart met confirmatie/visuele waarschuwing.
6. Voeg of verfijn leegte- en foutstates zodat de gebruiker meteen ziet wat er mis is en welke vervolgstap mogelijk is.
7. Voeg/verbeter zoeken en filters met een resetknop en heldere labels, zonder de pagina te verzwaren.
8. Voeg expliciete feedback toe voor laden, opslaan en fouten, zodat acties direct zichtbaar resultaat geven.
9. Harmoniseer aria-labels, focusstaten, contrast en toetsenbordbediening voor de volledige pagina.
10. Actualiseer tests voor scanbaarheid, tabstate, filters, empty states, confirmaties en feedback; update daarna de changelog/About-entry.

## Implementation steps (ordered)
1. Bevestig deze spec als actieve change spec voordat implementatie start.
2. Inspecteer `frontend/src/app/shell/AppShell.tsx` en `frontend/src/app/App.test.tsx` om de huidige `BoardRightsAdminTab`-structuur, filters, mutations en testdekking vast te leggen.
3. Maak de paginaheader duidelijker met titel, korte toelichting en een heldere primaire actiezone.
4. Versterk de actieve tab in dark mode en controleer dat de tabnav semantisch intact blijft.
5. Herbouw de bordkaartopbouw naar een vaste, scanbare structuur met consistente spacing en informatiehiërarchie.
6. Scheid primaire, secundaire en destructieve acties visueel en functioneel, inclusief bevestiging voor risicovolle acties waar die al bestaan of logisch nodig zijn.
7. Voeg of verbeter empty states met een concrete vervolgstap.
8. Implementeer of verfijn zoek- en filtercontrols voor bordnaam, status en rechten, inclusief reset.
9. Voeg expliciete loading-, saving-, success- en errorfeedback toe.
10. Harmoniseer labels, helpercopy, aria-attributen en focusstaten voor toetsenbordgebruik.
11. Werk frontendtests bij voor tabstate, kaartscanbaarheid, filters, empty states, feedback en destructieve acties.
12. Voeg de verplichte end-user-facing changelog/About-entry toe op de gebruikelijke locatie.
13. Voer gerichte frontendverificatie uit en werk deze spec bij met resultaat, verificatie en status.

## Acceptance criteria
1. De actieve tab **Bordrechten** is direct herkenbaar, ook in dark mode.
2. Per bordkaart is binnen enkele seconden duidelijk welk bord het is, wat de status/rechten zijn en welke actie primair is.
3. Primaire, secundaire en destructieve acties zijn visueel en in copy duidelijk van elkaar gescheiden.
4. Empty states tonen een nuttige vervolgstap in plaats van alleen een melding.
5. Zoeken en filters staan logisch op de pagina en zijn met één reset weer te wissen.
6. Opslaan, laden en fouten geven directe, expliciete feedback.
7. Labels, copy en spacing zijn consistent binnen de pagina.
8. De pagina is bruikbaar met toetsenbord en voldoet aan gangbare contrast- en focusverwachtingen.
9. De bestaande rechtenbeheerflow werkt functioneel gelijk aan vóór deze wijziging.
10. Gerichte frontendtests en de frontend build slagen.

## Testing plan
- Gerichte frontendtests:
  - `cd frontend && npm test -- App.test.tsx`
- Frontend build/typecheck:
  - `cd frontend && npm run build`
- Handmatige verificatie:
  1. Log in als admin.
  2. Open **Admin > Bordrechten**.
  3. Controleer actieve tab, headerhiërarchie, dark-mode leesbaarheid en kaartscanbaarheid.
  4. Test zoeken, filters en reset.
  5. Test empty state, loading, save-success en save-error feedback.
  6. Controleer dat destructieve acties visueel duidelijk gescheiden zijn en bevestiging vragen waar van toepassing.
  7. Controleer toetsenbordnavigatie, focusstates en contrast.

## Risk + rollback plan
### Risico's
- Te veel visuele wijzigingen kunnen de pagina drukker maken; mitigatie: beperkte accentkleuren en consistente spacing.
- Filters kunnen te zwaar aanvoelen; mitigatie: klein houden, contextueel tonen en reset voorzien.
- Stylingwijzigingen kunnen andere admincomponenten raken als shared classes te breed worden aangepast; mitigatie: scope lokaal naar `Bordrechten`.
- Feedbackstates kunnen bestaande mutationflows verstoren; mitigatie: behoud bestaande API-calls en test de save-flow expliciet.

### Rollback
- Revert de lokale wijzigingen in de `Bordrechten`-tab, bijbehorende styles en tests.
- Herstel de vorige card-, tab- en feedbackcomponenten zonder backendwijzigingen.
- Revert de About/changelog-entry als de wijziging volledig wordt teruggedraaid.

## Notes / links
- Bron: goedgekeurde Nederlandse draft outline uit de user request.
- Bekende frontendlocaties:
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/app/App.test.tsx`
  - `frontend/package.json`
- Relevante bestaande tabnaam: `Bordrechten`.
- Geen product-backendwijzigingen beoogd; alleen About/changelog-data in `backend/app/api/meta.py`.

## Current status
Completed — frontend UX polish and the required end-user-facing About/changelog entry are shipped.

## What changed
- De Admin > Bordrechten-tab heeft nu een duidelijkere header, sterkere actieve-tab styling in dark mode, scanbare board cards met status/rechten-chips, gescheiden primaire/destructieve acties, filter/search controls met reset, empty states met vervolgstap en expliciete save/delete feedback.
- Frontend tests zijn uitgebreid voor de filters, empty state en scoped card interactions.
- De About/changelog-payload bevat nu ook een eindgebruikersvriendelijke iteratie 75-entry voor deze wijziging.

## How to verify
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- Optioneel: open **About** en controleer dat iteratie 75 bovenaan staat in de changelog.

## Verification evidence
- `cd frontend && npm test -- App.test.tsx` ✅ 69 tests passed.
- `cd frontend && npm run build` ✅ frontend build completed successfully.
- Handmatige smoke niet uitgevoerd in deze sessie.

## Follow-ups
- Geen.

---
Status: done
Owner: —
Date: 2026-06-12
