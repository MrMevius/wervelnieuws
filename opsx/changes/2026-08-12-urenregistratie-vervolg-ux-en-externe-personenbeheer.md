# Title
Urenregistratie: vaste projecttotalen, zwevende deelnemerskiezer en Admin-beheer van externe personen

## Context
De urenregistratie heeft al een servergevoed overzicht **Projecttotalen**, een inline registratieflow met deelnemercheckboxen en centraal Admin-beheer voor bestaande externe personen. De huidige pagina heeft echter drie bedieningstekorten: projecttotalen verdwijnen bij scrollen, de deelnemerskeuze is niet als één duidelijke, compacte bediening georganiseerd, en externe personen kunnen nog vanuit de urenpagina via een quick-add worden aangemaakt.

De eerder gerealiseerde native disclosure voor deelnemers voldoet niet langer aan de goedgekeurde UX-richting. In de nieuwe-urenrij moet de deelnemerkeuze één compacte trigger met pijl zijn. Deze vervangt het losse label **Aantal personen**, de losse teller `n deelnemer(s)` en de huidige **Deelnemer(s)**-trigger. De trigger toont nooit geselecteerde namen: exact `Deelnemer(s) ▾` bij nul en `n deelnemer(s) ▾` bij een niet-lege selectie. De trigger opent één zwevend, niet-genest deelnemerskeuzemenu boven de bestaande pagina-inhoud; daarin blijven aangevinkte namen zichtbaar.

Ook wijken datumweergaven en duurinvoer nog niet overal afdoende afgebakend af van de gewenste gebruikerservaring. Native datumvelden worden door de browser/het besturingssysteem gelokaliseerd en hun zichtbare invoernotatie kan niet betrouwbaar door de applicatie worden afgedwongen. Alle app-gerenderde datums kunnen wel consequent als `dd-mm-jjjj` worden getoond. De bestaande duur is opgeslagen als integer `duration_half_hours`; de UI biedt nu meer dan 8 uur en de bewerkflow gebruikt nog vrije numerieke invoer.

Deze opvolgchange combineert uitsluitend deze nauw gekoppelde urenregistratie-UX- en beheerwijzigingen. Zij bouwt voort op de bestaande projecttotalen-, invoer-UX- en Admin-tabs-changes zonder hun afgeronde scope opnieuw te implementeren.

## Goals / Non-goals

### Goals
- Houd de sectie **Projecttotalen** zichtbaar tijdens verticaal scrollen op de urenpagina, met een bruikbare responsive fallback.
- Toon in de nieuwe-urenrij één compacte, toegankelijke trigger die het losse label **Aantal personen**, de losse teller en de huidige trigger vervangt: **Deelnemer(s) ▾** bij nul en **n deelnemer(s) ▾** bij een niet-lege selectie.
- Toon na sluiten uitsluitend deze teller in de trigger, nooit geselecteerde deelnemernamen; behoud aangevinkte namen zichtbaar in de geopende zwevende kiezer.
- Laat de trigger één zwevend/overlay deelnemerskeuzemenu openen waarin alle selecteerbare WindWilly- en externe personen onmiddellijk als checkboxen zichtbaar zijn.
- Behoud in de zwevende kiezer de groepskop **WindWilly-personen**, maar toon bij elke interne checkbox uitsluitend de naam van die persoon, zonder redundant type-label of -badge zoals **WindWilly**.
- Maak de zwevende kiezer volledig toetsenbord- en touchbedienbaar volgens bestaande applicatieconventies, met voorspelbaar focusbeheer, sluiten via Escape en buitenklik/-tap, en robuuste positionering binnen kleine viewports.
- Gebruik in alle door de app gerenderde uren-datumweergaven `dd-mm-jjjj` met koppeltekens.
- Behoud native `<input type="date">` voor datumselectie/-invoer; forceer geen tekstnotatie wanneer de browser die native weergave niet betrouwbaar laat sturen.
- Beperk elke uren-duurkeuze voor nieuwe of gewijzigde registraties tot gehele en halve uren van **0,5** tot en met **8 uur**; behoud opslag en API-veld `duration_half_hours`.
- Verwijder de externe-persoon-quick-add uit desktop en mobiel op de urenpagina.
- Maak het aanmaken van externe personen uitsluitend beschikbaar voor Admin via een expliciete, toegankelijke Admin-creatieflow met naam, optioneel e-mailadres en optionele notitie, inclusief succes-, validatie- en duplicatefeedback.
- Behoud selectie van reeds actieve/selecteerbare externe personen tijdens urenregistratie.

### Non-goals
- Geen wijziging aan projecten, posten, groepsregistratie, deelnemersmodel, historie, audit, export, import, backup of restore buiten de noodzakelijke duurvalidatie en audit van Admin-creatie.
- Geen nieuw rollen- of permissiemodel; de bestaande Admin-guard blijft leidend.
- Geen wijziging van de API-route of veldnaam `duration_half_hours`, en geen database- of datamigratie.
- Geen normalisatie of aanpassing van bestaande historische registraties met een duur boven 8 uur; zij blijven leesbaar. Alleen nieuwe en gewijzigde waarden volgen de nieuwe grens.
- Geen poging om de browser-/OS-notatie binnen native datumcontrols te overschrijven en geen vervanging daarvan door een zelfgebouwde datumwidget.
- Geen algemeen herontwerp van de urenpagina, Admin-shell of applicatieshell.
- Geen native disclosure voor deelnemers, groepsniveau-disclosures, geneste participantmenu's of tweede deelnemersmenu; de ene zwevende kiezer bevat rechtstreeks alle deelnemercheckboxen.

