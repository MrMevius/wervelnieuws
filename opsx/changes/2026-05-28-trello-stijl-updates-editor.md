# Title
Trello-stijl updates-editor voor vergaderbordkaarten

## Context
De gebruiker wil de updates-editor in vergaderbordkaarten visueel laten aansluiten op een Trello-achtige stijl (op basis van aangeleverde screenshot-referentie), zonder functionele wijzigingen.

Deze wijziging geldt uitsluitend voor de editor-UI van:
- nieuwe update plaatsen;
- bestaande update bewerken.

De bestaande Markdown-toolbaracties, rendering en updateflows moeten functioneel gelijk blijven. De wijziging is dus een gerichte frontend-presentatiepolish.

## Goals / Non-goals
### Goals
- Introduceer een compacte Trello-achtige toolbar/editor-uitstraling voor vergaderbord-update editors.
- Pas dezelfde stijl consistent toe op zowel “nieuwe update” als “update bewerken”.
- Behoud bestaande Markdown-toolbaracties en rendering (geen gedragwijziging).
- Verbeter visuele affordances: hover/focus states, editor shell, knoppen, spacing, responsive wrapping.
- Houd bestaande update-acties (opslaan/bewerken/annuleren/verwijderen/afbeelding) functioneel ongewijzigd.
- Werk relevante tests alleen bij als selectors/DOM-structuur aantoonbaar geraakt worden.
- Voeg een eindgebruikersvriendelijke About/changelog-entry toe conform repo-DOD.

### Non-goals
- Geen nieuwe editorfunctionaliteit (geen nieuwe knoppen/formattering/shortcuts).
- Geen wijzigingen aan Markdown-parser of rendererlogica.
- Geen backend/API/databasewijzigingen.
- Geen volledige redesign van modal/kaartdetail buiten de updates-editor.

## Proposed approach
1. Lokaliseer de frontend-locaties voor update-editor in create- en editflow binnen vergaderbordkaarten.
2. Introduceer beperkte markup/classname-aanpassingen waar nodig voor beter style-targeting, zonder gedrag te veranderen.
3. Implementeer CSS-polish voor:
   - compacte toolbarlayout;
   - knoppenstijl en states (default/hover/focus/active/disabled waar relevant);
   - textarea/editor-container (shell, borders, radius, spacing);
   - responsive wrapping voor small screens.
4. Zorg dat create- en edit-editor exact dezelfde visuele componentstijl delen.
5. Verifieer regressievrij dat bestaande toolbaracties, renderuitkomst en update-actieflows ongewijzigd blijven.
6. Pas tests alleen aan indien impacted door DOM/classnamewijzigingen.
7. Update About/changelog met korte eindgebruikersgerichte entry.

## Implementation steps (ordered)
1. Inventariseer componenten/secties in `frontend` waar:
   - “nieuwe update” editor wordt gerenderd;
   - “update bewerken” editor wordt gerenderd;
   - toolbaractiehandlers al bestaan.
2. Definieer een gedeelde style-haak (classnames/structuur) voor beide editorvarianten.
3. Voer minimale markup/classname-updates door die nodig zijn voor consistente CSS-targeting.
4. Implementeer CSS voor Trello-achtige compacte toolbar en editor shell.
5. Voeg duidelijke keyboard-focus indicatoren toe (zichtbaar contrast) voor toolbarbuttons en invoerveld.
6. Verfijn hover/active states voor muisgebruik zonder keyboard accessibility te degraderen.
7. Implementeer responsive wrapping/overflow-gedrag zodat toolbar bruikbaar blijft op kleine schermen.
8. Controleer functionele regressies in UI-flows:
   - markdown-opmaakacties;
   - save/edit/cancel/delete/image gerelateerde updateflows.
9. Update frontendtests alleen als impacted (selectors/snapshot/DOM-verwachtingen).
10. Voeg About/changelog-entry toe in de bestaande metadata-locatie.
11. Vul verificatie-uitkomsten in onder `Verification evidence` en laat `Current status` op basis van resultaten bijwerken.

