# Title
WindWilly homepage herindeling

## Context
De huidige WindWilly-homepage voelt te leeg en te statisch aan. Voor nieuwe en terugkerende gebruikers is niet meteen duidelijk wat WindWilly is, waar zij moeten starten en wat op dat moment relevant is. Ook voelt de huidige CTA `Bekijk changelog` te technisch en te intern voor een landingspagina.

Deze change richt zich op de homepage-ervaring: een helderdere maar nadrukkelijk rustige startpagina die past bij de bestaande WindWilly-branding.

Na de eerste uitwerking is de scope bewust versmald: de homepage moet niet als uitgebreid portaal aanvoelen, maar als een minimale, representatieve landingspagina met alleen de kernblokken hero, intro en samenwerkende coöperaties.

## Goals / Non-goals
### Goals
- Geef de homepage een sterkere hero met duidelijke waardepropositie.
- Voeg twee primaire, gebruikersvriendelijke CTA's toe.
- Leg kort uit wat WindWilly is en welke coöperaties samenwerken.
- Houd de homepage-inhoud beperkt tot de drie kernblokken: hero, intro en samenwerkende coöperaties.
- Verwijder extra portaal-/dashboardblokken van de homepage zodat de ervaring rustiger wordt.
- Houd footer en overige shell-onderdelen ondersteunend en sober.
- Verfijn navigatie- en presentatie-details die direct relevant zijn voor de homepage UX en visuele rust.
- Verfijn CTA-copy, hero-copy en styling zodat de homepage natuurlijker, compacter en rustiger aanvoelt.
- Corrigeer de hero-uitlijning zodat het bovenste vlak exact dezelfde linker containerlijn volgt als de blokken eronder.
- Trek het bovenste vlak qua stijl/opmaak gelijk aan de onderste kaarten, inclusief het verwijderen van de decoratieve hero-illustratie/gradient.
- Positioneer de homepagecopy inhoudelijk rond de drie kernmodules: WindWilly, Wervelnieuws en Vergaderborden.
- Verwijder de losse footer-linkjes onderaan de pagina.
- Maak de landingspagina inhoudelijk en visueel compacter door kortere copy en strakkere spacing.
- Verwijder de twee hero-CTA-knoppen, het introblok en de extra ondersteunende footerzin voor een nog soberdere landingspagina.
- Houd de visuele stijl consistent met de huidige WindWilly-branding.
- Voeg, indien de repo-regels dat vereisen, een gebruikersvriendelijke website changelog/About-entry toe.

### Non-goals
- Geen redesign van de volledige productarchitectuur.
- Geen backend feature-uitbreiding buiten wat nodig is om homepage-inhoud te renderen.
- Geen diepgaande redesign van contentbeheer of publicatieworkflows.
- Geen module-specifieke UX-wijzigingen buiten de homepage-ingang/landingcontext.
- Geen module-overzicht, actuele updatessectie of extra trust/transparency-sectie op de homepage in deze iteratie.
- Geen decoratieve hero-visual of afwijkende hero-kaartstijl in deze iteratie.
- Geen uitbreiding van inhoud; compacter maken gebeurt binnen dezelfde drie homepageblokken.
- Geen CTA-knoppen of extra introkaart op de landingspagina in deze iteratie.
- Geen algemene rebranding van andere pagina's tenzij noodzakelijk voor consistente home presentatie.

## Proposed approach
1. Analyseer de huidige homepagecomponent en navigatiestructuur.
2. Herontwerp de bovenkant van de pagina als duidelijke hero met:
   - korte uitleg wat WindWilly is;
   - twee primaire CTA's met duidelijke taakgerichtheid;
   - consistente visuele hiërarchie.
3. Voeg een introductiesectie toe met context over WindWilly en de samenwerkende coöperaties.
4. Behoud daarnaast alleen een compact blok voor samenwerkende coöperaties als tweede inhoudslaag.
5. Verwijder of vereenvoudig extra homepageblokken die de pagina druk of dashboard-achtig maken.
6. Houd footer en shell rustig en ondersteunend, zonder extra homepage-secties toe te voegen.
7. Pas labels en microcopy aan waar nodig zodat de homepage-ervaring niet meer op interne jargon-termen leunt.
8. Polijst CTA-teksten, hero-teksten en opmaak (hoogte, knopstijl, tekstbreedte, schaduw/border, footer-rust) zonder de scope uit te breiden.
9. Trek de hero-kaart visueel gelijk aan de onderste kaarten en verwijder decoratieve illustratie/gradient die niet bij de rustige kaartstijl past.
10. Verwerk duidelijke, korte copy die uitlegt dat:
   - WindWilly de online vraagbaak à la ChatGPT is voor vragen over de windprojecten;
   - Wervelnieuws de geautomatiseerde nieuwsvoorziening naar buiten is;
   - Vergaderborden alle openstaande acties rond de verschillende trajecten bevat.