## Proposed approach
1. Hergebruik de bestaande projecttotalencomponent en pas alleen de urenpagina-layout aan: positioneer deze sticky binnen de beschikbare contentkolom, met een veilige `top`-offset onder de vaste shell en een normale gestapelde weergave wanneer viewporthoogte/-breedte sticky gedrag onbruikbaar maakt. De sectie blijft volledig bereikbaar en overlapt geen create-, filter- of tabelbediening.
2. Vervang de native deelnemersdisclosure én de losse bedieningselementen **Aantal personen** en `n deelnemer(s)` door precies één knop/trigger rond de bestaande canonieke checkboxselectie. Toon bij nul selectie exact `Deelnemer(s) ▾` en anders exact `n deelnemer(s) ▾`, met `n` als actueel aantal unieke selecties en zonder geselecteerde namen, ook na sluiten. De aangevinkte namen blijven zichtbaar als checkboxlabels in het geopende menu. Plaats de trigger op desktop in dezelfde toevoeg-/create-rij op de plek van de huidige aantal-personenbediening; plaats hem niet als aparte rij onder de desktoptabel. Op mobiel blijft hij onderdeel van de gestapelde create-flow op de plek van die bediening en vóór de overige create-acties.
3. Open vanuit die trigger één zwevend menu met beide semantisch benoemde checkboxgroepen direct zichtbaar. Behoud de kop **WindWilly-personen**, maar render elke interne checkbox met uitsluitend de persoonsnaam en zonder redundant individueel type-label/-badge; de presentatie van externe opties blijft ongewijzigd, behalve voor noodzakelijke consistente toegankelijkheid. Positioneer het menu waar mogelijk aan de trigger, maar flip, shift of begrens het bij onvoldoende ruimte zodat het niet buiten de viewport valt; gebruik op mobiel een viewportveilige overlay/panelvariant met interne scrolling. Het menu mag geen horizontale overflow, afgekapt onbereikbaar deel, geneste menu of tweede expansieactie hebben. Behoud één participant-state, bestaande selecteerbaarheidsfilters, display-only historische deelnemers, foutkoppeling en payloadsemantiek.
4. Volg bestaande focus- en overlayconventies: de trigger heeft een toegankelijke naam en correcte open/dicht-status; openen zet focus op het eerste relevante interactieve element in het menu; Escape en buitenklik/-tap sluiten zonder selectie te wissen; sluiten herstelt focus op de trigger; checkboxinteractie sluit het menu niet automatisch. Tab/Shift+Tab blijven voorspelbaar binnen de geopende interactie volgens de bestaande overlayconventie.
5. Inventariseer alle uren-gerelateerde app-rendered datums (tabel, mobiele kaarten, filteropties, edit-/historyweergaven en relevante Admin-urenweergaven). Centraliseer waar nodig een formatter die ISO-datums zonder tijdzoneverschuiving naar `dd-mm-jjjj` omzet. Native date-controls blijven ISO-waarden ontvangen en behouden hun browserweergave.
6. Centraliseer de toegestane halve-uuropties als waarden 1–16 (`duration_half_hours`) en pas create- én editbediening daarop aan. Valideer dezelfde grens server-side voor create en update, zodat gemanipuleerde clients geen 0, 8,5 of hogere waarde kunnen opslaan. Historische hogere waarden blijven renderbaar; een edit vereist een nieuwe geldige keuze binnen de grens.
7. Verwijder alle quick-add UI, state, clientcall en duplicate-flow voor externe personen uit beide uren-create-oppervlakken. Breid de bestaande Admin-tab **Urenhistorie en identiteiten** uit met een expliciete knop/flow **Externe persoon aanmaken**. Alleen via de bestaande Admin-guard kan deze flow de bestaande create-route aanroepen; na succes verschijnt de persoon in het Admin-overzicht en wordt uren-meta geïnvalideerd zodat hij bij een volgende registratie selecteerbaar is.
8. Behoud en test bestaande server-side validatie voor externe personen (waaronder duplicateconflicten), expliciete veldfeedback en de huidige audit-/masterdata-semantiek. Als de create-route momenteel niet server-side Admin afschermt, voeg die afscherming toe zonder route- of payloadwijziging.

## Implementation steps (ordered)
1. **Inventarisatie en contractgrens**
   - Leg bestaande urenlayout, sticky shell-offsets, desktop/mobiele create- en editoppervlakken, datumformatters, duurvalidatie, external-person API-autorisatie en Admin-tabpatronen vast.
   - Leg de bestaande `duration_half_hours`-range en behandeling van historische waarden boven 8 uur in API-tests vast vóór wijziging.
2. **Projecttotalen sticky maken**
   - Pas uitsluitend urenpagina-CSS/markup aan zodat **Projecttotalen** op voldoende brede/hoge viewports sticky blijft binnen de contentcontainer.
   - Definieer responsive fallbackregels die de sectie statisch onder/bij de heading plaatsen wanneer sticky ruimte, mobiel viewport of zoom anders overlap, clipping of onbereikbaarheid veroorzaakt.
3. **Eén zwevende deelnemerskiezer**
      - Vervang op desktop en mobiel de native disclosure, het losse label **Aantal personen** en de losse teller `n deelnemer(s)` door exact één knop/trigger voor de bestaande canonieke deelnemersselectie. Toon bij nul selectie exact `Deelnemer(s) ▾` en bij één of meer selecties exact `n deelnemer(s) ▾`, waarbij `n` de actuele unieke selectie is; render nooit geselecteerde namen in de trigger. Behoud aangevinkte namen als zichtbare checkboxlabels in het geopende menu. Plaats de trigger op desktop in dezelfde toevoegrij op de plek van de aantal-personenbediening en op mobiel op die plek in de gestapelde create-flow.
     - Open met de trigger exact één zwevend menu/panel. Toon daarin zonder vervolghandeling alle checkboxen voor de semantisch benoemde groepen **WindWilly-personen** en **Externe personen**. Gebruik geen native disclosure, groepsniveau-disclosures, geneste menu's, tweede menu of andere expansieactie.
     - Behoud de groepskop **WindWilly-personen**, maar toon voor iedere interne checkbox alleen de persoonsnaam; verwijder individuele **WindWilly**-typeaanduidingen of gelijkwaardige redundante badges. Laat de bestaande externe-optieweergave ongewijzigd, tenzij een minimale wijziging nodig is om dezelfde toegankelijke checkboxsemantiek te behouden.
    - Implementeer toegankelijke trigger-/menu-semantiek, zichtbare focus en bestaande overlayfocusconventies. Openen focust het eerste relevante interactieve element; Escape en buitenklik/-tap sluiten; een sluitactie herstelt triggerfocus; aanvinken sluit niet; selectie blijft behouden bij sluiten, heropenen, repositioneren en een mobiele viewportwijziging.
    - Positioneer desktopmenu's verbonden aan de trigger en corrigeer bij viewportranden via flip/shift/constrain. Gebruik op smalle/mobiele viewports een veilige overlay/panelpresentatie met maximale viewporthoogte, interne verticale scrolling en zonder body-/horizontale overflow, clipping of bedekte essentiële bediening.
    - Behoud checkbox-toggle, geselecteerde-samenvatting, selectability filtering, foutfocus en dezelfde participantidentiteiten in create-payloads.
