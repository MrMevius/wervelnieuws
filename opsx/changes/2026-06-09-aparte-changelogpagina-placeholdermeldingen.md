# Title
Aparte changelogpagina en duidelijke placeholdermeldingen

## Context
De huidige frontend communiceert op enkele plekken onvoldoende expliciet wat al beschikbaar is en wat nog in ontwikkeling is:

- De WindWilly Assistent-modulepagina maakt nog niet duidelijk genoeg dat de assistent momenteel uitsluitend een placeholder/preview is en nog geen werkende assistent.
- De Wervelnieuws-mainpagina maakt nog niet zichtbaar genoeg dat Wervelnieuws zelf nog work in progress is.
- De changelog staat nu ingebed onder Wervelnieuws/About, terwijl deze als aparte pagina bereikbaar moet worden vanaf de WindWilly-landingspagina.
- De changelog moet visueel reverse-chronologisch worden getoond: nieuwste wijziging bovenaan, oudste onderaan.

Deze wijziging is primair frontendgericht. Backendwijzigingen zijn alleen binnen scope als inspectie aantoont dat changelogcontent of About-content daar centraal wordt beheerd en minimaal moet worden aangepast voor de verplichte user-facing changelog-entry volgens de repo Definition of Done.

## Goals / Non-goals
### Goals
- Verduidelijk de copy op de WindWilly Assistent-pagina zodat gebruikers ondubbelzinnig zien dat dit nu uitsluitend een placeholder/preview is.
- Voeg op de Wervelnieuws-mainpagina een duidelijke zichtbare “work in progress”-melding toe.
- Voeg een aparte changelogpagina toe via frontendrouting.
- Voeg op de WindWilly-landingspagina een duidelijke link of knop toe naar de aparte changelogpagina.
- Pas de Aboutpagina aan zodat de changelog daar niet meer als hoofdblok onder Wervelnieuws staat; de Aboutpagina mag hooguit kort naar de aparte changelogpagina verwijzen.
- Toon changelog-items reverse-chronologisch: nieuwste wijziging bovenaan, oudste onderaan.
- Pas relevante tests aan of voeg tests toe voor de nieuwe route, link en meldingen.
- Voeg de verplichte end-user-facing changelog-entry toe voor deze iteratie volgens de repo Definition of Done.

### Non-goals
- Geen backend-API-wijziging aan het changelog-datamodel, tenzij implementatie-inspectie aantoont dat dit technisch noodzakelijk is.
- Geen herontwerp van de volledige navigatiestructuur.
- Geen inhoudelijke productwijzigingen aan Wervelnieuws-workflows.
- Geen wijzigingen aan AI-, publicatie-, documentverwerking- of authenticatiefuncties.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer de frontend shell, routes en pagina’s voor:
   - WindWilly Assistent-modulepagina;
   - Wervelnieuws-mainpagina;
   - WindWilly-landingspagina;
   - Wervelnieuws/Aboutpagina;
   - bestaande changelogrendering en brondata.
2. Voeg een zelfstandige changelogroute en -pagina toe die bestaande changelogdata hergebruikt waar mogelijk.
3. Zorg dat changelogitems op de nieuwe pagina expliciet reverse-chronologisch worden weergegeven. Als de data al gesorteerd is, borg dit alsnog in componentlogica of testdekking zodat de UI-volgorde testbaar blijft.
4. Verplaats de changelogpresentatie functioneel weg uit de Aboutpagina: verwijder het hoofdblok of vervang het door een korte verwijzing naar de nieuwe changelogpagina.
5. Voeg op de WindWilly-landingspagina een duidelijke link/knop naar de nieuwe changelogpagina toe.
6. Verduidelijk de placeholdercopy op de WindWilly Assistent-pagina met tekst die expliciet vermeldt dat dit nog geen werkende assistent is.
7. Voeg op de Wervelnieuws-mainpagina een opvallende maar passende work-in-progressmelding toe.
8. Werk of voeg gerichte frontendtests toe voor routebereikbaarheid, de landingspaginalink, placeholdermelding, Wervelnieuws-work-in-progressmelding en changelogvolgorde.
9. Als de changelog-entry in backendcontent wordt beheerd, voeg daar de verplichte end-user-facing entry toe en voer de gerichte backend meta/About-test uit.

