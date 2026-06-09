# Title
Overhaul post-login landing page suite overview

## Context
De eerder gerapporteerde change spec voor `opsx/changes/2026-06-09-overhaul-post-login-landing-page.md` ontbreekt in de workspace. Deze spec legt de reeds goedgekeurde outline opnieuw vast als single source of truth voordat er frontendwijzigingen worden uitgevoerd.

Na inloggen komt de gebruiker op de algemene WindWilly-suite-overzichtslanding. Die pagina is momenteel te druk door suiteblokken/-kaarten en bevat nog een `Bestuur`-placeholder. De gewenste wijziging is een vereenvoudigde post-login landingpage: navigatie en titel blijven intact, maar de pagina zelf toont bovenaan een suite-overzicht-banner met een korte introductietekst over de drie samenwerkende energiecoöperaties.

## Goals / Non-goals
### Goals
- Vereenvoudig de suite overview landing page na login.
- Verwijder de `Bestuur`-placeholder van de landing page.
- Verwijder suiteblokken/-kaarten alleen van de landing page.
- Behoud bestaande titel en menu-/topnavigatie ongewijzigd.
- Plaats de suite overview banner bovenaan de landing page.
- Toon exact deze introductietekst in de banner:
  - `WindWilly is een initiatief van drie samenwerkende energiecoöperaties: Duurzaam Daarlerveen, Noaber & Co en Energiek Daarle.`
- Houd de wijziging frontend-only, tenzij inspectie aantoont dat backend/contentconfiguratie ook noodzakelijk is.
- Actualiseer relevante frontendtests voor de zichtbare landingcontent.

### Non-goals
- Geen redesign van de globale topnavigatie, menustructuur, routes of authenticatieflow.
- Geen wijzigingen aan andere suitepagina's of onderliggende modules.
- Geen backendwijzigingen, tenzij code-inspectie bewijst dat de landingcontent daar wordt beheerd.
- Geen wijziging aan publicatie-, AI-, document- of workflowfunctionaliteit.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer de frontend shell/landingcomponent om de post-login suite-overzichtslanding en de huidige suiteblocks/cards en `Bestuur`-placeholder te lokaliseren.
2. Pas uitsluitend de landingpage-markup aan zodat:
   - de suite overview banner bovenaan de landingcontent staat;
   - de exacte introcopy in die banner zichtbaar is;
   - suiteblocks/cards niet meer op de landingpage worden gerenderd;
   - de `Bestuur`-placeholder niet meer op de landingpage wordt gerenderd;
   - titel en menu-/topnavigatie ongewijzigd blijven.
3. Beperk stylingwijzigingen tot wat nodig is voor nette plaatsing van de bovenste banner en het verwijderen/opschonen van ongebruikte landinglayout.
4. Werk gerichte frontendtests bij of voeg assertions toe voor de nieuwe bannertekst en het ontbreken van de verwijderde landingelementen.
5. Alleen als inspectie aantoont dat de landingcontent in backend/default metadata staat, voer dan de minimale noodzakelijke backendaanpassing uit en breid de testscope overeenkomstig uit.

## Implementation steps (ordered)
1. Bevestig dit specdocument als actieve change spec.
2. Inspecteer `frontend/` op de post-login landingcomponent, vermoedelijk in de app shell/routeromgeving.
3. Bepaal welke suiteblocks/cards en de `Bestuur`-placeholder specifiek op de landingpage staan.
4. Verplaats of behoud de suite overview banner bovenaan de landingcontent met de exacte goedgekeurde introcopy.
5. Verwijder de rendering van suiteblocks/cards op de landingpage zonder navigatie-items, routes of andere pagina's te verwijderen.
6. Verwijder de rendering van de `Bestuur`-placeholder op de landingpage.
7. Houd bestaande titel/menu-navigatie functioneel en visueel ongewijzigd.
8. Pas CSS alleen gericht aan als de layout na het verwijderen van de blokken/cards spacing nodig heeft.
9. Werk frontendtests bij voor de exacte introcopy, bannerpositie waar testbaar, en afwezigheid van verwijderde landingelementen.
10. Run gerichte frontendtests en, indien relevant, aanvullende frontend lint/typecheck.
11. Update deze spec na implementatie met `What changed`, `How to verify`, `Verification evidence` en `Current status`.

