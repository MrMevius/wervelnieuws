# Title
Vergaderborden: kaartjes binnen dezelfde kolom herschikken

## Context
Gebruikers kunnen kaartjes momenteel wel tussen kolommen verplaatsen, maar niet betrouwbaar binnen dezelfde kolom herschikken. Gewenst gedrag is dat een kaartje omhoog/omlaag kan worden gesleept binnen dezelfde kolom, dat de visuele drop-positie duidelijk is tijdens slepen, en dat de nieuwe volgorde blijvend wordt opgeslagen na verversen.

Dit is een gerichte uitbreiding op de bestaande vergaderborden-drag-and-drop, geen nieuw DnD-framework en geen redesign van het bord.

Probleem: de horizontale invoeglijn is in de praktijk niet zichtbaar tijdens slepen.
Waarschijnlijke oorzaak: de drag-over state vertrouwt op browser-onbetrouwbare `dataTransfer.getData(...)`-reads tijdens `dragover`.

Aanvullende fix-scope: correct berekenen van target position voor bottom-drop edge cases zodat een kaart onderaan een niet-lege kolom echt als laatste landt, inclusief same-column reorder en cross-column moves waar relevant.

Aanvullende scope-uitbreiding: fix van drag state / indicator state zodat de invoeglijn betrouwbaar zichtbaar wordt tijdens slepen, zowel binnen dezelfde kolom als naar andere kolommen.

Reviewpunten die nog expliciet afgedekt moeten worden:
- een gerichte frontendregressietest voor same-column reorder;
- verdere verharding van het drag-indicator-pad zodat dit tijdens `dragover` primair niet leunt op `dataTransfer.getData()`;
- een handmatige browser-smoke-test waarvan het resultaat in deze spec wordt vastgelegd.

## Goals / Non-goals
### Goals
- Kaartjes kunnen binnen dezelfde kolom omhoog/omlaag worden gesleept.
- De invoegpositie is visueel duidelijk tijdens drag/drop.
- De invoegindicator is een duidelijke horizontale streep op de precieze landingspositie.
- De nieuwe volgorde wordt persistent opgeslagen en blijft behouden na refresh.
- Bestaand verplaatsen tussen kolommen blijft werken.
- Relevante frontend- en backendtests dekken het gedrag.
- Droppen onderaan een kolom met bestaande kaarten plaatst de kaart echt als laatste.
- Er is een expliciete frontendregressietest voor same-column reorder.
- De indicator-state vertrouwt tijdens `dragover` primair niet op `dataTransfer.getData()`.
- Een handmatige browser-smoke-test wordt uitgevoerd en als evidence vastgelegd.

### Scope in
- Fix van drag state / indicator state zodat de invoeglijn betrouwbaar zichtbaar wordt tijdens slepen.
- Werkt zowel binnen dezelfde kolom als tussen verschillende kolommen.
- Correct berekenen van target position voor bottom-drop, same-column reorder en cross-column moves waar relevant.
- Relevante regressietests voor top/midden/bottom drop-posities.
- Expliciete frontenddekkking voor same-column reorder.
- Verdere verharding van drag-state / indicator-pad waar passend, met minimale afhankelijkheid van `dataTransfer.getData()` tijdens `dragover`.
- Vastleggen van handmatige browser-smoke-test evidence.

### Non-goals
- Geen volledig nieuw drag-and-drop framework.
- Geen grote redesign van de bord-UI.
- Geen wijzigingen aan andere workflows of contentdomeinen buiten Vergaderborden.
- Geen nieuwe functionaliteit voor slepen tussen verschillende borden.
- Geen grote restyling van het bord.
- Geen vervanging van het bestaande drag-and-drop systeem.

### Scope out
- Redesign van de UI.
- Vervanging van het drag-and-drop systeem.

