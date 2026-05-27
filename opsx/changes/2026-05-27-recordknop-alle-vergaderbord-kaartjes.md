# Title
Recordknop op alle Vergaderbord-kaartjes

## Context
Op dit moment kan opnemen alleen vanuit de kaartdetailweergave van Vergaderborden. Daarnaast accepteert de backend opnames alleen voor kaarten in kolom/status `doing`. Dit beperkt de workflow: gebruikers willen direct op elk kaartje kunnen opnemen, zonder eerst de detailweergave te openen, en zonder statusbeperking.

## Goals / Non-goals
### Goals
- Voeg een recordknop toe op elk Vergaderbord-kaartje, ongeacht kolom/status.
- Start en stop opname direct vanaf het kaartje (zonder navigatie naar kaartdetail).
- Toon een timer alleen op het actief-opnemende kaartje en alleen tijdens een actieve opname.
- Gebruik voor upload de bestaande opname-endpoint (geen nieuwe API-route).
- Pas backend-validatie aan zodat uploads voor alle kaartkolommen/statussen zijn toegestaan.
- Borg dat er maximaal één actieve opname tegelijk kan lopen in de UI.
- Behoud bestaande opnamefunctionaliteit in kaartdetail (backward compatibility).
- Ververs board/card-data na succesvolle upload zodat opname zichtbaar is in kaartdetail.
- Lever Nederlandstalige foutmeldingen voor microfoon- en uploadfouten.
- Werk relevante frontend- en backendtests bij.

### Non-goals
- Geen transcriptiefunctionaliteit.
- Geen herontwerp van opslagmodel.
- Geen herontwerp van audioformaat of encodingstrategie.
- Geen herontwerp van permissiemodel/autorisatie.
- Geen volledige UI-redesign van Vergaderborden.

## Proposed approach
1. Frontend: breid kaartcomponent(en) in Vergaderborden uit met een inline recordknop op elk kaartje.
2. Frontend: implementeer lokale opname-state met globale exclusiviteit (één actieve opname tegelijk over het bord).
3. Frontend: voorkom click-bubbling van recordknop zodat kaartdetail niet opent bij record-interactie.
4. Frontend: toon timer-conditioneel uitsluitend op de kaart met actieve opname.
5. Frontend: hergebruik bestaande uploadflow/endpoint en trigger data-refresh na upload.
6. Backend: verwijder/versoepel serviceguard die upload beperkt tot `doing`, met behoud van bestaande validaties buiten deze statusregel.
7. Compatibiliteit: laat bestaande detail-opnameflow intact en voorkom stateconflicten tussen kaart- en detailopname.
8. Tests: dek frontend interactieflows en backend status-onafhankelijke uploadacceptatie af.

## Implementation steps (ordered)
1. Inventariseer huidige opnameflow in frontend (kaartdetail + board kaartinteracties) en backend upload-guard voor kaartstatus.
2. Voeg recordknop-rendering toe aan alle board-kaartjes, onafhankelijk van status/kolom.
3. Implementeer start/stop-opname op kaartniveau met event-handling die bubbling naar kaart-openactie voorkomt.
4. Voeg timerweergave toe die alleen zichtbaar is op de actieve kaart tijdens actieve opname.
5. Implementeer/actualiseer gedeelde opname-state zodat maximaal één opname tegelijk actief kan zijn.
6. Koppel stop/upload aan bestaande endpoint en voeg succesflow toe die board/card-data ververst.
7. Pas backend service/guard aan zodat uploads niet langer worden geblokkeerd op basis van kolom/status `doing`.
8. Verifieer dat detail-opnameflow blijft werken en niet regressief wordt door gedeelde state of backendwijziging.
9. Werk frontend tests bij voor zichtbaarheid, bubbling, start/stop/upload, timer, single-active en foutmeldingen.
10. Werk backend tests bij voor uploadacceptatie buiten `doing` en relevante validatiepaden.
11. Werk About/changelog bij met eindgebruikersentry indien implementatie wordt uitgevoerd en shipped.
12. Leg tijdens uitvoering de exacte verificatiecommando’s en resultaten vast in deze spec.

## Acceptance criteria (measurable)
1. Elk Vergaderbord-kaartje toont een recordknop, ongeacht kolom/status.
2. Klikken op de recordknop opent de kaartdetailweergave niet.
3. Klik op recordknop start opname direct op dat kaartje; tweede klik stopt opname en triggert upload via de bestaande endpoint.
4. Tijdens een actieve opname toont alleen het actieve kaartje een timer; andere kaartjes tonen geen actieve timer.
5. Backend accepteert opname-uploads voor kaarten in alle boardkolommen/statussen (niet alleen `doing`).
6. Na succesvolle upload worden board- en kaartdetaildata ververst en is de nieuwe opname zichtbaar in kaartdetail.
7. De UI staat maximaal één actieve opname tegelijk toe.
8. Bij microfoon- of uploadfout krijgt de gebruiker een Nederlandstalige foutmelding.
9. Bestaande opnamefunctionaliteit in kaartdetail blijft functioneel.
10. Relevante frontend- en backendtests zijn bijgewerkt en dekken de nieuwe/gewijzigde paden.