4. **Datumweergave standaardiseren**
   - Pas de uren-specifieke app-rendered datumlabels en formatters aan naar `dd-mm-jjjj`, inclusief lijst, mobiele kaarten, datumfilterkeuzes, edit-/detailweergaven en uren-Admin waar geraakt.
   - Houd alle native date-inputs ongewijzigd als `type="date"` met ISO-waarde; voeg geen slash- of hyphenassertie toe voor de browser-rendering van die controls.
5. **Duurgrens afdwingen**
   - Beperk gedeelde duurkeuzes tot 1–16 halve uren en toon labels `0.5 uur` tot en met `8 uur` volgens de bestaande formatteringsconventie.
   - Vervang vrije edit-numerieke invoer door dezelfde beperkte keuze en valideer create/update in backendservice/schema op integer 1–16, zonder wijziging van veldnaam of opslagtype.
   - Zorg dat bestaande hogere historische waarden zichtbaar blijven, maar bij opslaan van een edit niet opnieuw buiten de nieuwe grens kunnen worden verzonden.
6. **Externe personen uitsluitend in Admin aanmaken**
   - Verwijder desktop- en mobiele quick-add-markup, state, duplicate-candidate UI, create-mutation en bijbehorende resetlogica uit de urenpagina.
   - Voeg in **Admin > Urenhistorie en identiteiten** een expliciete creatieactie en toegankelijke modal of inline form toe met verplichte naam en optionele e-mail/notitie, Annuleren en Opslaan.
   - Hergebruik de bestaande create-API en duplicate-/veld-foutcontracten; invalidatie ververst het Admin-overzicht en `work-hours-meta`. Verifieer en handhaaf server-side dat alleen een Admin de create-route kan gebruiken.
7. **Tests, documentatie en verificatie**
    - Breid backend- en frontendregressies uit volgens de acceptance criteria, inclusief niet-Admin create-afwijzing indien de API die nog niet garandeert.
      - Werk `docs/urenregistratie.md` bij: de trigger **Deelnemer(s)**, geselecteerde teller, zwevende kiezer, bediening/sluitgedrag, direct zichtbare checkboxen en de groepskop **WindWilly-personen** met alleen persoonsnamen per interne optie, plus duurgrens, datumweergave en het feit dat externe personen uitsluitend via Admin worden aangemaakt. Voeg bij afgeronde implementatie een korte eindgebruikersgerichte About/changelog-entry toe.
   - Voer de opdrachten uit het Testing plan uit, leg feitelijke resultaten vast onder **Verification evidence** en zet de spec uitsluitend na alle criteria op Completed.

## Acceptance criteria
1. **Projecttotalen** blijft op een desktopviewport zichtbaar terwijl de gebruiker door de urenlijst scrollt, zonder de heading, create-rij, filters, tabelrijen of acties te overlappen of te verbergen.
2. Bij 320 CSS px en bij 200% zoom is een statische/gestapelde fallback actief of blijft sticky gedrag anderszins bruikbaar: Projecttotalen, createbediening en lijst zijn zonder horizontale viewportoverflow en zonder overlappende content bereikbaar.
3. Desktop en mobiel tonen bij uren toevoegen precies één compacte knop/trigger met exact label **Deelnemer(s) ▾** bij nul selectie en **n deelnemer(s) ▾** bij een niet-lege selectie, met `n` als actueel aantal geselecteerde unieke personen. Er is geen los label **Aantal personen** en geen losse `n deelnemer(s)`-teller. De trigger bevat na selectie en sluiten geen geselecteerde naam of namen. In het geopende zwevende menu blijven de aangevinkte namen als checkboxlabels zichtbaar. Op desktop staat deze in dezelfde toevoegrij op de plek van de voormalige aantal-personenbediening en niet in een aparte rij onder de desktoptabel. Op mobiel staat hij op die plek in de gestapelde create-flow, vóór de overige create-acties.
4. Activering van de trigger opent precies één zwevend deelnemersmenu/panel. Daarin zijn alle bestaande selecteerbare WindWilly-personen en externe personen onmiddellijk als checkboxen zichtbaar in afzonderlijk benoemde groepen. De groep **WindWilly-personen** blijft zichtbaar als kop, terwijl elke interne checkbox uitsluitend de persoonsnaam toont en geen redundant **WindWilly**-type-label of -badge bevat. De presentatie van externe opties blijft ongewijzigd, behalve waar minimaal nodig voor consistente toegankelijkheid. Geen participantgroep vereist nogmaals openen/uitklappen en er is geen native disclosure, genest menu, groepsniveau-menu, tweede menu of andere vervolghandeling.
5. De trigger heeft een toegankelijke naam en correcte open/dicht-status. Bij openen krijgt het eerste relevante interactieve element focus; Escape en buitenklik/-tap sluiten het menu zonder de selectie te wijzigen en herstellen focus op de trigger. Tab/Shift+Tab en zichtbare focus volgen de bestaande overlayconventie; een checkbox-toggle sluit het menu niet.
6. Het menu blijft volledig bereikbaar op desktop, bij 320 CSS px, 200% zoom en na mobiele viewportwijzigingen: het positioneert aan de trigger waar ruimte is, corrigeert bij viewportranden en gebruikt zo nodig een begrensd, intern verticaal scrollbaar mobiel panel. Er is geen horizontale viewportoverflow, clipping, onbereikbare checkbox of bedekte essentiële bediening.
7. Aan- en uitvinken voegt/verwijdert precies de betreffende bestaande participant uit de canonieke selectie; teller, selectie en create-payload blijven na sluiten/heropenen behouden en de payload bevat precies de aangevinkte identities, zonder duplicaten. Niet-selecteerbare en historische deelnemers behouden hun bestaande display-only semantiek.
8. Elke app-gerenderde datum in de geraakte urenpagina en uren-Adminweergaven gebruikt `dd-mm-jjjj`; er resteert geen app-gerenderde slash-notatie voor die datums. Native `type="date"`-controls blijven native en worden niet op hun browserzichtbare format geassert.
9. Create- en editduur bieden uitsluitend 0,5-uursstappen van 0,5 tot en met 8 uur (payloadwaarden `duration_half_hours` 1–16). Waarden 0, 17 en niet-integers worden server-side bij create én update afgewezen; `0.5 → 1`, `1 → 2`, `8 → 16` blijft correct.
10. Bestaande groepen met meer dan 8 uur blijven zonder dataverlies leesbaar in lijst, kaarten, historie en audit. Een bewerking kan pas worden opgeslagen met een nieuwe waarde binnen 0,5–8 uur.
11. De urenpagina bevat op desktop noch mobiel een formulier, knop, API-callpad of duplicate-flow om een externe persoon aan te maken; bestaande actieve externe personen blijven daar wel selecteerbaar.
12. Alleen een Admin ziet en kan de expliciete creatieflow voor externe personen in **Admin > Urenhistorie en identiteiten** gebruiken. Deze vereist een naam, accepteert optioneel e-mail/notitie, toont Nederlandse success- en validatie/duplicatefeedback, en de nieuw aangemaakte persoon is na succes in het Admin-overzicht en in vernieuwde uren-meta zichtbaar.
13. Een niet-Admin krijgt geen toegang tot de Admin-creatieflow én kan de externe-person-create-API server-side niet succesvol gebruiken (bestaande route en payloadvorm mogen verder ongewijzigd blijven).
14. `docs/urenregistratie.md` beschrijft de exacte nul-/niet-nultriggerlabels, dat de trigger na sluiten uitsluitend het aantal en geen geselecteerde namen toont, en dat aangevinkte namen zichtbaar blijven in de geopende zwevende kiezer, naast sluitgedrag en direct zichtbare selecties. Bij afronding bevat de About/changelog een korte eindgebruikersgerichte entry. Gerichte backend/frontendtests, volledige geraakte suites, frontendproductiebouw en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Backend: duurgrenzen, update/create-contract en Admin-autorisatie externe personen
cd backend
uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q

