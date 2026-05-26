# Title
Vergaderborden: kaarttitels alleen bewerken in kaartdetail

## Context
De eerder opgeleverde wijziging voor inline kaarttitels (`2026-05-26-vergaderborden-inline-kaarttitels.md`) maakte titelbewerking mogelijk direct in het bordoverzicht.

Op basis van gebruikersfeedback moet deze UX worden aangescherpt: het bordoverzicht is primair bedoeld voor scannen, openen en slepen van kaarten. Titelbewerking hoort alleen plaats te vinden nadat een kaart is geopend in de kaartdetailweergave/modal.

Deze follow-up wijziging verplaatst de titelbewerkingsinteractie van overview naar detail, zonder backend-redesign en zonder regressies in bestaande vergaderbordflows.

## Goals / Non-goals
### Goals
- Titelbewerking is **niet** meer mogelijk in het bordoverzicht.
- Kaarten in het bordoverzicht behouden pointer-cursor (klikbare affordance).
- Klik op kaart in overview opent kaartdetail zoals verwacht.
- Kaarttitel is inline bewerkbaar in de geopende kaartdetailweergave.
- Bestaande titel-update API/client wordt hergebruikt.
- Validatie blijft consistent: lege titel wordt geblokkeerd met Nederlandse foutmelding.
- Interacties in detailbewerking volgen UX-afspraak:
  - `Enter` bewaart geldige wijziging
  - `blur` bewaart geldige wijziging
  - `Escape` annuleert en herstelt originele titel
- Relevante board/detail queries worden geïnvalideerd zodat overview en detail synchroon updaten.
- Frontend-tests dekken de nieuwe UX en regressierisico’s.

### Non-goals
- Geen backend redesign of contractwijziging van titel-endpoint (tenzij technisch strikt noodzakelijk).
- Geen uitbreiding van inline bewerken naar andere kaartvelden.
- Geen redesign van volledige kaartdetailmodal.
- Geen herschrijving van drag/drop-mechaniek.

## Proposed approach
1. Verwijder overview-specifieke titel edit-controls/input rendering uit de kaartcomponent op het bord.
2. Render overview-titel als normale, niet-editbare tekst op kaartniveau.
3. Behoud pointer-cursor op interactieve board cards.
4. Voeg in de kaartdetailweergave een inline titel-editmodus toe rond de bestaande detailtitel.
5. Hergebruik bestaande title-update client/API-flow inclusief bestaande validatieboodschap voor lege titel.
6. Pas event-handling aan zodat stopPropagation alleen wordt gebruikt waar nodig en klik/open/drag gedrag stabiel blijft.
7. Invalideer na succesvolle save zowel board-project query als board-card/detail query.
8. Werk frontend tests bij (overview niet-editbaar, detail wel editbaar, Enter/blur/Escape, regressies op open/drag/updates).
9. Werk About/changelog alleen bij als repository-conventie dit vereist voor deze wijziging.

## Implementation steps (ordered)
1. Inventariseer huidige titel-edit state en handlers in `VergaderbordenPage` en detailmodal.
2. Verwijder overview title edit button/input/keyboard-pad en bijbehorende rendering-takken.
3. Laat overview-kaarttitel statisch renderen met bestaande kaartklik naar detail.
4. Implementeer/verplaats titleEdit-state naar detailcontext (open kaart).
5. Voeg detail-inline-edit interacties toe: start edit, `Enter` save, `blur` save, `Escape` cancel.
6. Hergebruik bestaande update-mutatie naar titel endpoint; behoud Nederlandse lege-titelvalidatie.
7. Borg query invalidation voor board-overview én geopende kaartdetaildata.
8. Controleer event propagation en drag/click interacties zodat drag/drop en detail-open niet regressief wijzigen.
9. Update `VergaderbordenPage` tests (en eventueel detailgerelateerde tests) voor nieuwe UX-regels en regressies.
10. Update changelog/About alleen indien van toepassing volgens bestaande projectafspraken.

