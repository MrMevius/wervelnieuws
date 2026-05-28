Title
Audio-opnames als normale updatekaarten tonen

Context
- Op dit moment worden audio-opnames in vergaderbord kaartdetails in een aparte sectie **"Opnames"** getoond.
- De gewenste UX is één uniforme activiteitenstroom, waarbij tekstupdates en audio-opnames samen in dezelfde tijdlijn staan.
- Dit moet aansluiten op bestaand gedrag voor updates, zonder wijzigingen aan opslagmodel of opnameproces.

Goals / Non-goals
## Goals
- Audio-opnames tonen als normale update/activity-kaarten in dezelfde lijst als tekstupdates.
- Gecombineerde lijst newest-first sorteren op datum/tijd.
- Audio-kaart toont minimaal: label, datum/tijd, audio player en download link.
- Bestaande opname-upload/start/stop en download endpoint blijven werken.
- Bestaande tekstupdate-functionaliteit en acties blijven werken.
- Relevante frontend/backend tests updaten/toevoegen en laten slagen.
- About/changelog entry toevoegen met user-facing beschrijving.

## Non-goals
- Geen transcriptie van audio toevoegen.
- Geen wijziging in opslag, bestandsformaat of audioverwerkingspipeline.
- Geen database-migraties.
- Geen herontwerp van de kaartdetail modal buiten de noodzakelijke merge van activity-weergave.
- Audio-opnames niet bewerkbaar maken als tekstupdates.

Proposed approach
- Kies **Option B (minimal backend + frontend merge)** als implementatierichting.
- Backend: voeg uploader-gerelateerde velden toe aan `RecordingResponse` indien praktisch en backwards-compatible.
- Frontend:
  - Bouw één gecombineerde activity-array uit tekstupdates en opnames.
  - Sorteer aflopend op timestamp:
    - update: `created_at`
    - recording: `recorded_at`, met fallback naar `created_at`.
  - Render beide typen met (zoveel mogelijk) hetzelfde `board-update-item` kaartpatroon.
  - Voor opname-items: toon label **"Audio-opname"**, uploader (of fallback), geformatteerde datum/tijd, audio controls en download link.
- Verwijder de losse **"Opnames"**-sectie uit kaartdetail.

Implementation steps (ordered)
1. Bevestig en/of breid backend `RecordingResponse` uit met veilige, backwards-compatible metadata voor uploader/timestamp (alleen indien nodig voor frontend rendering).
2. Pas frontend datamapping in vergaderbord kaartdetail aan zodat updates + recordings worden samengevoegd in één typed activity-collectie.
3. Implementeer stabiele newest-first sortering op gecombineerde timestamp-logica (`recorded_at` fallback `created_at` voor opnames).
4. Render opname-activiteiten als normale updatekaart met audio player + downloadlink en consistente metadataweergave.
5. Verwijder de aparte weergave/heading **"Opnames"** uit de UI.
6. Verifieer dat bestaande update-acties/rendering (tekstupdates) ongewijzigd blijven functioneren.
7. Update/voeg tests toe:
   - Frontend tests voor gecombineerde rendering + sortering + afwezigheid van aparte Opnames-sectie.
   - Backend tests voor response-compatibiliteit en download endpoint continuïteit.
8. Update `backend/app/api/meta.py` About/changelog met een korte user-facing wijzigingsnotitie.

Acceptance criteria
1. In kaartdetail bestaat geen aparte heading/sectie **"Opnames"** meer.
2. Audio-opnames verschijnen in dezelfde update/activity-kaartenlijst als tekstupdates.
3. Gemixte tekst/audio items worden newest-first getoond op datum/tijd.
4. Elke audio-updatekaart bevat een werkende audio player.
5. Elke audio-updatekaart bevat een werkende downloadlink naar de bestaande download-URL.
6. Tekstupdates blijven correct werken inclusief bestaande rendering en acties.
7. Opname start/stop/upload flow blijft werken.
8. Bestaand recording download endpoint blijft werken.
9. Relevante frontend en backend tests slagen.