# Frontend: urenpagina, zwevende deelnemerskiezer (inclusief interne naamlabels), Admin-creatie en About/changelog
cd ../frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige direct geraakte frontendset en productiebouw
npm test -- --run
npm run build

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Scroll op desktop door een lijst die langer is dan het viewport en bevestig dat **Projecttotalen** zichtbaar blijft zonder overlap; controleer de gestapelde fallback op tablet en 320 CSS px bij 200% zoom.
- Controleer op desktop dat één trigger de voormalige **Aantal personen**-bediening en losse teller vervangt en in dezelfde toevoegrij staat, niet als aparte rij onder de desktoptabel. Selecteer twee personen, sluit de kiezer en bevestig exact label **2 deelnemer(s) ▾**, zonder geselecteerde namen. Heropen de kiezer en bevestig dat de twee aangevinkte namen zichtbaar blijven. Controleer op mobiel dezelfde labels en plaatsing, vóór de overige create-acties.
- Gebruik uitsluitend toetsenbord op desktop en mobiel: open de kiezer, verifieer startfocus en zichtbare focus, navigeer met Tab/Shift+Tab volgens de bestaande overlayconventie, vink personen aan/uit, sluit met Escape en bevestig terugkeer van focus naar de trigger. Heropen en bevestig behouden selectie en teller. Herhaal met buitenklik/-tap en bevestig dat dit sluit zonder selectie te wissen.
- Bevestig dat openen alle checkboxen direct toont, zonder native disclosure, groepsmenu of tweede expansieactie; de kop **WindWilly-personen** blijft zichtbaar en elke interne optie toont uitsluitend een persoonsnaam zonder type-label/-badge. Controleer dat externe opties ongewijzigd blijven, behalve voor noodzakelijke consistente toegankelijkheid. Valideer de lege selectie en sla een registratie op. Controleer dat checkboxinteractie de kiezer niet sluit en dat de create-payload uitsluitend de actuele aangevinkte identities bevat.
- Test de open kiezer op 320 CSS px, 200% zoom, nabij alle desktop-viewportranden en na mobiele viewport-/oriëntatiewijziging. Bevestig een volledig bereikbaar, zo nodig intern scrollbaar panel zonder horizontale overflow, clipping of bedekte essentiële bediening.
- Controleer lijst, mobiele kaart, datumfilteropties, edit/detail en uren-Admin op `dd-mm-jjjj`; bevestig dat native datumvelden in de browser als native control werken, ongeacht lokale browsernotatie.
- Controleer create en edit op de onder-, tussen- en bovengrens (0,5, 1,5 en 8 uur) en bevestig dat een bestaande registratie boven 8 uur leesbaar is maar alleen met een geldige nieuwe duur kan worden opgeslagen.
- Controleer als Admin de volledige creatie-, validatie-, duplicate- en succesflow voor een externe persoon en selecteer deze daarna in een nieuwe urenregistratie. Controleer als niet-Admin zowel verborgen UI als server-side geweigerde create-request.

## Risk + rollback plan

