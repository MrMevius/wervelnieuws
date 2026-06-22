# Title
Vergaderbord kaart-detail UX/UI polish

## Context
De kaart-detailmodal op het Vergaderbord voelt momenteel visueel druk, technisch en te weinig hiërarchisch. De belangrijkste informatie en acties — titel, beschrijving, update-editor, bijlagen, updategeschiedenis en sluiten — lopen visueel te veel door elkaar, waardoor scannability en gebruiksgemak achterblijven.

Deze change is bedoeld als een gerichte, snelle polish binnen de bestaande modal en bestaande productstijl. De modal moet rustiger, consistenter en responsiever worden zonder de kernlogica van kaartbeheer te herontwerpen. Bestaande naastliggende work zoals update-editor- en attachment-verbeteringen mag alleen worden geraakt voor zover dat direct nodig is voor deze modal-polish.

Op basis van review zijn de scope-additions expliciet goedgekeurd voor: het oplossen van de blur/toolbar-race in de beschrijving-editor en het afmaken van de toetsenbordtoegankelijkheid van de gepolijste kaart-detailmodal.

## Goals / Non-goals
### Goals
- Verbeter de visuele hiërarchie tussen titel, beschrijving, update-input, bijlagen en updategeschiedenis.
- Houd `Update plaatsen` functioneel hetzelfde, maar maak de primaire actie visueel rustiger en duidelijker.
- Verbeter attachment-UX met een duidelijke uploadzone en drag & drop, met behoud van de huidige uploadflow.
- Presenteer updates als een duidelijkere chronologische timeline.
- Maak de update-editor-toolbar compacter en consistenter, zonder functies te wijzigen.
- Los de beschrijving-editor blur/toolbar interaction race op, zodat formatteringsacties geen premature save of verlies van actie veroorzaken.
- Integreer de close button beter in de modal-layout.
- Maak de beschrijving visueel duidelijk onderscheidend van updates, maar nog steeds licht bewerkbaar.
- Verhoog de verticale ritmiek, spacing en sectieconsistentie in de modal.
- Zorg voor bruikbaarheid op desktop, tablet en mobiel.
- Maak de modal volledig keyboard-baar binnen de bestaande modal: initial focus management, focus trap while open, en Escape-to-close.
- Voeg basis accessibility-polish toe: zichtbare focus states, voldoende click targets en keyboard-baar gedrag.
- Sta alleen kleine adjacent consistency tweaks toe wanneer ze direct nodig zijn voor deze modal.

### Non-goals
- Geen fundamentele wijziging van kaartlogica, datamodel of workflow.
- Geen nieuwe editorfuncties.
- Geen volledige modal redesign.
- Geen board-brede redesign buiten strikt noodzakelijke adjacent tweaks.
- Geen bredere revisie van de editorarchitectuur of modal-routing buiten de minimale fix voor deze review findings.
- Geen wijziging van upload-/attachment-capabilities buiten de presentatie en interaction polish van deze modal.
- Geen backendwijzigingen tenzij onverwacht noodzakelijk blijkt na inspectie.

## Proposed approach
1. Inspecteer de huidige kaart-detailmodal, update-editor, attachment-rendering, description-weergave en close-flow om de minimale ingreep te bepalen.
2. Breng een duidelijke sectie-structuur aan in de modal: header, beschrijving, update composer, bijlagen, timeline/history.
3. Laat `Update plaatsen` op dezelfde plek en met dezelfde functie, maar verfijn de visuele nadruk, spacing en disabled/loading/error-states.
4. Voeg een duidelijke drag & drop uploadzone toe boven of naast de bestaande attachment-selectie, gekoppeld aan dezelfde uploadhandeling.
5. Maak attachment-acties (upload, download, verwijderen) visueel consistenter en minder link-achtig.
6. Hervorm de updatehistory tot een beter scanbare timeline zonder wijziging in data of inhoud.
7. Verfijn de editor-toolbar visueel (compactere shell, betere uitlijning, heldere hover/focus states) zonder toolbarfuncties te veranderen.
8. Repareer de beschrijving-editor blur/toolbar race zodat formatteringsacties niet door blur een premature save of verlies van actie veroorzaken.
9. Maak de beschrijving visueel los van de updates, met een rustige editable presentatie en duidelijke affordance voor inline bewerking.
10. Integreer de close button in de modalheader/toolbarzône zodat deze minder losstaand aanvoelt.
11. Voeg modal-a11y toe: initial focus bij openen, focus trap binnen de open modal, Escape-to-close en focus return naar de trigger.
12. Pas responsive gedrag en focus/keyboard affordances aan voor desktop, tablet en mobiel.
13. Werk gerichte frontendtests en een end-user changelog/About-entry bij als onderdeel van de implementatie.

