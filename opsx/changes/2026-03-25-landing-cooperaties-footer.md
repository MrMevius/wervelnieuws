# Title
Iteratie 26 - Landing visual fix, coöperatie-informatie en globale footer (WindWilly-casing)

## Context
Na de suite-rebrand bevat de WindWilly-landing bovenaan een wit/intens licht vlak in de hero, wat botst met de gewenste rustige visuele stijl. Daarnaast ontbreekt op de landing nog algemene context over de drie betrokken coöperaties. Ook is er nog geen consistente footer met copyrightregel.

## Goals / Non-goals
### Goals
- Hero op de landing theme-aware maken zodat het bovenste blok niet als hard wit vlak overkomt.
- Benaming in tab/navigatie waar relevant op WindWilly zetten i.p.v. Wervelnieuws.
- Landingspagina rustiger maken met bestuur-placeholders (poppetjes) i.p.v. uitgebreide coöperatietekst.
- Na inloggen standaard op de algemene suite-landing uitkomen.
- Wervelnieuws-subnavigatie weer als Wervelnieuws labelen (niet WindWilly).
- Schrijfwijze standaardiseren naar **WindWilly** (2x hoofdletter W) in zichtbare UI-teksten.
- Suite-overzicht-banner minder dominant en later in de pagina positioneren.
- Een subtiele globale footer toevoegen met de gekozen copy.
- Tests aanpassen waar relevant.
- About/changelog uitbreiden met deze iteratie in eindgebruikersvriendelijke taal.

### Non-goals
- Geen redesign van topnavigatie of routestructuur.
- Geen backend functionele wijzigingen buiten About/changelog content.
- Geen nieuwe CMS- of admin-editflow voor landingcontent.

## Proposed approach
1. Pas de landingcomponent aan in `frontend/src/app/shell/AppShell.tsx`:
   - Hero blijft semantisch `<header>` maar krijgt nieuwe class voor theme-aware styling.
   - Nieuwe coöperatiesectie met 3 info-cards onder bestaande feature-cards.
2. Voeg globale footer toe in de app-shell onder `<main className="page-content">`.
3. Werk styling uit in `frontend/src/styles.css` met tokens die in light/dark thema leesbaar blijven.
4. Werk bestaande frontend test(s) bij voor nieuwe content.
5. Voeg een website-changelogregel toe aan default About-content in backend (`backend/app/api/meta.py`).

## Implementation steps (ordered)
1. Nieuwe change spec opstellen (dit document).
2. Acceptance criteria valideren met gekozen UX-varianten.
3. Frontend markup aanpassen (hero + coöperatiecards + globale footer).
4. CSS toevoegen/aanpassen voor theme-aware hero, coöperatiegrid en footer.
5. Frontend tests actualiseren.
6. About default changelog uitbreiden met iteratie 26.
7. Relevante tests draaien.
8. Deze spec bijwerken met verificatie-evidence en status.
9. Kleine visuele finetune op verzoek: spacing/typografie landing + subtiele footer-afwerking.
10. Verwerk feedbackronde: header-label rename, hero-cascade fix en inhoudelijke coöperatieverrijking op basis van webbronnen.
11. Verwerk tweede feedbackronde: browsertabtitel op WindWilly en landing vereenvoudigen met bestuur-placeholders.
12. Verwerk derde feedbackronde: default login-landingsroute, herstel Wervelnieuws-label voor subdienst, en banner minder prominent/lager op de landing.
13. Verwerk vierde feedbackronde: standaardiseer merkcasing naar WindWilly in zichtbare labels/teksten.

## Acceptance criteria
1. Op de WindWilly-landing staat geen storend wit hero-blok meer; de hero is visueel consistent in light en dark mode.
2. WindWilly is de zichtbare suiteschrijfwijze voor de algemene omgeving (inclusief browsertitel).
3. Onder de functionaliteitskaarten staat een rustige sectie met drie bestuur-placeholders (poppetjes) zonder uitgebreid coöperatieverhaal.
4. De app toont een subtiele globale footer met exact:
   - `© 2026 WindWilly · Vibecoded by BJ & MR`
