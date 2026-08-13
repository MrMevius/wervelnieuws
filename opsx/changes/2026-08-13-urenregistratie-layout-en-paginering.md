# Title
Urenregistratie: compacte layout, ongewijzigde standaardsortering en tabelvoetpaginering

## Context
De urenregistratiepagina toont **Projecttotalen** momenteel binnen de operationele lijstlayout, bevat zichtbare sorteer- en volgordecontrols en verdeelt de pagineringsbediening niet als één rechts uitgelijnde tabelvoet. Daardoor benut de urentabel niet de volledige beschikbare contentbreedte en is de bediening visueel minder compact dan de goedgekeurde UX-richting.

Deze change beperkt zich tot de presentatie en bediening van de urenregistratiepagina. De bestaande standaard/API-sortering `work_date desc` blijft het effectieve gedrag; alleen de zichtbare sorteer- en volgordecontrols verdwijnen. De reeds bestaande projecttotalen blijven servergevoed en functioneel ongewijzigd.

## Goals / Non-goals

### Goals
- Plaats **Projecttotalen** op desktop sticky rechtsboven bij de paginakop en buiten de tabel/contentkolom, zodat de tabel de volledige beschikbare contentbreedte benut.
- Toon **Projecttotalen** op mobiel statisch en zonder horizontale overflow of bedekte bediening.
- Verwijder uitsluitend de zichtbare sorteer- en volgordecontrols op de urenregistratiepagina.
- Behoud de bestaande default- en API-sortering `work_date desc`, inclusief requestsemantiek en resultaatvolgorde.
- Plaats **Per pagina**, vorige, paginastatus en volgende als één rechts uitgelijnde footer direct onder de urentabel.
- Maak uitsluitend knoppen binnen de urenregistratiepagina compacter; andere pagina's en gedeelde knopvarianten behouden hun huidige afmetingen.
- Werk gerichte tests, `docs/urenregistratie.md` en de eindgebruikersgerichte About/changelog bij.

### Non-goals
- Geen wijziging aan backend, API-routes, queryparameters, datamodel, database, migraties of de berekening van `project_totals`.
- Geen wijziging aan de betekenis, standaardwaarde of server-side uitvoering van sortering; er komt geen vervangende zichtbare sorteerbediening.
- Geen wijziging aan filters, deelnemerskiezer, invoer-, bewerk-, verwijder-, historie-, audit-, Admin- of exportflows.
- Geen algemeen herontwerp van de applicatieshell, andere tabellen, andere pagina's of globale knopstijlen.
- Geen wijziging aan de inhoud of responscontracten van projecttotalen.

## Proposed approach
1. Inventariseer de bestaande urenpagina-layout, de queryparameters/defaults voor de groepenlijst, de projecttotalencomponent, de pagineringsmarkup en de lokale versus gedeelde knopklassen.
2. Maak de urenlijstlayout op desktop een duidelijke scheiding tussen een hoofdcontentkolom met tabel en een sticky projecttotalenkolom bij de paginakop. Laat de tabelcontainer zelf de volledige breedte van de hoofdcontentkolom gebruiken. Gebruik op mobiele/nauwe viewports een statische, gestapelde projecttotalensectie.
3. Verwijder alleen de rendering en lokale state/handlers die uitsluitend bestaan voor de zichtbare sorteer- en volgordecontrols. Houd de bestaande `work_date desc` default en de ongewijzigde API-call/querysemantiek expliciet intact.
4. Verplaats bestaande pagineringscontrols zonder gedragswijziging naar een semantische footer direct na de tabel; lijn de volledige controlegroep rechts uit en behoud toegankelijke namen, disabled states en pagination state.
5. Scope compacte knopstyling onder een urenpagina-rootselector of lokale componentklasse, zodat uitsluitend knoppen op deze pagina kleiner worden en shared/global button styles niet wijzigen.

## Implementation steps (ordered)
1. **Inventarisatie en regressiegrens**
   - Leg huidige DOM-structuur, responsive breakpoints, projecttotalenpositionering, list-query defaults en bestaande pagination/sort tests vast.
   - Bevestig in code en tests dat een initiële lijstrequest zonder zichtbare sorteerkeuze effectief `work_date desc` behoudt.
2. **Desktop- en mobiele layout voor projecttotalen**
   - Positioneer **Projecttotalen** op geschikte desktopviewports als sticky element rechtsboven naast de paginakop, buiten de tabelcontainer.
   - Zorg dat de tabel in haar eigen hoofdcontentkolom de volledige beschikbare breedte gebruikt.
   - Voeg een statische gestapelde mobiele/nauwe fallback toe die geen overlap, clipping of horizontale overflow veroorzaakt.
