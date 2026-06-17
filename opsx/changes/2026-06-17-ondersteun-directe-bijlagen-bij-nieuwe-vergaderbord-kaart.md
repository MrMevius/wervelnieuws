# Title
Ondersteun directe bijlagen tijdens het aanmaken van een nieuwe vergaderbord-kaart

## Context
Gebruikers kunnen momenteel wel bijlagen toevoegen bij het bewerken van bestaande vergaderbord-kaarten, maar niet tijdens het aanmaken van een nieuwe kaart. Daardoor moet een kaart eerst worden aangemaakt voordat bestanden kunnen worden toegevoegd, wat de create-flow onnodig onderbreekt.

De eerder afgeronde change `opsx/changes/2026-06-16-voeg-kaartbijlagen-toe-aan-vergaderbord-kaarten.md` maakte een post-create detailflow acceptabel. De huidige applicatie-werking is dus conform die spec; dit is een gerichte UX-follow-up om bijlagen direct in de nieuwe-kaartflow te ondersteunen.

Deze follow-up blijft frontend-led en hergebruikt de reeds opgeleverde attachment-backendcapability uit die afgeronde change; er komt geen nieuwe backend-scope bij. Eventuele backend attachment-bestanden in de worktree horen bij de afgeronde 2026-06-16 change en zijn niet onderdeel van deze follow-up.

## Goals / Non-goals
### Goals
- Voeg directe bijlage-selectie toe aan de inline create-flow van een nieuwe vergaderbord-kaart.
- Ondersteun meerdere geselecteerde bestanden in v1.
- Laat de kaart eerst succesvol aanmaken en upload daarna automatisch de geselecteerde bijlagen met het nieuwe kaart-id.
- Toon tijdens create + auto-attach expliciete, zichtbare upload-/verwerkingsfeedback.
- Toon duidelijke Nederlandse feedback bij gedeeltelijke mislukking: kaart is aangemaakt, maar één of meer uploads zijn mislukt.
- Behoud de bestaande attachment-flow voor bestaande kaarten ongewijzigd.
- Voeg gerichte regressietests toe voor create + auto-attach, no-attachment en partial-failure gedrag.
- Werk changelog/About bij als de implementatie wordt uitgevoerd.

### Non-goals
- Geen draft/temp-upload systeem.
- Geen nieuw atomic multipart create-card endpoint.
- Geen brede redesign van de kaartaanmaak-UI buiten de attachment-UX.
- Geen uitbreiding buiten vergaderbord-kaarten.
- Geen wijziging van de bestaande attachment-flow op bestaande kaarten.
- Geen nieuwe backend-scope; alleen hergebruik van de reeds beschikbare attachment-endpoints/capability.

## Proposed approach
- Reuse bestaande create-card en upload-attachment endpoints en de eerder opgeleverde attachment-backendcapability; de oplossing blijft frontend-gedreven.
- In de nieuwe-kaartform wordt een attachment picker toegevoegd die meerdere bestanden bewaart in lokale component state.
- Bij submit maakt de UI eerst de kaart aan en uploadt daarna de geselecteerde bestanden sequentieel of in een gecontroleerde batch met het nieuw verkregen card-id.
- De UI houdt zichtbare progress/processing/error state bij zodat de gebruiker ziet wat er gebeurt tijdens create + auto-upload.
- Bij partial failure blijft de kaart bestaan; de UI meldt welke upload(s) faalden en dat de rest wel is toegevoegd.
- De bestaande edit/detailflow voor attachments blijft intact en herbruikbaar.

## Implementation steps (ordered)
1. Inspect the current VergaderbordenPage create-card flow, attachment upload helpers, and client methods to identify the minimal insertion points.
2. Extend the new-card inline form UI with an attachment picker that supports multiple file selection and shows the selected files before submit.
3. Store selected files locally in the create-form state without introducing a separate upload step or temp upload model.
4. Update the submit handler so it:
   - creates the card first;
   - uses the returned card id to upload selected files automatically;
   - preserves the existing no-attachment path.
5. Add visible progress/processing feedback for create + auto-attach, plus partial-failure messaging in Dutch, without blocking successful card creation.
6. Ensure the existing-card attachment flow remains unchanged and keeps using the current endpoints.
7. Add/extend frontend tests for:
    - selecting multiple files in the new-card flow;
    - create + auto-upload success;
    - create without attachments;
    - partial upload failure messaging;
    - visible progress/processing state during create + auto-attach.