## Implementation steps (ordered)
1. Lokaliseer de kaart-detailmodalcomponent(en), attachment UI, update editor, description renderer en bijbehorende styles/tests.
2. Breng de modalstructuur terug naar duidelijke secties met consistente spacing en verticale ritmiek.
3. Verfijn de modalheader en integreer de close button visueel in dezelfde actieregel als de rest van de header controls.
4. Herstyle `Update plaatsen` zodat de primaire actie minder zwaar oogt, maar functioneel en positioneel gelijk blijft.
5. Voeg een attachment dropzone toe die drag & drop ondersteunt en dezelfde uploadflow gebruikt als bestaande selectie-upload.
6. Herstyle attachment items zodat upload/download/verwijder-acties duidelijker zijn dan platte tekstlinks.
7. Presenteer bestaande updates als een chronologische timeline met heldere tijd-/volgordehiërarchie en betere scanbaarheid.
8. Maak de update-editor-toolbar compacter en visueel consistenter, terwijl alle bestaande knoppen/functies behouden blijven.
9. Repareer de beschrijving-editor blur/toolbar interaction race zodat toolbar-formatting geen premature save of verloren actie kan veroorzaken.
10. Geef de beschrijving een eigen visuele treatment die onderscheid maakt tussen beschrijving en updates, met lichte inline edit-affordance.
11. Voeg modal keyboard-a11y toe: initial focus bij openen, focus trap binnen de modal zolang deze open is, Escape sluit de modal en focus keert terug naar de trigger.
12. Controleer en verbeter responsieve layout op desktop, tablet en mobiel zonder componentgedrag te veranderen.
13. Voeg basis toegankelijkheidsverbeteringen toe: duidelijke focus states, voldoende kliktargets, keyboard bruikbaarheid en lokale contrastverbetering.
14. Voeg of actualiseer gerichte frontendtests voor de aangepaste modalpresentatie, de blur/toolbar-fix en de modal keyboard-a11y.
15. Werk de changelog/About-content bij met een korte, gebruikersgerichte entry.
16. Vul deze spec na implementatie aan met `What changed`, `How to verify` en `Verification evidence`.

## Acceptance criteria
1. De modal heeft een duidelijkere hiërarchie tussen titel, beschrijving, update-input, bijlagen en updategeschiedenis.
2. `Update plaatsen` blijft functioneel op dezelfde plek, maar oogt visueel rustiger en duidelijker in state-gedrag.
3. Attachments hebben een duidelijke uploadzone met drag & drop en een nettere presentatie van geüploade items.
4. Download- en verwijderacties voor bijlagen zijn visueel duidelijker dan platte tekstlinks.
5. Updates worden getoond als een beter scanbare chronologische timeline.
6. De update-editor-toolbar is compacter en consistenter, zonder functieverlies.
7. De beschrijving is visueel duidelijk te onderscheiden van updates, maar blijft licht bewerkbaar.
8. De close button voelt geïntegreerd in de modal-layout in plaats van als losstaand element.
9. Spacing en verticale ritmiek zijn consistenter over secties, labels, velden en acties.
10. De aangepaste onderdelen blijven bruikbaar op desktop, tablet en mobiel.
11. Basis toegankelijkheid is verbeterd met zichtbare focus states, bruikbare click targets en keyboard-navigatie.
12. De beschrijving-editor verliest geen formatteringsactie meer door blur/toolbar-interactie; save gebeurt pas op het juiste moment.
13. De modal is volledig keyboard-toegankelijk: initial focus bij openen, focus blijft binnen de modal zolang deze open is, en Escape sluit de modal veilig af.
14. Er zijn geen brede board-redesigns of nieuwe editorfeatures geïntroduceerd.