11. Verwijder de losse footer-linkjes onderaan de pagina.
12. Verkort copy in hero, intro en samenwerking waar mogelijk zonder de kernboodschap te verliezen.
13. Verklein verticale padding, tussenruimtes en waar passend kop-/knopmaten zodat de pagina zichtbaar compacter wordt.
14. Verwijder de hero-CTA-knoppen en het aparte introblok zodat alleen de kerninhoud overblijft.
15. Verwijder de ondersteunende footerzin en laat alleen de minimale footer-meta over.
16. Werk tests en, indien van toepassing, About/changelog-inhoud bij.
17. Corrigeer container- en padding-uitlijning van de hero ten opzichte van het resterende coöperatieblok.

## Implementation steps (ordered)
1. Bevestig deze spec als actieve change spec.
2. Inspecteer de huidige homepage en noteer welke componenten en routes al bestaan.
3. Definieer de versmalde homepage-structuur: hero, intro, samenwerkende coöperaties.
4. Werk de homepage-markup en bijbehorende styling aan voor deze rustige contenthiërarchie.
5. Implementeer of hergebruik de twee primaire CTA's met gebruikersvriendelijke labels.
6. Verwijder module-overzicht, actuele/updates- en extra trust/transparency-blokken van de homepage.
7. Verfijn footer, navigatie-elementen en labelgebruik specifiek voor de homepage, met focus op rust.
8. Pas CTA-copy aan naar natuurlijkere labels zoals `Naar overzicht` en `Open planning`, en maak hero-copy compacter.
9. Verfijn styling van hero, knoppen, tekstbreedte, schaduw/borders, coöperatieblok en footer zonder nieuwe contentblokken toe te voegen.
10. Corrigeer de linkerrand/container-uitlijning van de hero zodat deze visueel gelijk loopt met de onderliggende blokken.
11. Trek de hero-kaart qua achtergrond, radius, rand en interne spacing gelijk aan intro en coöperatiekaart; verwijder decoratieve hero-illustratie/gradient.
12. Werk de homepagecopy bij zodat WindWilly, Wervelnieuws en Vergaderborden helder en compact worden gepositioneerd volgens de gebruikersomschrijving.
13. Verwijder de losse footer-linkjes onderaan de pagina.
14. Verkort de tekstinhoud en verminder hoogte/padding/spacings van de drie homepageblokken zodat de landingspagina een stuk compacter aanvoelt.
15. Verwijder de hero-CTA-knoppen, het introblok en de extra footerzin zodat de landingspagina soberder wordt.
16. Werk relevante frontendtests bij of voeg nieuwe tests toe voor content en navigatie.
17. Als de repo-rules dit vereisen, voeg een website changelog/About-entry toe in eindgebruikersvriendelijke taal.
18. Run gerichte verificatie en update deze spec met implementatie-evidence na uitvoering.

## Acceptance criteria
1. De homepage legt boven de vouw duidelijk uit wat WindWilly is en voor wie de pagina bedoeld is.
2. De homepage bevat geen hero-CTA-knoppen meer; de hero is puur informatief.
3. De homepage bevat na de hero alleen nog een blok voor samenwerkende coöperaties.
4. De homepage bevat geen extra dashboard-/portaalblokken zoals modules, actueel/updates of aanvullende trust-secties.
5. De homepage gebruikt geen technisch of intern label zoals `Bekijk changelog` als primaire publieke CTA, tenzij dat contextueel echt passend is.
6. De pagina oogt visueel rustiger dan de eerdere iteratie en blijft consistent met de bestaande WindWilly-branding en shell-stijl.
7. De primaire CTA gebruikt natuurlijkere taal (`Naar overzicht`) en de secundaire CTA blijft kort en duidelijk (`Open planning`) of equivalent goedgekeurde copy.
8. Hero-copy is compacter en de opmaak is zichtbaar verfijnd: minder hoge hero, rustigere knophiërarchie, smallere tekstregel en subtielere visuele accenten.
9. Het hero-vlak volgt links dezelfde containerlijn en visuele uitlijning als intro en samenwerkende coöperaties.
10. Het bovenste vlak gebruikt dezelfde rustige kaartstijl als de twee onderste blokken en bevat geen decoratieve hero-illustratie/gradient meer.
11. De homepagecopy maakt duidelijk dat WindWilly een online vraagbaak is, Wervelnieuws de geautomatiseerde nieuwsvoorziening is en Vergaderborden de openstaande acties per traject bundelt.
12. Het aparte introblok `Rustig startpunt` is verwijderd.
13. De ondersteunende footerzin is verwijderd.
14. De resterende homepage-inhoud is compacter geformuleerd en visueel duidelijk minder hoog dan de vorige iteratie.
15. De wijziging blijft beperkt tot homepage/landingcontext en brengt geen onbedoelde impact op andere modules of routes.
16. Relevante tests slagen en de geüpdatete homepage-UX wordt gecontroleerd via gerichte verificatie.
17. Als een website changelog/About-update vereist is, is die toegevoegd in eindgebruikersvriendelijke taal.

