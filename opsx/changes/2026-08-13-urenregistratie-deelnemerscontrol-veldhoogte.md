# Title
Urenregistratie: deelnemerscontrol op desktop even hoog als overige invoervelden

## Context
De afgeronde change `2026-08-13-urenregistratie-filters-export-en-veldhoogtes.md` heeft de reguliere desktopinvoervelden in de urenregistratie op 34 px gezet en de deelnemerscontrol bewust compact gehouden op 30 px. De goedgekeurde follow-up corrigeert uitsluitend die compactere uitzondering: de deelnemerscontrol moet op desktop dezelfde hoogte krijgen als de overige invoervelden in dezelfde invoerrij.

## Goals / Non-goals

### Goals
- Geef de deelnemerscontrol in de desktop-invoerrij dezelfde berekende hoogte als datum, project, post, duur en beschrijving.
- Behoud de bestaande deelnemerskiezer volledig functioneel, inclusief openen, selecteren, teller, focus, Escape en buitenklik.
- Scope de visuele wijziging uitsluitend tot de desktopurenregistratie-invoer.

### Non-goals
- Geen wijziging aan de deelnemersselectielogica, labels, teller, menu/picker, toegankelijkheidssemantiek of create-payload.
- Geen wijziging aan mobiele of tablet-layout, overige invoervelden, globale controlstijlen, backend, API, database of tests buiten noodzakelijke gerichte regressiedekking.
- Geen heropening van de eerder afgeronde filter-, CSV- of overige urenregistratiescope.

## Proposed approach
1. Lokaliseer de lokaal gescope CSS-regels die in de voorgaande change de reguliere desktopcontrols op 34 px en de deelnemers-trigger op 30 px zetten.
2. Vervang uitsluitend de afwijkende desktophoogte van de deelnemerscontrol door dezelfde gedeelde hoogte als de reguliere invoervelden; behoud bestaande padding, layout en interactie tenzij een minimale lokale correctie nodig is om de hoogte werkelijk gelijk te maken.
3. Actualiseer of voeg een gerichte structurele/CSS-regressietest toe die vastlegt dat de deelnemerscontrol niet langer een compactere hoogte ontvangt en uitsluitend in desktopscope de gedeelde hoogte volgt.

## Implementation steps (ordered)
1. **Inventariseer de huidige styling**
   - Bevestig de huidige desktopselector(s) voor datum, project, post, duur, beschrijving en de deelnemers-trigger in de urenregistratie-invoerrij.
   - Bevestig dat de bestaande afwijkende compacte hoogte uitsluitend de deelnemerscontrol betreft.
2. **Normaliseer de desktophoogte**
   - Verwijder of overschrijf alleen de lokale 30 px-uitzondering voor de deelnemerscontrol.
   - Laat de deelnemerscontrol de bestaande gedeelde desktopcontrolhoogte gebruiken (momenteel 34 px), zonder globale selector of mobiele regel te wijzigen.
3. **Leg regressiegedrag vast**
   - Werk de gerichte urenregistratie- of stijltest bij zodat deze de gedeelde desktophoogte en de afwezigheid van een compactere deelnemers-uitzondering controleert.
   - Behoud bestaande regressies voor de deelnemerspicker en ureninvoer ongewijzigd, behalve wanneer een verwachting expliciet de oude 30 px-hoogte vastlegt.
4. **Verifieer en registreer**
   - Voer de exacte geautomatiseerde en handmatige controles uit het Testing plan uit.
   - Leg de feitelijke uitkomsten onder `Verification evidence` vast; markeer de spec pas als completed wanneer alle acceptance criteria zijn aangetoond.

## Acceptance criteria
1. Op desktop hebben datum, project, post, duur, beschrijving en de deelnemerscontrol in de urenregistratie-invoerrij dezelfde berekende controlhoogte van 34 px.
2. Er resteert geen urenregistratie-desktop-CSS-regel die de deelnemerscontrol op 30 px of anderszins lager zet dan de reguliere invoervelden.
3. De wijziging is lokaal gescoped tot de desktop-invoerrij van urenregistratie; mobiele/tabletweergave en controls op andere pagina's veranderen niet.
4. De deelnemerscontrol behoudt zijn huidige label/teller, toegankelijke naam, open/dicht-status, selectiegedrag, toetsenbordbediening, Escape-, buitenklik- en focusherstelgedrag.
5. De gerichte frontendtest, frontendproductiebouw en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Gerichte urenregistratie- en stijlregressies
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/styles.lightmode.test.ts

# TypeScript- en Vite-productiebouw
npm run build

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Open urenregistratie op een desktopviewport en vergelijk via browser developer tools de berekende hoogte van datum, project, post, duur, beschrijving en deelnemerscontrol; alle zijn 34 px.
- Open de deelnemerskiezer, selecteer en deselecteer een deelnemer, sluit met Escape en buitenklik, en bevestig dat selectie, teller en focusherstel ongewijzigd werken.
- Controleer op tablet/mobiel dat de bestaande gestapelde invoer en deelnemerskiezer visueel en functioneel ongewijzigd blijven.

## Risk + rollback plan

### Risks and mitigations
- **De hoogte wijkt door padding of box-sizing alsnog af:** controleer berekende browserwaarden voor alle zes desktopcontrols en houd de aanpassing bij de bestaande lokale gedeelde regel.
- **Een te brede selector raakt mobiel of andere pagina's:** scope de selector onder de urenmodule en de desktop-invoerrij; voer de tablet/mobiele regressiecheck uit.
- **De grotere trigger beïnvloedt pickeruitlijning of focus:** wijzig geen picker- of eventlogica en controleer openen, selectie en sluitpaden handmatig.

