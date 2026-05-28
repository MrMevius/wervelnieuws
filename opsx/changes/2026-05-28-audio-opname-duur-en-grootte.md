Title
Audio-opname duur en bestandsgrootte tonen in updatekaarten

Context
- Audio-opnames in updatekaarten tonen in de native speler soms `0:00 / 0:00`.
- Daardoor zien gebruikers niet betrouwbaar hoe lang een opname is via de standaard player-weergave.
- Daarnaast ontbreekt zichtbare basisinformatie over de opname, zoals bestandsgrootte.
- We willen dit oplossen zonder zware server-side mediabewerking (zoals ffmpeg-transcodering/remuxing) in deze iteratie.

Goals / Non-goals
## Goals
- Toon de correcte opnameduur in de audio-updatekaart op basis van opgeslagen opname-metadata.
- Toon bestandsgrootte (`size_bytes`) in de audio-updatekaart in gebruikersvriendelijk formaat (bijv. `1,2 MB`).
- Voeg fallback-logica toe voor bestaande opnames waar duur en/of grootte ontbreekt, zonder UI-breakage.
- Behoud bestaande audio player-controls en bestaande downloadlink-functionaliteit.
- Voeg/actualiseer tests voor rendering van duur en bestandsgrootte, inclusief fallbackgedrag.
- Voeg een eindgebruikersvriendelijke changelog/About-vermelding toe.

## Non-goals
- Geen volledige audio-transcodering/remuxing met ffmpeg in deze wijziging.
- Geen nieuw detailscherm voor audio-opnames.
- Geen uitgebreide technische metadataweergave (zoals MIME-type, codec, bitrate).
- Geen wijziging aan opnameflow (start/stop/upload) buiten metadataweergave en lichte fallback.

Proposed approach
- Gebruik bestaande recording-data uit backend/API als bron voor `duration` en `size_bytes`.
- Frontend audio-updatekaart rendert expliciet metadataregel, los van wat de browser-player zelf toont.
- Formatteer duur naar leesbaar tijdsformaat (bijv. `0:42`, `3:07`) en grootte naar KB/MB met locale-vriendelijke notatie.
- Implementeer defensieve fallback:
  - Als duur ontbreekt/onbruikbaar is: toon nette fallbacktekst (bijv. `Duur onbekend`) of verberg alleen het duurveld.
  - Als grootte ontbreekt/onbruikbaar is: toon nette fallbacktekst (bijv. `Grootte onbekend`) of verberg alleen het grootteveld.
- Voor bestaande records zonder metadata: geen backend-transcodering; hoogstens lichte, non-blocking afleiding indien al beschikbare bestandsinfo aanwezig is.
- Laat audio player + downloadlink exact intact, zodat afspelen en downloaden ongewijzigd blijven.

Implementation steps (ordered)
1. Inventariseer huidige recording-response velden in backend en frontend types (`duration`, `size_bytes`, relevante timestamp/labelvelden).
2. Bevestig contract: API levert voor audio-opnames waar beschikbaar `duration` en `size_bytes` door aan de kaartdetail-respons.
3. Voeg frontend formatter helpers toe/hergebruik bestaande helpers voor:
   - duurweergave;
   - bestandsgrootteweergave.
4. Pas rendering van audio-updatekaart aan met zichtbare metadataregel, bijvoorbeeld: `Duur: 0:42 · Grootte: 1,2 MB`.
5. Voeg fallbackgedrag toe voor missende/ongeldige metadata zonder UI-fouten.
6. Verifieer dat bestaande audio player-controls en downloadlink gedrag ongewijzigd functioneren.
7. Update/voeg tests toe voor:
   - rendering met geldige duur + grootte;
   - rendering/fallback wanneer duur en/of grootte ontbreekt.
8. Controleer (en indien nodig update) relevante backend/API-tests op aanwezigheid/doorgifte van `duration` en `size_bytes`.
9. Werk website About/changelog (`backend/app/api/meta.py`) bij met eindgebruikersvriendelijke release-notitie.

Acceptance criteria
1. Audio-updatekaarten tonen zichtbaar de opnameduur en bestandsgrootte wanneer metadata beschikbaar is.
2. Metadataweergave is leesbaar geformatteerd (duur als tijdnotatie, grootte als KB/MB).
3. Bestaande opnames zonder metadata veroorzaken geen UI-fout en blijven zichtbaar/bruikbaar.
4. Als duur niet beschikbaar is, wordt nette fallback getoond of het duurveld consistent verborgen.
5. Als grootte niet beschikbaar is, wordt nette fallback getoond of het grootteveld consistent verborgen.
6. Audio afspelen via de bestaande player en downloaden via bestaande link blijven werken.
7. Frontend tests dekken rendering van duur + grootte en fallbackscenario’s.
8. Relevante backend/API-tests bevestigen dat `duration` en `size_bytes` beschikbaar blijven waar verwacht.