## Proposed approach
1. Hergebruik de bestaande board- en drag/drop-architectuur waar mogelijk.
2. Breid de frontend-dropafhandeling uit zodat same-column drops een echte reorder-actiesemantiek krijgen in plaats van een no-op.
3. Laat de UI tijdens slepen duidelijk zien waar het kaartje ingevoegd wordt, zonder te vertrouwen op onbetrouwbare `dataTransfer.getData(...)`-reads tijdens `dragover`.
4. Gebruik hiervoor een horizontale invoegstreep tussen kaarten, of bovenaan/onderaan een kolom waar relevant.
5. Sla de nieuwe volgorde op via de bestaande backendlaag of een minimale uitbreidende API aanpassing die expliciet een doelpositie binnen dezelfde kolom accepteert.
6. Zorg dat persistente sortering bij laden de opgeslagen volgorde respecteert.
7. Voeg gerichte regressietests toe voor reorder binnen kolom, grensgevallen aan begin/einde van de kolom, bottom-drop positionering en behoud van cross-column gedrag.
8. Werk indien passend de repo-changelog/About-pagina bij volgens bestaande conventies.

## Implementation steps (ordered)
1. Inspecteer de huidige Vergaderborden DnD- en sorteerlogica in frontend en backend.
2. Bepaal het huidige positioneringsmodel en hoe kaartvolgorde per kolom wordt opgeslagen en opgehaald.
3. Implementeer same-column reorder in de frontend met duidelijke visuele drop-indicator.
4. Breid de backend/API uit of pas de bestaande move-logica aan zodat een nieuwe positie binnen dezelfde kolom correct wordt gepersisteerd.
5. Zorg dat ophalen/renderen van kaarten de opgeslagen order gebruikt en refresh-safe is.
6. Verifieer dat cross-column verplaatsen ongewijzigd blijft werken.
7. Voeg frontendtests toe voor slepen binnen dezelfde kolom en visuele/interactionele kernpaden.
8. Voeg backend/API-tests toe voor persistente volgorde, begin/einde-posities en regressie op cross-column moves.
9. Werk docs/changelog bij indien de repository dat voor deze UI-wijziging verwacht.

## Acceptance criteria
1. Kaartjes kunnen binnen dezelfde kolom omhoog en omlaag worden gesleept.
2. Tijdens slepen is de beoogde invoegpositie visueel duidelijk.
3. Tijdens slepen verschijnt een duidelijke horizontale streep op de invoegpositie.
4. De streep is zichtbaar tussen twee kaarten, of bovenaan/onderaan een kolom waar relevant.
5. Dit werkt zowel binnen dezelfde kolom als bij slepen naar een andere kolom.
6. Bestaande reorder-functionaliteit blijft werken.
7. Relevante tests worden bijgewerkt.
8. Na verversen staat de kolomvolgorde nog steeds goed.
9. Verplaatsen tussen kolommen blijft functioneren zoals voorheen.
10. Frontend- en backendtests dekken reorder binnen dezelfde kolom en relevante randgevallen.
11. Frontendtests dekken dat de invoeglijn zichtbaar en stabiel wordt weergegeven zonder afhankelijkheid van onbetrouwbare `dataTransfer`-reads tijdens `dragover`.
12. Minimaal één handmatige browser-check bevestigt dat de invoeglijn echt zichtbaar is tijdens same-column en cross-column slepen.
13. Droppen onderaan een kolom met bestaande kaarten plaatst de kaart echt als laatste.
14. Dit werkt zowel bij verplaatsen naar een andere kolom als bij reorder binnen dezelfde kolom waar van toepassing.
15. Relevante regressietests dekken top/midden/bottom drop-posities.
16. Bestaande zichtbare invoeglijn en move-functionaliteit blijven intact.

