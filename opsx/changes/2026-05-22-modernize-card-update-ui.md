# Title
Moderniseer kaart-toevoegformulier en update-flow in vergaderborden UI

## Context
De huidige kaartjes-interface in Vergaderborden oogt rommelig bij het toevoegen van nieuwe kaartjes, met name door inconsistente uitlijning tussen titelveld, beschrijving, teamledenkeuze en actieknop. Daarnaast is de update-flow in het kaartdetailvenster functioneel beperkt en visueel onduidelijk: validatiefeedback is niet consequent zichtbaar, updates worden onvoldoende prominent weergegeven, en het detailvenster ondersteunt geen sluiten via buitenklik.

Deze iteratie moderniseert gericht de UX van kaart toevoegen en kaartupdates binnen de bestaande donkere/groene thema-identiteit, zonder grote herbouw van detailfunctionaliteit of datamodelverplichtingen.

## Goals / Non-goals
### Goals
- Compact inline formulier voor kaart toevoegen moderniseren in alle kaartkolommen.
- Betere uitlijning van titelveld, beschrijving, teamleden/selectie en knop.
- Titel verplicht maken bij kaart toevoegen met inline validatiefout bij ontbrekende titel.
- Kaartdetailvenster beperkt moderniseren:
  - betere spacing/layout
  - kleinere sluitknop rechtsboven
  - sluiten via buitenklik.
- Update-flow verbeteren:
  - update-tekst verplicht
  - inline foutmelding bij lege update
  - updateveld leeg na succesvolle plaatsing
  - update-lijst direct verversen
  - update-teller op kaart én detail direct bijwerken
  - updates tonen als lijst onder het invoerformulier
  - nieuwste updates bovenaan
  - per update tekst + datum/tijd + auteur tonen waar beschikbaar
  - nette fallback tonen wanneer datum/tijd/auteur ontbreekt
  - lege statusmelding tonen wanneer er nog geen updates zijn.
- Bestaande donkere/groene thema behouden.
- Goede bruikbaarheid op desktop en tablet.

### Non-goals
- Geen aanpassingen aan opnames-functionaliteit.
- Geen bewerken of verwijderen van bestaande updates.
- Geen grote herbouw van het kaartdetailvenster.
- Geen volledig nieuwe visuele stijl.
- Geen mobiele optimalisatie als expliciet iteratiedoel.
- Geen verplichte datamodel-uitbreiding voor update-metadata (metadata blijft best-effort).

## Proposed approach
1. Inventariseer bestaande frontendcomponenten en styles voor:
   - inline kaart-toevoegformulier per kolom
   - kaartdetailvenster
   - update-invoer, update-lijst en update-tellerweergave.
2. Herstructureer formulierlayout en spacing op component-/CSS-niveau zodat titel, beschrijving, teamleden en knop consistent zijn uitgelijnd in alle kolommen.
3. Voeg client-side validatie toe voor verplichte kaarttitel met directe inline foutmelding en blokkeer submit zonder geldige titel.
4. Moderniseer kaartdetailvenster beperkt door compacte header/sluitknop en buitenklik-sluitgedrag met behoud van bestaande modalflow.
5. Versterk update-flow in detail:
   - verplichte update-invoer + inline foutmelding
   - directe lijstrefresh en tellersynchronisatie na succesvolle submit
   - lege input resetten na submit
   - updates onder invoer tonen, aflopend op recentheid.
6. Definieer en gebruik fallback-rendering voor ontbrekende metadata (datum/tijd/auteur) zonder harde backendafhankelijkheid.
7. Houd stylingwijzigingen strikt binnen vergaderborden/kaartcomponent-scope om regressierisico in andere UI te beperken.
8. Werk website changelog/About-entry bij met eindgebruikersvriendelijke toelichting van verbeterde kaart- en updatebediening.

