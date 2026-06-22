# Title
Klikbare afbeeldingspreview bij bijlagen

## Context
Bijlagen tonen momenteel geen visuele indicatie of preview voor afbeeldingsbestanden. Gebruikers moeten kunnen zien welke bijlagen afbeeldingen zijn en deze direct groter kunnen bekijken zonder de upload-, download- of verwijderflow te verstoren.

Deze change voegt een klikbare image preview/lightbox toe aan de bestaande bijlage-sectie, met minimale impact op niet-afbeeldingsbijlagen en zonder onnodige backend-wijzigingen.

Follow-up scope: de image preview-modal moet ook correct samenwerken met het onderliggende detailmodal-gedrag. Escape mag alleen de bovenste preview-modal sluiten en focus moet binnen de preview-modal blijven zolang deze open is.

Follow-up scope (approved): na het sluiten van de preview moet focus terugkeren naar de thumbnail/preview die de modal opende, en de repo-required About/changelog-update voor deze iteratie moet worden toegevoegd.

## Goals / Non-goals
### Goals
- Toon een zichtbare thumbnail/preview voor afbeeldingsbijlagen in de bijlage-sectie.
- Maak de preview klikbaar.
- Open de afbeelding in een lightbox/modal met grotere weergave.
- Laat de afbeelding in de modal netjes binnen de viewport passen.
- Behoud bestaande acties voor download/verwijderen en de huidige weergave voor niet-afbeeldingsbijlagen.
- Zorg dat Escape alleen de bovenste preview-modal sluit wanneer deze open is.
- Zorg dat toetsenbordfocus binnen de preview-modal blijft zolang deze open is.
- Herstel focus naar de thumbnail/preview-trigger die de modal opende wanneer de preview sluit.
- Werk de About/changelog bij met een korte, end-user-friendly entry over de image preview in attachments.

### Non-goals
- Geen aparte galerij- of bewerkingsfunctionaliteit.
- Geen wijziging aan niet-afbeeldingsbijlagen.
- Geen backend-wijzigingen, tenzij bestaand bestandstype/URL-gebruik extra metadata nodig maakt voor veilige image-detectie.
- Geen nieuwe upload- of bestandsbeheerflow.

## Proposed approach
- Hergebruik de bestaande bijlagekaart/-lijst en voeg een visuele image-state toe op basis van beschikbare metadata zoals MIME-type en, indien nodig, bestands-extensie.
- Render voor afbeeldingen een compacte thumbnail in de bijlage-sectie.
- Open bij klik een modal/lightbox met een responsieve grote preview.
- Zorg dat de modal keyboard- en klikbaar sluitbaar is, en dat de bestaande actieknoppen in de bijlagekaart hun gedrag behouden.
- Zorg dat modal-event handling rekening houdt met een eventueel onderliggend detailmodal en dat focus trap + Escape alleen op de preview-modal werken.
- Bewaar een referentie naar de trigger zodat focus na sluiten terug kan keren naar de juiste thumbnail/preview.
- Voeg de vereiste About/changelog-entry toe in de gebruikelijke repo-locatie en houd de tekst kort, functioneel en gebruikersgericht.
- Als de huidige API geen betrouwbare image-indicatie levert, beperk de oplossing tot bestaande metadata of voeg alleen de kleinste benodigde backend-exposure toe.

## Implementation steps (ordered)
1. Inspect the current attachment UI, attachment data shape, and any existing file-type metadata usage.
2. Define the image-detection rule set (preferred MIME-type, fallback op extensie, en afhandeling bij ontbrekende metadata).
3. Add thumbnail rendering for afbeeldingsbijlagen in de bestaande attachment list/card layout.
4. Implement a reusable modal/lightbox component for enlarged image viewing.
5. Wire click/tap behavior so the thumbnail opens the modal while download/verwijderacties intact blijven.
6. Ensure responsive sizing, overflow handling, accessible close behavior, and topmost-modal keyboard handling (ESC only on preview modal, focus trap while open, close button/backdrop if supported).
7. Restore focus to the originating thumbnail/preview trigger on modal close.
8. Add the required About/changelog entry for the image-preview improvement.
9. Add/adjust frontend tests for image vs non-image attachment rendering, modal open/close behavior, and focus restoration.
10. Run targeted frontend verification for the changed attachment component(s).

