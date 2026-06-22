# Title
Vergaderbord kaartdetail: meerdere bestanden tegelijk uploaden in bijlagen

## Context
In de bijlage-sectie van het kaartdetail in Vergaderborden kan een gebruiker nu maar één bestand tegelijk kiezen of droppen. Daardoor is het toevoegen van meerdere bijlagen onnodig traag en foutgevoelig.

De bestaande flow heeft al een duidelijke knop **Toevoegen**, single-file validatie en een werkende uploadroute voor één bestand. Deze change moet die basis behouden en alleen de selectie-/drop-ervaring uitbreiden naar meerdere bestanden tegelijk.

Voor deze wijziging is een frontend-first MVP gewenst: de UI accepteert meerdere bestanden, maar uploadt ze sequentieel via het bestaande single-file endpoint.

## Goals / Non-goals
### Goals
- Meerdere bestanden tegelijk kunnen selecteren via de bestandskiezer.
- Meerdere bestanden tegelijk kunnen droppen in de bijlage-sectie.
- De bestaande knop **Toevoegen** blijft de batch starten.
- De batch wordt sequentieel geüpload via het bestaande single-file attachment endpoint.
- Geef duidelijke feedback bij succes, partial success en fouten per bestand.
- Bestaande single-file validatie, permissies en download/delete-gedrag blijven behouden.

### Non-goals
- Geen backend API-wijziging voor batch upload in v1.
- Geen nieuwe achtergrondtaak of parallelle upload-orchestratie.
- Geen redesign van de kaartdetail-modal of bijlagenlijst.
- Geen wijziging aan attachment-opslag, permissies of download-URL’s.

## Proposed approach
- Breid de frontend bijlageflow uit van één `File` naar een batch van `File[]` in de kaartdetailmodal.
- Gebruik `multiple` op de file picker en accepteer meerdere files uit drag-and-drop.
- Bewaar een duidelijke selectie-state met bestandsnamen/aantal en een resetoptie.
- Start bij **Toevoegen** een sequentiële uploadloop die voor elk bestand het bestaande `uploadBoardCardAttachment(cardId, file)` hergebruikt.
- Toon voortgang per bestand en eindstatus van de batch (geslaagd, deels geslaagd, mislukt).
- Laat validatie per bestand ongewijzigd door de bestaande endpoint- en clientvalidatie te blijven gebruiken.
- Houd de UX simpel: geen geavanceerde retry-queue in de eerste versie, alleen heldere batchfeedback en reset na afloop.

## Implementation steps (ordered)
1. Inspecteer de huidige bijlage-section in `frontend/src/app/features/admin/VergaderbordenPage.tsx` en de attachment upload helper in `frontend/src/lib/api/...` om de single-file flow exact vast te leggen.
2. Verander de lokale selectie-state van één bestand naar een lijst van geselecteerde bestanden, inclusief duidelijke UI voor geselecteerde batch en wissen/reset.
3. Pas de file picker aan naar `multiple` en pas drag-and-drop aan zodat alle gedropte bestanden worden meegenomen in plaats van alleen het eerste bestand.
4. Implementeer een sequentiële uploadhandler die per bestand het bestaande single-file endpoint gebruikt en per resultaat succes/fout opslaat.
5. Voeg batchstatusfeedback toe: lopende bestandsnaam/teller, totaalresultaat, en melding bij partial success met vermelding van mislukte bestanden.
6. Zorg dat foutafhandeling de batch niet abrupt stopt tenzij een onherstelbare fout optreedt; later bestanden moeten zoveel mogelijk nog worden geprobeerd.
7. Werk frontendtests uit voor multi-select, multi-drop, sequentiële upload, partial success en validatie-regressies.
8. Voeg een korte end-user changelog/About-note toe indien de repo-iteratie daarom vraagt.

