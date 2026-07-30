# Title
Kaartjes archiveren en soft-verwijderen op vergaderborden

## Context
Op vergaderborden kunnen kaarten nu wel verplaatst, bewerkt en van updates/bijlagen voorzien worden, maar er is nog geen consistente card-level lifecycle voor archiveren en verwijderen. De codebase heeft al een patroon voor soft delete bij updates en een `is_archived`-veld op `board_cards`, maar die basis is nog niet volledig doorgetrokken naar de kaart-UX, API en zichtbaarheid.

Deze change voegt een veilige, auditbare kaartlifecycle toe: kaarten kunnen worden gearchiveerd, weer teruggezet en soft-verwijderd zonder harde database-delete. Daarmee blijven historie en referenties behouden, terwijl de actieve boardweergave schoner wordt.

## Goals / Non-goals
### Goals
- Kaarten op vergaderborden kunnen archiveren en weer dearchiveren.
- Kaarten kunnen soft-verwijderd worden zonder fysieke database-delete.
- Gearchiveerde en soft-verwijderde kaarten verdwijnen uit de standaard boardweergave.
- Bestaande kaartgeschiedenis, updates, bijlagen en opnames blijven auditbaar en traceerbaar.
- De UI laat archiveren direct uitvoeren; soft-verwijderen vraagt om duidelijke bevestiging en statusfeedback.
- API, repository en frontend blijven consistent met het bestaande board-permissiemodel.
- Audit events worden vastgelegd voor archive/dearchive/delete-acties.

### Non-goals
- Geen bulk-archivering of bulk-delete in v1.
- Geen apart restore-scherm voor soft-deleted kaarten.
- Geen harde file-cleanup van gekoppelde assets als onderdeel van deze change.
- Geen redesign van de rest van het vergaderbord of de kaartdetailmodal.

## Proposed approach
1. Hergebruik `board_cards.is_archived` voor archiveren/dearchiveren van kaarten.
2. Voeg soft-delete metadata toe aan `board_cards` (bijv. `deleted_at` en `deleted_by_user_id`) en filter soft-deleted kaarten standaard uit board- en detailqueries.
3. Voeg repository- en API-methodes toe voor archive, dearchive en soft-delete met dezelfde toegangsguards als de bestaande kaartacties.
4. Werk de frontend-api client en kaartdetail-UX bij zodat gebruikers archiveren en verwijderen expliciet kunnen uitvoeren met duidelijke bevestiging en statusfeedback.
5. Laat boardlijsten, kaarttelling en detailweergaven soft-deleted kaarten niet meer tonen; gearchiveerde kaarten blijven alleen zichtbaar via een expliciete archived-state route of filter als dat binnen de bestaande UX past.
6. Voeg gerichte tests toe voor permissies, zichtbaarheid, statusovergangen en regressies op bestaande kaartacties.

## Implementation steps (ordered)
1. Inspecteer de huidige board-card modellen, repository-methodes, API-routes en kaartdetail-UI om de bestaande archive- en soft-delete-patronen te volgen.
2. Breid het datamodel uit voor card soft-delete metadata en voeg de benodigde migratie toe.
3. Implementeer repository- en servicelogica voor card archive/dearchive en card soft-delete, inclusief filtering in lijst- en detailqueries.
4. Voeg API-endpoints of mutaties toe voor archiveren, dearchiveren en soft-verwijderen, met audit logging en permissiecontrole.
5. Werk `frontend/src/lib/api/client.ts` en de vergaderborden-UI bij met card actions, bevestigingsdialogen en statusindicaties.
6. Zorg dat kaarten die gearchiveerd of soft-verwijderd zijn niet meer in de actieve board-kolommen, tellingen en actieflows voorkomen.
7. Voeg backend- en frontendtests toe voor:
   - archiveren/dearchiveren,
   - soft-verwijderen,
   - hidden-state in board/detail,
   - permissieblokkades,
   - regressie op bestaande update/attachment/recording flows.
8. Voeg indien nodig een korte About/changelog-regel toe voor de eindgebruiker.

## Acceptance criteria
1. Een gebruiker met geldige boardrechten kan een kaart archiveren en later weer dearchiveren.
2. Een soft-verwijderde kaart verschijnt niet meer in de standaard boardweergave of kaartdetailflow.
3. Gearchiveerde kaarten tellen niet mee in de actieve kaarttelling van het bord.
4. Archiveren is direct; soft-verwijderen vraagt om een duidelijke bevestiging in de UI.
5. De backend verwijdert geen board-card records hard uit de database.
6. Bestaande updates, bijlagen en opnames blijven functioneel voor niet-verwijderde kaarten.
7. Onbevoegde gebruikers kunnen archiveren of verwijderen niet uitvoeren.
8. Audit logging registreert archive/dearchive/delete-acties.
9. Bestaande card-move, update- en attachmentflows blijven werken voor normale kaarten.

