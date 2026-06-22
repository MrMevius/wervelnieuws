# Title
Compacte 1-regel kaart-verplaats update in kaartmodal

## Context
Kaart-verplaats updates in de kaartmodal worden nu over meerdere regels getoond. Daardoor nemen ze onnodig veel verticale ruimte in en zijn ze minder snel scanbaar.

De gewenste aanpassing is klein en visueel gericht: automatische kaart-verplaats updates compacter tonen in de kaartmodal, zonder de verplaatsing zelf of andere updateflows te wijzigen.

## Goals / Non-goals
### Goals
- Toon automatische kaart-verplaats updates in de kaartmodal op één regel.
- Gebruik het format `Kaart verplaatst: <bron> → <doel>`.
- Laat bestaande kaart-verplaats updates, waar technisch haalbaar, ook compact renderen zonder datamigratie.
- Laat handmatige updates en andere systeemupdates ongewijzigd.

### Non-goals
- Geen wijziging aan andere update-types.
- Geen wijziging aan andere schermen buiten de kaartmodal.
- Geen functionele wijziging aan het verplaatsen van kaarten zelf.
- Geen datamigratie of herschrijving van opgeslagen updates tenzij later expliciet nodig blijkt.

## Proposed approach
1. Hergebruik de bestaande detectie van automatische kaart-verplaats updates.
2. Pas uitsluitend de renderweergave in de kaartmodal aan naar één compacte regel met pijlnotatie.
3. Zorg dat bestaande updates met een passend move-patroon dezelfde compacte rendering krijgen, zonder data te wijzigen.
4. Houd fallback-rendering voor handmatige en overige systeemupdates intact.
5. Dek het gedrag af met gerichte UI-tests rond nieuwe en bestaande updates.

## Implementation steps (ordered)
1. Lokaliseer de kaartmodal-renderer en de logica voor automatische kaart-verplaats updates.
2. Definieer het compacte renderformaat exact als `Kaart verplaatst: <bron> → <doel>`.
3. Pas de renderer aan zodat zowel nieuwe als bestaande move-updates compact worden weergegeven waar het opgeslagen patroon dit toelaat.
4. Behoud de bestaande rendering voor handmatige updates en andere systeemupdates.
5. Voeg of werk gerichte tests bij voor:
   - een nieuwe automatische kaart-verplaats update,
   - een bestaande kaart-verplaats update,
   - een handmatige update die ongewijzigd blijft.
6. Voer gerichte verificatie uit in de kaartmodal en leg de resultaten vast.

## Acceptance criteria
1. Een automatische kaart-verplaats update wordt in de kaartmodal op één regel getoond.
2. De weergave volgt exact het formaat `Kaart verplaatst: <bron> → <doel>`.
3. Bestaande kaart-verplaats updates worden ook compact weergegeven, mits technisch haalbaar zonder datamigratie.
4. Handmatige updates blijven visueel en functioneel ongewijzigd.
5. Andere systeemupdates blijven ongewijzigd.

## Testing plan
- Gerichte UI-test(s) voor de kaartmodal met:
  - nieuwe automatische move-update,
  - bestaande move-update,
  - handmatige update als regressiecheck.
- Handmatige controle in de kaartmodal op één representatieve kaart met updatehistorie.
- Indien frontend tooling dat vereist: relevante frontend build/typecheck voor het gewijzigde gebied.

## Risk + rollback plan
### Risks
- Bestaande updates kunnen anders opgeslagen zijn dan verwacht, waardoor niet alle historische move-updates automatisch compact te renderen zijn.
- Een te brede patroonherkenning kan per ongeluk andere updates meenemen.

### Mitigation
- Beperk de wijziging tot de move-update renderer in de kaartmodal.
- Laat fallbackgedrag voor alle niet-move-updates intact.
- Test expliciet zowel nieuwe als bestaande updates.

### Rollback
- Zet de kaartmodal-rendering van kaart-verplaats updates terug naar de huidige multiline logica.
- Geen datamigratie terugdraaien nodig als er geen opslagwijziging is doorgevoerd.

## Notes / links
- Afgeleid van de ingestuurde Draft Change Spec Outline.
- Waarschijnlijk geen externe docs nodig; wel deze spec en verificatie-evidence bijwerken.
- Gerelateerd aan eerdere compactere verplaats-update specs in de repository.

## Current status
Completed

## What changed
- De kaartmodal-renderer toont automatische en bestaande kaart-verplaats updates compact als `Kaart verplaatst: <bron> → <doel>`.
- De bestaande fallback voor handmatige updates en andere systeemupdates blijft ongewijzigd.
- De gerichte `VergaderbordenPage.test.tsx`-dekking bevestigt de compacte move-weergave zonder datamigratie.

## How to verify
1. Run: `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` vanuit `frontend/`.
2. Run: `npm run build` vanuit `frontend/`.
3. Handmatige UI-check in de kaartmodal:
   - een automatische kaart-verplaats update is één regel met `Kaart verplaatst: <bron> → <doel>`;
   - een bestaande kaart-verplaats update wordt ook compact weergegeven;
   - handmatige updates en andere systeemupdates blijven ongewijzigd.

## Verification evidence
- ✅ `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` (frontend/)
  - Resultaat: 1 testbestand geslaagd, 37 tests passed.
- ✅ `npm run build` (frontend/)
  - Resultaat: geslaagde TypeScript/Vite productiebuild.

---
Status: completed
Owner: n.v.t.
Date: 2026-06-13