## Acceptance criteria
1. In de bijlage-sectie kunnen gebruikers meerdere bestanden tegelijk selecteren in de file picker.
2. In de bijlage-sectie kunnen gebruikers meerdere bestanden tegelijk droppen.
3. De knop **Toevoegen** uploadt de volledige geselecteerde batch.
4. Uploads verlopen sequentieel via het bestaande single-file attachment endpoint.
5. Bij partial success ziet de gebruiker welke bestanden geslaagd en welke mislukt zijn.
6. Bestaande single-file validatie blijft gelden voor elk bestand in de batch.
7. Bestaande upload-, download- en verwijderflows blijven werken voor niet-batchgebruik.
8. Relevante frontend-regressietests voor deze flow slagen.

## Testing plan
- Gerichte frontendtests voor de Vergaderborden kaartdetail bijlageflow, met cases voor:
  - multiple file picker selection
  - multi-file drop
  - batch upload via **Toevoegen**
  - partial success/error feedback
  - behoud van single-file validatie
- Regresstest op het bestaande attachment endpoint om te bevestigen dat single-file upload ongewijzigd blijft.
- Handmatige smoke-check in de kaartdetailmodal met meerdere kleine testbestanden.

## Risk + rollback plan
### Risks
- Regressie in de bestaande uploadflow door de wijziging van single-file naar batch-state.
- Onduidelijke of te veel meldingen tijdens sequentiële uploads.
- Drag-and-drop kan per ongeluk dezelfde validatie of clear/reset-logica breken.
- Partial success-UX kan verwarrend zijn als fouten niet per bestand worden getoond.

### Rollback
- Herstel de frontend terug naar single-file selectie en single-drop gedrag.
- Laat het bestaande backend endpoint en attachment-data ongemoeid.
- Als batchstatus onduidelijk blijkt, rollback alleen de batch-UI en behoud de bestaande uploadknop/endpoint flow.

## Notes / links
- Bron: door de gebruiker aangeleverde outline voor deze wijziging.
- Relevante startpunten:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `backend/tests/test_boards_api.py`
  - `frontend/src/lib/api/client.ts` of de attachment upload helper die daaruit aanroept
- Bestaande single-file uploadroute: `POST /api/boards/cards/{cardId}/attachments`
- Docs impact: update deze change spec en, bij implementatie, een korte changelog/About-entry of UI-note als dat in de iteratie gebruikelijk is.

## Current status
Completed

## What changed
- Vergaderbord kaartdetail ondersteunt nu batch-selectie en batch-drop van meerdere bijlagen in de bijlage-sectie.
- De knop **Toevoegen** start sequentiële uploads via het bestaande single-file attachment endpoint.
- De UI toont geselecteerde bestandsnamen, batchvoortgang en per-bestand succes/foutstatus met partial-success feedback.
- Frontendtests zijn uitgebreid voor multi-select, multi-drop, sequentiële upload en partial-success.
- De About/changelog-pagina heeft een nieuwe eindgebruikersvriendelijke iteratie-entry over meerdere bijlagen tegelijk toevoegen.

## How to verify
- Draai: `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- Draai backend-regressie: `pytest backend/tests/test_boards_api.py -k attachment`
- Handmatige smoke-check: open kaartdetail, selecteer/dropp meerdere bestanden en start **Toevoegen**.
- Controleer About/changelog op de nieuwe iteratie-entry voor deze Vergaderborden-uitbreiding.

## Verification evidence
- ✅ `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` — 49 tests geslaagd.
- ✅ `./.venv/bin/pytest tests/test_boards_api.py -k attachment -q` (vanuit `backend/`) — 2 geslaagd, 32 gedeselecteerd.
- ✅ `npm run build` — frontend build geslaagd.
- ✅ About/changelog-entry toegevoegd in `backend/app/api/meta.py` (iteratie 87).

## Follow-ups / risks
- Kleine review-opmerking: gebruik op termijn een stabielere unieke UI-key voor batchresultaten als dubbele bestandsnamen in dezelfde batch vaker voorkomen.

---
Status: completed
Owner: 
Date: 2026-06-22
