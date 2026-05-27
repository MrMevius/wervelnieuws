# Title
Vergaderborden hoofdmenu onthoudt laatste bord + paginatitel toont bordnaam

## Context
De bestaande hoofdmenu-link **Vergaderborden** opent nu de generieke route. Daardoor komt een gebruiker niet automatisch terug bij het laatst gebruikte vergaderbord. Daarnaast toont de Vergaderborden-pagina nog de generieke koptekst:
- titel: `Vergaderborden`
- subtitel: `Projecten en kaarten overzichtelijk beheren per fase.`

Goedgekeurde follow-up vraagt dat de navigatie “terug naar laatst gekozen bord” werkt in dezelfde browser, met robuuste fallback wanneer de selectie ontbreekt of ongeldig is. Ook moet de paginakop contextueel worden: alleen de naam van het geopende vergaderbord.

## Goals / Non-goals
### Goals
- Heropen de bestaande spec voor een gerichte follow-up op Vergaderborden-navigatie.
- Sla in de browser de **laatst gekozen geldige project-id** op zodra een geldig project wordt geopend of gekozen.
- Laat hoofdmenu-link/titel **Vergaderborden** navigeren naar het laatst geselecteerde project via `/vergaderborden?project=<id>`.
- Behoud fallback naar **Algemeen** (indien aanwezig) of anders eerste geldige project wanneer geen geldige laatste selectie bestaat.
- Vervang de paginakop op Vergaderborden door uitsluitend de titel/naam van het geopende vergaderbord (h1).
- Verwijder de generieke subtiteltekst op deze pagina.
- Behoud bestaande werking van projectdropdown-links, bordkaartjes, drag-drop en detailgedrag.
- Werk tests, About/changelog en deze spec bij voor de follow-up.

### Non-goals
- Geen server-side gebruikersvoorkeuren.
- Geen account-brede opslag/synchronisatie van voorkeuren.
- Geen nieuwe backend/API-eindpunten.
- Geen nieuwe routes of slug-architectuur.
- Geen opslag van kaartfilters, kolomstatus of andere bord-UI-state buiten projectselectie.
- Geen wijzigingen aan kaartinhoud of board business logica.

## Proposed approach
1. Gebruik browseropslag (localStorage) voor een sleutel met de laatst geopende **geldige** project-id voor Vergaderborden.
2. Werk opslag alleen bij wanneer project-id valide is tegen de actuele projectlijst.
3. Laat hoofdmenu-item **Vergaderborden** resolveren naar `/vergaderborden?project=<id>` op basis van opgeslagen geldige selectie.
4. Als opgeslagen selectie ontbreekt/ongeldig is: gebruik bestaande fallbackvolgorde (**Algemeen** indien beschikbaar, anders eerste geldige project).
5. Laat `VergaderbordenPage` paginakop renderen als enkel h1 met de naam van het geopende bord/project.
6. Verwijder de generieke subtitelregel volledig uit de Vergaderborden-header.
7. Houd bestaande navigatie- en bordinteractiegedrag ongewijzigd buiten bovengenoemde aanpassingen.

## Implementation steps (ordered)
1. Inventariseer huidige projectselectiebron in `AppShell` en `VergaderbordenPage`, inclusief bestaande fallbacklogica (Algemeen/eerste project).
2. Definieer één consistente localStorage-sleutel voor “laatst gekozen vergaderbordproject” en documenteer validatieregels.
3. Implementeer in Vergaderborden-flow: schrijf project-id alleen naar localStorage wanneer deze voorkomt in de actuele projectlijst.
4. Pas hoofdmenu-link/titel **Vergaderborden** aan zodat navigatie de laatst opgeslagen geldige project-id gebruikt (`/vergaderborden?project=<id>`).
5. Implementeer fallbackpad voor ontbrekende/ongeldige opgeslagen waarde naar Algemeen/eerste project, zonder regressie op bestaand gedrag.
6. Pas Vergaderborden-header aan: h1 = naam geopend bord; verwijder generieke subtiteltekst.
7. Werk tests bij in `App.test.tsx` en `VergaderbordenPage.test.tsx` voor laatste-selectie-navigatie, opslagvalidatie, fallback en headerweergave.
8. Werk About/changelog-entry bij met expliciete melding “terug naar laatst gekozen vergaderbord” en “paginatitel toont bordnaam”.
9. Werk specstatus en verificatiesecties bij op basis van testuitkomsten na implementatie.

## Acceptance criteria
1. Klik op hoofdmenu-titel/link **Vergaderborden** opent het laatst geselecteerde geldige vergaderbord via `/vergaderborden?project=<id>`.
2. De laatste geldige selectie blijft na refresh en nieuwe browsersessie beschikbaar in dezelfde browser.
3. Bij ontbrekende of ongeldige opgeslagen selectie blijft fallback naar **Algemeen** (of eerste geldige project) werken.
4. De Vergaderborden-pagina toont als h1 uitsluitend de naam van het geopende vergaderbord.
5. De generieke subtiteltekst (`Projecten en kaarten overzichtelijk beheren per fase.`) wordt niet meer getoond.
6. Bestaande projectdropdown-links, bordkaartjes, drag-drop en detailgedrag blijven werken.