### Risks and mitigations
- **Sticky overlap door vaste shell of klein viewport:** begrens de sticky container, gebruik de werkelijke shell-offset en lever een geteste statische responsive fallback.
- **Zwevende kiezer raakt focus kwijt, sluit onbedoeld of positioneert buiten beeld:** hergebruik bestaande overlay-/focusconventies, test Escape, buitenklik/-tap, focusherstel, selectiebehoud en checkboxinteractie expliciet. Anchor het desktopmenu aan de trigger en implementeer flip/shift/begrenzing; gebruik op mobiel een viewportveilig, intern scrollbaar panel.
- **Kiezer staat buiten de toevoegflow of wordt genest:** plaats de trigger op desktop binnen dezelfde toevoegrij direct onder **Aantal personen** en handhaaf op mobiel de directe, gestapelde opvolging. Render alle groepen en checkboxen direct in één niet-genest menu, zonder native disclosure of tweede expansieactie.
- **Interne type-informatie blijft dubbel zichtbaar of externe opties veranderen onbedoeld:** behoud uitsluitend de groepskop **WindWilly-personen** als interne typecontext, voeg een gerichte DOM-/toegankelijkheidsregressie toe voor naam-only interne labels en wijzig externe presentatie alleen indien noodzakelijk voor consistente checkbox-toegankelijkheid.
- **Trigger toont alsnog persoonsnamen na sluiten:** centraliseer de gesloten-triggertekst op uitsluitend de nul-/niet-nulteller en voeg regressies toe die na selectie, sluiten en heropenen de exacte triggertekst en zichtbare aangevinkte checkboxnamen afzonderlijk verifiëren.
- **Datumformattering verschuift een datum door timezone-parsing:** formatteer pure ISO-datums als kalenderdatum, niet via een lokale `Date`-conversie die de dag kan verschuiven.
- **Nieuwe duurgrens blokkeert historische data:** verander bestaande records niet; valideer alleen create/update en test historische waarden expliciet.
- **Quick-add-verwijdering laat een niet-admin API-pad open:** test de route als niet-Admin en handhaaf bestaande Admin-autorisatie server-side waar nodig.
- **Admin-creatie mist bestaande duplicate- of invalidatiegedrag:** hergebruik de bestaande route/service en controleer duplicatefeedback plus `work-hours-meta` invalidatie.

### Rollback
1. Er is geen database- of datamigratie; revert de gewijzigde frontend-, backendvalidatie-, test-, documentatie- en changelogcommit(s) als één change.
2. Een rollback herstelt de eerdere duurgrens en eventueel de urenpagina-quick-add. Reeds opgeslagen geldige waarden blijven compatible omdat `duration_half_hours` ongewijzigd is.
3. Herhaal na rollback minimaal de gerichte backend- en frontendtests, `npm run build` en `git diff --check`.

## Notes / links
- Gerelateerde specs:
  - `opsx/changes/2026-08-12-urenregistratie-terminologie-en-persoonlijk-overzicht.md` (Projecttotalen)
  - `opsx/changes/2026-08-12-urenverantwoording-invoer-ux-verfijning.md` (deelnemer- en duurinvoer)
  - `opsx/changes/2026-08-12-urenverantwoording-admin-tabs.md` (Admin-tab voor externe personen)