## Implementation steps (ordered)
1. Lokaliseer betrokken frontendbestanden (vergaderborden pagina, kaartcomponenten, detailmodal, bijbehorende styles).
2. Refactor inline kaart-toevoegformulierlayout voor consistente uitlijning in alle kolommen.
3. Implementeer verplichte titelvalidatie bij kaart toevoegen met inline foutweergave.
4. Pas detailvensterlayout aan (spacing) en vervang/slim down sluitknop rechtsboven.
5. Implementeer buitenklik-sluitgedrag voor het detailvenster.
6. Implementeer verplichte update-tekstvalidatie met inline foutmelding.
7. Na succesvolle update-submit:
   - leeg updateveld
   - ververs update-lijst direct
   - werk update-teller op kaart en detail direct bij.
8. Render updates als lijst onder updateformulier, met nieuwste eerst en metadata/fallback-weergave per item.
9. Toon duidelijke lege-melding wanneer geen updates beschikbaar zijn.
10. Houd bestaande donkere/groene thema-uitstraling intact en controleer bruikbaarheid op desktop/tablet.
11. Voeg/werk tests bij waar bestaande teststructuur dit ondersteunt.
12. Werk About/changelog bij met functionele eindgebruikersvermelding.
13. Werk deze spec tijdens implementatie bij in de secties “What changed”, “How to verify”, “Verification evidence” en “Current status”.

## Acceptance criteria
1. In alle kaartkolommen is het nieuwe kaartformulier netjes uitgelijnd en visueel consistenter.
2. Een kaart zonder titel kan niet worden toegevoegd.
3. Bij ontbrekende titel verschijnt een inline foutmelding.
4. Het kaartdetailvenster heeft een kleine sluitknop rechtsboven.
5. Klikken buiten het detailvenster sluit het venster altijd.
6. Een lege update kan niet worden geplaatst.
7. Bij lege update verschijnt een inline foutmelding.
8. Na succesvolle update:
   - updateveld wordt geleegd
   - update verschijnt direct in de lijst
   - update-teller wordt direct bijgewerkt.
9. Updates worden onder het formulier getoond, nieuwste bovenaan.
10. Per update wordt tekst plus datum/tijd/auteur getoond waar beschikbaar, anders een nette fallback.
11. Als er geen updates zijn, verschijnt een lege melding.
12. Opnames-functionaliteit blijft buiten scope.

## Testing plan
- Inspecteer relevante frontendcomponenten en style-scopes voor regressierisico.
- Voeg/werk tests bij waar bestaande frontend teststructuur dit ondersteunt (gericht op validatie en update-render gedrag).
- Handmatige verificatie (minimaal):
  - kaart toevoegen zonder titel
  - kaart toevoegen met titel
  - detailvenster openen/sluiten via knop
  - detailvenster sluiten via buitenklik
  - lege update plaatsen
  - geldige update plaatsen
  - update-lijst (nieuwste bovenaan) en update-teller direct controleren.
- Run relevante frontend lint/test/build-commando’s volgens projectstructuur.

## Risk + rollback plan
### Risico’s
- Bestaande update-data bevat mogelijk onvolledige metadata (datum/tijd/auteur), wat inconsistentie in lijstweergave kan geven.
- Buitenklik-sluiten kan typed maar nog niet verzonden update-inhoud verliezen; dit gedrag is geaccepteerd binnen scope.
- Stylingwijzigingen kunnen onbedoeld alle kaartkolommen beïnvloeden.

### Mitigatie
- Verplicht fallback-weergavepad voor ontbrekende metadata.
- Scope CSS/componentwijzigingen strikt tot vergaderborden kaart- en detailcontext.
- Gerichte regressiecontrole op toevoegen/updateflow in meerdere kolommen.

### Rollback
- Draai UI- en eventhandler-aanpassingen terug naar bestaande kaart- en detailcomponentversies.
- Revert specifieke commits per implementatiestap indien regressie wordt geconstateerd.

## Notes / links
- Bron: door gebruiker aangeleverde en overeengekomen “Draft Change Spec Outline”.
- Slug: `modernize-card-update-ui`.
- Docs impact: About/website changelog moet end-user-vriendelijke vermelding krijgen van verbeterde kaart- en updatebediening.