3. **Sorteerbediening verwijderen zonder contractwijziging**
   - Verwijder uitsluitend zichtbare sorteer- en volgordecontrols en bijbehorende UI-specifieke state/handlers van de urenpagina.
   - Behoud de bestaande default/API-aanroep voor `work_date desc`; wijzig geen backendcode, API-types, route, parameternaam of sorteersemantiek.
4. **Paginering naar tabelvoet verplaatsen**
   - Render **Per pagina**, vorige, de huidige paginastatus en volgende als één samenhangende, rechts uitgelijnde footer direct onder de tabel.
   - Behoud page-sizekeuze, vorige/volgende gedrag, disabled states, actuele pagina-informatie en toetsenbordbediening.
5. **Lokale knopcompactheid**
   - Pas alleen binnen de urenregistratiepagina padding, hoogte en/of typografie van knoppen minimaal aan volgens bestaande visuele conventies.
   - Verifieer dat knoppen in andere pagina's en gedeelde componentgebruik buiten deze pagina niet veranderen.
6. **Tests, documentatie en verificatie**
   - Voeg gerichte regressies toe voor desktop/mobiele layoutstructuur, afwezigheid van sorteercontrols, behouden `work_date desc`-request/default, tabelvoetpaginering, lokale knopscoping en toegankelijkheid.
   - Werk `docs/urenregistratie.md` bij met de positionering van projecttotalen, het ontbreken van handmatige sorteervolgorde en de locatie van de paginering.
   - Voeg bij afronding een korte, eindgebruikersgerichte About/changelog-vermelding toe conform `AGENTS.md`, voer het Testing plan uit en leg feitelijke resultaten vast.

## Acceptance criteria
1. Op een desktopviewport staat **Projecttotalen** rechtsboven bij de urenpaginakop en blijft de sectie zichtbaar tijdens verticaal scrollen door een lijst die langer is dan het viewport, zonder paginakop, filters, invoer, tabel of acties te overlappen of te bedekken.
2. **Projecttotalen** is buiten de tabelcontainer gerenderd en de urentabel gebruikt de volledige beschikbare breedte van haar hoofdcontentkolom; de totalensectie verkleint of nestelt de tabel niet.
3. Op 320 CSS px en bij 200% zoom is **Projecttotalen** statisch/gestapeld, zijn kop, totalen, invoer, tabel en paginering bereikbaar en bestaat geen horizontale viewportoverflow, overlap of clipping.
4. De urenregistratiepagina toont geen zichtbare sorteer- of volgordecontrol (inclusief label, select, knop of iconische bediening) voor de urenlijst.
5. Zonder zichtbare sorteerbediening blijft de initiële en vervolg-lijstquery de bestaande standaard/API-sortering `work_date desc` gebruiken; de resultaatvolgorde blijft nieuwste werkdatum eerst. API-routes, parameters en backend-sortering wijzigen niet.
6. **Per pagina**, vorige, huidige paginastatus en volgende staan samen als rechts uitgelijnde footer direct onder de urentabel, niet boven de tabel en niet elders op de pagina.
7. De tabelvoet behoudt bestaande page-sizeopties, paginawisseling, statusinformatie, disabled states en toegankelijke namen voor vorige/volgende.
8. Alleen knoppen binnen de urenregistratiepagina zijn aantoonbaar compacter dan vóór deze change; knoppen op andere pagina's en globale/shared button-styling wijzigen niet.
9. `docs/urenregistratie.md` beschrijft de actuele projecttotalenlayout, de behouden standaardvolgorde zonder zichtbare sorteerbediening en de paginering onder de tabel. De About/changelog bevat bij afronding een korte eindgebruikersgerichte entry.
10. Gerichte frontendtests, de volledige frontendtestset, de frontendproductiebouw en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Gerichte urenpagina-, sorteerdefault-, paginerings- en About-regressies
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige frontendregressieset en productiebuild
npm test -- --run
npm run build

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Open de urenregistratiepagina op desktop, scroll door een lange lijst en controleer dat **Projecttotalen** sticky rechtsboven blijft zonder overlap, terwijl de tabel haar beschikbare contentbreedte benut.
- Controleer op 320 CSS px en bij 200% zoom dat projecttotalen statisch stapelt en dat geen horizontale overflow, clipping of bedekte bediening optreedt.
- Bevestig dat geen sorteer- of volgordecontrol zichtbaar is en controleer via browser developer tools dat de lijst nog volgens `work_date desc` wordt opgevraagd en nieuwste werkdatum eerst toont.
- Controleer dat **Per pagina**, vorige, paginastatus en volgende direct onder de tabel als rechts uitgelijnde groep staan; test page-sizewijziging, eerste/laatste pagina en toetsenbordbediening.
- Vergelijk knoppen op de urenregistratiepagina met een andere pagina om te bevestigen dat alleen urenknoppen compacter zijn.

## Risk + rollback plan