## Testing plan (canonical commands or approach)
- Frontend component/unit tests:
  - recordknop zichtbaar op kaarten in alle statussen/kolommen;
  - klik op recordknop bubbelt niet naar kaart-openinteractie;
  - start/stop/uploadflow via bestaande endpoint;
  - timer alleen op actieve opnamekaart;
  - één actieve opname tegelijk;
  - Nederlandstalige foutmeldingen voor microfoon/upload.
- Backend API/service tests:
  - upload toegestaan voor kaarten buiten `doing`;
  - bestaande validaties en foutpaden blijven correct.
- Voer project-relevante testcommando’s uit zoals aanwezig in repository tooling en leg exacte commando’s + uitkomsten vast onder **How to verify** en **Verification evidence** tijdens implementatie.

## Risk + rollback plan
### Risks
- Browser-/platformverschillen in `MediaRecorder` gedrag.
- Onbedoelde click-bubbling waardoor kaartdetail toch opent.
- Stateconflicten tussen opname op kaartjes en bestaande detailmodal.
- Ongewenste neveneffecten door versoepeling van backend statusguard.

### Mitigation
- Houd opname-interactie expliciet gescheiden van kaart-openactie (`stopPropagation`/gelijke patroonconsistentie).
- Centraliseer actieve-opname-state met duidelijke lifecycle (start, stop, upload, reset).
- Voeg regressietests toe voor detail-opnameflow en statusonafhankelijke backendacceptatie.
- Beperk backendwijziging tot alleen de status/kolomguard, zonder overige validaties te verwijderen.

### Rollback
- Frontend: verwijder recordknop op kaartjes en herstel uitsluitend detail-opname-interactie.
- Backend: herstel de eerdere serviceguard die opname beperkt tot `doing`.
- Re-run regressietests voor board/detail-opname na rollback.

## Notes / links
- Inputbron: door gebruiker aangeleverde, goedgekeurde scope + acceptance criteria.
- Slug: `recordknop-alle-vergaderbord-kaartjes`.
- Docs-impact: About/changelog-update is vereist bij implementatie-shipping conform repo Definition of Done.

## Current status
Completed

## What changed
- Frontend Vergaderborden:
  - Op elk kaartje (todo/doing/done) staat nu een inline recordknop.
  - Record-interactie op het kaartje gebruikt `stopPropagation`, waardoor kaartdetail niet opent bij recordklik.
  - Start/stop van opname werkt direct op kaartniveau; upload gebruikt de bestaande endpoint (`uploadBoardRecording`).
  - Timer wordt alleen getoond op het actief-opnemende kaartje.
  - UI-state borgt maximaal één actieve opname tegelijk over het bord.
  - Nederlandstalige foutmeldingen toegevoegd voor microfoonstartfout en uploadfout.
  - Na succesvolle upload worden zowel borddata als kaartdetaildata geïnvalideerd/ververst.
  - Bestaande detail-opnameknop voor `doing` is intact gebleven en gebruikt dezelfde opname-state.
- Backend:
  - Status/kolom-guard verwijderd in `BoardService.store_recording`; opname-uploads zijn niet langer beperkt tot `doing`.
  - Overige validaties (audio MIME) bleven intact.
- Tests:
  - Frontendtests uitgebreid met dekking voor recordknoppen op alle kaartjes, geen bubbling naar detail, start/stop/upload, timer op actieve kaart, single-active gedrag, en NL microfoonfoutmelding.
  - Backendtest aangepast van "alleen doing" naar acceptatie voor `todo`/`doing`/`done`.
- About/changelog:
  - Nieuwe eindgebruikersentry toegevoegd (iteratie 43) over direct opnemen op elk kaartje en upload in alle kolommen.

## How to verify
- Frontend targeted tests:
  - `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` (workdir: `frontend/`)
- Frontend build/typecheck sanity:
  - `npm run build` (workdir: `frontend/`)
- Backend targeted tests (recording-gerelateerd):
  - `./backend/.venv/bin/pytest backend/tests/test_boards_api.py -k recording` (workdir: repo root)

## Verification evidence
- ✅ Frontend:
  - Command: `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`
  - Result: **PASS** — `19 passed`.
- ✅ Frontend build/typecheck:
  - Command: `npm run build`
  - Result: **PASS** — TypeScript build + Vite production build completed.
- ✅ Backend:
  - Command: `./backend/.venv/bin/pytest backend/tests/test_boards_api.py -k recording`
  - Result: **PASS** — `2 passed, 13 deselected`.
- ✅ Review/finalize:
  - Result: **PASS with note** — automated `opsx-review`/`opsx-docs` subagents were unavailable (`ProviderModelNotFoundError`), so no-edit review/finalize were completed manually against the acceptance criteria and verification evidence.
- ℹ️ Tijdens verificatie:
  - Eerste backend-run met systeem-`pytest` faalde door ontbrekende `fastapi`; opgelost door project-venv pytest te gebruiken.
  - Eerste frontend-run gebruikte onjuist padfilter; gecorrigeerd naar `src/app/features/admin/VergaderbordenPage.test.tsx`.

---
Status: completed
Owner: n/a
Date: 2026-05-27