## Testing plan
- Breid AppShell tests uit voor hoofdmenu-navigatie naar laatst geselecteerd project en fallback bij ontbrekende/ongeldige localStorage-waarde:
  - `src/app/App.test.tsx`
- Pas VergaderbordenPage tests aan voor opslag van geldige selectie en headerweergave (h1=projectnaam, geen generieke subtitel):
  - `src/app/features/admin/VergaderbordenPage.test.tsx`
- Run minimaal in `frontend/`:
  - `npm test -- src/app/App.test.tsx src/app/features/admin/VergaderbordenPage.test.tsx`
  - `npm run build`

## Risk + rollback plan
### Risico's
- localStorage bevat verouderde project-id (bijv. verwijderd project), wat foutieve navigatie kan veroorzaken.
- Regressie in hoofdmenu-navigatie als localStorage-resolutie niet consistent wordt toegepast.
- Headerwijziging kan tests/UI breken als andere componenten nog op generieke titel/subtitel vertrouwen.
- Regressie in bestaande bordinteracties door aanpassing van selectie-initialisatie.

### Mitigatie
- Valideer opgeslagen project-id altijd tegen actuele projectlijst vóór navigatie/rendering.
- Gebruik consistente fallback naar Algemeen/eerste project wanneer validatie faalt.
- Dek fallback en header-output expliciet af met gerichte unit/integratietests.

### Rollback
- Zet hoofdmenu-link **Vergaderborden** terug naar statische route `/vergaderborden`.
- Verwijder of negeer localStorage-gebruik voor laatst gekozen project.
- Herstel generieke paginatitel/subtitel in Vergaderborden-header.
- Herstel tests naar pre-follow-up verwachtingen.

## Notes / links
- Relevante componenten:
  - `src/app/App.tsx` / app-shell topnav (exacte bestandsnaam volgens repo)
  - `src/app/features/admin/VergaderbordenPage.tsx`
- Relevante tests:
  - `src/app/App.test.tsx`
  - `src/app/features/admin/VergaderbordenPage.test.tsx`
- Docs-impact:
  - About/changelog/spec bijwerken met melding “terug naar laatst gekozen vergaderbord” en “paginatitel toont bordnaam”.

## Current status
Completed

## What changed
- `VergaderbordenPage` slaat nu de laatst geopende **geldige** project-id op in `localStorage` via sleutel `vergaderborden:last-valid-project-id`.
- Opslag wordt alleen bijgewerkt na validatie tegen actuele `boardProjects`; ongeldige query/project-id valt terug op Algemeen of eerste project.
- Topnav-link **Vergaderborden** resolveert nu naar `/vergaderborden?project=<id>` met voorkeur voor opgeslagen geldige selectie; bij ontbrekende/ongeldige opslag geldt fallback Algemeen/eerste project.
- Header op Vergaderborden toont nu alleen de geopende projectnaam als `h1`; generieke subtitel is verwijderd.
- Gerichte tests bijgewerkt/uitgebreid in `App.test.tsx` en `VergaderbordenPage.test.tsx` voor opslag, validatie, fallback en header-output.
- About/changelog uitgebreid met iteratie 39 over “terug naar laatst gekozen vergaderbord” en contextuele bordtitel.

## How to verify
1. In `frontend/`, run:
   - `npm test -- src/app/App.test.tsx src/app/features/admin/VergaderbordenPage.test.tsx`
   - `npm run build`
2. Controleer handmatig:
   - hoofdmenu-link **Vergaderborden** opent laatst gekozen geldig project
   - laatste selectie blijft behouden na refresh en nieuwe browsersessie (zelfde browser)
   - ongeldige of ontbrekende opslagwaarde valt terug op Algemeen/eerste project
   - Vergaderborden h1 toont alleen projectnaam
   - generieke subtitel is afwezig
   - projectdropdown-links, bordkaartjes, drag-drop en detailgedrag werken ongewijzigd

## Verification evidence
- `npm test -- src/app/App.test.tsx src/app/features/admin/VergaderbordenPage.test.tsx` ✅
  - Resultaat: 2 testbestanden geslaagd, 58 tests geslaagd.
- `npm run build` ⚠️➡️✅
  - Eerste run faalde op TypeScript (`BoardProjectDetail` heeft `project_name`, niet `project.name`) in `VergaderbordenPage.tsx`.
  - Na gerichte fix opnieuw uitgevoerd: build geslaagd (`tsc -b && vite build`).

---
Status: completed
Owner: n.v.t.
Date: 2026-05-27
