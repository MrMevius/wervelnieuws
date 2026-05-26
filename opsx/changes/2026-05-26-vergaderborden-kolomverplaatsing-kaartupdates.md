# Title
Vergaderborden: kolomverplaatsingen zichtbaar maken in kaartupdates

## Context
Na de drag/drop-verbetering willen gebruikers in kaartdetails/timeline ook expliciet zien wanneer een kaart van kolom is veranderd.

Huidige situatie:
- Endpoint `PATCH /boards/cards/{card_id}/move` verwerkt kolomwijzigingen.
- Er wordt al audit logging gedaan.
- Er verschijnt nog geen zichtbare `CardUpdate` in de bestaande kaartupdates/timeline voor kolomverplaatsingen.

Gevolg: verplaatsingen zijn functioneel uitgevoerd, maar niet transparant zichtbaar voor gebruikers in de plek waar zij wijzigingen op een kaart volgen.

## Goals / Non-goals
### Goals
- Bij een echte kolomwijziging via `PATCH /boards/cards/{card_id}/move` automatisch een zichtbare kaartupdate/timeline-item aanmaken.
- Update bevat: bronkolom (NL-label), doelkolom (NL-label), actor (huidige gebruiker), datum/tijd.
- Update moet zichtbaar zijn in de bestaande kaartdetail-updates/timeline (zonder nieuwe component).
- Same-column/no-op mag géén system update aanmaken.
- System update moet niet bewerkbaar zijn via bestaande UI (gebruik bestaande non-editable weergave).
- Regressietests toevoegen/actualiseren in backend en frontend.
- About/changelog bijwerken in `backend/app/api/meta.py`.

### Non-goals
- Geen redesign van kaartdetailpagina of timeline-UI.
- Geen nieuwe timelinecomponent als bestaande updates-lijst volstaat.
- Geen wijziging van same-column reordergedrag.
- Geen drag/drop-herontwerp.
- Geen edit/delete-beheer toevoegen voor system updates.
- Geen database-migratie of expliciet typeveld toevoegen, tenzij implementatie aantoont dat dit onvermijdelijk is.

## Proposed approach
1. In de move-flow de oude kolom vastleggen vóór de statuswijziging.
2. Move normaal uitvoeren via bestaande endpoint/serviceflow.
3. Alleen als `old_column != new_column`: automatisch een `CardUpdate` aanmaken gekoppeld aan de huidige gebruiker.
4. Tekstinhoud van de update opbouwen met NL-kolomnamen en actor + datum/tijd, bijvoorbeeld:
   - `Kaart verplaatst van Te doen naar Bezig door admin op 26-05-2026 14:32.`
5. Bestaande card detail response en bestaande updates/timelineweergave hergebruiken zodat de update direct zichtbaar is zonder UI-redesign.
6. Geen functionele productiegedragswijzigingen buiten deze toevoeging.

## Implementation steps (ordered)
1. Inventariseer de huidige backend move-route en service/repository-flow voor kaarten.
2. Bepaal betrouwbare plek om bronkolom te lezen vóór mutatie en doelkolom na validatie.
3. Voeg conditionele creatie van `CardUpdate` toe bij echte kolomwijziging.
4. Zorg dat update-inhoud NL-kolomlabels gebruikt en actor + timestamp bevat.
5. Borg dat same-column/no-op paden géén update schrijven, ook bij directe API-calls.
6. Verifieer dat bestaande handmatige kaartupdates ongewijzigd blijven werken.
7. Voeg backend tests toe/werk bij in `backend/tests/test_boards_api.py` voor:
   - update aangemaakt bij echte kolommove
   - geen update bij no-op move
   - zichtbaarheid via kaartdetail endpoint