5. Na inloggen landt de gebruiker standaard op de algemene WindWilly-landing (suite-overzicht).
6. De subdienst blijft in de navigatie als `Wervelnieuws` herkenbaar.
7. Zichtbare UI-teksten gebruiken consequent `WindWilly` (2x hoofdletter W).
8. Bestaande/gerichte frontend tests dekken de nieuwe zichtbare teksten.
9. About default changelog bevat een nieuwe eindgebruikersvriendelijke iteratie-entry voor deze wijziging.

## Testing plan
- Frontend: gerichte Vitest run op `src/app/App.test.tsx`.
- Backend: gerichte pytest run op `backend/tests/test_meta_and_me.py` (voor default about/changelog regressie).

## Risk + rollback plan
### Risico's
- Contrast in dark mode kan te laag zijn bij nieuwe hero/fallback-kleuren.
- Extra landingcontent kan op mobiel te lang worden zonder duidelijke spacing.

### Rollback
- Frontend rollback: revert van `AppShell.tsx` en `styles.css` wijzigingen.
- Backend rollback: verwijder iteratie 26 changelog-entry in `_default_about`.

## Notes / links
- Input userkeuzes (MC):
  - Nieuwe spec
  - Theme-aware hero
  - 3 info-cards
  - Subtiele globale footer
  - Footer copy: `© 2026 WindWilly · Vibecoded by BJ & MR`
- Externe bronnen voor aangescherpte coöperatie-tekst:
  - https://www.energiekdaarle.nl
  - https://duurzaamdaarlerveen.nl
  - https://noaber.co/groene-noabers-opgericht/
- Tweede feedback van gebruiker:
  - Browsertab mocht geen "Wervelnieuws" meer tonen.
  - Landing moest rustiger: alleen bestuur-placeholders.

## Current status
Completed (met gedocumenteerde lokale backend test-blocker)

## What changed
- `frontend/src/app/shell/AppShell.tsx`
  - Theme-aware landing hero toegepast via extra class `windwilly-hero`.
  - Nieuwe sectie **Betrokken coöperaties** toegevoegd met 3 info-cards:
    - Energiek Daarle
    - Duurzaam Daarlerveen
    - Noaber & Co
  - Globale app-footer toegevoegd met exacte copy:
    - `© 2026 WindWilly · Vibecoded by BJ & MR`
  - Feedbackronde verwerkt:
    - header-label aangepast van `Wervelnieuws` naar `WindWilly`;
    - coöperatie-teksten verrijkt met specifiekere publieke info;
    - per coöperatie een bronlink toegevoegd.
  - Tweede feedbackronde verwerkt:
    - aria-labels voor suitegroep/dropdown aangepast naar WindWilly;
    - coöperatieverhaal vervangen door rustige bestuur-sectie met 3 poppetjes-placeholders.
  - Derde feedbackronde verwerkt:
    - login-success route navigeert nu naar de algemene landing (`WINDWILLY_PATHS.landing`),
    - subdienstlabel hersteld naar `Wervelnieuws` incl. dropdown aria-labels,
    - suite-overzicht-banner onder de modulekaarten geplaatst met compactere tekst.
  - Vierde feedbackronde verwerkt:
    - zichtbare merknaamteksten gestandaardiseerd naar `WindWilly` (o.a. login-eyebrow, landing-aria-labels, landingtitel en footercopy).
  - Vijfde feedbackronde verwerkt:
    - 2x hoofdletter-W standaard verder doorgetrokken in docs/specgerelateerde teksten.
- `frontend/index.html`
  - Browsertitel aangepast van `Wervelnieuws` naar `WindWilly`.
- `backend/app/api/meta.py`
  - About/changelogteksten met suiteschrijfwijze gestandaardiseerd naar `WindWilly`.
- `opsx/changes/2026-03-24-iteratie-13-windwilly-suite-rebrand-shell.md`
  - Historische spectekst geharmoniseerd naar `WindWilly` (zonder route-slugs te wijzigen).
- `opsx/changes/2026-03-24-iteratie-15-trello-placeholder.md`
  - WindWilly-casing in suite/landing-tekst geharmoniseerd.
- `ITERATIONS.md`
  - Referentie naar suite-naam geharmoniseerd naar `WindWilly`.
