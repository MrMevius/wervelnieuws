# Title
Vergaderbord kaartdetail-modal: labels en helperteksten opschonen

## Context
De kaartdetail-modal op het Vergaderbord bevat dubbele labels en overbodige helperteksten rond **Beschrijving**, **Nieuwe update** en **Bijlagen**. Daardoor oogt de modal drukker dan nodig en verliest de UI onnodig aan rust en scanbaarheid.

Deze change is een kleine visuele polish binnen de bestaande modal. De bedoeling is alleen copy- en layout-opschoning, zonder functionele wijziging aan de onderliggende upload- of bewerkflows.

## Goals / Non-goals
### Goals
- Verwijder dubbele labels in de kaartdetail-modal.
- Verwijder overbodige helperteksten bij beschrijving, update en bijlagen.
- Maak de bijlagensectie rustiger door de expliciete uploadtekst/button te vereenvoudigen of te vervangen door een stillere, bestaande trigger.
- Werk spacing en sectie-layout bij zodat de modal na de opschoning logisch en netjes blijft.
- Laat bestaande interacties voor beschrijving, updates en bijlagen bruikbaar en herkenbaar.

### Non-goals
- Geen functionele wijziging aan uploadlogica.
- Geen herontwerp van de kaartdetail-modal buiten deze polish.
- Geen backendwijzigingen.
- Geen nieuwe features voor beschrijving, updates of bijlagen.

## Proposed approach
1. Lokaliseer de kaartdetail-modal, de secties voor beschrijving/update/bijlagen en de bijbehorende labels/helperteksten.
2. Verwijder de dubbele `Beschrijving` en de helperzin `Klik om de kaartomschrijving direct te bewerken.`.
3. Verwijder de dubbele `Nieuwe update` en de helperzin `De update blijft op dezelfde plek, maar is rustiger opgebouwd.`.
4. Vereenvoudig de bijlagensectie door de helperzin en de teksten `Bijlage selecteren` en `Bijlage uploaden` te verwijderen of te vervangen door een stillere variant die dezelfde uploadflow gebruikt.
5. Pas spacing, margin/padding en verticale ritmiek aan zodat er na de opschoning geen lege of rommelige ruimtes overblijven.
6. Werk gerichte frontendtests bij die nu op gewijzigde labels of secties leunen.
7. Verifieer handmatig dat beschrijving, update plaatsen en bijlagen-upload nog steeds werken zoals voorheen.

## Implementation steps (ordered)
1. Inspecteer de huidige kaartdetail-modalcomponent(en), sectiecomponenten, labels en styles rond beschrijving, nieuwe update en bijlagen.
2. Verwijder de dubbele labels en helperteksten uit de modalmarkup.
3. Pas de bijlagen-CTA aan zodat de uploadflow hetzelfde blijft, maar de zichtbare tekst en presentatie rustiger zijn.
4. Herstel spacing, uitlijning en sectieruimte na het verwijderen van tekstblokken.
5. Actualiseer de relevante frontendtests voor kaartdetail en bijlagen, inclusief eventuele label-asserties.
6. Voer de gerichte verificatie uit op de vergaderbord-UI en controleer dat de modal visueel rustig blijft zonder lege ruimtes.

## Acceptance criteria
1. Elk genoemd dubbel label of overbodig tekstblok is verwijderd.
2. Uploaden van bijlagen werkt nog steeds zoals nu.
3. De layout blijft netjes en logisch, zonder lege of rommelige ruimtes na de opschoning.
4. Bestaande interacties voor beschrijving, updates en bijlagen blijven bruikbaar.
5. Er is geen bredere modal-redesign of functionele wijziging geïntroduceerd.

## Testing plan
- Gerichte frontend-tests voor de vergaderbord kaartdetail-modal en bijlagenflow.
- Relevante testfile(s) voor de vergaderbord-UI draaien, inclusief eventuele snapshots of label-asserties die door de tekstwijzigingen geraakt worden.
- Handmatige smoke-check van de modal: beschrijving bewerken, update plaatsen, bijlagen selecteren/uploaden en visuele spacing beoordelen.

## Risk + rollback plan
### Risks
- Kleine kans op frontend-testbreuk door gewijzigde labels of helperteksten.
- Layout kan te krap of juist te ruim worden na het verwijderen van tekstblokken.
- De bijlagen-CTA kan per ongeluk een bestaande uploadinteractie minder duidelijk maken.

### Rollback
- Zet de verwijderde labels/helperteksten en de aangepaste spacing terug.
- Herstel de vorige bijlagen-CTA-tekst of buttonpresentatie als de stille variant onduidelijk blijkt.
- Omdat de change UI-only is, is rollback beperkt tot frontend copy/styling.

## Notes / links
- Bron: door de gebruiker aangeleverde Draft Change Spec Outline.
- Relevante context/specs:
  - `opsx/changes/2026-06-17-vergaderbord-kaart-detail-ux-ui-polish.md`
  - `opsx/changes/2026-06-16-voeg-kaartbijlagen-toe-aan-vergaderbord-kaarten.md`
- Docs impact: alleen deze change spec en de eindstatus/evidence; geen extra gebruikersdocumentatie verwacht.

## Current status
Completed

## What changed
- Verwijderd uit de kaartdetail-modal: de extra `Beschrijving`-label, de helperzin bij beschrijving, de extra `Nieuwe update`-label, de helperzin bij nieuwe updates en de bijlage-helperzin.
- Vereenvoudigde bijlagen-CTA in de modal: de zichtbare `Bijlage selecteren`-tekst is weg, en de uploadknop heet nu `Toevoegen`.
- Spacing en paddings van de modal-secties en uploadzone zijn licht aangescherpt zodat de modal na het schrappen van copy rustiger blijft.
- Uploadgedrag en bestaande interacties zijn ongewijzigd gebleven.

## How to verify
Na implementatie:
- draai `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` in `frontend/`;
- open de kaartdetail-modal en controleer dat de genoemde dubbele labels/helperteksten niet meer zichtbaar zijn;
- controleer dat bijlagen nog steeds gekozen en geüpload kunnen worden via de bestaande flow.

## Verification evidence
- `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅
- Resultaat: 1 testbestand, 48 tests geslaagd, inclusief assertie dat `Beschrijving` nog maar één keer zichtbaar is in de detailmodal.

---
Status: completed
Owner: n.v.t.
Date: 2026-06-22