## Current status
Completed

## What changed
- Frontend `VergaderbordenPage` aangepast voor compacte, consistente inline kaart-toevoegformulieren in alle kolommen:
  - titel, beschrijving en teamleden in gestandaardiseerde veldopbouw;
  - actieknop in vaste actieregel;
  - verplichte titel met inline foutmelding (`Titel is verplicht.`).
- Kaartdetailvenster beperkt gemoderniseerd:
  - kleine ronde sluitknop rechtsboven (`×`);
  - modal sluit bij buitenklik op de overlay;
  - spacing en formulieropmaak opgeschoond met behoud van donkere/groene themalook.
- Update-flow in kaartdetail verbeterd:
  - update-tekst verplicht gemaakt met inline foutmelding (`Vul eerst een update in.`);
  - updatesectie staat direct onder updateformulier;
  - updates worden newest-first gerenderd;
  - metadataweergave per update: datum/tijd + auteur met fallback (`Datum onbekend`, `Onbekende auteur`);
  - lege-statusmelding toegevoegd (`Er zijn nog geen updates geplaatst.`);
  - na succesvolle submit wordt update-invoer direct leeggemaakt;
  - query invalidation uitgebreid zodat detail én kaartoverzicht/teller direct verversen.
- Opnames-functionaliteit bewust ongemoeid gelaten (out of scope).
- End-user changelog/About bijgewerkt met iteratie 31 in backend `/meta/about` default content.
- Gerichte frontend-tests toegevoegd voor:
  - inline validatie bij lege kaarttitel;
  - inline validatie bij lege update en sluiten van detailmodal via buitenklik.

## How to verify
1. Open Vergaderborden en selecteer een project met kolommen.
2. Probeer in een kolom een kaart toe te voegen zonder titel.
   - Verwacht: inline foutmelding `Titel is verplicht.` en geen submit.
3. Voeg daarna een kaart toe met geldige titel.
   - Verwacht: kaart wordt toegevoegd en formulier reset.
4. Open een kaartdetail.
   - Verwacht: kleine sluitknop rechtsboven zichtbaar.
5. Klik buiten de modal.
   - Verwacht: modal sluit direct.
6. Open kaartdetail opnieuw en klik op `Update plaatsen` met leeg updateveld.
   - Verwacht: inline foutmelding `Vul eerst een update in.` en geen submit.
7. Plaats een geldige update.
   - Verwacht: invoerveld wordt geleegd, update verschijnt direct onder formulier, nieuwste staat bovenaan, teller op kaart/detail ververst direct.
8. Controleer update-items:
   - Verwacht: tekst + datum/tijd + auteur waar beschikbaar; nette fallback waar metadata ontbreekt.
9. Controleer kaart zonder updates.
   - Verwacht: melding `Er zijn nog geen updates geplaatst.`.
10. Controleer About-pagina changelog.
   - Verwacht: nieuwe iteratie-entry over deze Vergaderborden UX-verbeteringen.

Gerichte test-run:
- `npm test -- -t "shows inline error when adding a card without title|shows inline error for empty update and closes detail on outside click"`

## Verification evidence
- Code-updates uitgevoerd in frontend board UI + styles + About changelog backend.
- Gerichte testcases toegevoegd in `frontend/src/app/App.test.tsx`:
  - `shows inline error when adding a card without title`
  - `shows inline error for empty update and closes detail on outside click`
- Gerichte test command uitgevoerd:
  - `npm test -- -t "shows inline error when adding a card without title|shows inline error for empty update and closes detail on outside click"`
  - Resultaat: geslaagd (2 tests passed, 41 skipped in filtered run).
- Brede frontend-verificatie uitgevoerd:
  - `npm test && npm run build`
  - Resultaat: geslaagd; volledige frontend test-suite 43/43 passed en `tsc -b && vite build` succesvol.
- Geen aparte lint-run uitgevoerd: `frontend/package.json` bevat geen lint-script.

---
Status: completed
Owner: n.t.b.
Date: 2026-05-22
