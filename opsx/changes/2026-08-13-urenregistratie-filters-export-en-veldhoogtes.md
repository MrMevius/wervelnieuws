# Title
Urenregistratie: kolomfilters verwijderen, CSV bij paginering en consistente invoerveldhoogtes

## Context
De afgeronde change `2026-08-13-urenregistratie-layout-en-paginering.md` heeft de urenlijst, projecttotalen en tabelvoetpaginering herordend. De urenregistratie bevat nog wel interactieve kolomfilters met bijbehorende lokale state, metadata-afleidingen en lijst-/CSV-queryparameters. Deze bediening is niet langer gewenst en moet volledig verdwijnen, zonder restcode of queryparameters voor deze filters.

Daarnaast moet **CSV export** in de tabelvoet onderaan links vóór of direct naast **Per pagina** staan. De desktop-invoerrij moet visueel consistente hoogtes krijgen voor datum-, select- en beschrijvingsvelden. De deelnemerskiezer blijft bewust compacter dan deze standaardinvoervelden.

## Goals / Non-goals

### Goals
- Verwijder alle urenregistratie-kolomfilters uit de desktop-UI, inclusief **Alle filters wissen**.
- Verwijder de uitsluitend voor deze kolomfilters gebruikte lokale state, afleidingen, handlers, metadata-afhankelijkheden en lijst-/CSV-queryparameters.
- Behoud de expliciete standaardvolgorde `work_date desc`, de bestaande paginering en de inhoud van CSV-export zonder filterbeperking.
- Plaats **CSV export** in de bestaande tabelvoet onderaan links, vóór of direct naast **Per pagina**; de volledige voet blijft direct onder de tabel/na de mobiele kaarten staan.
- Maak de desktop-invoervelden voor datum, project, post, duur en beschrijving onderling even hoog volgens een vastgelegde lokale CSS-regel; behoud de deelnemerscontrol zichtbaar bewust compacter.
- Werk `docs/urenregistratie.md` en de verplichte eindgebruikersgerichte About/changelog bij.

### Non-goals
- Geen nieuwe algemene zoek-, filter- of sorteerbediening als vervanging voor de kolomfilters.
- Geen wijziging aan backendroutes, datamodel, database, migraties, API-contracten of server-side filterondersteuning.
- Geen wijziging aan de vaste lijstsortering `work_date desc`, page-sizeopties, pagineringgedrag, CSV-bestandsformaat of CSV-downloadmechanisme.
- Geen wijziging aan projecttotalen, ureninvoerlogica, deelnemersselectiegedrag, mobiele kaartweergave, bewerk/verwijderflows of Admin-schermen.
- Geen globale herstyling van invoervelden, selects of knoppen buiten de urenregistratiepagina.

## Proposed approach
1. Traceer alle desktop-kolomfilterrendering en de daaraan gekoppelde frontendstate (`project`, `post`, datum, deelnemer, type, zoektekst en filterzoekvelden), afgeleide filteropties en API-queryopbouw.
2. Vereenvoudig de urenlijst- en CSV-exportqueries tot uitsluitend de ongewijzigde sortering en de bestaande paginering voor de lijst. Laat geen voormalige filterqueryparameter in frontendrequests achter.
3. Verplaats de bestaande CSV-actie van de toolbar naar de bestaande `work-hours-pagination`-voet, semantisch vóór of direct naast de page-sizecontrol aan de linkerkant van die voet.
4. Leg lokaal gescope CSS vast voor een gedeelde desktophoogte van de reguliere invoervelden in de invoerrij. Geef de deelnemers-trigger expliciet een kleinere hoogte, zonder het bereik, de focus of de pickerinteractie te wijzigen.
5. Actualiseer regressietests, gebruikersdocumentatie en de About/changelog-entry.

## Implementation steps (ordered)
1. **Inventariseer filterafhankelijkheden**
   - Identificeer `ColumnFilter`, kolomfiltermarkup, resetbediening, lokale filterstate, filterzoekstate, filteropties uit metadata en gedeelde filterqueryopbouw in de urenpagina en gerichte tests.
   - Leg vast welke queryvelden alleen voor kolomfilters bestaan en bevestig dat `sort_key=work_date` en `sort_direction=desc` behouden moeten blijven.
2. **Verwijder kolomfilters en restcode**
   - Verwijder de volledige zichtbare kolomfilterbediening uit alle tabelkoppen, inclusief actieve-indicatoren en **Alle filters wissen**.
   - Verwijder uitsluitend de nu ongebruikte component, imports, state, memo's, handlers en metadata-afleidingen.
   - Bouw de lijstquery op met alleen ongewijzigde paginering en expliciete standaard-sortering; bouw de CSV-query met uitsluitend de behouden standaard-sortering.
3. **Positioneer CSV-export in de tabelvoet**
   - Verwijder de losse exporttoolbar.
   - Render de bestaande CSV-exportactie onderaan links in de bestaande pagination-footer, vóór of direct naast het label **Per pagina**.
   - Behoud downloadnaam, foutgedrag, toetsenbordtoegang en de bestaande pagina-/disabled-state van vorige en volgende.