- `frontend/src/styles.css`
  - Nieuwe CSS-variabelen toegevoegd voor landing hero (light/dark).
  - `app-shell` uitgebreid naar drie rijen (`topbar`, `content`, `footer`).
  - Nieuwe stijlen toegevoegd voor `app-footer`, `windwilly-hero`, `cooperatives-section`, `cooperative-grid` en `cooperative-card`.
  - Responsive gedrag uitgebreid zodat coöperatiegrid op small screens naar 1 kolom gaat.
  - Visuele finetune op verzoek doorgevoerd:
    - subtiele footer-achtergrond, verfijnde padding en typografie,
    - betere regelhoogte en leesbreedte in coöperatiesectie,
    - aangescherpte kaarttypografie desktop + mobiel.
  - Hero-cascade fix: selector aangescherpt naar `.main-hero.windwilly-hero`, zodat de lichte fallback-stijl van `.main-hero` niet meer over de landing-hero heen schrijft.
  - Bestuur-placeholders styling toegevoegd (`board-placeholder-grid`, `board-member-card`, `member-avatar`) en oudere tekstzware coöperatiestyling teruggebracht.
  - Bannerintegratie verfijnd via `.suite-overview-banner` (compactere spacing/typografie, rustiger visueel gewicht).
- `frontend/src/app/App.test.tsx`
  - Landingtest uitgebreid met asserts voor:
    - sectiekop "Betrokken coöperaties"
    - drie coöperatienamen
    - globale footertekst
  - Header/dropdown tests aangepast op nieuwe zichtbare labelnaam `WindWilly`.
  - Landing assertions aangepast naar bestuur-placeholders in plaats van coöperatienamen.
  - Derde feedbackronde verwerkt:
    - dropdown-selectors terug op `Wervelnieuws`,
    - login helper accepteert landing of workflow voor route-specifieke tests,
    - main-gerelateerde test navigeert expliciet naar `Main` vanuit landing.
- `backend/app/api/meta.py`
  - Default About/changelog uitgebreid met iteratie **26** in eindgebruikersvriendelijke taal.

## How to verify
1. Frontend landing + regressie:
   - `cd frontend && npm test -- src/app/App.test.tsx`
2. Backend default about/changelog regressie:
   - `cd backend && pytest tests/test_meta_and_me.py`
3. Handmatige UI-check:
   - Log in, klik op WindWilly-logo (landing).
   - Controleer hero zonder hard wit vlak in light én dark mode.
   - Controleer coöperatiecards en footertekst.

## Verification evidence
- ✅ Frontend test geslaagd:
  - Commando: `npm test -- src/app/App.test.tsx`
  - Resultaat: `1 passed`, `39 passed (39)`
- ✅ Frontend test opnieuw geslaagd na visuele finetune:
  - Commando: `npm test -- src/app/App.test.tsx`
  - Resultaat: `1 passed`, `39 passed (39)`
- ✅ Frontend test geslaagd na feedbackronde (header rename + hero fix + bronverrijking):
  - Commando: `npm test -- src/app/App.test.tsx`
  - Resultaat: `1 passed`, `39 passed (39)`
- ✅ Frontend test geslaagd na tweede feedbackronde (browsertitel + rustige placeholders):
  - Commando: `npm test -- src/app/App.test.tsx`
  - Resultaat: `1 passed`, `39 passed (39)`
- ✅ Frontend test geslaagd na derde feedbackronde (login landing + subdienstlabel + bannerpositie):
  - Commando: `npm test -- src/app/App.test.tsx`
  - Resultaat: `1 passed`, `39 passed (39)`
- ✅ Frontend test geslaagd na vierde feedbackronde (WindWilly-casing):
  - Commando: `npm test -- src/app/App.test.tsx`
  - Resultaat: `1 passed`, `39 passed (39)`
- ✅ Repo-brede controles op resterende tekstuele casing:
  - Controle: grep op legacy WindWilly-varianten in `*.{md,py,tsx,ts,html}`
  - Resultaat: geen matches
- ⚠️ Backend test in deze omgeving geblokkeerd:
  - Commando: `pytest tests/test_meta_and_me.py`
  - Resultaat: `ModuleNotFoundError: No module named 'fastapi'`
  - Interpretatie: lokale backend testomgeving mist dependencies; wijziging in `meta.py` is wel doorgevoerd.
