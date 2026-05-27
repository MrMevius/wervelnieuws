# Title
Kaartbeschrijving inline bewerken

## Context
Op Vergaderborden wordt een kaartbeschrijving wel getoond, maar kan deze na aanmaak niet meer aangepast worden. Dit belemmert snelle correcties en inhoudelijke verfijning in de bestaande kaartdetailflow.

## Goals / Non-goals
### Goals
- Maak de bestaande kaartbeschrijving van een kaart inline bewerkbaar in de kaartdetailweergave.
- Sla gewijzigde beschrijving automatisch op bij `blur` (focus verlaat het veld).
- Sta een lege beschrijving toe (lege string is geldig).
- Vermijd onnodige API-calls wanneer de tekst niet gewijzigd is.
- Zorg dat zowel bordoverzicht als detailweergave de opgeslagen beschrijving tonen na opslaan.
- Voeg backend- en frontendtests toe voor endpoint, client en UI-flow.

### Non-goals
- Geen bewerking van titel, status, kolom, assignees of andere kaartvelden.
- Geen audit logging of versiehistorie voor deze wijziging.
- Geen UI-redesign buiten de minimale inline-edit toevoeging.

## Proposed approach
1. Backend: introduceer een gerichte endpoint `PATCH /api/boards/cards/{card_id}/description` met request schema voor beschrijving.
2. Backend: voeg repository/service-logica toe om alleen `description` te valideren en op te slaan, inclusief ondersteuning voor lege waarde.
3. Frontend API-client: voeg een methode toe voor het updaten van kaartbeschrijving via de nieuwe PATCH-endpoint.
4. Frontend UI: implementeer in `VergaderbordenPage.tsx` inline-edit state + save-on-blur op basis van het bestaande titel-edit patroon.
5. Frontend dataflow: trigger refresh/invalidate van relevante board/detail data na succesvolle save.
6. Tests: breid backend en frontend tests uit voor changed/unchanged gedrag, validatie en zichtbare data-refresh.
7. Documentatie: werk website changelog/About bij met functionele eindgebruikersnotitie indien de locatie in deze repo aanwezig is.

## Implementation steps (ordered)
1. Lokaliseer bestaande board/card backend routes, schema’s en repository-methodes voor kaartupdates.
2. Voeg request/response contract toe voor beschrijvingsupdate (in lijn met bestaande API-conventies).
3. Implementeer backend endpoint `PATCH /api/boards/cards/{card_id}/description`:
   - valideert input;
   - accepteert lege beschrijving;
   - persisteert uitsluitend `description`.
4. Voeg/actualiseer backend tests voor:
   - succesvolle update met gewijzigde tekst;
   - succesvolle update naar lege tekst;
   - foutafhandeling bij ongeldige kaart/context.
5. Voeg frontend API-clientmethode toe voor description PATCH-call.
6. Implementeer inline edit UX in kaartdetail in `VergaderbordenPage.tsx`:
   - editmodus voor beschrijving;
   - save op blur;
   - vergelijking met originele waarde zodat ongewijzigde input geen API-call doet.
7. Koppel succesvolle save aan board/detail refresh zodat beide views actuele beschrijving tonen.
8. Voeg/actualiseer frontend test(s) voor:
   - inline bewerken en save op blur;
   - geen API-call bij ongewijzigde waarde;
   - geüpdatete beschrijving zichtbaar na refreshflow.
9. Werk About/changelog bij met eindgebruikersgerichte entry als het verwachte bestand/pad bestaat.
10. Leg verificatiecommando’s en uitkomsten vast in deze spec bij uitvoering.

## Acceptance criteria (measurable)
1. Gebruiker kan een bestaande kaartbeschrijving inline bewerken in de kaartdetailweergave.
2. Bij `blur` wordt een gewijzigde beschrijving automatisch opgeslagen.
3. Bij ongewijzigde beschrijving wordt geen update-API-call uitgevoerd.
4. Backend valideert request en persisteert de bijgewerkte beschrijving correct (incl. lege string).
5. Frontend ververst bord/detaildata na succesvolle save zodat beide weergaven de nieuwe beschrijving tonen.
6. Backend- en frontendtests dekken endpoint/client/UI-flow voor deze wijziging.

## Testing plan (canonical commands or approach)
- Backend (gericht): voer relevante pytest(s) voor boards API uit, met focus op het nieuwe description PATCH-pad.
- Frontend (gericht): voer test(s) uit voor `VergaderbordenPage` die inline description-edit en blur-save dekken.
- Breder (indien geraakt): run aanvullende checks (bijv. bredere testset/build) alleen als gedeelde code is aangepast.
- Leg exacte commando’s en resultaten vast onder **How to verify** en **Verification evidence** tijdens implementatie.

## Risk + rollback plan
### Risks
- Save-on-blur kan onbedoeld opslaan bij accidenteel focusverlies.
- Onnodige netwerkcalls/performance-impact als changed-check onjuist wordt geïmplementeerd.

### Mitigation
- Vergelijk current vs original description vóór save en sla alleen op bij verschil.
- Houd updatepad beperkt tot één veld (`description`) om regressierisico te verkleinen.

### Rollback
- Verwijder de nieuwe description endpoint, frontend clientmethode, inline-edit state en bijbehorende tests.
- Geen schema-migratie rollback nodig; `description` veld bestaat al.

## Notes / links
- Bron: user-provided Draft Change Spec Outline (leidend voor scope en acceptance criteria).
- Endpointvoorstel: `PATCH /api/boards/cards/{card_id}/description`.
- Docs-impact: update About/changelog alleen als verwachte locatie in deze repo aanwezig is.

## Current status
Completed

## What changed
- Backend: nieuw request schema `BoardCardDescriptionUpdateRequest` toegevoegd met validatie en `extra="forbid"`.
- Backend: repositorymethode `update_card_description` toegevoegd die uitsluitend `description` bijwerkt.
- Backend: endpoint `PATCH /api/boards/cards/{card_id}/description` toegevoegd met access-check, persist en activity-touch, zonder extra audit/versiegeschiedenis conform scope.
- Backend tests uitgebreid in `backend/tests/test_boards_api.py` voor:
  - succesvolle update met gewijzigde beschrijving;
  - succesvolle update naar lege beschrijving;
  - validatie op scoped payload (extra fields geweigerd);
  - 404 bij onbekende kaart.
- Frontend API-client uitgebreid met `updateBoardCardDescription(cardId, { description })`.
- Frontend UI (`VergaderbordenPage.tsx`): inline beschrijving bewerkbaar gemaakt in kaartdetail met save-on-blur en changed-check om no-op calls te voorkomen.
- Frontend data-refresh: na succesvolle beschrijvingssave worden zowel board- als card-detail queries geinvalidated.
- Frontend tests uitgebreid in `VergaderbordenPage.test.tsx` voor blur-save flow, no-op bij ongewijzigde tekst en refreshgedrag.
- About/changelog bijgewerkt met een eindgebruikersgerichte entry voor deze iteratie.

## How to verify
- Backend (gericht):
  - `uv run pytest tests/test_boards_api.py -k description` (run vanuit `backend/`)
- Frontend (gericht):
  - `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` (run vanuit `frontend/`)

## Verification evidence
- ✅ `uv run pytest tests/test_boards_api.py -k description` → 3 passed, 12 deselected.
- ✅ `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` → 1 file passed, 15 tests passed.
- ✅ Review/finalisatie: implementatie gecontroleerd tegen scope; beschrijvingswijzigingen voegen geen extra audit/versiegeschiedenis toe conform non-goals.

---
Status: completed
Owner: n/a
Date: 2026-05-27