## Acceptance criteria
1. In het bordoverzicht kan een gebruiker geen kaarttitel meer direct bewerken (geen inline input/editcontrol aanwezig).
2. Board cards tonen nog steeds pointer-cursor bij hover.
3. Klik op een board card opent kaartdetail zoals voorheen.
4. In kaartdetail is kaarttitel inline bewerkbaar.
5. Een geldige titelwijziging in detail wordt opgeslagen via de bestaande API-flow en blijft persistent na refresh.
6. Na opslaan is de nieuwe titel zichtbaar in zowel detail als overzicht.
7. Lege titel wordt geblokkeerd met Nederlandse foutmelding (geen save).
8. `Escape` annuleert bewerking en herstelt de vorige titel in detail.
9. Drag/drop gedrag op het bord blijft functioneel ongewijzigd.
10. Bestaande updates/recordings-gerelateerde kaartflows blijven functioneel ongewijzigd.
11. Frontend-tests dekken minimaal overview non-editability, detail editflow, validatie en regressie op kaartopen/drag gedrag.

## Testing plan
- Gericht frontend:
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx`
  - Voeg/actualiseer tests voor:
    - geen overview title edit
    - detail inline edit
    - Enter-save
    - blur-save
    - Escape-cancel
    - lege titel foutmelding
    - kaart open + drag/drop regressie
- Build check:
  - `cd frontend && npm run build`
- Backend tests:
  - Alleen draaien als backend code toch geraakt wordt; anders niet vereist voor deze wijziging.

## Risk + rollback plan
### Risico’s
- State-sync issues tussen detail-save en overview-rendering.
- Regressie in klik/drag gedrag door event-handler verschuiving.
- Bestaande tests falen omdat ze overview inline edit verwachtten.
- Onduidelijkheid in changelog als gebruikersgedrag verandert zonder heldere release-notitie.

### Mitigatie
- Expliciete query invalidation en herlaadcontrole na save.
- Gerichte interactietests op click/open/drag combinaties.
- Verwijder/vervang verouderde tests in dezelfde PR met regressiedekking voor nieuwe flow.
- Korte, duidelijke changelogtekst indien deze wijziging user-facing wordt vrijgegeven.

### Rollback
- Frontend-only rollback: revert van de verplaatsing van titelbewerking terug naar vorige overview-implementatie.
- Backend endpoint blijft compatibel en hoeft niet te worden teruggedraaid.
- Indien nodig volledige git revert van de betrokken frontend commitset.

## Notes / links
- Gerelateerde afgeronde spec: `opsx/changes/2026-05-26-vergaderborden-inline-kaarttitels.md`.
- Inputbron: door gebruiker aangeleverde Draft Change Spec Outline + expliciete UX-beslissingen in deze sessie.
- Voorgestelde bestandsfocus (indicatief):
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - eventueel bijbehorende detail/modal component(en)
  - relevante frontend testbestanden
  - optioneel `backend/app/api/meta.py` voor changelog-entry

## Current status
Completed

## What changed
- Frontend: titelbewerking verwijderd uit het bordoverzicht; kaarttitels worden daar weer als gewone tekst getoond.
- Frontend: kaartklik in het overzicht opent de kaartdetailweergave; pointer-cursor op kaarten blijft behouden via bestaande styling.
- Frontend: inline titelbewerking toegevoegd in de geopende kaartdetailweergave met `Enter`/`blur` opslaan, `Escape` annuleren en Nederlandse lege-titelvalidatie.
- Frontend: bestaande titelupdate API-client en query-invalidation hergebruikt zodat board-overzicht en kaartdetail opnieuw worden opgehaald na opslaan.
- Tests: `VergaderbordenPage` tests aangepast voor overview non-editability, detail-editflow, blur-save, validatiefout, Escape-cancel, kaartdetail openen en drag/drop-regressie.
- About/changelog: iteratie 36 toegevoegd om duidelijk te maken dat kaarttitels nu vanuit kaartdetail worden bewerkt.

## How to verify
- `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`
- `cd backend && ./.venv/bin/pytest tests/test_boards_api.py`
- Handmatig aanbevolen: open Vergaderborden, controleer dat titels in het overzicht niet direct bewerkbaar zijn, klik een kaart open, bewerk de titel in detail, refresh en controleer dat de titel behouden blijft.

## Verification evidence
- `cd frontend && npm test -- VergaderbordenPage.test.tsx` — PASS: 7 tests passed.
- `cd frontend && npm run build` — PASS: TypeScript build en Vite build geslaagd.
- `cd backend && ./.venv/bin/pytest tests/test_boards_api.py` — PASS: 11 passed, 38 warnings.

---
Status: completed
Owner: OpenCode
Date: 2026-05-27