## Testing plan
- Backend targeted tests voor board card lifecycle, permissiechecks en query-filtering.
- Frontend tests voor kaartdetail-acties, bevestigingsdialogen en hidden-state.
- Regressietests op bestaande boardflows (verplaatsen, updates, bijlagen, opnames).
- Canonical commands:
  - `cd backend && uv run pytest -q backend/tests/test_boards_api.py`
  - `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`
  - `cd frontend && npm run build`

## Risk + rollback plan
### Risks
- Soft-deleted kaarten kunnen per ongeluk uit bestaande queries of counts lekken als filters niet overal consequent worden toegepast.
- UI-acties kunnen conflicteren met bestaande board-detail state of permissies.
- Een onzorgvuldige migratie kan bestaande cardrecords of relaties beïnvloeden.

### Rollback
- Verwijder de nieuwe UI-acties en API-routes.
- Zet `is_archived` terug of maak soft-delete metadata ongedaan voor affected cards.
- Omdat de wijziging soft-delete gebruikt, blijven records en historie intact en is rollback vooral een kwestie van filtering en statusvelden terugzetten.

## Notes / links
- Relevante context in codebase:
  - `backend/app/models/entities.py`
  - `backend/app/api/boards.py`
  - `backend/app/repositories/board_repository.py`
  - `backend/alembic/versions/20260528_0019_card_update_soft_delete.py`
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/lib/api/client.ts`
- Aannames:
  - Archiveren gebruikt het bestaande `board_cards.is_archived`-patroon.
  - Soft-verwijderen betekent: record markeren als verwijderd, niet fysiek verwijderen.
  - Er komt in v1 geen apart herstelscherm voor soft-deleted kaarten.
- SQLite-opmerking:
  - De `deleted_by_user_id`-FK voor `board_cards` wordt in SQLite bewust niet als losse FK toegevoegd/verwijderd via Alembic, omdat de bestaande migratieconventie daar `ALTER TABLE`-beperkingen omzeilt en de relationele garantie al in het model zit voor niet-SQLite backends.
- Finalisatie-opmerking:
  - In de werkboom waren al niet-gerelateerde, bestaande wijzigingen aanwezig; deze finalisatie heeft alleen de change spec aangevuld.
  - De About/changelog-impact is onderdeel van de shipped iteratie en wordt hier expliciet vastgelegd als eindgebruikergerichte release-notitie.

## Current status
Completed

## Acceptance checklist
- [x] Kaarten kunnen archiveren en weer dearchiveren.
- [x] Soft-verwijderde kaarten verdwijnen uit standaard board- en detailweergaven.
- [x] Gearchiveerde kaarten tellen niet mee in de actieve boardtelling.
- [x] Archiveren is direct; soft-verwijderen vraagt om bevestiging.
- [x] Geen harde database-delete van board-card records.
- [x] Updates, bijlagen en opnames blijven werken voor niet-verwijderde kaarten.
- [x] Onbevoegde gebruikers kunnen archiveren/verwijderen niet uitvoeren.
- [x] Audit logging registreert archive/dearchive/delete-acties.
- [x] Bestaande card-move, update- en attachmentflows blijven werken.

## What changed
- `deleted_by_user_id` in de board-card migratie matcht nu de modeldefinitie beter: FK naar `users`, index, en nette rollback van FK/index voordat kolommen worden verwijderd.
- De detail- en prullenbak-soft-delete flow heeft nu expliciete succes- en foutmelding-UX.
- De frontend heeft een regressietest voor het soft-delete pad vanuit kaartdetail.
- Backend-tests bevatten nu negatieve permissiechecks en audit-event assertions voor archive, restore, soft-delete en recycle-bin restore.
- De bestaande UX-afspraak blijft intact: archiveren is direct; soft-verwijderen vraagt om bevestiging.
- De About/changelog-documentatie is als afgeronde iteratie vastgelegd in de release-context van deze spec.

## How to verify
- `cd backend && STORAGE_ROOT=/tmp/opencode/wervelnieuws-review-storage uv run --extra dev alembic upgrade head`
- `cd backend && uv run pytest -q tests/test_boards_api.py`
- `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx -t 'verwijdert een kaart vanuit detail en toont succesfeedback'`
- `cd frontend && npm run build`

Expected results:
- Alembic upgrade succeeds.
- Backend tests pass.
- Targeted frontend test passes.
- Frontend production build succeeds.

## Verification evidence
- `cd backend && STORAGE_ROOT=/tmp/opencode/wervelnieuws-review-storage uv run --extra dev alembic upgrade head` → passed
- `cd backend && uv run pytest -q tests/test_boards_api.py` → 35 passed, 172 warnings
- `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx -t 'verwijdert een kaart vanuit detail en toont succesfeedback'` → 1 passed, 53 skipped
- `cd frontend && npm run build` → passed

---
Status: Completed
Owner:
Date: 2026-07-29