## Acceptance criteria
1. Na inloggen toont de suite overview landing page bovenaan de content een suite overview banner.
2. De banner bevat exact de tekst: `WindWilly is een initiatief van drie samenwerkende energiecoöperaties: Duurzaam Daarlerveen, Noaber & Co en Energiek Daarle.`
3. De `Bestuur`-placeholder is niet meer zichtbaar op de landing page.
4. Suiteblocks/cards zijn niet meer zichtbaar op de landing page.
5. Suiteblocks/cards zijn niet verwijderd uit navigatie, routes of eventuele andere pagina's waar ze buiten de landing bewust gebruikt worden.
6. De bestaande titel en menu-/topnavigatie blijven ongewijzigd in tekst, structuur en routegedrag.
7. De wijziging is frontend-only, tenzij in de spec-evidence wordt vastgelegd waarom een backendwijziging noodzakelijk was.
8. Relevante frontendtests slagen en controleren minimaal de exacte nieuwe introcopy.

## Testing plan
- Gerichte frontendtest voor de app shell/landingpage, afhankelijk van bestaande testlocatie. Verwachte commandokandidaten:
  - `cd frontend && npm test -- src/app/App.test.tsx`
- Als de bestaande teststructuur een andere landingtest bevat, run de meest gerichte Vitest-test voor de landing/shell.
- Overweeg aanvullende frontendvalidatie bij gedeelde shellwijzigingen:
  - `cd frontend && npm run typecheck`
  - `cd frontend && npm run lint`
- Handmatige UI-check:
  1. Log in.
  2. Controleer dat de landing opent met de banner bovenaan.
  3. Controleer de exacte introcopy.
  4. Controleer dat `Bestuur` en suiteblocks/cards niet meer op de landing staan.
  5. Controleer dat titel en menu-/topnavigatie ongewijzigd werken.

## Risk + rollback plan
### Risico's
- Suiteblocks/cards kunnen ook als navigatie-ingang dienen; verwijderen van de landing mag routebereikbaarheid niet breken.
- Tests kunnen afhankelijk zijn van oude landingcontent en moeten gericht worden aangepast zonder dekking voor navigatie te verliezen.
- Styling kan lege ruimte of onbedoelde spacing achterlaten na het verwijderen van de kaarten.

### Rollback
- Revert de frontendwijzigingen in de landingcomponent en eventuele bijbehorende CSS/testaanpassingen.
- Als inspectie toch backend/contentmetadatawijzigingen vereist, revert die specifieke backendcontentaanpassing afzonderlijk.
- Her-run dezelfde gerichte tests om te bevestigen dat de vorige landingstaat hersteld is.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-09-overhaul-post-login-landing-page.md`.
- Gebruikersinput bevestigt dat de outline is goedgekeurd en nu alleen als spec moet worden vastgelegd.
- Frontend-only uitgangspunt, tenzij inspectie anders bewijst.
- Exacte introcopy is bindend en moet inclusief interpunctie worden overgenomen.

## Current status
Completed — implementatie en gerichte verificatie zijn uitgevoerd. De landingpage-wijziging zelf is frontend-only; daarnaast is `backend/app/api/meta.py` bijgewerkt voor de verplichte website About/changelog-entry volgens de repo Definition of Done.

## What changed
- De WindWilly post-login landingpage toont nu direct bovenaan de bestaande suite-overview-banner met titel `Welkom bij WindWilly` en de exacte introcopy: `WindWilly is een initiatief van drie samenwerkende energiecoöperaties: Duurzaam Daarlerveen, Noaber & Co en Energiek Daarle.`
- De suiteblocks/-cards zijn alleen uit de landingpage-rendering verwijderd; topnavigatie-links en routegedrag zijn behouden.
- De `Bestuur (placeholder)`-sectie met bestuurslid-placeholders is van de landingpage verwijderd.
- Frontendtests in `frontend/src/app/App.test.tsx` controleren nu de exacte nieuwe introcopy, behoud van suite-navigatie en afwezigheid van oude suitecard-/Bestuur-placeholdercontent.
- De website About/changelog-defaultcontent is aangevuld met een eindgebruikersvriendelijke entry over het rustigere startscherm, conform repo DoD.

## How to verify
- `cd frontend && npm test -- src/app/App.test.tsx`
- `cd frontend && npm run build`
- Changelog/About smoke-check: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
- Handmatige UI-check: log in, controleer dat de banner bovenaan staat met de exacte introcopy, dat `Bestuur` en de suitecards niet op de landing staan, en dat titel/menu-/topnavigatie ongewijzigd werken.

## Verification evidence
- PASS — `cd frontend && npm test -- src/app/App.test.tsx` → 1 test file passed, 55 tests passed.
- PASS — `cd frontend && npm run build` → TypeScript build en Vite production build succeeded.
- PASS — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload` → 1 passed.
- PARTIAL/KNOWN unrelated failure — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py` → 23 passed, 1 failed: existing `test_login_token_expiry_aligns_with_cookie_ttl_by_default` mismatch (`Max-Age=2592000`, token TTL circa 43199s). The targeted About/changelog test in the same file passed.

---

Status: completed  
Owner: optional  
Date: 2026-06-09
