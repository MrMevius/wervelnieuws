## Title
Iteratie 13 - Windwilly suite-shell met Wervelnieuws subdienst

## Context
Volgens `ITERATIONS.md` moet de applicatie evolueren van een losse Wervelnieuws-app naar een Windwilly-suite. Windwilly wordt het hoofddomein met een chatbot-achtige hoofddienst op `/`, terwijl Wervelnieuws als subdienst onder `/wervelnieuws` blijft draaien. Daarnaast moeten placeholders beschikbaar komen voor `urenverantwoording` en `participatiemomenten`. De gebruiker heeft bevestigd dat alle onderdelen achter dezelfde login moeten blijven vallen.

## Goals / Non-goals
### Goals
- Introduceer Windwilly-suite navigatie in de frontend.
- Maak een placeholder-hoofdpagina op `/` (chatbot-stijl).
- Zet Wervelnieuws-routes onder `/wervelnieuws/*`.
- Voeg placeholders toe voor `/urenverantwoording` en `/participatiemomenten`.
- Behoud gedeeld accountbeheer en login-gating voor alle suite-onderdelen.
- Zorg dat frontend routing ook bij directe URL-navigatie blijft werken in de container.

### Non-goals
- Geen implementatie van echte chatbotfunctionaliteit in iteratie 13.
- Geen functionele uitbreiding van urenverantwoording of participatiemomenten buiten placeholders.
- Geen backend API-hernoeming of domeinbrede migratie van interne namen naar Windwilly.
- Geen wijziging aan publicatieflows of n8n-logica uit iteratie 12.

## Proposed approach
1. Introduceer suite-routes in de bestaande React app met login-gating op app-niveau.
2. Prefix bestaande Wervelnieuws-paden met `/wervelnieuws` en voeg redirects toe vanaf oude paden.
3. Voeg placeholderpagina’s toe voor Windwilly Chatbot, Urenverantwoording en Participatiemomenten.
4. Werk topnavigatie en branding bij naar Windwilly met duidelijke module-links.
5. Voeg Nginx SPA fallback-configuratie toe aan frontend image voor deep links.
6. Update tests en About-changelog voor iteratie 13.

## Implementation steps (ordered)
1. Update `frontend/src/app/App.tsx` met suite-tabs en nieuwe route-structuur.
2. Verplaats bestaande routes (`main`, `planning`, `database`, `log`, `about`, `settings`, `admin`) naar `/wervelnieuws/*`.
3. Voeg placeholdercomponenten en route-definities toe voor `/`, `/urenverantwoording`, `/participatiemomenten`.
4. Voeg redirect-routes toe van legacy paden (bijv. `/main`) naar `/wervelnieuws/main`.
5. Configureer Nginx `try_files` fallback in frontend container.
6. Werk frontend tests en backend About/changelog entry bij.