## Testing plan
- Frontend gerichte tests rond de Vergaderbord-kaartdetailmodal en relevante UI-componenten.
- Frontend regressietests voor de beschrijving-editor blur/toolbar-interactie, zodat toolbar-actions geen premature save veroorzaken.
- Frontend regressietests voor modal-toegankelijkheid: initial focus, focus trap en Escape-to-close.
- Frontend build voor de gewijzigde frontendcode.
- Lint/typecheck alleen als de repository daarvoor een bestaand script heeft; gebruik de repo-standaard voor de betrokken frontendmap.
- Handmatige verificatie op minimaal drie viewportcategorieën: desktop, tablet en mobiel.
- Handmatige smoke-checks:
  - modal openen/sluiten en close button gedrag;
  - `Update plaatsen` flow;
  - update-editor toolbar gebruik;
  - formatteringsacties vanuit de toolbar terwijl de beschrijving-editor focus verliest;
  - attachment selecteren via click en via drag & drop;
  - download- en verwijderacties;
  - timeline/geschiedenis scannen;
  - description inline edit;
  - keyboard navigation, initial focus, focus trap en Escape-to-close.

## Risk + rollback plan
### Risks
- Visuele wijzigingen kunnen layout-regressies veroorzaken in modal- en responsive states.
- Drag & drop kan edge cases opleveren rond hover, focus, error en file-input fallback.
- Timeline-presentatie kan te breed worden bij lange inhoud of veel updates.
- Dichtbij liggende componentwijzigingen kunnen per ongeluk andere board-interacties raken.
- De blur/toolbar-fix kan subtiele timingregressies introduceren in editor save- of formatting-gedrag.
- De focus trap kan interfereren met bestaande toolbar-knoppen, popovers of andere modal-controls als de tabbable volgorde niet exact klopt.

### Rollback
- Revert de nieuwe style wrappers en layout-structuur van de modal.
- Zet drag & drop terug naar de bestaande uploadflow op klik/selectie.
- Herstel de vorige lijstpresentatie voor updates als timeline-rendering regressies geeft.
- Revert de editor blur/toolbar-interaction fix als formatteringsacties of autosave-gedrag regressies vertonen.
- Verwijder of verslap de focus trap / initial-focus logica als deze modal-interactie blokkeert.
- Revert alleen de lokale modalpolish zonder data-, backend- of workflowwijzigingen.

## Notes / links
- Bron: door de gebruiker aangeleverde Draft Change Spec Outline.
- Slug: `vergaderbord-kaart-detail-ux-ui-polish`.
- Gerelateerde context/specs:
  - `opsx/changes/2026-05-28-trello-stijl-updates-editor.md`
  - `opsx/changes/2026-06-17-ondersteun-directe-bijlagen-bij-nieuwe-vergaderbord-kaart.md`
  - `opsx/changes/2026-05-27-edit-card-description.md`
- Deze change blijft bewust binnen de bestaande productstijl met alleen een lichte refresh waar nodig.

## Current status
Completed

## What changed
Implemented the approved review-fix scope inside the existing card-detail modal:
- Prevented description-editor toolbar clicks from racing blur/save, so formatting actions survive and save only after the editor legitimately blurs.
- Added modal keyboard behavior: initial focus on open, focus trapping while open, Escape-to-close, and focus return to the card trigger.
- Kept the existing UX/UI polish intact; no broader redesign or workflow change was introduced.

## How to verify
From `frontend/`:
- `npx vitest run src/app/features/admin/VergaderbordenPage.test.tsx`
- `npm run build`

Then smoke-check the card detail modal on desktop/tablet/mobile for:
- close behavior and focus return;
- title/description editing;
- toolbar formatting inside the description editor;
- update posting;
- attachment upload/download/remove;
- keyboard tab/shift-tab and Escape behavior.

## Verification evidence
`frontend/`:
- `npx vitest run src/app/features/admin/VergaderbordenPage.test.tsx` ✅ 48 tests passed
- `npm run build` ✅ passed (`tsc -b && vite build`)

---
Status: completed
Owner: n.v.t.
Date: 2026-06-17