## Implementation steps (ordered)
1. Bevestig dit document als actieve change spec voordat implementatie start.
2. Inspecteer `frontend/` om de bestaande router, App-shelltests en relevante pagina-/componentbestanden te vinden.
3. Inspecteer waar de About/changelogcontent wordt geladen of gedefinieerd, inclusief eventuele backend meta/About-bron.
4. Maak een nieuwe frontendroute voor de aparte changelogpagina met een duidelijke paginatitel en bestaande stylingconventies.
5. Render changelogitems op de nieuwe pagina in reverse-chronologische volgorde, met nieuwste wijziging bovenaan.
6. Voeg op de WindWilly-landingspagina een duidelijke link of knop naar de nieuwe changelogroute toe.
7. Pas de Aboutpagina aan zodat de changelog daar niet meer als hoofdblok onder Wervelnieuws staat; voeg indien wenselijk een korte verwijzing naar de aparte changelogpagina toe.
8. Verduidelijk de WindWilly Assistent-paginacopy met een zichtbare melding dat dit uitsluitend een placeholder/preview is en nog geen werkende assistent.
9. Voeg op de Wervelnieuws-mainpagina een zichtbare work-in-progressmelding toe.
10. Voeg of actualiseer frontendtests voor de nieuwe route, landingspaginalink, beide meldingen en changelogvolgorde.
11. Voeg de verplichte user-facing changelog-entry voor deze iteratie toe op de plek waar website/About/changelogcontent wordt beheerd.
12. Voer gerichte frontendtests voor App-shell/routing uit.
13. Voer de frontend build uit als bredere check.
14. Als backendcontent is aangepast, voer de gerichte backend meta/About-test uit.
15. Update deze spec na implementatie met `What changed`, `How to verify`, `Verification evidence` en een passende `Current status`.

## Acceptance criteria
1. De WindWilly Assistent-pagina zegt duidelijk dat dit nu uitsluitend een placeholder/preview is en nog geen werkende assistent.
2. De Wervelnieuws-mainpagina toont zichtbaar dat Wervelnieuws nog work in progress is.
3. Er is een aparte changelogpagina met een eigen frontendroute.
4. De WindWilly-landingspagina bevat een duidelijke link of knop naar de aparte changelogpagina.
5. De Aboutpagina toont de changelog niet meer als hoofdblok onder Wervelnieuws; hooguit staat er een korte verwijzing naar de aparte changelogpagina.
6. Changelog-items worden met nieuwste wijziging bovenaan en oudste onderaan getoond.
7. Tests dekken de nieuwe route/link/meldingen en changelogvolgorde waar passend.
8. De verplichte end-user-facing changelog-entry voor deze iteratie is toegevoegd volgens de repo Definition of Done.
9. De wijziging blijft frontendgericht; eventuele backendwijzigingen zijn beperkt tot noodzakelijke content/meta-aanpassingen en worden in deze spec verantwoord.

## Testing plan
- Gerichte frontendtests voor App-shell/routing uitvoeren. Verwachte commandokandidaat:
  - `cd frontend && npm test -- src/app/App.test.tsx`
- Als inspectie aantoont dat relevante tests elders staan, voer de meest gerichte Vitest-test(s) voor routing/pagina’s uit.
- Frontend build uitvoeren als bredere check:
  - `cd frontend && npm run build`