Testing plan
- Frontend (gericht):
  - Draai testbestand(en) voor updatekaart/audio rendering (bijv. `npm test -- <relevant-testbestand>`).
  - Voeg assertions toe voor:
    - zichtbare `Duur` + `Grootte` bij complete metadata;
    - fallback/verborgen veld bij ontbrekende metadata.
- Backend/API (gericht):
  - Draai relevante tests die card/recording responses verifiëren (bijv. `cd backend && .venv/bin/pytest tests/test_boards_api.py`).
  - Bevestig dat `duration` en `size_bytes` in responsecontract behouden blijven.
- Handmatige verificatie:
  - Open kaartdetail met audio-opname en controleer voorbeeldweergave: `Duur: 0:42 · Grootte: 1,2 MB`.
  - Open kaartdetail met oudere opname zonder duur/grootte en controleer nette fallback zonder layout-breuk.

Risk + rollback plan
## Risico's
- De native browser-player kan nog steeds `0:00 / 0:00` tonen wanneer bronbestand zelf ontbrekende/gebrekkige duration metadata heeft.
- Inconsistente historische data (missende `duration`/`size_bytes`) kan meerdere fallbackpaden vereisen.
- Formatteringsverschillen (decimalen/locale) kunnen testassertions fragiel maken als niet eenduidig vastgelegd.

## Rollback
- Frontend rollback: verwijder metadataregel (duur/grootte) uit audio-updatekaarten.
- Backend-data en opslagmodel blijven ongewijzigd; rollback is primair presentatielaag.
- Als later vereist is dat de browser-player zélf altijd juiste teller toont, plan vervolgspec voor server-side remuxing/transcodering.

Notes / links
- Gebaseerd op de door gebruiker aangeleverde en overeengekomen Draft Change Spec Outline.
- Scopegrenzen zijn expliciet: geen ffmpeg-remux/transcode in deze iteratie.
- Docs-impact: About/changelog entry verplicht bij afronding.

Current status
Done (implemented + targeted automated verification passed; manual UI spot-check remains optional because automated rendering tests cover the update-card states)

What changed
- Frontend audio-updatekaart (`VergaderbordenPage`) toont nu expliciet een metadataregel:
  - `Duur: <mm:ss of fallback> · Grootte: <KB/MB/B of fallback>`.
- Formattering toegevoegd in frontend:
  - duur: afgerond naar seconden, weergave als `m:ss`;
  - grootte: `B`, `KB`, `MB` met `nl-NL` decimaalnotatie (bijv. `1,2 KB`).
- Fallbacklogica toegevoegd voor historische/onvolledige recordings:
  - ontbrekende/ongeldige duur ⇒ `Duur onbekend`;
  - ontbrekende/ongeldige grootte ⇒ `Grootte onbekend`.
- Bestaande audio player en downloadlink zijn ongewijzigd gebleven (zelfde `audio src` en `href`).
- Frontend testdekking uitgebreid in `VergaderbordenPage.test.tsx`:
  - assert op metadataweergave bij geldige duur + grootte;
  - nieuw fallbackscenario voor ontbrekende duur/grootte.
- Frontend API-typing versoepeld voor bestaande data zonder complete metadata:
  - `duration` en `size_bytes` als optioneel/nullabel in board-card detail recordings.
- About/changelog bijgewerkt met nieuwe eindgebruikersvriendelijke iteratie-entry in `backend/app/api/meta.py` (iteratie 53).

How to verify
1. Draai gerichte frontend test voor vergaderbord-kaartdetail:
   - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
2. Draai gerichte backendtest voor recordings-contract:
   - `cd backend && uv run pytest tests/test_boards_api.py -k recording`
3. Controleer changelog/About update:
   - `read /home/mevius/wervelnieuws/backend/app/api/meta.py`
4. Optioneel handmatig in UI:
   - Open kaartdetail met opname met metadata en controleer `Duur: ... · Grootte: ...`.
   - Open kaartdetail met oudere opname zonder metadata en controleer fallback zonder layout-breuk.

Verification evidence
- Frontend test uitgevoerd:
  - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Resultaat: `1 passed`, `27 passed`.
- Backend test uitgevoerd:
  - `cd backend && uv run pytest tests/test_boards_api.py -k recording`
  - Resultaat: `2 passed, 18 deselected`.
- Frontend typecheck uitgevoerd:
  - `cd frontend && npx tsc -b --pretty false`
  - Resultaat: geslaagd zonder diagnostics.
- About/changelog entry toegevoegd in `backend/app/api/meta.py` voor iteratie `53`.

Status: done
Owner:
Date: 2026-05-28