### Risks and mitigations
- **Sticky projecttotalen overlappen content of blijven te kort sticky:** gebruik de bestaande shell-offset, een dedicated desktoplayout en een expliciet geteste statische fallback op nauwe/korte viewports.
- **Verwijderde sorteer-UI verandert onbedoeld de query:** dek de exacte default `work_date desc` met een regressietest af en wijzig geen API- of backendsorteercode.
- **Paginering raakt los van de tabel of verliest status:** verplaats bestaande controls als één groep en test page-size, disabled states en paginawisseling.
- **Compacte styling lekt naar andere schermen:** scope CSS strikt onder de urenpagina-root of een lokale class en voeg een regressie/visuele controle voor niet-urenknoppen toe.
- **Responsive tabelbreedte introduceert overflow:** test desktop, 320 CSS px en 200% zoom met lange inhoud en bestaande responsieve tabelpatronen.

### Rollback
1. Er zijn geen data-, API- of migratiewijzigingen; revert de betrokken frontend-, test-, documentatie- en changelogwijzigingen als één change.
2. Een rollback herstelt de eerdere layout en zichtbare sorteercontrols zonder gevolgen voor opgeslagen uren, projecttotalen of paginationdata.
3. Herhaal na rollback minimaal de gerichte frontendtests, `npm run build` en `git diff --check`.

## Notes / links
- Gerelateerde specs:
  - `opsx/changes/2026-08-12-urenregistratie-terminologie-en-persoonlijk-overzicht.md` (servergevoede projecttotalen)
  - `opsx/changes/2026-08-12-urenregistratie-vervolg-ux-en-externe-personenbeheer.md` (bestaande sticky/fallback-richting en urenpagina-UX)
  - `opsx/changes/2026-08-12-urenverantwoording-admin-tabs.md` (afbakening urenbeheer/Admin)
- Waarschijnlijke implementatiepunten:
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/app/App.test.tsx`
  - `docs/urenregistratie.md`
  - bestaande About/changelog-pagina of -bronbestand

### Assumptions
- “Sticky rechtsboven bij paginakop op desktop” betekent een sticky element in de urenpagina-layout naast de hoofdcontent, niet een viewport-brede overlay.
- “Statisch mobiel” geldt op de bestaande mobiele/nauwe breakpoint van de urenpagina; de exacte breakpoint volgt het aanwezige responsive patroon.
- “Default/API `work_date desc` behouden” betekent behoud van de huidige request/defaultsemantiek zonder nieuwe UI om die volgorde te wijzigen.
- “Uitsluitend knoppen binnen urenregistratiepagina kleiner” sluit knoppen in uren-Admin-tabs en alle andere schermen uit, tenzij zij daadwerkelijk binnen de urenregistratiepaginacontainer renderen.

## Current status
Completed.

## What changed
- De urenpagina gebruikt op desktop een hoofdcontentkolom met daarnaast sticky **Projecttotalen**; op smalle schermen wordt de layout statisch gestapeld.
- Sorteer- en volgordecontrols zijn verwijderd. De lijst- en CSV-aanvraag sturen ongewijzigd expliciet `sort_key=work_date` en `sort_direction=desc`.
- **Per pagina**, vorige, paginastatus en volgende staan als toegankelijke, rechts uitgelijnde footer direct onder de tabel.
- Compacte knopmaten zijn lokaal onder `.uren-module-page` gescoped.
- De urenregistratiedocumentatie en de eindgebruikerschangelog (iteratie 106) zijn bijgewerkt, met bijbehorende frontend-regressies.

## How to verify
- Vanuit `frontend`: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`, daarna `npm test -- --run` en `npm run build`.
- Vanuit de repositoryroot: `git diff --check`.
- Controleer handmatig desktop-sticky totalen, de statische 320px/200%-fallback, ontbrekende sorteercontrols, paginering onder de tabel en lokale knopcompactheid.

