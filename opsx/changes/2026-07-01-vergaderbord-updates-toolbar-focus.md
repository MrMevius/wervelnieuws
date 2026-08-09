# Title
Vergaderbord updates-editor toolbar alleen zichtbaar bij focus

## Context
In de kaartdetailweergave van het Vergaderbord is de rich-text toolbar van de updates-editor momenteel altijd zichtbaar. Daardoor oogt de UI drukker dan gewenst en wijkt het gedrag af van het beoogde focusgedrag: de toolbar moet alleen zichtbaar zijn wanneer de gebruiker echt in de editor werkt.

Deze change beperkt zich tot de frontend UX rond de updates-editor in kaartdetail. De bestaande editorfunctionaliteit moet ongewijzigd blijven; alleen de zichtbaarheid en focus-ervaring van de toolbar wordt aangescherpt voor zowel het aanmaken van een nieuwe update als het bewerken van een bestaande update.
Review-opmerking: focus mag niet alleen op de textarea worden gemeten; de volledige editor-shell moet als focusgebied gelden zodat de toolbar ook verdwijnt wanneer focus via toolbar-knoppen of keyboard/tab-navigatie de shell verlaat.

## Goals / Non-goals
### Goals
- Verberg de toolbar van **Nieuwe update** standaard.
- Toon de toolbar zodra de gebruiker in de editor-shell klikt of focus geeft.
- Verberg de toolbar opnieuw zodra focus de editor-shell volledig verlaat, ook als dat gebeurt via toolbar-knoppen of keyboard/tab-navigatie.
- Pas exact hetzelfde zichtbaarheidsgedrag toe op **Update bewerken**.
- Laat bestaande formatteringsknoppen en editor-acties volledig werken.
- Laat de beschrijving-editor in dezelfde kaartdetailweergave ongewijzigd functioneren.
- Werk gerichte frontendtests bij of voeg ze toe voor dit focus/blur-gedrag.

### Non-goals
- Geen backendwijzigingen.
- Geen API- of datamodelwijzigingen.
- Geen redesign van de topic/detail rich-text editor buiten deze toolbar-zichtbaarheid.
- Geen nieuwe toolbarfunctionaliteit of extra opmaakopties.
- Geen brede visuele herstructurering van de kaartdetailmodal.

## Proposed approach
1. Inventariseer de huidige updates-editor in `VergaderbordenPage` en bepaal hoe toolbar-zichtbaarheid nu wordt aangestuurd.
2. Introduceer of hergebruik een lokale focus-state of CSS `:focus-within`-aanpak op de volledige editor-shell (niet alleen de textarea) zodat de toolbar alleen zichtbaar is wanneer de shell echt focus bevat.
3. Pas zowel de **Nieuwe update**-composer als de **Update bewerken**-composer op dezelfde manier aan.
4. Zorg dat clicks op toolbarknoppen, tekstinvoer en andere interactieve elementen binnen de editor-shell de toolbar zichtbaar houden zolang de focus binnen de shell blijft.
5. Laat blur naar buiten de editor-shell de toolbar verbergen, inclusief bij focusverlies via toolbar-acties en keyboard/tab-navigatie, zonder inhoud of opmaakfunctionaliteit te verstoren.
6. Actualiseer gerichte frontendtests voor zichtbaarheids-, focus- en regressiegedrag.
7. Voeg indien vereist door repo-conventie een korte About/changelog-entry toe voor deze UX-wijziging.