## Acceptance criteria
1. Afbeeldingsbijlagen tonen een zichtbare preview/thumb in de bijlage-sectie.
2. Niet-afbeeldingsbijlagen blijven exact de huidige weergave houden.
3. Klik op een afbeeldingspreview opent een lightbox/modal.
4. De grote afbeelding past netjes binnen de viewport/schermruimte.
5. De modal is op een duidelijke manier weer sluitbaar.
6. Download- en verwijderacties blijven werken zoals voorheen.
7. Relevante frontendtests voor de attachment-UI slagen.
8. Als een detailmodal al open is, sluit Escape alleen de preview-modal en blijft de detailmodal open.
9. Tab en Shift+Tab navigeren alleen binnen de preview-modal zolang deze open is.
10. Sluiten via knop en backdrop blijft werken.
11. Na sluiten van de preview keert focus terug naar de thumbnail/preview-trigger die de modal opende.
12. Keyboardgebruikers verliezen hun plaats niet na het sluiten van de preview.
13. De About/changelog bevat een beknopte entry over image previews in attachments.
14. Bestaand open-/sluitgedrag blijft werken zoals voorheen.

## Testing plan
- Handmatige verificatie met minimaal 1 afbeeldingsbijlage en 1 niet-afbeeldingsbijlage.
- Controleer:
  - preview zichtbaar voor image attachments
  - klik opent modal/lightbox
  - sluiten werkt
  - download/verwijderen blijven werken
  - niet-image attachments tonen geen previewwijziging
- Draai de relevante frontend checks/testsuite voor de gewijzigde componenten.

## Risk + rollback plan
### Risks
- Layout-verschuiving in bestaande bijlagekaart door thumbnail-rendering.
- Onjuiste detectie van MIME-type/extensie waardoor previews onterecht wel of niet verschijnen.
- Modal kan focus-/overflowproblemen veroorzaken op kleinere schermen.
- Modal event handling kan bestaande toetsenbordinteracties beïnvloeden.
- Focus trap mag geen toegankelijkheidsregressies introduceren.
- Focus restore kan conflicteren met geneste modal state als refs onjuist worden beheerd.
- De changelog-entry moet functioneel en end-user-friendly blijven, zonder te technisch te worden.

### Rollback
- Verwijder de thumbnail/lightbox UI-laag en herstel de oorspronkelijke bijlageweergave.
- Laat upload/download/verwijderpad en bestaande backend/data-onafhankelijkheid intact.
- Als image-detectie extra backend-metadata vereiste, rol alleen die extra exposure terug als de UI zonder die metadata kan terugvallen op de oude weergave.

## Notes / links
- User request en aangeleverde Draft Change Spec Outline zijn de functionele bron van waarheid.
- Waarschijnlijke startpunten zijn de frontend-componenten waar bijlagen worden weergegeven, plus eventuele gedeelde modal-/previewcomponenten.
- Als de bestaande attachment payload al mime/type/url bevat, heeft deze change waarschijnlijk geen backend-aanpassing nodig.

## Current status
Done

## What changed
De preview-modal kreeg eigen keyboard handling voor Escape en Tab/Shift+Tab, met focus-omloop binnen de preview en zonder lek naar de onderliggende detailmodal. Bij sluiten gaat focus nu terug naar de thumbnail die de preview opende. De backend About/changelog bevat een korte, end-user-friendly entry over de nieuwe afbeeldingpreview in bijlagen.

## How to verify
1. Open een kaartdetail met minstens één afbeeldingsbijlage en één niet-afbeeldingsbijlage.
2. Controleer dat alleen de afbeeldingsbijlage een zichtbare thumbnail heeft.
3. Klik de thumbnail en controleer dat een lightbox/modal opent.
4. Controleer dat de afbeelding netjes binnen het scherm blijft en dat sluiten werkt via de sluitknop, backdrop of Escape.
5. Controleer dat download- en verwijderacties nog werken voor de bijlagen.
6. Controleer dat Escape alleen de preview-modal sluit wanneer ook de detailmodal open is.
7. Controleer dat Tab en Shift+Tab binnen de preview-modal blijven zolang deze open is.
8. Sluit de preview en controleer dat focus terugkeert naar dezelfde thumbnail/preview-trigger.
9. Open About of de changelog en controleer dat er een korte entry staat over afbeeldingsbijlagen die groter bekeken kunnen worden.
10. Draai `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` en `npm run build` in `frontend/`.

## Verification evidence
`npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅
`npm run build` ✅

`.venv/bin/pytest tests/test_meta_and_me.py -q` ✅

---
Status: done
Owner: 
Date: 2026-06-22