## Acceptance criteria
1. De updates-editor toont een compact Trello-achtig opmaakblok met toolbar en editor shell in de vergaderbordkaart-UI.
2. Zowel “nieuwe update” als “update bewerken” gebruiken dezelfde Trello-achtige editorstijl.
3. Bestaande toolbaracties (Markdown formatting controls) blijven werken zoals voorheen.
4. Flows voor opslaan, bewerken, annuleren, verwijderen en afbeelding-gerelateerde updateacties blijven ongewijzigd in gedrag.
5. Editor en toolbar blijven bruikbaar op kleine schermen (geen kritieke overflow die acties ontoegankelijk maakt).
6. Hover- en focus-states zijn zichtbaar en bruikbaar (keyboard focus duidelijk waarneembaar).
7. Er zijn geen backend/API/DB-bestanden functioneel aangepast voor deze wijziging.
8. Relevante tests slagen na eventuele noodzakelijke testupdates.
9. About/changelog bevat een eindgebruikersvriendelijke entry voor deze visuele verbetering.

## Testing plan
- Geautomatiseerd:
  - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - `cd frontend && npm run build`
- Handmatige smoke-test:
  1. Open vergaderbordkaart en controleer nieuwe update-editorstijl.
  2. Open edit-modus van bestaande update en controleer dezelfde stijl.
  3. Test toolbaracties (bestaande markdown-acties) op beide editors.
  4. Test save/edit/cancel/delete/image flows op regressie.
  5. Controleer compacte weergave en wrapping op small-screen viewport.
  6. Controleer zichtbare hover/focus states (inclusief keyboard-tab navigatie).

## Risk + rollback plan
### Risks
- CSS bleed naar andere componenten door te brede selectors.
- Toolbar overflow of onbruikbare layout op kleinere schermen.
- Frontendtests breken door selector- of DOM-structuurwijzigingen.
- Onvoldoende contrast in focus/hover states bij donkere of afwijkende thema’s.

### Mitigatie
- Scope CSS strikt op vergaderbord-updates-editor classes.
- Gebruik responsive regels met wrapping i.p.v. horizontale clipping.
- Houd markupwijzigingen minimaal en pas tests gericht aan waar nodig.
- Valideer focus/hover contrast visueel op relevante thema-instellingen.

### Rollback
- Revert alleen frontend presentatieaanpassingen (markup/classnames/CSS) en bijbehorende test/changelogwijzigingen.
- Geen backend/API/DB rollback noodzakelijk.

## Notes / links
- Aangeleverde scope en acceptatiecriteria van gebruiker zijn leidend voor deze spec.
- Beoogd specbestand: `opsx/changes/2026-05-28-trello-stijl-updates-editor.md`.
- Referentie: Trello-achtige visuele stijl op basis van gedeelde screenshot (uitgesproken als UI-richting, niet als functionele uitbreiding).

## Current status
Completed

## What changed
- In `frontend/src/app/features/admin/VergaderbordenPage.tsx` is de updates-editor-structuur voor zowel **Nieuwe update** als **Update bewerken** gelijkgetrokken met gedeelde style hooks:
  - `board-update-editor-shell`
  - `board-update-textarea`
  - `board-update-toolbar-button`
- De bestaande `UpdateFormattingToolbar`-acties en eventhandlers zijn functioneel ongewijzigd gebleven; alleen classnames/markup voor styling-targeting zijn aangepast.
- In `frontend/src/styles.css` is de Trello-achtige visuele polish doorgevoerd voor de updates-editor:
  - compactere editor-shell met border/radius/background;
  - toolbar als compacte bovenbalk;
  - knopstijlen met duidelijke hover/active/focus-visible states;
  - focus-within ring op de editorshell;
  - responsive verfijning voor small screens (wrapping/maatvoering).
- About/changelog bijgewerkt in `backend/app/api/meta.py` met iteratie **51** en eindgebruikersvriendelijke beschrijving van deze visuele verbetering.

## How to verify
1. `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
2. `cd frontend && npm run build`
3. Handmatige smoke volgens stappen in `Testing plan`.

## Verification evidence
- Geautomatiseerd:
  1. `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅ geslaagd
  2. `cd frontend && npm run build` ✅ geslaagd
- Handmatige smoke-test:
  - Niet uitgevoerd in deze CLI-run; aanbevolen om lokaal visueel te bevestigen op desktop + small-screen viewport.

---
Status: completed
Owner: OPSX Implementer
Date: 2026-05-28
