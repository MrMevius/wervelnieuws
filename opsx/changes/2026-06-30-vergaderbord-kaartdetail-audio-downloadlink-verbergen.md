# Title
Vergaderbord kaartdetail: losse audio-downloadlink verbergen

## Context
In de Vergaderbord-kaartdetail UI tonen audio-opnames momenteel zowel een native audio player als een aparte link **"Download opname"**. Die losse link is redundant, omdat downloaden al via de player beschikbaar is.

Deze change is bedoeld als een kleine UI-only opschoning in de bestaande kaartdetailweergave. De onderliggende opnamegegevens en download-URL moeten beschikbaar blijven, maar de extra zichtbare downloadlink wordt in deze specifieke UI verborgen.

Daarnaast staan de labelregel **"Audio-opname"** en de metadataregel met duur en grootte nu nog onder elkaar. Voor een compactere weergave moeten deze opnamegegevens op één regel naast elkaar worden getoond, zonder het gedrag van de player te wijzigen.

## Goals / Non-goals
### Goals
- Verberg de losse **"Download opname"**-link in de relevante vergaderbord kaartdetail UI.
- Laat de audio player voor opnames zichtbaar en bruikbaar.
- Laat de bestaande `download_url` in data/payloads ongemoeid zodat downloadgedrag buiten deze UI niet breekt.
- Toon **"Audio-opname"** en de metadata (**duur** en **grootte**) op één regel in de kaartdetailweergave.
- Werk de betrokken frontendtests bij zodat ze het nieuwe gedrag reflecteren.

### Non-goals
- Geen backendwijzigingen.
- Geen wijzigingen aan opslag, API-contract of payloadstructuur.
- Geen wijzigingen aan de audio player zelf.
- Geen verwijdering van de onderliggende download-URL uit responses.
- Geen bredere UX-redesign van de kaartdetailmodal.

## Proposed approach
1. Lokaliseer de audio-opname-rendering in de vergaderbord kaartdetail UI.
2. Verwijder of conditioneer de zichtbare **"Download opname"**-link uit deze weergave.
3. Pas de opnamekop aan zodat **"Audio-opname"** en de metadata op één regel renderen.
4. Laat de audio player ongewijzigd renderen met dezelfde bron (`download_url`).
5. Pas de relevante frontendtests aan zodat ze niet meer op de losse link assert-en en wel controleren dat de player nog aanwezig is.
6. Verifieer handmatig dat audio-opnames nog afspeelbaar zijn, dat de opnamekop compacter op één regel staat en dat de download-URL in de markup/data nog wordt gebruikt door de player.

## Implementation steps (ordered)
1. Inspecteer `frontend/src/app/features/admin/VergaderbordenPage.tsx` en de bijbehorende tests om de huidige audio-opname-rendering te bevestigen.
2. Verwijder de zichtbare **"Download opname"**-link uit de audio-opname-sectie in de kaartdetail UI.
3. Pas de markup/styling aan zodat **"Audio-opname"** en **duur/grootte** op één regel staan.
4. Behoud de audio player met dezelfde `src`/`download_url`-koppeling.
5. Update `frontend/src/app/features/admin/VergaderbordenPage.test.tsx` zodat de test de afwezigheid van de losse downloadlink controleert, de compacte opnamekop verifieert en de aanwezigheid van de player blijft verifiëren.
6. Draai de gerichte frontendtests en controleer dat de wijziging geen andere kaartdetail-gedragingen raakt.

## Acceptance criteria
1. Audio-opnames in de Vergaderbord kaartdetail UI tonen nog steeds een werkende audio player.
2. De losse tekstlink **"Download opname"** wordt in die UI niet meer getoond.
3. **"Audio-opname"** en de metadata (**duur** en **grootte**) staan in die UI op één regel.
4. De onderliggende `download_url` blijft beschikbaar in de payload en wordt niet aangepast of verwijderd.
5. De relevante frontendtests zijn bijgewerkt en slagen.
6. Er zijn geen backend-, API- of opslagwijzigingen nodig.

## Testing plan
- Gerichte frontendtest voor `VergaderbordenPage`:
  - `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- Handmatige smoke-check in de kaartdetail UI:
  - audio-opname zichtbaar
  - label en metadata op één regel zichtbaar
  - player afspeelbaar
  - geen losse **"Download opname"**-link zichtbaar
  - player blijft dezelfde download-URL gebruiken

## Risk + rollback plan
### Risks
- Kleine kans op testbreuk door gewijzigde DOM-asserties.
- Kans dat de losse link elders nog gewenst blijkt in een andere context als de selectie te breed is.
- Onbedoelde regressie in de audio-opname-rendering als de markup te agressief wordt aangepast.
- Kleine kans dat de compacte éénregelige layout op smallere breedtes minder netjes afbreekt dan verwacht.

### Rollback
- Herstel de verwijderde **"Download opname"**-link en de bijbehorende testexpectaties.
- Omdat dit een UI-only wijziging is, is rollback beperkt tot frontendmarkup en tests.

## Notes / links
- Bron: door de gebruiker aangeleverde Draft Change Spec Outline.
- Relevante bestanden:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
- Gerelateerde context:
  - `opsx/changes/2026-05-28-audio-opnames-als-updatekaarten.md`
  - `opsx/changes/2026-06-22-vergaderbord-kaartdetail-modal-opschonen.md`
- Docs impact: alleen deze spec als bron van waarheid; geen bredere productdocs verwacht.

## Current status
Partial

## What changed
De vergaderbord kaartdetail UI toont nog steeds de audio player voor opname-items, maar niet meer de losse tekstlink "Download opname". De opnamekop rendert nu als één regel met "Audio-opname" plus duur en grootte, terwijl de onderliggende `download_url` ongewijzigd blijft voor de player.

## How to verify
Na implementatie:
- draai `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` in `frontend/`;
- open de vergaderbord kaartdetail UI met een audio-opname;
- controleer dat **"Audio-opname"** en **duur/grootte** visueel op één regel staan;
- controleer dat de player zichtbaar is en dat de losse **"Download opname"**-link ontbreekt;
- controleer dat de player nog steeds de bestaande `download_url` gebruikt.

## Verification evidence
`npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` in `frontend/` — passed (49 tests).

De éénregelige opnamekop is technisch afgedwongen via frontendmarkup + `.board-recording-summary { white-space: nowrap; }`, maar een handmatige browser-check voor smalle breedtes is in deze CLI-sessie nog niet uitgevoerd.

---
Status: partial
Owner: n.v.t.
Date: 2026-06-30