## Verification evidence
- Impactinspectie uitgevoerd voor urenpagina, gerelateerde tests, styles, urenregistratiedocumentatie en About/changelogbron plus -fixture.
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` geslaagd: 2 bestanden, 126 tests.
- `cd frontend && npm test -- --run` geslaagd: 5 bestanden, 189 tests.
- `cd frontend && npm run build` geslaagd. Vite meldt alleen de bestaande waarschuwing voor een geminificeerde chunk groter dan 500 kB.
- `git diff --check` geslaagd.

## In-scope repair — mobiele volgorde projecttotalen

- **Oorzaak:** de desktopcorrectie plaatste de contentkolom vóór de totalenkolom in de DOM. De mobiele fallback schakelde de layout vervolgens naar `display: block`, waardoor **Projecttotalen** visueel na alle urencontent verscheen in plaats van statisch erboven.
- **Reparatie:** de mobiele breakpoint behoudt nu een eencoloms grid en geeft **Projecttotalen** uitsluitend daar `order: -1`; desktop houdt content links, een volle contentkolom voor de tabel en sticky totalen rechts.
- **Regressie:** de urenpaginatest dekt aanvullend dat totalen een los sibling van de urencontent blijven, zodat de mobiele orderregel de volledige urenbediening als één blok kan voorafgaan. De bestaande siblingassertions voor desktopcontent, totalenkolom, tabelvoetpaginering en standaard-sortering zijn in dezelfde analyse gecontroleerd en blijven correct.
- **Documentatie:** geen aanpassing nodig; `docs/urenregistratie.md` beschreef de goedgekeurde mobiele positie al correct.

### Repair verification evidence

- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` geslaagd: 1 bestand, 37 tests.
- Eerste productiebouw vond uitsluitend een TypeScript-testtypefout: de nieuwe DOM-siblingassertion gebruikte een generieke `Element` waar Testing Library een `HTMLElement` verwacht. De query is getypeerd als `HTMLElement`; geen productgedrag is gewijzigd. Herverificatie volgt.
- Na die in-scope testcorrectie zijn de gerichte test opnieuw en `cd frontend && npm run build` geslaagd. De build geeft alleen de bestaande Vite-waarschuwing voor een geminificeerde chunk groter dan 500 kB.

## In-scope repair — responsive totals en mobiele pagineringsvoet

- **Oorzaak:** de eerdere mobiele fallback startte pas op 560px en de enkele pagineringsvoet stond in de DOM vóór de mobiele kaarten. Daardoor was een middelbreed viewport (zoals een desktop op 200% zoom) nog kwetsbaar voor de sticky zijbalk, en verscheen de mobiel zichtbare footer vóór de kaarten terwijl de desktoptafel verborgen was.
- **Reparatie:** de totalenkolom schakelt nu op de relevante shell-breakpoint van 920px naar de statische, bovenaan gestapelde layout; daarmee is de desktop-sticky variant nooit actief in de smalle/middelbrede shell. De enkele pagineringsfooter is na de mobiele kaarten verplaatst en behoudt op mobiel expliciet rechtsuitlijning. Er is geen tweede mobiele pagination toegevoegd.
- **Regressies:** structurele assertions dekken één footer na zowel tabel als mobiele kaarten. Paginationinteracties dekken page-size-reset en de opeenvolgende vorige/volgende requests, status en disabled states. De CSS-test toetst de 920px statische fallback en de mobiele rechtsuitlijning; alle eerder verwante urenlayout- en paginationassertions zijn gezamenlijk gecontroleerd.
- **Documentatie:** geen aanpassing nodig; `docs/urenregistratie.md` beschrijft dit gedrag al zonder breakpoint- of DOM-implementatiedetails.

### Repair verification evidence

- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` geslaagd: 2 bestanden, 128 tests.
- `cd frontend && npm test -- --run` geslaagd: 5 bestanden, 192 tests.
- `cd frontend && npm run build` geslaagd. Alleen de bestaande Vite-waarschuwing voor een geminificeerde chunk groter dan 500 kB.
- Eerste `cd backend && pytest` via de systeem-Python was niet uitvoerbaar omdat `fastapi` daar ontbreekt. De canonieke repository-omgeving is vervolgens gebruikt: `cd backend && .venv/bin/pytest` geslaagd: 268 passed, 1 skipped. Alleen bestaande deprecationwarnings.
- `git diff --check` geslaagd.
- Browser/e2e-tooling is niet als afhankelijkheid of configuratie aanwezig; viewport/zoom is daarom vastgelegd via de responsive CSS-regressietest, niet via een browserrun.

## Reviewresultaat

- Documentation/changelog review: **GO**. `docs/urenregistratie.md` beschrijft al de actuele projecttotalenpositie, de statische mobiele fallback, de behouden nieuwste-datum-eerst-volgorde zonder handmatige sorteerbediening en de paginering direct onder de tabel. De eindgebruikersgerichte About/changelog-entry voor iteratie 106 is aanwezig in `frontend/src/app/App.test.tsx` (fixture voor de About-content).
- Beide in-scope repairs zijn verwerkt en door de gerichte en volledige frontendregressies, productiebouw en `git diff --check` geverifieerd.
- De handmatige browsercheck voor desktop-scroll, 320 CSS px en 200% zoom blijft als niet-blokkerende follow-up staan; browser/e2e-tooling is niet aanwezig in de repository.

## Final status

**Completed**

### Follow-ups

- Voer bij een volgende beschikbare browser/e2e-omgeving de handmatige responsive controle uit voor sticky/statische projecttotalen, pagineringpositie en lokale knopcompactheid. Dit blokkeert de afronding niet.

---
Status: Completed
Owner: —
Date: 2026-08-13