## Testing plan
- Gerichte frontend test/lint/typecheck op de homepage- en shell-bestanden die wijzigen.
- Verwachte commando's, afhankelijk van repo-setup:
  - `cd frontend && npm test`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run typecheck`
- Handmatige UI-check:
  1. Open de homepage.
  2. Controleer hero, CTA's en uitlegtekst boven de vouw.
  3. Controleer intro en coöperatieblok op rust, spacing en leesbaarheid.
  4. Controleer dat extra homepageblokken zijn verwijderd.
  5. Controleer mobiele responsive layout.
  6. Controleer dat jargon zoals `changelog` niet als primaire homepage-CTA domineert.

## Risk + rollback plan
### Risico's
- Te veel resterende visuele elementen kunnen de homepage nog steeds onrustig maken.
- Door het verwijderen van extra blokken kan de homepage minder directe navigatie bieden.
- Nieuwe layout kan inconsistent worden met bestaande shell/theming.
- CTA's kunnen routes openen die wel bestaan, maar inhoudelijk niet de verwachte instap bieden.

### Rollback
- Revert de homepagecomponenten, styling en eventuele bijbehorende testwijzigingen.
- Revert eventuele About/changelog-contentwijziging afzonderlijk.
- Herstel de eerdere uitgebreidere homepage-iteratie indien de versmalde variant te weinig richting geeft.

## Notes / links
- Gebruikersvraag: representatieve homepage herindeling voor WindWilly.
- Scope is bewust beperkt tot homepage/landingcontext.
- Scope-update 2026-06-11: homepage verder versmald naar alleen hero, intro en samenwerkende coöperaties.
- Scope-update 2026-06-11 (polish): CTA-copy, hero-copy en styling worden nog rustiger en natuurlijker gemaakt zonder extra content toe te voegen.
- Scope-update 2026-06-11 (layout): hero-uitlijning links wordt gelijkgetrokken met de onderliggende contentblokken.
- Scope-update 2026-06-11 (inhoud/stijl): hero-stijl wordt gelijkgetrokken met de onderste kaarten, homepagecopy wordt inhoudelijk aangescherpt rond WindWilly/Wervelnieuws/Vergaderborden en footer-linkjes worden verwijderd.
- Scope-update 2026-06-11 (compactheid): copy en spacing van de drie homepageblokken worden verder ingekort zodat de landingspagina aanzienlijk compacter wordt.
- Scope-update 2026-06-11 (verdere versobering): hero-knoppen, introblok en extra footerzin worden verwijderd.
- Repo-regel: website changelog/About-updates moeten worden meegenomen als de implementatie dat vereist.
- Gevraagde sluginrichting is bewust Nederlands en compact gehouden.

## Current status
Completed

## What changed
- Homepage is teruggebracht tot alleen de hero en het blok met samenwerkende coöperaties.
- De hero CTA-knoppen `Naar overzicht` en `Open planning` zijn verwijderd.
- Het aparte introblok `Rustig startpunt` is verwijderd.
- De ondersteunende footerzin onderaan de pagina is verwijderd.
- De hero- en coöperatiecopy en spacing zijn compact gehouden zodat de landing rustig en on-brand blijft.
- De website changelog kreeg een nieuwe entry voor deze versobering.

## How to verify
- Frontend:
  - `cd frontend && npm test -- src/app/App.test.tsx`
  - `cd frontend && npm run build`
- Backend:
  - `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
- Handmatig in de browser:
  - open de homepage;
  - controleer dat alleen de hero en het blok samenwerkende coöperaties zichtbaar zijn;
  - controleer dat de CTA-knoppen, het introblok en de footerzin ontbreken.

## Verification evidence
- Polish-update goedgekeurd door gebruiker op 2026-06-11.
- Layout-uitlijningsupdate goedgekeurd door gebruiker op 2026-06-11.
- Inhoud/stijl-update goedgekeurd door gebruiker op 2026-06-11.
- Compactheidsupdate goedgekeurd door gebruiker op 2026-06-11.
- Verdere versoberingsupdate goedgekeurd door gebruiker op 2026-06-11.
- Implementatie voltooid op 2026-06-12.
- Verificatie: `cd frontend && npm test -- src/app/App.test.tsx` ✅
- Verificatie: `cd frontend && npm run build` ✅
- Verificatie: `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py` ✅

---

Status: completed  
Owner: optional  
Date: 2026-06-11