## Acceptance criteria
- Ingelogde gebruiker ziet Windwilly-suite navigatie met modules: WindWilly, Wervelnieuws, Urenverantwoording, Participatiemomenten.
- Wervelnieuws-subnavigatie (`Main`, `Planning`, `Database`, `Log`, `About`) valt visueel onder de moduleknop `Wervelnieuws`.
- Modulelabel `Chatbot` is hernoemd naar `WindWilly`.
- Hoofdtabjes in de suite-navigatie hebben gelijke breedte.
- Wervelnieuws-subnavigatie is alleen zichtbaar wanneer de gebruiker zich in `/wervelnieuws/*` bevindt.
- Wervelnieuws-subnavigatie is op `/wervelnieuws/*` altijd zichtbaar (niet inklapbaar).
- Wervelnieuws-subnavigatie is een dropdown onder de hoofdknop en fade-in op hover/focus.
- Route `/wervelnieuws/main` (en andere Wervelnieuws-subroutes) werkt voor bestaande functionaliteit.
- Route `/` toont een algemene Windwilly-landingspagina met module-uitleg.
- Routes `/urenverantwoording` en `/participatiemomenten` tonen placeholders.
- Alle suite-routes blijven achter dezelfde login/auth-flow vallen.
- Accountnaam/user-menu staat rechtsboven in de topbar.
- Klik op het Windwilly-logo opent een algemene suite-landingspagina.
- Hoofdmenubalk is gefixeerd en kan bij omlaag scrollen uit beeld schuiven.
- Hoofdmenulayout blijft stabiel (geen verspringing tussen routes met/zonder Wervelnieuws-submenu).
- Menu-items blijven stabiel zonder verspringing tussen modulewissels.
- Legacy Wervelnieuws-routes redirecten naar de nieuwe `/wervelnieuws/*` paden.
- `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: routeprefix kan bestaande interne links breken.
  - Mitigatie: helperfunctie voor Wervelnieuws-padopbouw en regressietests op navigatie.
- Risico: deep-link refresh geeft 404 zonder server fallback.
  - Mitigatie: Nginx `try_files` configureren naar `index.html`.
- Rollback:
  - suite-routes terugdraaien naar oude route-structuur,
  - placeholderpagina’s verwijderen,
  - Nginx-config terugzetten naar vorige image-opzet.

## Notes / links
- Bron: `ITERATIONS.md` Iteratie #13.
- Confirmatie gebruiker: Windwilly hoofddienst op `/`, Wervelnieuws onder `/wervelnieuws`, login verplicht.

## Current status
Completed

## What changed
- Frontend suite-shell en route-structuur bijgewerkt in `frontend/src/app/App.tsx`:
  - Branding gewijzigd naar **Windwilly** in topbar en login.
  - Nieuwe suite-navigatie toegevoegd: **Chatbot**, **Wervelnieuws**, **Urenverantwoording**, **Participatiemomenten**.
  - Wervelnieuws-routes verplaatst naar `/wervelnieuws/*` via centrale `WERVEL_PATHS` constants.
  - Placeholderpagina toegevoegd op `/` voor de Windwilly Chatbot.
  - Placeholderroutes toegevoegd voor `/urenverantwoording` en `/participatiemomenten`.
  - Legacy redirects toegevoegd vanaf `/main`, `/planning`, `/database`, `/log`, `/about`, `/settings`, `/admin`, `/admin/scheduler`.
  - Legacy detailroute `/planning/:topicId` redirectt nu naar `/wervelnieuws/planning/:topicId` met behoud van `topicId`.
- Interne Wervelnieuws-links en navigatieacties aangepast naar het nieuwe `/wervelnieuws` routeprefix (bijv. main CTA’s en planning detail terugknoppen).
- Frontend container aangepast voor SPA deep-linking:
  - Nieuw bestand `frontend/nginx.conf` met `try_files $uri $uri/ /index.html;`.
  - `frontend/Dockerfile` kopieert nu de custom Nginx-config naar `/etc/nginx/conf.d/default.conf`.
- About/changelog bijgewerkt met een eindgebruikersvriendelijke iteratie-entry:
  - `backend/app/api/meta.py` bevat nu iteratie `22` met uitleg over de Windwilly-suite start en subdienst-routing.
- Frontend tests uitgebreid/aangepast in `frontend/src/app/App.test.tsx`:
  - Nieuwe test op suite-modules en chatbot-placeholder na login.
  - Nieuwe test op redirect van legacy `/main` naar Wervelnieuws-main flow.
  - Bestaande Main-pagina test aangepast om expliciet naar `Main` te navigeren vanuit de nieuwe `/` chatbot-startpagina.
- Feedbackronde verwerkt voor topnavigatie en accountpositie:
  - `frontend/src/app/App.tsx`: Wervelnieuws-subnavigatie (`Main`, `Planning`, `Database`, `Log`, `About`) nu gegroepeerd onder de module `Wervelnieuws` in de hoofdnavigatie (geen losse tweede tabrij meer).
  - `frontend/src/styles.css`: nieuwe stijlen voor geneste Wervelnieuws-subtabs onder de knop, en `user-menu-wrap` expliciet rechts uitgelijnd (`justify-self: end`) zodat accountnaam weer rechtsboven staat.
- Tweede feedbackronde verwerkt voor labels, zichtbaarheid en landing:
  - `frontend/src/app/App.tsx`:
    - Tab `Chatbot` hernoemd naar `WindWilly` en route op `/windwilly`.
    - Nieuwe algemene landingspagina op `/` toegevoegd (`WindwillyLandingPage`).
    - Logo `Windwilly` is klikbaar en linkt naar de landingspagina.
    - Login navigeert na succes naar `/wervelnieuws/main` zodat Wervelnieuws direct geopend is.
    - Wervelnieuws-subtabs worden conditioneel getoond op basis van route (`/wervelnieuws/*`).
  - `frontend/src/styles.css`:
    - Hoofdnavigatie (`.suite-tabs`) omgezet naar 4 gelijke kolommen voor even brede tabjes.
    - Responsieve variant toegevoegd (2 kolommen op small screens).
  - `frontend/src/app/App.test.tsx`:
    - Suite-labeltest aangepast naar `WindWilly`.
    - Nieuwe test toegevoegd voor klik op logo -> landingspagina.
    - Gevalideerd dat Wervelnieuws-subtabs op landing niet zichtbaar zijn.
- Derde feedbackronde verwerkt voor compacte collapsible submenu-UX:
  - `frontend/src/app/App.tsx`:
    - `wervelSubnavExpanded` state toegevoegd.
    - Toggleknop (`▴/▾`) toegevoegd bij `Wervelnieuws` om subtabs in/uit te klappen.
    - Subtabs blijven alleen beschikbaar op `/wervelnieuws/*`, maar zijn nu door gebruiker compact te verbergen.
  - `frontend/src/styles.css`:
    - Stijlen toegevoegd voor `suite-group-header` en `wervel-subnav-toggle`.
  - `frontend/src/app/App.test.tsx`:
    - Nieuwe test toegevoegd die valideert dat subtabs inklapbaar zijn op Wervelnieuws-routes.
- Vierde feedbackronde verwerkt voor geanimeerde submenu-UX:
  - `frontend/src/app/App.tsx`:
    - Wervelnieuws-subtabs blijven gemount op `/wervelnieuws/*` met state-classes (`is-expanded` / `is-collapsed`) voor vloeiende overgang.
    - `aria-hidden` toegepast in ingeklapte toestand zodat submenu-links niet in de toegankelijkheidsboom blijven staan.
  - `frontend/src/styles.css`:
    - Zachte transities toegevoegd op `max-height`, `opacity` en `transform` voor uit-/inklappen.
    - `prefers-reduced-motion` gerespecteerd door animaties uit te schakelen voor gebruikers die minder beweging wensen.
- Vijfde feedbackronde verwerkt voor content, vaste navigatiebreedte en topbar-gedrag:
  - `frontend/src/app/App.tsx`:
    - Algemene landingspagina op `/` inhoudelijk uitgebreid met suite-intro en modulekaarten.
    - Wervelnieuws-subtabs niet meer inklapbaar; op `/wervelnieuws/*` altijd zichtbaar.
    - Topbar-gedrag toegevoegd: gefixeerd aan bovenkant, en bij neerwaarts scrollen tijdelijk uit beeld (`is-hidden`).
  - `frontend/src/styles.css`:
    - Hoofdnavigatie (`.suite-tabs`) begrensd met vaste maximale breedte i.p.v. over de volledige beschikbare breedte.
    - Topbar omgezet naar `position: fixed` met hide-on-scroll transitie.
    - `page-content` top-padding verhoogd zodat content onder de gefixeerde menubalk blijft.
  - `frontend/src/app/App.test.tsx`:
    - Landingspaginatest aangepast op nieuwe heading/content.
    - Submenu-test aangepast naar altijd zichtbaar op Wervelnieuws-routes.
- Zesde feedbackronde verwerkt voor uitlijning, submenubalk en stabiele menulayout:
  - `frontend/src/app/App.tsx`:
    - Hoofdmenu vereenvoudigd naar vier primaire tabs.
    - Wervelnieuws-submenu verplaatst naar een aparte submenubalk onder de hoofdknoppen.
    - Submenubalk blijft altijd in de topbar-structuur aanwezig met placeholder op niet-Wervelnieuws-routes, om verspringing te voorkomen.
  - `frontend/src/styles.css`:
    - Logo expliciet links uitgelijnd (`grid-column: 1; justify-self: start`).
    - Gebruikersmenu expliciet rechts uitgelijnd (`grid-column: 3; justify-self: end`).
    - Topbar als 2-rijige vaste layout met hoofdmenu in rij 1 en Wervelnieuws-submenubalk in rij 2.
    - Content-toppadding verhoogd zodat pagina-inhoud niet onder de gefixeerde topbar valt.
    - Submenubalk horizontaal naast elkaar met `nowrap` en eventuele horizontale scroll bij krappe breedte.
- Zevende feedbackronde verwerkt voor mobiele swipe-hint en verdere stabilisatie zonder verspringing:
  - `frontend/src/app/App.tsx`:
    - Wervelnieuws-submenulinks altijd in DOM gehouden binnen de submenubalk; zichtbaarheid nu via `aria-hidden` + CSS-visibility i.p.v. conditionele render.
    - Mobiele hinttekst toegevoegd: `Veeg horizontaal voor meer`.
  - `frontend/src/styles.css`:
    - Submenubalk desktop op vaste, stabiele layout (`overflow-x: hidden`, `justify-content: flex-start`) om shifts tussen modules te voorkomen.
    - Mobiel horizontaal scrollen behouden met verborgen scrollbar en zichtbare swipe-hint.
    - Verborgen toestanden gebruiken `visibility` (geen layout-collaps) zodat hoofdmenu en submenubalk niet verspringen.
- Achtste feedbackronde verwerkt voor overlap-fix en hover-dropdown:
  - `frontend/src/app/App.tsx`:
    - Wervelnieuws-submenu omgezet naar dropdown onder de hoofdknop `Wervelnieuws`.
    - Dropdown opent op hover/focus en blijft zichtbaar op Wervelnieuws-routes; sluit weer buiten hover/focus.
    - `aria-hidden` op dropdown afgestemd op zichtbaarheid.
  - `frontend/src/styles.css`:
    - Topbar teruggebracht naar één stabiele hoofdregel (logo links, hoofdtabs gecentreerd, user rechts).
    - Dropdown absoluut gepositioneerd met fade-in transitie (`opacity` + `transform`) zodat de paginaflow niet verschuift.
    - `page-content` top-padding aangepast om overlap van content onder menu/submenu te voorkomen.
    - Mobiele dropdown blijft bruikbaar met horizontale scroll binnen het dropdown-paneel indien nodig.
  - `frontend/src/app/App.test.tsx`:
    - Submenu-test aangepast naar hovergedrag vanuit een niet-Wervelnieuws route.
- Negende feedbackronde verwerkt voor soepelere hover-overgang:
  - `frontend/src/app/App.tsx`:
    - Sluitvertraging van ~120ms toegevoegd bij `mouseleave`/`blur` voor het Wervelnieuws-dropdownmenu.
    - Openen van dropdown annuleert eventuele pending sluit-timer om flikkeren te voorkomen.
    - Cleanup toegevoegd voor timeout bij unmount.
- Tiende feedbackronde verwerkt voor uitfade op Wervelnieuws-routes + top-offset:
  - `frontend/src/app/App.tsx`:
    - Dropdown zichtbaarheid aangepast zodat deze niet permanent open blijft op `/wervelnieuws/*`; submenu fade-out werkt nu weer bij mouse leave, ook op Wervelnieuws-pagina's.
  - `frontend/src/styles.css`:
    - `page-content` top-padding verhoogd (desktop + mobiel) zodat pagina-inhoud niet achter de vaste hoofdmenubalk valt.
  - `frontend/src/app/App.test.tsx`:
    - Navigatie-tests aangepast naar helper-gedreven hover/open gedrag voor submenu-items (Planning/Database/Log/About).
    - Login helper generieker gemaakt voor admin/non-admin gebruikersnaam in heading.
- Elfde feedbackronde verwerkt voor overlap op brede schermen:
  - `frontend/src/styles.css`:
    - In de `@media (min-width: 1600px)` layout is `page-content` top-padding verhoogd naar `128px` zodat content ook op grote schermbreedtes onder de vaste menubalk start.
- Twaalfde feedbackronde verwerkt voor compactere topbar + windmolenlogo:
  - `frontend/src/app/App.tsx`:
    - Tekstlogo `Windwilly` in de topbar vervangen door een klikbaar windmolen-SVG (landing-link behouden).
    - Visueel verborgen tekstlabel toegevoegd voor toegankelijkheid (`sr-only`).
  - `frontend/src/styles.css`:
    - Hoofdmenubalk compacter gemaakt (kleinere topbar padding en kleinere tab-padding).
    - User knop en avatar iets compacter gemaakt zodat totale menubalkhoogte afneemt.
    - Nieuwe stijlen toegevoegd voor het windmolenlogo (`.windmill-logo`) en utility class `.sr-only`.

## How to verify
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `cd frontend && npm test -- --run` -> geslaagd (`36 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite productiebuild afgerond).
- Na feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`36 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na tweede feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`37 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na derde feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na vierde feedbackaanpassing (animatie) opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na vijfde feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na zesde feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na zevende feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na achtste feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na negende feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na tiende feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na elfde feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
- Na twaalfde feedbackaanpassing opnieuw uitgevoerd:
  - `cd frontend && npm test -- --run` -> geslaagd (`38 passed`).
  - `cd frontend && npm run build` -> geslaagd.