4. **Normaliseer desktop-invoerveldhoogtes**
   - Voeg onder de urenpagina-scope een consistente hoogte en box-sizing toe voor datum, projectselect, postselect, duurselect en beschrijvingsinvoer in de desktop-invoerrij.
   - Geef de deelnemers-trigger een expliciet kleinere hoogte dan de reguliere velden en verifieer dat de control niet verticaal uitlijning, validatiemeldingen of de picker breekt.
   - Houd mobiele invoer en globale gedeelde controlstijlen ongewijzigd tenzij een lokaal responsive patroon dit strikt vereist.
5. **Tests, documentatie en verificatie**
   - Voeg regressietests toe voor de afwezigheid van alle kolomfilters/resetbediening en filterqueryparameters, behoud van `work_date desc`, ongewijzigde pagination en CSV-export in de voet vóór/naast **Per pagina**.
   - Voeg structurele/CSS-regressies toe voor uniforme desktopveldhoogtes en de bewust compactere deelnemerscontrol, lokaal gescoped tot urenregistratie.
   - Werk `docs/urenregistratie.md` en de About/changelog-bron en -fixture bij; voer alle hieronder genoemde controles uit en registreer uitkomsten in deze spec.

## Acceptance criteria
1. De urenregistratie toont op desktop geen interactieve kolomfilterbediening, filtermenu, filteractieve indicator, filterzoekveld of **Alle filters wissen**-knop.
2. `UrenverantwoordingPage.tsx` bevat geen ongebruikte `ColumnFilter`-component, filterlokale state, filterzoekstate, filteroption-memo of handler die uitsluitend voor de verwijderde kolomfilters bestond.
3. Een initiële en gepagineerde lijstrequest bevatten `sort_key=work_date`, `sort_direction=desc`, `page` en `page_size`, maar bevatten geen voormalige filterqueryparameter: `project_id`, `post_id`, `work_date`, `participant_kind`, `participant_query` of `query`.
4. De CSV-exportrequest behoudt `sort_key=work_date` en `sort_direction=desc`, bevat geen voormalige filterqueryparameter en exporteert daardoor de volledige set volgens de bestaande serversemantiek.
5. **CSV export** staat uitsluitend in de pagination-footer direct onder de desktoptabel en na de mobiele kaarten, aan de linkerkant vóór of direct naast **Per pagina**; er is geen losse exporttoolbar boven de tabel.
6. **Per pagina**, vorige, paginastatus en volgende behouden hun bestaande opties, requestgedrag, toegankelijke namen en disabled states.
7. In de desktop-invoerrij hebben datum, project, post, duur en beschrijving dezelfde berekende controlhoogte; de deelnemers-trigger heeft aantoonbaar een kleinere berekende hoogte en blijft volledig bruikbaar met muis en toetsenbord.
8. De hoogteaanpassing is lokaal tot de urenregistratiepagina gescoped; controles op andere pagina's en de mobiele ureninvoer wijzigen niet.
9. `docs/urenregistratie.md` vermeldt dat kolomfilters ontbreken, CSV in de tabelvoet bij **Per pagina** staat en de reguliere desktop-invoer een consistente hoogte heeft met een compactere deelnemerscontrol. De About/changelog bevat een korte, eindgebruikersgerichte vermelding.
10. De gerichte frontendtest, volledige frontendtestset, frontendproductiebouw, backendtestset en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Gerichte urenregistratie- en About-regressies
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige frontendregressieset en productiebuild
npm test -- --run
npm run build

# Backendregressies in de canonieke repository-virtualenv
cd ../backend
.venv/bin/pytest

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Open urenregistratie op desktop en bevestig dat alle kolomkoppen statische labels zijn zonder filter- of resetbediening.
- Controleer in browser developer tools dat lijst- en CSV-requests geen voormalige filterparameters sturen, wel `work_date desc`, en dat de lijst nieuwste werkdatum eerst toont.
- Controleer dat CSV export onderaan links vóór of naast **Per pagina** staat en dat page-size, vorige/volgende, paginastatus en CSV-download werken.
- Vergelijk in een desktopbrowser de berekende hoogtes van datum, project, post, duur en beschrijving in de invoerrij; bevestig dat deelnemers bewust kleiner is en diens picker via muis, Tab en Escape blijft werken.
- Controleer op 320 CSS px en bij 200% zoom dat de mobiele kaartweergave en pagination-footer bereikbaar blijven zonder horizontale overflow of overlap.

## Risk + rollback plan