8. Voeg frontend regressietest(s) toe/werk bij in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx` voor zichtbaarheid/non-editability in bestaande updatesweergave.
9. Draai gerichte drag/drop-regressietests zodat bestaande behavior intact blijft.
10. Werk About/changelog bij in `backend/app/api/meta.py` met eindgebruikersgerichte entry.

## Acceptance criteria (measurable)
1. Verplaatsen van een kaart van **Te doen** naar **Bezig** maakt een zichtbare kaartdetail-update met bronkolom, doelkolom, gebruiker en datum/tijd.
2. Verplaatsen van **Bezig** naar **Klaar** of terug naar **Te doen** maakt hetzelfde type update.
3. Same-column/no-op moves maken geen system update.
4. De update verschijnt in de bestaande kaartdetail updates/timeline.
5. De system update is niet bewerkbaar via de UI.
6. Bestaande handmatige updates blijven werken.
7. Bestaande drag/drop tests blijven slagen.
8. Backend tests dekken system update bij echte kolomwijziging en geen update bij no-op.
9. About/changelog is bijgewerkt.

## Testing plan
- Backend gericht:
  - `cd backend && ./.venv/bin/pytest tests/test_boards_api.py -k "move or card_update or board"`
  - of minimaal de specifieke nieuwe/gewijzigde testcases voor move + detail updates.
- Frontend gericht:
  - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- Regressie/kwaliteit changed areas:
  - `cd frontend && npm run build`
  - aanvullende gerichte board drag/drop tests binnen bestaande suite.
- Handmatige checklist:
  1. Kaart verplaatsen tussen kolommen en kaartdetail openen.
  2. Controleren dat timeline-item zichtbaar is met juiste van/naar, actor en datum/tijd.
  3. Same-column drop/no-op uitvoeren en bevestigen dat geen extra system update verschijnt.
  4. Bevestigen dat system update niet inline bewerkbaar is.

## Risk + rollback plan
### Risks
- Dubbele logregels bij retries of dubbele drop-events.
- `CardUpdate` heeft mogelijk geen expliciet system/manual type; afhankelijkheid van bestaande non-editable UI-afhandeling.
- Inconsistentie in datum/tijd formatting/timezone tussen backend en frontend.
- Kans op onbedoelde updates bij same-column API-calls als guard niet strikt genoeg is.

### Rollback
- Schakel automatische `CardUpdate` creatie in move-flow uit/revert.
- Laat bestaande move-endpoint functionaliteit intact.
- Behoud audit logging zoals reeds aanwezig.

## Notes / links
- Gerelateerd eerder werk:
  - `opsx/changes/2026-05-26-vergaderborden-drag-drop-kaartjes.md`
- Verwachte backend testlocatie:
  - `backend/tests/test_boards_api.py`
- Verwachte frontend testlocatie:
  - `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
- Changeloglocatie:
  - `backend/app/api/meta.py`

### Assumptions
- Bestaande authenticatiecontext levert de actor (current user) al beschikbaar in de move-route/service.
- Bestaande `CardUpdate` structuur kan update-tekst opslaan zonder schemawijziging.
- Bestaande kaartdetail API response levert updates zodanig dat nieuwe system update automatisch in frontend verschijnt.

## Current status
Completed

## What changed
- Backend move-endpoint (`PATCH /boards/cards/{card_id}/move`) leest nu eerst de oude kolom vóór de mutatie.
- Na een succesvolle move wordt nu conditioneel een zichtbare `CardUpdate` aangemaakt **alleen** wanneer de kolom echt wijzigt (`old_column != new_column`).
- De system update-tekst gebruikt Nederlandse kolomlabels (`Te doen`, `Bezig`, `Klaar`) en bevat actor + datum/tijd, bijvoorbeeld: `Kaart verplaatst van Te doen naar Bezig door admin op 26-05-2026 14:32.`
- Same-column/no-op pad maakt geen system update aan.
- Bestaande handmatige updateflow (`POST /boards/cards/{card_id}/updates`) is ongewijzigd gelaten.
- Backend regressietests toegevoegd voor:
  - system update bij echte kolommove,
  - expliciete AC2-dekking voor `Bezig -> Klaar` met correcte NL-labels in het updatebericht,
  - geen update bij same-column move/no-op,
  - zichtbaarheid via bestaand kaartdetail endpoint.
- About/changelog bijgewerkt in `backend/app/api/meta.py` met iteratie 34.

## How to verify
1. Draai backend regressietests:
   - `cd backend && ./.venv/bin/pytest tests/test_boards_api.py -k "move or update"`
   - `cd backend && ./.venv/bin/pytest tests/test_boards_api.py`
2. Controleer in testoutput dat nieuwe move-update tests slagen:
   - `test_move_card_creates_system_update_for_column_change`
   - `test_move_card_creates_system_update_for_doing_to_done`
   - `test_move_card_same_column_creates_no_system_update`
3. (Optioneel handmatig) Verplaats een kaart naar andere kolom en open kaartdetail: controleer updatebericht met van/naar + actor + tijdstip.
4. Controleer About endpoint/content op nieuwe changelog-entry iteratie 34.
5. Frontend regressie/typecheck:
   - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
   - `cd frontend && npm run build`

## Verification evidence
- Command: `cd backend && ./.venv/bin/pytest tests/test_boards_api.py -k "move or update"`
  - Resultaat: PASS (6 passed, 2 deselected)
- Command: `cd backend && ./.venv/bin/pytest tests/test_boards_api.py`
  - Resultaat: PASS (8 passed)
- Command: `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Resultaat: PASS (3 passed)
- Command: `cd frontend && npm run build`
  - Resultaat: PASS (`tsc -b && vite build`)
- No-edit review: afgerond zonder blocking findings na extra AC2-testdekking.
- Niet handmatig in browser geverifieerd; handmatige detail/timeline-check blijft als optionele releasecontrole opgenomen onder How to verify.
- Niet-blockerend: backend pytest toont bestaande dependency/deprecation warnings (`pytest-asyncio`, `crypt`, `datetime.utcnow()`), zonder testfalen.
- Scopecheck:
  - Frontend timelineweergave hergebruikt; geen nieuwe component nodig.
  - Handmatige updates blijven werken; bestaande flowtest blijft groen.

---
Status: completed
Owner: OPSX Implementer
Date: 2026-05-26