### Rollback
1. Er zijn geen data-, API- of migratiewijzigingen; revert uitsluitend de betrokken frontendstijl-, test- en specwijzigingen als één change.
2. De rollback herstelt de eerdere compacte desktopdeelnemerscontrol zonder gevolgen voor opgeslagen uren of deelnemersselecties.
3. Herhaal na rollback minimaal de gerichte frontendtest, `npm run build` en `git diff --check`.

## Notes / links
- Voorgaande change met de te corrigeren uitzondering: `opsx/changes/2026-08-13-urenregistratie-filters-export-en-veldhoogtes.md`.
- Waarschijnlijke implementatiepunten:
  - `frontend/src/styles.css`
  - `frontend/src/styles.lightmode.test.ts`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` (alleen als een bestaande verwachting geraakt wordt)

### Docs-impact
- `docs/urenregistratie.md` beschrijft de gelijke desktophoogte van datum, project, post, duur, omschrijving en deelnemerskiezer. De eerdere tekst die de deelnemerskiezer bewust compacter noemde, was stale.
- **Geen About/changelog-entry:** `AGENTS.md` vereist voor elke *afgeronde iteratie* een eindgebruikersgerichte About-entry. Deze change is echter nadrukkelijk een kleine visuele bugfix binnen de reeds afgeronde urenregistratie-iteratie van 2026-08-13, geen zelfstandige functionele iteratie. Een extra eindgebruikersentry voor een hoogtecorrectie voegt geen bruikbare productinformatie toe en wordt daarom niet gemaakt. Als de repository-eigenaar deze follow-up alsnog als afzonderlijke afgeronde iteratie classificeert, vervalt deze uitzondering en is vóór afronding een korte About-entry vereist.

### Assumptions
- De gedeelde desktopcontrolhoogte uit de voorgaande change blijft 34 px; deze follow-up past alleen de deelnemerscontrol daaraan aan.
- “Deelnemerscontrol” betekent de trigger/knop in de desktop-invoerrij, niet de checkboxen of het zwevende deelnemersmenu.

## Current status
Completed — IN_SCOPE_REPAIR-batch is geïmplementeerd en volledig geverifieerd, inclusief de gekoppelde README-documentatiecorrectie.

## What changed
- De lokaal gescope desktopregel voor `.work-hours-create-row .work-hours-participant-trigger` gebruikt nu, net als de overige invoervelden in de rij, `box-sizing: border-box`, `min-height: 34px` en `height: 34px`.
- De CSS-regressietest legt vast dat de trigger 34 px hoog is en binnen dezelfde regel geen 30px-uitzondering meer bevat.
- Bestaande gerichte pickerregressies voor openen, selectie, teller, toetsenbord, Escape, buitenklik en focusherstel zijn ongewijzigd uitgevoerd.
- IN_SCOPE_REPAIR: de 34px-regel voor de deelnemerstrigger staat uitsluitend in `@media (min-width: 921px)`, de inverse van het bestaande `max-width: 920px`-breakpoint. Tablet en mobiel ontvangen deze hoogte dus niet.
- IN_SCOPE_REPAIR: `docs/urenregistratie.md` corrigeert de stale bewering dat de deelnemerskiezer compacter is en beschrijft de gelijke desktophoogte.
- IN_SCOPE_REPAIR: `README.md` beschrijft `docs/urenregistratie.md` niet langer als documentatie van filters; de samenvatting weerspiegelt de huidige inhoud.

## How to verify
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/styles.lightmode.test.ts`
- `cd frontend && npm run build`
- `git diff --check`
- Handmatig (optioneel als browser-smokecheck): controleer op desktop via developer tools dat datum, project, post, duur, beschrijving en de deelnemerstrigger 34 px hoog zijn; verifieer vervolgens openen/selecteren/deselecteren, Escape, buitenklik en focusherstel. Controleer tablet/mobiel op ongewijzigde invoer en picker.

## Verification evidence
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/styles.lightmode.test.ts` (39 tests, 2 testbestanden; inclusief pickerinteractie en CSS-regressie).
- PASS — `cd frontend && npm run build` (`tsc -b && vite build`). Vite rapporteerde uitsluitend de bestaande waarschuwing dat een gegenereerde chunk groter is dan 500 kB; de build slaagde.
- PASS — `git diff --check` (geen output).
- PASS — `cd frontend && npm test` (volledige canonieke frontendtestsuite; uitgevoerd na de README-documentatiecorrectie).
- PASS — `cd frontend && npm run build` (`tsc -b && vite build`; uitgevoerd na de README-documentatiecorrectie).
- PASS — `git diff --check` (geen output; uitgevoerd na de README-documentatiecorrectie).
- PASS — Documentatiecontrole: `README.md` en `docs/urenregistratie.md` gecontroleerd; de README noemt filters niet meer en de urenregistratiedocumentatie beschrijft expliciet dat kolomfilters en **Alle filters wissen** ontbreken.
- Niet uitgevoerd — handmatige browsercontrole; de berekende 34px-desktophoogte is structureel afgedekt door de lokaal gescope CSS-regel en regressietest.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/styles.lightmode.test.ts` (39 tests, 2 testbestanden). De CSS-regressie bevestigt `min-width: 921px` voor de 34px-triggerregel en geen 34px-regel in de bestaande `max-width: 920px`-scope.
- PASS — `cd frontend && npm test` (191 tests, 5 testbestanden).
- PASS — `cd frontend && npm run build` (`tsc -b && vite build`). De build slaagde; Vite rapporteerde uitsluitend de bestaande waarschuwing voor een gegenereerde chunk groter dan 500 kB.
- PASS — `git diff --check` (geen output).

---
Status: completed
Owner: —
Date: 2026-08-13