- Als backendcontent voor About/changelog wordt aangepast, voer de gerichte backend meta/About-test uit:
  - `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
- Handmatige UI-check:
  1. Open de WindWilly-landingspagina en controleer de link/knop naar de changelog.
  2. Open de aparte changelogpagina en controleer paginatitel, inhoud en reverse-chronologische volgorde.
  3. Open de Aboutpagina en controleer dat de changelog daar niet meer als hoofdblok staat.
  4. Open de WindWilly Assistent-pagina en controleer de expliciete placeholder/previewmelding.
  5. Open de Wervelnieuws-mainpagina en controleer de zichtbare work-in-progressmelding.

## Risk + rollback plan
### Risico's
- Bestaande About-tests kunnen afhankelijk zijn van de oude ingebedde changelogpresentatie en moeten gericht worden bijgewerkt.
- Navigatie- of routingtests kunnen breken als routeverwachtingen hardcoded zijn.
- Als de changelogvolgorde impliciet afhankelijk is van backend/data-volgorde, kan zonder expliciete sortering of testdekking regressie ontstaan.
- De nieuwe meldingen kunnen visueel te dominant of juist onvoldoende zichtbaar zijn als styling niet aansluit bij bestaande componenten.

### Rollback
- Revert de nieuwe frontendroute, changelogpagina en link/knop op de WindWilly-landingspagina.
- Revert de Aboutpagina-aanpassing zodat de vorige changelogpresentatie terugkomt.
- Revert de aangepaste placeholder- en work-in-progresscopy.
- Revert testaanpassingen die uitsluitend bij deze wijziging horen.
- Laat changelogdata ongewijzigd tenzij een nieuw toegevoegde entry expliciet teruggedraaid moet worden.
- Her-run dezelfde gerichte frontend- en eventuele backendtests om herstel te bevestigen.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-09-aparte-changelogpagina-placeholdermeldingen.md`.
- Gebruikersoutline is de bron voor deze spec.
- Repo Definition of Done vereist voor elke voltooide iteratie een functionele, end-user-friendly website changelog/About-entry.
- Geen technische docs verwacht voor deze wijziging.

## Current status
Completed.

Follow-ups: none currently open.

## What changed
- Frontendrouting uitgebreid met een aparte changelogroute (`/changelog`) die bestaande About/changelogdata hergebruikt.
- WindWilly-landingspagina uitgebreid met een duidelijke knop/link naar de aparte changelogpagina.
- Nieuwe changelogpagina toegevoegd met eigen titel en expliciete newest-first sortering op datum en daarna iteratienummer.
- Aboutpagina aangepast zodat de changelog daar niet meer als hoofdblok wordt getoond; de pagina verwijst kort naar de aparte changelogpagina.
- WindWilly Assistent-copy verduidelijkt: de pagina meldt nu expliciet dat dit uitsluitend een placeholder/preview is en nog geen werkende assistent.
- Wervelnieuws-mainpagina uitgebreid met een zichtbare work-in-progressmelding.
- Frontendtests aangepast/toegevoegd voor route/link, placeholdermelding, work-in-progressmelding, About-verwijzing en changelogvolgorde.
- Default About/changelogcontent in backend metadata uitgebreid met een end-user-facing entry voor deze iteratie, conform repo Definition of Done.

## How to verify
- `cd frontend && npm test -- src/app/App.test.tsx`
- `cd frontend && npm run build`
- Omdat backend default About/changelogcontent is aangepast: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
- Handmatige UI-checks aanbevolen in browser:
  1. WindWilly-landingspagina bevat knop/link “Bekijk changelog”.
  2. `/changelog` toont “Changelog” met nieuwste items bovenaan.
  3. Aboutpagina toont geen ingebed changelogblok meer en verwijst naar de changelogpagina.
  4. WindWilly Assistent meldt dat dit nog geen werkende assistent is.
  5. Wervelnieuws-mainpagina toont de work-in-progressmelding.

## Verification evidence
- `cd frontend && npm test -- src/app/App.test.tsx` — geslaagd: 57 tests passed.
- `cd frontend && npm run build` — geslaagd: TypeScript build en Vite production build voltooid.
- `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload` — geslaagd: 1 test passed, 2 bestaande deprecation warnings.
- Handmatige browsercheck niet uitgevoerd in deze sessie; bovengenoemde gedrag is afgedekt door gerichte frontendtests waar passend.