### Risks and mitigations
- **Restfilterstate of queryparameters blijft achter:** verwijder de filterketen als geheel en leg de exacte toegestane/verboden requestparameters vast in regressietests.
- **CSV staat visueel of semantisch los van paginering:** hergebruik één bestaande footer en test de DOM-volgorde voor desktop en mobiel.
- **Veldhoogtestyling raakt globale controls of mobiel:** scope selectors onder `.uren-module-page` en de desktop-invoerrij; controleer een niet-urenpagina en mobiele invoer.
- **Compacte deelnemerscontrol wordt moeilijker bedienbaar:** behoud huidige minimum interactieve afmetingen waar mogelijk en test focus, Escape en pickeropening.
- **Onbedoelde verandering in sortering/exportomvang:** behoud expliciete sorteerparameters en test lijst- plus exportaanroep afzonderlijk.

### Rollback
1. Er zijn geen data-, backend-, API- of migratiewijzigingen; revert alle betrokken frontend-, test-, documentatie- en changelogwijzigingen als één change.
2. De rollback herstelt de eerdere kolomfilters, exporttoolbar en controlstyling zonder gevolgen voor opgeslagen uren of CSV-data.
3. Voer na rollback minimaal de gerichte frontendtest, `npm run build`, `.venv/bin/pytest` en `git diff --check` opnieuw uit.

## Notes / links
- Vorige afgeronde change: `opsx/changes/2026-08-13-urenregistratie-layout-en-paginering.md`.
- Waarschijnlijke implementatiepunten:
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/styles.css`
  - `frontend/src/app/App.test.tsx` en de bestaande About/changelog-bron
  - `docs/urenregistratie.md`

### Assumptions
- “Kolomfilters volledig verwijderen” betreft uitsluitend de urenregistratielijst; server-side filtermogelijkheden blijven voor compatibiliteit ongewijzigd maar worden door deze pagina niet meer gebruikt.
- “Onderaan links vóór/naast Per pagina” betekent binnen dezelfde bestaande pagination-footer en niet een aparte tweede footer of toolbar.
- “Consistente desktop-invoerveldhoogtes” betreft de reguliere controls in de desktop-invoerrij; de deelnemers-trigger is expliciet de enige beoogde compacte uitzondering.

## Current status
Completed — automated verification is current; the requested manual browser checks remain unexecuted because no browser tooling is available in this environment.

## What changed
- Verwijderde alle urenlijst-kolomfilters, de resetbediening, bijbehorende lokale state/afleidingen, `ColumnFilter` en de uitsluitend daarvoor gebruikte CSS.
- Vereenvoudigde lijstrequests tot `page`, `page_size`, `sort_key=work_date` en `sort_direction=desc`; CSV gebruikt uitsluitend de twee behouden sorteervelden.
- Verplaatste de enige CSV-exportactie naar de pagination-footer vóór **Per pagina**.
- Legde lokaal gescope desktophoogtes vast voor datum-, project-, post-, duur- en beschrijvingsvelden (34 px), met een expliciet compactere deelnemers-trigger (30 px).
- Actualiseerde urenregistratiedocumentatie, About/changelog-bron (iteratie 107), About-fixture en regressietests. De projecttotalen-leegmelding verwijst niet langer naar verwijderde filters.
- IN_SCOPE_REPAIR: de vervolgrequest-test voor paginering vergelijkt nu het volledige requestobject voor pagina 2 (bij 25 en 50 per pagina), zodat uitsluitend `page`, `page_size`, `sort_key=work_date` en `sort_direction=desc` zijn toegestaan en voormalige filterparameters niet ongemerkt kunnen terugkeren.

## How to verify
- Vanuit `frontend`: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx src/styles.lightmode.test.ts`, daarna `npm test -- --run` en `npm run build`.
- Vanuit `backend`: `.venv/bin/pytest`.
- Vanuit de repositoryroot: `git diff --check`.
- Voer daarnaast de handmatige controles uit het **Testing plan** uit in een browser, met nadruk op de requestparameters en de desktop- en mobiele responsiviteit.

## Verification evidence
- Gerichte frontendtests: geslaagd — 3 bestanden, 129 tests (`npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx src/styles.lightmode.test.ts`).
- Volledige frontendtestset: geslaagd — 5 bestanden, 191 tests (`npm test -- --run`).
- Frontendproductiebouw: geslaagd (`npm run build`; `tsc -b && vite build`). Vite meldde uitsluitend de bestaande waarschuwing voor een geminificeerde chunk groter dan 500 kB.
- Backendtestset: geslaagd — 268 passed, 1 skipped (`.venv/bin/pytest`). Er zijn alleen bestaande deprecation warnings van pytest-asyncio, `crypt` en `datetime.utcnow`.
- `git diff --check`: geslaagd.
- Browsertoolingcontrole: geen beschikbare browserautomatisering aangetroffen (`google-chrome`, `chromium`, `chromium-browser`, `firefox`, `playwright` en lokale Playwright-/Puppeteer-modules ontbreken). Daarom zijn de handmatige checks voor berekende controlhoogtes, deelnemerspicker via muis/Tab/Escape, 320 CSS px en 200% zoom niet uitgevoerd en is hiervoor geen positief bewijs opgenomen.

---
Status: completed (manual browser evidence unavailable in this environment)
Owner: —
Date: 2026-08-13