8. Add changelog/About entry if the repository contains the expected end-user changelog location.

## Acceptance criteria
1. Gebruiker kan tijdens het aanmaken van een nieuwe vergaderbord-kaart meerdere bijlagen selecteren.
2. Bij submit wordt de kaart eerst aangemaakt en worden de gekozen bijlagen daarna automatisch gekoppeld aan die kaart.
3. Een nieuwe kaart zonder bijlagen kan nog steeds normaal worden aangemaakt.
4. Als één of meer uploads na succesvolle kaartaanmaak falen, krijgt de gebruiker duidelijke Nederlandse feedback en blijft de kaart behouden.
5. De bestaande bijlageflow voor al bestaande kaarten blijft werken zoals voorheen.
6. Tijdens create + auto-attach ziet de gebruiker duidelijke zichtbare voortgangs-/verwerkingsfeedback.
7. Relevante frontendtests slagen en de change blijft binnen vergaderbord-scope.

## Testing plan
- Frontend tests gericht op `VergaderbordenPage.tsx` voor:
  - multi-file select in create flow;
  - create + auto-upload success path;
  - no-attachment submit path;
  - partial-failure messaging;
  - visible progress/processing state during create + auto-attach.
- Voeg kleine regressiecoverage toe waar nodig voor client helpers of mocked upload sequencing.
- Run relevante frontend tests/build voor de aangepaste admin-UI.
- Voer backendtests alleen uit als de implementatie toch backendcode raakt.

## Risk + rollback plan
### Risks
- Partial success kan verwarrend zijn als de kaart wel bestaat maar niet alle bijlagen zijn geüpload.
- Extra state in de create-form kan de UX en onderhoudbaarheid complexer maken.
- Sequente upload na create kan bij netwerkproblemen vaker foutmeldingen opleveren.

### Rollback
- Verwijder de nieuwe attachment-picker en auto-uploadlogica uit de new-card flow.
- Verwijder de progress/processing UI-state uit de create-flow.
- Laat de bestaande attachment-support voor bestaande kaarten ongemoeid.
- Geen database- of API-rollback nodig; deze follow-up blijft frontend-led en hergebruikt de backend attachment-capability uit de eerder afgeronde attachment-change.

## Notes / links
- Bron: user-provided Draft Change Spec Outline (leidend voor scope en acceptatie).
- Referenties:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
  - `frontend/src/lib/api/client.ts`
  - `opsx/changes/2026-06-16-voeg-kaartbijlagen-toe-aan-vergaderbord-kaarten.md`
- Docs-impact: update changelog/About-entry als de implementatie wordt uitgevoerd.

## Current status
Completed

## What changed
De inline nieuwe-kaartflow in Vergaderborden ondersteunt nu meerdere bijlagen in één keer met expliciete voortgangsfeedback tijdens aanmaken en auto-attach. De kaart wordt eerst aangemaakt en de geselecteerde bestanden worden daarna automatisch geüpload met het nieuwe kaart-id. Bij gedeeltelijke uploadfouten blijft de kaart bestaan en ziet de gebruiker een duidelijke Nederlandse melding. De bestaande bijlageflow voor bestaande kaarten is ongemoeid gelaten. Deze follow-up gebruikt uitsluitend de reeds beschikbare backend attachment-capability uit de eerder afgeronde attachment-change; er zijn in deze follow-up geen backendwijzigingen gedaan.

## How to verify
Frontend:
- `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` → expected: all new-card attachment tests pass.
- `npm run build` → expected: frontend builds cleanly.

Backend:
- Niet nodig; deze fix introduceert geen backendwijzigingen en leunt op de 2026-06-16 backend-capability.

## Verification evidence
`npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` ✅ 44 tests passed.

`npm run build` ✅ tsc + Vite build passed.

Verificatie van de backendcapability verwijst naar `opsx/changes/2026-06-16-voeg-kaartbijlagen-toe-aan-vergaderbord-kaarten.md`; daar zijn de attachment-API/migratie/tests als afgeronde basis vastgelegd.

---
Status: done
Owner: 
Date: 2026-06-17
