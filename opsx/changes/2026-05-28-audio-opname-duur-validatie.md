Title
Audio-opname duurvalidatie: voorkom `duration = 0` als geldige duur

Context
- Nieuwe audio-opnames kunnen momenteel als `duration = 0` worden opgeslagen, ondanks dat het bestand daadwerkelijk audio bevat.
- Dit veroorzaakt misleidende UI in updatekaarten (`Duur: 0:00`) en in de native player (`0:00 / 0:00`).
- De huidige capture-keuze WebM/Opus blijft in deze wijziging bewust gehandhaafd.
- Voor toekomstige transcriptie kan server-side normalisatie later worden toegevoegd, maar valt buiten deze scope.

Goals / Non-goals
## Goals
- Frontend bepaalt opname-duur betrouwbaarder op basis van start/stop-timestamps, zodat echte opnames niet als `0` geüpload worden.
- Backend valideert/normaliseert `duration=0` zodat deze waarde niet blind als geldige duur wordt behandeld.
- Bestaande recordings met `duration=0` tonen in de UI `Duur onbekend`.
- Bestandsgrootte blijft zichtbaar in updatekaarten.
- Bestaande player-functionaliteit en downloadlink blijven werken.
- Testdekking omvat frontend fallback, frontend upload-duurberekening en backend validatie/normalisatie.

## Non-goals
- Geen formaatwijziging naar MP3/WAV/M4A.
- Geen server-side transcriptie-normalisatie in deze wijziging.
- Geen ffmpeg-transcodering/remuxing in deze wijziging.
- Geen garantie dat de native browser-player metadataweergave direct volledig correct wordt voor alle historische WebM-bestanden.

Proposed approach
- Frontend:
  - Gebruik opname start/stop-timestamps als primaire bron voor geüploade `duration`.
  - Hanteer een defensieve ondergrens/validatie zodat een geldige opname niet met `0` seconden wordt doorgestuurd.
  - Houd UI-rendering robuust: `duration <= 0` of ontbrekend wordt als onbekend behandeld in metadataweergave.
- Backend:
  - Voeg server-side duurvalidatie toe op create/update recording-pad.
  - Behandel `duration=0` als onbetrouwbaar: sla op als `None` of pas afgesproken normalisatie toe (consistent binnen API-contract).
  - Zorg dat API-responses voor bestaande records met nulduur niet regressief breken.
- UX weergave:
  - Updatekaart toont `Duur onbekend` voor onbruikbare duurwaarden.
  - Bestandsgrootteweergave blijft ongewijzigd beschikbaar.
  - Player en downloadlink blijven functioneel en onveranderd in gedrag.
- Rationale:
  - WebM/Opus blijft een acceptabele korte-termijnkeuze voor browser recording en toekomstige transcriptie.
  - Duration metadata uit container/player mag niet als enige waarheid gebruikt worden.
  - Originele opname kan bewaard blijven; eventuele transcriptiepipeline kan later server-side normalisatie toevoegen.

Implementation steps (ordered)
1. Inventariseer huidig frontend opnamepad (start/stop, upload payload) en backend opslag-/validatiepad voor recording `duration`.
2. Definieer eenduidige domeinregel: `duration <= 0` geldt als onbekend/onbruikbaar en wordt niet als echte duur gepresenteerd.
3. Implementeer frontend-berekening op basis van timestamps met validatie voordat upload-payload wordt verstuurd.
4. Implementeer backend-validatie/normalisatie zodat `duration=0` niet blind geaccepteerd wordt.
5. Pas frontend rendering aan voor bestaande/historische recordings met nulduur: toon `Duur onbekend`.
6. Verifieer dat bestandsgrootteweergave, player-controls en downloadlink intact blijven.
7. Voeg/actualiseer tests voor frontend en backend volgens testplan.
8. Controleer dat bestaande recording API-tests groen blijven.

Acceptance criteria
1. Nieuwe opnames krijgen geen `0` als duur wanneer er daadwerkelijk opgenomen is.
2. Backend accepteert `duration=0` niet blind als echte duur (wordt afgewezen of genormaliseerd volgens afgesproken regel).
3. Bestaande recordings met duur `0` tonen in de UI `Duur onbekend`.
4. Bestandsgrootte blijft zichtbaar bij recordings.
5. Player en downloadlink blijven werken zoals voorheen.
6. Tests dekken:
   - `duration=0` fallback in frontend-weergave,
   - frontend upload-duurberekening,
   - backend validatie/normalisatie,
   - en bestaande recording API-tests blijven groen.