- Waarschijnlijke implementatiepunten:
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/app/features/urenverantwoording/WorkHoursAdminTabs.tsx`
  - `frontend/src/lib/datetime.ts`
  - `frontend/src/lib/api/client.ts`
  - `backend/app/api/work_hours.py`
  - `backend/app/services/work_hours_service.py`
  - `backend/app/schemas/work_hours.py`
  - `backend/tests/test_work_hours_api.py`
  - `backend/tests/test_admin_api.py`
  - `docs/urenregistratie.md`
- **Docs impact:** de urenhandleiding en, bij afronding, de verplichte gebruikersgerichte website-changelog/About-entry worden bijgewerkt volgens `AGENTS.md`.
- **Aanvullende docs-impact:** de urenhandleiding vermeldt dat **WindWilly-personen** de groepskop is en dat interne opties daaronder alleen persoonsnamen tonen.

### Assumptions
- “Alle participantpersonen direct zichtbaar” betekent: direct zichtbaar zodra het ene menu **Personen toevoegen** is geopend, voor alle reeds door bestaande eligibility/meta als selecteerbaar geleverde personen. Zeer lange lijsten mogen visueel scrollen maar niet achter aanvullende interactieve bediening worden verborgen of uitgeklapt.
- De goedgekeurde vervolgscope vervangt **Personen toevoegen**, het losse label **Aantal personen** en de losse teller door één zwevende-kiezertrigger. De teller verschijnt alleen als onderdeel van die trigger bij een niet-lege selectie; `n` is het aantal unieke geselecteerde participantidentiteiten.
- “Volgens bestaande overlayconventies” betekent dat de implementatie het bestaande, bewezen applicatiepatroon voor focusbeheer en Tab/Shift+Tab hergebruikt. Als geen dergelijk patroon bestaat, is een focus-trap binnen het geopende mobiele/overlaypanel vereist; Escape, buitenklik/-tap en focusherstel naar de trigger gelden in alle gevallen.
- “Projecttotalen sticky/floating” betekent sticky binnen de urencontent en niet een viewport-brede, contentbedekkende floating overlay.
- “Datumweergave” betreft app-gerenderde uren-datums; de browser bepaalt de zichtbare notatie van native `type="date"`-invoer.
- “Externe personen alleen via Admin” betekent aanmaken uitsluitend als Admin; selecteren van reeds actieve externe personen in een urenregistratie blijft toegestaan voor gebruikers met bestaande urenregistratietoegang.
- De groepskop **WindWilly-personen** levert voldoende typecontext voor interne opties; een individuele typeaanduiding naast elke interne naam is daarom redundant.
- De triggertekst is een compacte selectie-indicator, geen samenvatting van geselecteerde personen: na sluiten bevat deze alleen `Deelnemer(s) ▾` of `n deelnemer(s) ▾`; de checkboxen in de geopende kiezer zijn de zichtbare bron voor aangevinkte namen.

## Current status
Approved unified-button UX adjustment implemented and automated verification passed. The overall change is not yet Completed: manual browser/accessibility checks and mixed-worktree diff isolation remain pending.

## What changed
- Made **Projecttotalen** sticky below the shell on spacious viewports, with bounded internal scrolling and a static stacked fallback at narrow widths.
- Previously replaced participant `details` controls with immediately visible checkbox groups on desktop and mobile. This is superseded by the approved one-disclosure requirement and must be changed: one menu labelled appropriately (for example **Personen toevoegen**) must reveal all participant checkboxes directly, without group-level or second menus.
- Kept the existing timezone-safe `dd-mm-jjjj` formatter for all affected app-rendered hours dates; native date fields remain native ISO-backed controls.
- Limited create and edit duration selections to `duration_half_hours` 1–16 and enforced the same integer range in create/update schemas. Historical values above 16 still render and must be replaced by a valid choice before an edit is saved.
- Moved external-person creation to an explicit Admin modal with name, optional e-mail/notitie, success/error feedback, and invalidation of both Admin masterdata and `work-hours-meta`; added server-side Admin enforcement for the existing create route.
- Added regression coverage for the prior direct participant groups, absent quick-add UI, Admin creation and invalidations, duration boundary rejection/history readability, non-Admin create denial, and the updated About/changelog ordering. Participant-selection regressions must be revised for the adjusted one-disclosure behavior.
- Updated the hours guide and added the end-user About/changelog entry (iteration 105).
- IN_SCOPE_REPAIR: moved the sticky containing block to a two-column hours-list layout, so **Projecttotalen** remains sticky for the full hours-list scroll range; the existing narrow responsive static fallback remains in place.
- IN_SCOPE_REPAIR: historical durations above 8 hours now render as an explicit unselected historical option in the edit form. Saving is disabled until a user deliberately selects a permitted 0.5–8 hour value; the historical value is never silently substituted or submitted.
- IN_SCOPE_REPAIR: hardened the Admin external-person create modal with Dutch client-side field errors, parsed hard/advisory duplicate feedback with visible candidates, and a deliberate force-create action only for advisory duplicates.
- IN_SCOPE_REPAIR: kept the hours layout to exactly two direct grid columns: sticky **Projecttotalen** and `.work-hours-page-content`, which now contains all status, error, overview, create and list operations. The narrow static fallback is unchanged.
- IN_SCOPE_REPAIR: added a frontend DOM regression that requires the operational list panel to remain inside `.work-hours-page-content`.
- Replaced the superseded always-visible create participant groups with one native, accessible **Personen toevoegen** disclosure on both desktop and mobile. Opening it immediately renders both named checkbox groups; it has no nested or group-level disclosure. The existing shared participant state, selection summary, payload semantics and participant error focus behavior are retained. Its placement must now be adjusted to the approved layout: on desktop within the same toevoegrij directly below **Aantal personen**, rather than in a separate row below the desktop table; on mobile directly after **Aantal personen** in the stacked create-flow.
- IN_SCOPE_REPAIR: added immediate feedback in the one native disclosure trigger: it now states the selected count and names while closed and open. The participant checkboxes retain the same canonical state and create payload. Added explicit touch/pointer affordances for the native disclosure and checkbox labels after inspecting the browser-native `details`/`summary` styles; no blocking overlay or disabled pointer rule was present.
- Updated the directly coupled hours guide and iteration 105 changelog wording to describe the one-menu behavior.
- Approved narrow follow-up (2026-08-13): moved the desktop **Personen toevoegen** disclosure into the existing **Aantal personen** cell of the same create-table row, directly beneath the count. The former standalone participants table row was removed, preserving valid table DOM. The mobile create stack now renders its **Aantal personen** count immediately before its one disclosure. The existing canonical participant state, feedback, checkbox behavior and payload semantics are unchanged; disclosure content retains a bounded, wrapping grid layout.
- Approved scope adjustment (2026-08-13): this native **Personen toevoegen** disclosure and all disclosure-specific positioning, behavior, assertions and documentation are superseded. Replace it with the compact **Deelnemer(s) ▾** trigger, selected-count feedback and one viewport-safe floating participant picker described in this spec. Preserve the existing canonical selection state, payload, validation/error behavior and selectability semantics.
- Latest floating-picker implementation summary: replaced the native create-row disclosure on desktop and mobile with a compact **Deelnemer(s) ▾** trigger that shows the selected count only when non-zero. The trigger opens one direct floating checkbox picker containing both participant groups, retaining canonical selection and create-payload semantics. Added dialog/expanded state semantics, initial checkbox focus, native keyboard operation, Escape and outside pointer/tap closing with focus return, and a viewport-fixed internally scrollable picker; opening one surface closes the other.
- IN_SCOPE_REPAIR: made trigger text exactly **Deelnemer(s) ▾** at zero selections and **Deelnemer(s) (n) ▾** otherwise, without a detached count badge. Desktop pickers now calculate an anchored fixed position and flip, shift and constrain against viewport edges; the existing centered, internally scrolling mobile panel remains viewport-safe. The picker now traps Tab/Shift+Tab consistently with `AccessibleModal` while retaining Escape/outside close and trigger-focus restoration. Updated the hours guide, iteration-105 user-facing changelog wording and App regression expectation.
- Approved narrow follow-up (2026-08-13): the floating picker must retain **WindWilly-personen** as its group heading while removing redundant per-person internal type labels/badges (such as **WindWilly**), so each internal checkbox shows only the person's name. External-option presentation is out of scope and remains unchanged unless a minimal accessibility-consistency change is required. No implementation has been performed for this adjustment.
- Implemented the approved narrow follow-up: internal floating-picker labels now contain only each person's name. The retained **WindWilly-personen** fieldset heading supplies the type context; the internal participant draft type, accessible checkbox naming, canonical selection state and payload conversion are unchanged. External options retain their **Externe persoon** type label.
- Updated all coupled picker interaction assertions to use the internal name-only accessible names and added a focused regression for the retained heading, absent redundant internal label and unchanged external option label.
- Updated the hours guide because it describes the individual picker labels.
- Approved narrow adjustment (2026-08-13): supersedes the prior selected-name trigger feedback. After selection and menu close, the trigger must be exactly **Deelnemer(s) ▾** at zero or **Deelnemer(s) (n) ▾** at nonzero, with no selected names; checked names remain visible only in the open floating picker. Relevant picker tests and `docs/urenregistratie.md` must be updated with this behavior. No implementation has been performed for this adjustment.
- Implemented the approved number-only-trigger adjustment. The existing trigger renderer already produced the exact zero/nonzero labels without participant names, so no behavior/state/payload change was needed. Strengthened the direct desktop and mobile regression to assert exact closed-button text, absence of the selected name in that button, and checked-name visibility after reopening the floating picker. Updated the hours guide to state the closed-trigger name exclusion explicitly.
- IN_SCOPE_REPAIR (2026-08-13): removed the residual selected-participant chip/list from both closed create surfaces. The separate `n deelnemer(s)` count and compact count-only trigger remain; selected names and type labels now render only as checkbox content while the floating picker is open. Selection state, create payloads, participant errors and picker accessibility are unchanged. Desktop and mobile regressions now assert that closed create surfaces contain neither selected names nor `WindWilly-gebruiker`, then assert the selected checkbox is visible and checked after opening.
- Approved narrow UX adjustment (2026-08-13): supersedes the separate **Aantal personen** label, detached `n deelnemer(s)` count and current trigger. Replace all three with one compact floating-picker button: `Deelnemer(s) ▾` at zero and `n deelnemer(s) ▾` after selection. Preserve picker structure, canonical selection, payload, accessibility, errors and all other behavior. No implementation has been performed for this adjustment.
- Implemented the approved unified-button adjustment: both desktop and mobile create surfaces now render only the compact picker trigger. It is exactly **Deelnemer(s) ▾** at zero selection and **n deelnemer(s) ▾** after selection; the former **Aantal personen** label and detached count were removed. Floating-picker anchoring/open behavior, canonical selection, validation feedback, payload identities, keyboard handling and focus return are unchanged.
- Updated focused desktop/mobile regressions for the exact labels and the absence of the removed standalone label/count, while retaining picker, selection, payload and accessibility interaction coverage. Updated the user guide and the coupled iteration-105 About text.

## How to verify
- `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q`
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` (after revising participant-menu assertions)
- `cd frontend && npm test -- --run && npm run build`
- `git diff --check`
- Add focused desktop/mobile regressions that assert there is no separate **Aantal personen** label or detached `n deelnemer(s)` counter; assert exact trigger text `Deelnemer(s) ▾` at zero and `n deelnemer(s) ▾` after selection, while retaining picker, payload, a11y and error assertions. Then perform the existing manual browser/accessibility checks before release.
- Isolate the change from mixed unrelated worktree changes and review the resulting diff before release.
- Final verification must additionally cover the floating picker’s trigger/count, direct checkbox structure, Space selection, Escape/outside close, focus return, persisted selection and exact payload behavior.
- This repair batch additionally verifies exact zero/nonzero trigger labels on both create surfaces, focus wrapping, and the desktop edge-placement strategy.
- Add a focused picker regression that asserts the retained **WindWilly-personen** heading, name-only labels for all rendered internal checkbox options, absence of redundant internal type labels/badges, and unchanged external-option presentation unless an explicitly documented accessibility necessity applies.
- Add a focused picker regression for both create surfaces: after selecting participant(s) and closing the picker, assert the trigger is exactly `n deelnemer(s) ▾`, contains no selected name, and is the only count-related control; after reopening, assert the selected checkbox names remain visible and checked. Also assert the exact zero-selection label `Deelnemer(s) ▾`.
- For this narrow follow-up, rerun the focused hours/App frontend tests, the complete frontend suite, production build and `git diff --check`. Retain the existing manual browser/accessibility and mixed-worktree diff-isolation checks as release blockers.
- This residual-list repair verifies its dedicated hours-page regression first, then the full frontend suite, frontend production build and `git diff --check`.