Testing plan
- Frontend (gericht):
  - `npm test -- VergaderbordenPage.test.tsx`
  - `npm run build`
- Backend (gericht):
  - `pytest tests/test_boards_api.py`
- Breder indien nodig:
  - `npm test`
  - `pytest`

Risk + rollback plan
## Risico's
- Inconsistente timestamp-bronnen (`recorded_at` vs `created_at`) kunnen sorteerafwijkingen geven.
- Uploader-metadata kan ontbreken in oudere/bestaande records.
- Test selectors/assertions kunnen breken door gewijzigde DOM-structuur.
- Kleine styling-regressies door hergebruik van updatekaart-layout.

## Rollback
- Frontend rollback: gecombineerde rendering terugdraaien en aparte Opnames-sectie herstellen.
- Backend rollback: optionele response-uitbreidingen terugnemen (behouden van backwards compatibility voorkomt API-breakage).

Notes / links
- User request en outline in deze sessie gelden als functionele bron voor scope/acceptatie.
- Changelog-impact: `backend/app/api/meta.py` updaten met eindgebruikersvriendelijke notitie.

Current status
Done

What changed
- Backend `RecordingResponse` uitgebreid met uploader-metadata (`uploaded_by_user_id`, `uploaded_by_username`, `uploaded_by_display_name`) op een backwards-compatible manier.
- `GET /api/boards/cards/{card_id}` en `POST /api/boards/cards/{card_id}/recordings` geven nu deze uploader-metadata mee in recording-items.
- Frontend kaartdetail (`VergaderbordenPage`) toont nu één gecombineerde activiteitenlijst met tekstupdates + audio-opnames in dezelfde `board-update-item` stijl.
- Gecombineerde lijst sorteert newest-first op timestamp:
  - tekstupdate: `created_at`
  - opname: `recorded_at` met fallback `created_at`
- Opname-items tonen label **Audio-opname**, datum/tijd, audio player (`controls`) en downloadlink naar bestaande `download_url`.
- Losse heading/sectie **Opnames** verwijderd uit kaartdetail.
- Frontend API-types in `frontend/src/lib/api/client.ts` bijgewerkt voor nieuwe optionele recording uploader-velden.
- Tests bijgewerkt:
  - frontend test toegevoegd voor gecombineerde weergave/sortering/geen aparte Opnames-sectie.
  - backend test uitgebreid met uploader-velden en download endpoint-continuïteit.
- About/changelog bijgewerkt met user-facing notitie in `backend/app/api/meta.py` (iteratie 45: **Vergaderborden: audio-opnames nu in dezelfde updates-tijdlijn**).

How to verify
1. Open Vergaderborden kaartdetail met zowel tekstupdates als opnames en bevestig:
   - geen aparte heading/sectie **Opnames**;
   - audio-opnames staan tussen updates in dezelfde lijst;
   - lijst is newest-first over beide typen;
   - opname-item bevat audio player + downloadlink.
2. Controleer dat tekstupdate-acties (weergave/bewerken/verwijderen) ongewijzigd werken.
3. Draai gerichte checks:
   - `npm test -- VergaderbordenPage.test.tsx`
   - `npm run build`
   - `cd backend && .venv/bin/pytest tests/test_boards_api.py`

Verification evidence
- `npm test -- VergaderbordenPage.test.tsx` ✅ (26 passed)
- `npm run build` ✅
- `pytest tests/test_boards_api.py` ⚠️ faalde in globale Python met `ModuleNotFoundError: No module named 'fastapi'`
- `.venv/bin/pytest tests/test_boards_api.py` ✅ (20 passed)

Final status
Done

Follow-ups
- Geen open follow-ups voor deze wijziging.

About/changelog confirmation
- Aanwezig in `backend/app/api/meta.py` als changelog iteratie 45 met eindgebruikersvriendelijke tekst over audio-opnames in dezelfde updates-tijdlijn.

Status: done
Owner: 
Date: 2026-05-28