## Implementation steps (ordered)
1. Lokaliseer de updates-editorcomponenten in `frontend/src/app/features/admin/VergaderbordenPage.tsx` en de bijbehorende tests in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`.
2. Breng in kaart welke wrapper als editor-shell kan dienen voor focus/blur-gedrag.
3. Implementeer toolbar-zichtbaarheid zodat deze standaard verborgen is en alleen zichtbaar wordt bij focus of interactie binnen de editor-shell.
4. Pas dezelfde logica toe op de bewerkmodus voor updates.
5. Controleer dat toolbar-acties, selectiegedrag en invoer niet worden geblokkeerd door de zichtbaarheidseisen.
6. Verifieer dat de beschrijving-editor dezelfde kaartdetailflow zonder regressies blijft gebruiken.
7. Werk of breid gerichte frontendtests uit voor:
   - standaard verborgen toolbar,
   - zichtbaar bij focus/klik,
   - verborgen bij blur buiten de shell,
   - bewerkmodus met hetzelfde gedrag,
   - behoud van formatteringsacties.
8. Voeg indien nodig een korte changelog/About-entry toe volgens de repositoryconventie.

## Acceptance criteria
1. De toolbar van **Nieuwe update** is standaard verborgen bij het openen van kaartdetail.
2. De toolbar verschijnt zodra de gebruiker in de nieuwe update-editor klikt of focus geeft.
3. De toolbar verdwijnt zodra focus de volledige editor-shell verlaat, ook na interactie met toolbar-knoppen en via keyboard/tab-navigatie.
4. Dezelfde zichtbaarheidseisen gelden voor **Update bewerken**.
5. Formatteringsknoppen blijven functioneel werken terwijl de toolbar zichtbaar is.
6. De beschrijving-editor blijft ongewijzigd bruikbaar en vertoont geen regressie.
7. Er is geen backend-, API- of opslagwijziging nodig voor deze UX-aanpassing.
8. Gerichte frontendtests dekken het focus/blur-gedrag en de belangrijkste regressies.

## Testing plan
- Gerichte frontendtest(s) voor `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`.
- Verwachte command(s):
  - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - `cd frontend && npm run build`
- Handmatige browsercheck:
   1. Open kaartdetail en controleer dat de toolbar bij **Nieuwe update** verborgen is.
   2. Klik/focus in de editor en controleer dat de toolbar verschijnt.
   3. Tab of klik buiten de volledige editor-shell en controleer dat de toolbar verdwijnt, ook na gebruik van toolbar-knoppen.
   4. Herhaal dit voor **Update bewerken**.
   5. Check dat formatteringsknoppen nog werken.
   6. Check dat de beschrijving-editor niet is beïnvloed.

## Risk + rollback plan
### Risks
- `focus-within` of lokale focus-state kan edge cases geven rond keyboard-navigatie en toolbar-interactie.
- Toolbar-knoppen kunnen per ongeluk als blur-trigger worden gezien als de shell-grenzen te smal zijn.
- CSS-only verbergen kan onbedoeld impact hebben op accessibility, vooral voor toetsenbordgebruik.

### Rollback
- Revert de zichtbaarheid-/focuswijzigingen in de frontend styles en componentlogica.
- Herstel de vorige toolbarweergave als focusgedrag regressies of toegankelijkheidsproblemen veroorzaakt.
- Geen data- of backendrollback nodig, omdat deze change frontend-only is.

## Notes / links
- Bron: door de gebruiker aangeleverde discovery/outline.
- Slug: `vergaderbord-updates-toolbar-focus`.
- Relevante context/specs in dezelfde UX-lijn:
  - `opsx/changes/2026-05-28-rijkere-markdown-editor-vergaderbord-updates.md`
  - `opsx/changes/2026-06-17-vergaderbord-kaart-detail-ux-ui-polish.md`
- Doc-impact: waarschijnlijk beperkt; alleen een About/changelog-entry toevoegen als dat volgens de repo-conventie voor afgeronde iteraties nodig is.

## Current status
Done

## What changed
- Frontendtestdekking is uitgebreid met echte keyboard-Tab-flow via `userEvent.tab()` voor zowel **Nieuwe update** als **Update bewerken**.
- De test bewijst dat de toolbar zichtbaar blijft zolang focus in de editor-shell zit en verdwijnt zodra Tab de shell verlaat.
- `@testing-library/user-event` is als frontend dev dependency toegevoegd om deze realistische keyboardnavigatie te testen.

## How to verify
1. `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
2. Handmatig in kaartdetail:
   - open **Nieuwe update** en controleer dat de toolbar verschijnt zodra de editor-shell focus krijgt;
   - Tab door de update-editor en controleer dat de toolbar verdwijnt zodra focus de shell verlaat;
   - herhaal dit bij **Update bewerken**.

## Verification evidence
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅
  - Resultaat: 51 tests passed.
- `npm install -D @testing-library/user-event` ✅
  - Resultaat: dependency added for real keyboard-tab coverage.

---
Status: done
Owner: n.v.t.
Date: 2026-07-01