## Testing plan
- Frontendtests voor same-column reorder en visuele drop-positie.
- Frontendtests voor indicator-rendering in beide situaties (same-column en cross-column), zonder afhankelijkheid van onbetrouwbare `dataTransfer`-reads tijdens `dragover`.
- Backend/API-tests voor het opslaan en teruglezen van de nieuwe volgorde, inclusief eerste/laatste positie en bottom-drop target positionering.
- Regressietests voor top, midden en bottom drop-posities over meerdere kaarten.
- Regressietests dat cross-column moves ongewijzigd blijven.
- Handmatige verificatie:
  1. Sleep een kaartje binnen dezelfde kolom naar een andere positie.
  2. Ververs de pagina.
  3. Controleer dat de volgorde behouden is.
  4. Sleep daarna een kaartje naar een andere kolom en bevestig dat dat nog steeds werkt.
  5. Controleer in de browser dat de horizontale invoegstreep zichtbaar en correct gepositioneerd is.
  6. Controleer dit zowel binnen dezelfde kolom als tussen verschillende kolommen.
  7. Test expliciet top-, midden- en bottom-drop-posities in een kolom met meerdere kaarten.
  8. Controleer dat bottom-drop onderaan een niet-lege kolom het kaartje als laatste plaatst.

## Risk + rollback plan
### Risks
- Off-by-one fouten bij positionering of persistente volgorde.
- Off-by-one fouten bij bottom-drop target positionering.
- Regresies in cross-column drag/drop.
- UI kan misleidend gedrag tonen als frontend-volgorde en backend-volgorde tijdelijk uit elkaar lopen.
- Visuele flicker of onduidelijke spacing rond de invoegstreep.
- Regresie in bestaande drag/drop events door de state-aanpassing voor de invoeglijn.
- Regresie in drag/drop edge-cases door verdere hardening van het indicator-pad.
- Extra flicker of timingverschillen in de drag-indicator bij same-column reorder.

### Rollback
- Revert de nieuwe reorder-logica voor same-column drag/drop.
- Herstel het eerdere gedrag waarbij dezelfde kolom geen reorder-effect had.
- Laat cross-column verplaatsing intact als afzonderlijke paden dat toelaten.

## Notes / links
- Slugvoorstel: `reorder-board-cards-within-column`
- Relevante scope: alleen Vergaderborden, bestaande board-UX behouden.
- Docs-impact: beperkt; voeg alleen een changelog/About-entry toe als de repo dat voor deze iteratie voorschrijft.

## Current status
Completed — de expliciete same-column regressietest, de hardening van het dragover/indicator-pad en de handmatige browser-smoke-test zijn afgerond en vastgelegd.

## What changed
- Dragover op bordkolommen en kaarttargets gebruikt nu uitsluitend de ref-gebonden drag state; `dataTransfer.getData(...)` blijft alleen als drop-fallback bestaan.
- De invoegindicator blijft daardoor stabiel tijdens slepen zonder primaire afhankelijkheid van browser-onbetrouwbare `dataTransfer`-reads tijdens `dragover`.
- Er is nu een expliciete frontendregressietest voor same-column reorder, inclusief een `dataTransfer`-onleesbare drag state op het dragover-pad.
- Bestaande cross-column move- en bottom-drop-regressiedekking blijft intact.
- De handmatige browser-smoke-test is vastgelegd als geslaagde verificatie voor same-column reorder, cross-column move en bottom-drop invoeglijn-zichtbaarheid.

## How to verify
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`
- Handmatig: sleep een kaart binnen dezelfde kolom en naar een andere kolom; controleer dat de horizontale invoegstreep zichtbaar is tijdens drag-over en dat reorder/move blijft werken.

## Verification evidence
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅ (46 tests passed)
- `cd frontend && npm run build` ✅
- Testuitbreiding: expliciete same-column regressiedekking toegevoegd; dragover gebruikt ref-state en de test draait met een `dataTransfer`-mock waarvan `getData(...)` niet nodig is.
- Handmatige browser-smoke-test (gebruiker): "Yes ziet er goed uit" — bevestigd voor same-column reorder, cross-column move en bottom-drop invoeglijn-zichtbaarheid.

## Follow-ups
Geen.

---
Status: done
Owner:
Date: 2026-06-17