Testing plan
- Frontend test: `duration: 0` rendert `Duur onbekend`.
- Frontend test: uploadpad stuurt geen `0`-duur mee bij geldige opname (timestamp-gebaseerde berekening).
- Backend test: `duration=0` wordt opgeslagen als `None` of afgewezen/genormaliseerd conform gekozen regel.
- Regressie: bestaande recording API-tests blijven groen.
- Handmatige spot-check:
  - kaartdetail met recording toont grootte + juiste duur/fallback;
  - audio afspelen en download blijven functioneel.

Risk + rollback plan
## Risico's
- Native browser-player kan nog steeds `0:00 / 0:00` tonen door WebM-container metadata, ook als kaartmetadata correct fallbackt.
- Kleine afrondingsverschillen in duurberekening (milliseconds → seconds) kunnen testverwachtingen beïnvloeden zonder duidelijke standaard.
- Historische records kunnen verschillende nul-/lege duurpatronen bevatten die extra defensieve parsing vereisen.

## Rollback
- Verwijder frontend timestamp-duurvalidatie en herstel vorige uploadduurgedrag.
- Verwijder backend duurvalidatie/normalisatie en herstel vorige opslaggedrag.
- Laat UI-fallbackwijziging desgewenst terugdraaien als regressies optreden.
- Voor structurele player-duration-correctie volgt later aparte spec met media-normalisatie.

Notes / links
- Gebaseerd op door gebruiker aangeleverd en akkoord bevonden outline.
- Scope blijft expliciet binnen WebM/Opus-behoud zonder transcode/remux.
- Vervolgkans: aparte wijziging voor server-side normalisatie t.b.v. speler-durationmetadata en transcriptiestroom.

Current status
Completed

What changed
- Frontend duration fallback aangescherpt: `duration <= 0` wordt nu getoond als `Duur onbekend` in de updatekaart-metadata.
- Frontend uploadpad aangescherpt:
  - opname-upload gebruikt nog steeds start/stop-timestamps + timer als bron,
  - upload-call forceert defensief minimaal `1` seconde bij geldige upload,
  - API-client stuurt alleen `duration` mee als deze strikt `> 0` is.
- Backend recording upload normaliseert `duration <= 0` nu consequent naar `None` vóór opslag (`duration=0` wordt dus niet als geldige duur bewaard).
- Backend About/changelog aangevuld met iteratie 54, conform repo Definition of Done.
- Testdekking uitgebreid/geactualiseerd:
  - frontend test voor `duration: 0` fallback naar `Duur onbekend`,
  - frontend opname-uploadtest controleert expliciet dat geüploade duur `> 0` is,
  - backend API-test toegevoegd die `duration=0` normalisatie naar `None` verifieert (response + detail endpoint).

How to verify
1. Frontend targeted tests draaien:
   - `cd frontend && npm run test -- src/app/features/admin/VergaderbordenPage.test.tsx`
2. Backend targeted tests draaien:
   - `cd backend && .venv/bin/pytest tests/test_boards_api.py -k recording`
3. Spot-check codegedrag:
   - `formatRecordingDuration` behandelt `0` als onbekend,
   - `uploadBoardRecording` stuurt geen `duration=0`,
   - backend `/cards/{card_id}/recordings` normaliseert `duration=0` naar `None`.
4. About/changelog check:
   - `backend/app/api/meta.py` bevat iteratie `54` met eindgebruikersvriendelijke beschrijving.

Verification evidence
- Implementatie uitgevoerd in frontend + backend + tests + About/changelog.
- Verificatie uitgevoerd met gerichte frontend- en backendtests (zie commandolog hieronder).
- Resultaten:
  - `cd frontend && npm run test -- src/app/features/admin/VergaderbordenPage.test.tsx` → PASS (`1 passed`, `27 passed`).
  - `cd backend && .venv/bin/pytest tests/test_boards_api.py -k recording` → PASS (`3 passed`, `18 deselected`).
  - `cd frontend && npx tsc -b --pretty false` → PASS (geen diagnostics).

Status: done
Owner:
Date: 2026-05-28
