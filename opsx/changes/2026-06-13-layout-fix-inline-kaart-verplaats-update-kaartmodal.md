# Title
Layout-fix voor inline kaart-verplaats update in kaartmodal

## Context
De 1-regel weergave voor automatische kaart-verplaats updates in de kaartmodal is opnieuw geregresseerd en wordt weer multiline getoond.

De vermoedelijke oorzaak is dat een recente system-message wijziging de compacte renderer omzeilt of dat de huidige render/layout de update opnieuw over losse regels opsplitst.

De oplossing moet de compacte inline weergave herstellen zonder andere update-types of schermen te raken.

## Goals / Non-goals
### Goals
- Herstel de compacte 1-regel weergave van automatische kaart-verplaats updates in de kaartmodal.
- Laat `Kaart verplaatst: <bron> → <doel>` weer als inline tekst renderen.
- Zorg dat zowel bestaande als nieuwe move-updates dit gedrag volgen.

### Non-goals
- Geen wijziging aan andere update-types.
- Geen wijziging aan andere schermen buiten de kaartmodal.
- Geen backend-opslagwijzigingen, tenzij technisch echt nodig.
- Geen wijzigingen aan handmatige updates of andere systeemupdates.

## Proposed approach
1. Lokaliseer de kaartmodal-component en de renderroute voor automatische kaart-verplaats updates.
2. Controleer waar de recente system-message wijziging de compacte renderer of inline wrapper omzeilt.
3. Herstel uitsluitend de compacte inline rendering voor automatische move-updates in de kaartmodal.
4. Behoud het bestaande format `Kaart verplaatst: <bron> → <doel>` en laat wrappen alleen via normale tekstflow gebeuren.
5. Verifieer dat handmatige updates en andere systeemupdates ongewijzigd blijven.
6. Dek de fix af met een regressietest, frontendtest en build-check.

## Implementation steps (ordered)
1. Vind de kaartmodal en de renderer voor automatische move-updates.
2. Identificeer de regressie: waar de system-message wijziging de compacte renderer/layout heeft omzeild.
3. Pas de minimale frontend-rendering/layout aan zodat move-updates weer als één inline boodschap verschijnen.
4. Controleer dat bestaande en nieuwe move-updates beide het format `Kaart verplaatst: <bron> → <doel>` tonen.
5. Controleer dat handmatige updates en andere systeemupdates visueel ongewijzigd blijven.
6. Voeg of werk een regressietest bij voor move-update rendering in de kaartmodal.
7. Run de relevante frontendtest en frontend build; leg de uitkomst vast.

## Acceptance criteria
1. Automatische kaart-verplaats updates tonen weer als `Kaart verplaatst: <bron> → <doel>`.
2. De update wordt visueel inline getoond en niet opgesplitst over losse regels door render/layout.
3. Bestaande en nieuwe move-updates volgen dit gedrag.
4. Handmatige updates en andere systeemupdates blijven ongewijzigd.

## Testing plan
- Regresstest voor move-update rendering in de kaartmodal.
- Controle dat de system-message lock behouden blijft.
- Relevante frontendtest(s) draaien voor de kaartmodal/renderinglogica.
- Frontend build runnen voor de betrokken code.

## Risk + rollback plan
### Risks
- De recente system-message wijziging kan de compacte renderer opnieuw omzeilen.
- Een te brede layout-aanpassing kan ook andere updateberichten in de modal raken.

### Rollback
- Rollback is terug naar de huidige rendererlogica.
- Beperk rollback tot de modal-renderinglaag; geen opslag- of datamigratie nodig.

## Notes / links
- Afgeleid van de aangeleverde Draft Change Spec Outline.
- Actieve spec is heropend vanwege regressie; prioritaire focus is herstel van de compacte renderer.
- Verificatie-evidence uit de eerdere fix behouden, maar aanvullen met nieuwe regressie-evidence.

## Current status
done

## What changed
- De eerdere fix en verificatie blijven als relevante historie in de spec staan.
- De automatische kaart-verplaats update in de kaartmodal rendert nu weer als één inline message-wrapper (`<span>`) met `Kaart verplaatst: <bron> → <doel>`, zodat de tekst niet door de grid-layout wordt opgesplitst.
- De bestaande move-update-detectie en de niet-bewerkbare / niet-verwijderbare system-message-behandeling zijn ongewijzigd gebleven.
- Handmatige updates en andere systeemupdates zijn niet aangepast.

## How to verify
1. Open de kaartmodal met ten minste één automatische kaart-verplaats update.
2. Controleer dat de update inline rendert als `Kaart verplaatst: <bron> → <doel>`.
3. Controleer dat handmatige updates en andere systeemupdates niet gewijzigd zijn.
4. Run de relevante frontendtest(s) en de frontend build.

## Verification evidence
- `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅
- `npm run build` ✅
- Resultaat: 37 tests passed; production build succeeded.

---
Status: done
Owner: n.v.t.
Date: 2026-06-13