## Verification evidence
- `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` — passed: 116 tests. Existing Python deprecation warnings only.
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` — passed: 116 tests.
- `cd frontend && npm test -- --run` — passed: 179 tests.
- `cd frontend && npm run build` — passed. Vite reported its existing >500 kB chunk-size advisory only.
- `git diff --check` — passed.
- Manual viewport, zoom, keyboard and live-role checks were not executed in this non-browser implementation environment.
- IN_SCOPE_REPAIR focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` — passed: 29 tests.
- IN_SCOPE_REPAIR frontend production build: `cd frontend && npm run build` — passed. Vite reported its existing >500 kB chunk-size advisory only.
- IN_SCOPE_REPAIR complete frontend suite: `cd frontend && npm test -- --run` — passed: 182 tests.
- IN_SCOPE_REPAIR related backend suite: `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` — passed: 116 tests. Existing pytest-asyncio, `crypt`, and `datetime.utcnow()` deprecation warnings only.
- IN_SCOPE_REPAIR whitespace check: `git diff --check` — passed.
- Final IN_SCOPE_REPAIR focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` — passed: 30 tests.
- Final IN_SCOPE_REPAIR complete frontend suite: `cd frontend && npm test -- --run` — passed: 183 tests.
- Final IN_SCOPE_REPAIR frontend production build: `cd frontend && npm run build` — passed. Vite reported its existing >500 kB chunk-size advisory only.
- Final IN_SCOPE_REPAIR whitespace check: `git diff --check` — passed.
- Final automated verification is green: focused frontend test passed (30 tests), complete frontend suite passed (183 tests), frontend production build passed (Vite existing >500 kB chunk-size advisory only), and `git diff --check` passed. The related backend suite also passed (116 tests; existing deprecation warnings only).
- The participant-selection assertions and related frontend evidence above apply to the superseded always-visible-groups behavior. They must be replaced by evidence for exactly one disclosure that reveals all participant checkboxes directly.
- Manual browser/accessibility verification remains pending: desktop sticky scroll; 320 CSS px/200% zoom without overflow or overlap; keyboard-visible focus; and Admin/non-Admin route UI.
- Mixed unrelated worktree changes remain a release/review blocker; diff isolation is still required.
- Adjusted-scope focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` — passed: 120 tests. The disclosure regression verifies exactly one closed disclosure per create surface, direct availability of both checkbox groups after opening, and no nested disclosure.
- Adjusted-scope frontend production build: `cd frontend && npm run build` — passed. Vite reported its existing >500 kB chunk-size advisory only.
- Adjusted-scope related backend suite: `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` — passed: 116 tests. Existing pytest-asyncio, `crypt`, and `datetime.utcnow()` deprecation warnings only.
- Adjusted-scope whitespace check: `git diff --check` — passed.
- IN_SCOPE_REPAIR focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` — passed: 121 tests. The added regression covers desktop and mobile separately: selecting an eligible other user updates the disclosure feedback immediately, closing/reopening retains the checked state, and each create surface submits one canonical payload exactly once.
- IN_SCOPE_REPAIR frontend production build: `cd frontend && npm run build` — passed. Vite reported its existing >500 kB chunk-size advisory only.
- IN_SCOPE_REPAIR whitespace check: `git diff --check` — passed.
- Manual browser/accessibility checks and isolation of the mixed unrelated worktree diff remain pending.
- Approved narrow follow-up (2026-08-13) implementation: desktop **Personen toevoegen** is inside the same create-table row and directly below **Aantal personen**; no standalone participants row remains. Mobile renders its one disclosure directly after **Aantal personen** in the stacked flow. The dedicated structural regression also retains the one-disclosure/open-checkbox assertions; existing behavior regressions retain selection-feedback, checkbox, reopening and exact-payload coverage.
- Approved narrow follow-up focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` — passed: 121 tests.
- Approved narrow follow-up frontend production build: `cd frontend && npm run build` — passed. Vite reported its existing >500 kB chunk-size advisory only.
- Approved narrow follow-up whitespace check: `git diff --check` — passed.
- Latest floating-picker focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` — passed: 32 tests.
- Latest floating-picker frontend production build: `cd frontend && npm run build` — passed. Vite reported only the existing informational >500 kB chunk warning.
- Latest floating-picker backend API suite: from `backend/`, with a temporary `STORAGE_ROOT`, `.venv/bin/pytest tests/test_work_hours_api.py` — passed: 84 tests; existing deprecation warnings only, and the temporary root was removed.
- Latest floating-picker manual check: pending; desktop/tablet/320 CSS px at 200% zoom, real-browser visible-focus and floating-picker placement/scrolling verification were not executed.
- Diff isolation remains pending because mixed unrelated worktree changes must be isolated before release.
- No verification evidence exists yet for the approved name-only internal-option adjustment; rerun the focused frontend test, complete relevant frontend suite/build and `git diff --check` after implementation, plus the corresponding manual picker check.
- Latest IN_SCOPE_REPAIR focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` — passed: 124 tests.
- Latest IN_SCOPE_REPAIR complete frontend suite: `cd frontend && npm test -- --run` — passed: 187 tests.
- Latest IN_SCOPE_REPAIR related backend suite: `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` — passed: 116 tests. Existing pytest-asyncio, `crypt`, and `datetime.utcnow()` deprecation warnings only.
- Latest IN_SCOPE_REPAIR frontend production build: `cd frontend && npm run build` — passed. Vite reported the existing informational >500 kB chunk-size advisory only.
- Latest IN_SCOPE_REPAIR whitespace check: `git diff --check` — passed. `git diff --stat` confirms the worktree still contains mixed unrelated changes, so isolation remains pending.
- Approved name-only internal-option focused frontend tests: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` — passed: 125 tests.
- Approved name-only internal-option complete frontend suite: `cd frontend && npm test -- --run` — passed: 188 tests.
- Approved name-only internal-option frontend production build: `cd frontend && npm run build` — passed. Vite reported only the existing informational >500 kB chunk-size advisory.
- Approved name-only internal-option whitespace check: `git diff --check` — passed.
- Manual browser/accessibility verification remains pending (desktop/tablet/320 CSS px at 200% zoom, visible focus and floating-picker placement/scrolling). Mixed unrelated worktree changes remain a release/review blocker; diff isolation is still required.
- No verification evidence exists yet for the approved number-only-trigger adjustment. After implementation, rerun the focused picker/frontend tests, complete relevant frontend suite, production build and `git diff --check`; manually confirm the closed-trigger text and visible checked names after reopening.
- PASS — approved number-only-trigger adjustment: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 files passed, 125 tests passed. The direct desktop/mobile regression asserts exact zero/nonzero closed-trigger text, selected-name absence from each closed button, and checked-name visibility after reopening the picker.
- PASS — approved number-only-trigger adjustment: `cd frontend && npm run build` → TypeScript and Vite production build passed. Vite emitted only its existing >500 kB chunk-size advisory.
- PASS — approved number-only-trigger adjustment: `git diff --check` → no whitespace errors. The reviewed worktree remains mixed with unrelated changes; diff isolation remains pending and is not claimed complete.
- IN_SCOPE_REPAIR focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` — passed: 35 tests.
- IN_SCOPE_REPAIR full frontend test suite: `cd frontend && npm test -- --run` — passed: 188 tests.
- IN_SCOPE_REPAIR frontend production build: `cd frontend && npm run build` — passed. Vite emitted only its existing informational >500 kB chunk-size advisory.
- IN_SCOPE_REPAIR diff check: `git diff --check` — passed. The worktree remains mixed with unrelated changes; isolation remains pending.
- No verification evidence exists yet for the approved unified-button adjustment. After implementation, rerun the focused hours/App frontend tests, the complete frontend suite, production build and `git diff --check`; manually confirm both exact trigger states and absence of the removed standalone label/counter.
- PASS — unified-button focused frontend test: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → 1 file passed, 35 tests passed.
- PASS — unified-button affected frontend tests: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → 2 files passed, 125 tests passed.
- PASS — unified-button full frontend suite: `cd frontend && npm test -- --run` → 5 files passed, 188 tests passed.
- PASS — unified-button frontend production build: `cd frontend && npm run build` completed successfully. Vite emitted only the existing informational warning for a minified chunk above 500 kB.
- PASS — relevant backend suite: `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` → 116 passed. Existing pytest-asyncio, `crypt`, and `datetime.utcnow()` deprecation warnings only.
- PASS — `git diff --check` → no whitespace errors. The worktree remains mixed with unrelated changes, so diff isolation remains pending.
- Repair round 1: the deliberately exact nonzero accessible label invalidated shared picker-opening test queries that matched only `Deelnemer(s)`. Updated those focused interaction queries to accept either approved trigger state; rerun passed.

---
Status: implemented — automated verification in progress; manual browser/accessibility and mixed-worktree diff-isolation blockers remain
Owner: —
Date: 2026-08-13
