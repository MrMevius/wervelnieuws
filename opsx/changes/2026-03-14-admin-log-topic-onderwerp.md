## Title
Admin log toont onderwerpregel i.p.v. topic-ID

## Context
In Admin > Activiteit wordt nu alleen `topic_id` getoond. Voor beheerders is dit slecht leesbaar. De wens is om in deze lijst de onderwerpregel van het topic te tonen, afgekort waar nodig, en de sectie expliciet te hernoemen naar `Admin log`.

## Goals / Non-goals
### Goals
- Admin-tab heet `Admin log` i.p.v. `Activiteit`.
- In de admin-logtabel wordt de topic-onderwerpregel getoond i.p.v. topic-ID.
- Lange onderwerpregels worden in de UI afgekort met behoud van volledige tekst via tooltip.
- Backend levert hiervoor onderwerpregel mee in `/api/admin/activity`.

### Non-goals
- Geen wijziging in audit-eventopslag of eventsemantiek.
- Geen nieuwe filter- of sorteerfunctionaliteit in Admin log.
- Geen wijzigingen aan andere admin-tabs.

## Proposed approach
1. Breid het admin-activity responsemodel uit met `topic_subject`.
2. Pas de admin-activity query aan met een join op `Topic` om de onderwerpregel op te halen.
3. Werk frontend API-typen bij.
4. Pas Admin UI labels en rendering van de Topic-kolom aan (afgekorte onderwerpregel).
5. Werk tests en About changelog bij.

## Implementation steps (ordered)
1. `backend/app/schemas/admin.py` uitbreiden met `topic_subject`.
2. `backend/app/api/admin.py` uitbreiden met `Topic`-join en veldmapping.
3. `frontend/src/lib/api/client.ts` type `AdminActivity` uitbreiden.
4. `frontend/src/app/App.tsx`:
   - tablabel en heading hernoemen naar `Admin log`;
   - helper toevoegen voor afkorten;
   - topic-kolom vullen met afgekorte `topic_subject`.
5. `backend/tests/test_admin_api.py` assertions uitbreiden.
6. `frontend/src/app/App.test.tsx` mocks/assertions bijwerken.
7. `backend/app/api/meta.py` changelogregel toevoegen.
8. Relevante tests/build draaien en resultaten vastleggen.

## Acceptance criteria
- In Admin is het tablabel `Admin log`.
- In de Admin log-tabel wordt topic-onderwerpregel getoond i.p.v. topic-ID.
- Lange onderwerpregels worden afgekort weergegeven (met tooltip/hover op volledige inhoud).
- `/api/admin/activity` bevat `topic_subject` in de response.
- Backend en frontend tests voor dit gedrag slagen.

## Testing plan
- `cd backend && pytest tests/test_admin_api.py -q`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: bestaande clients verwachten exact oud activity-schema.
  - Mitigatie: `topic_id` blijft bestaan; `topic_subject` is aanvullend.
- Risico: lange teksten verstoren tabelbreedte.
  - Mitigatie: expliciete UI-afkorting met vaste limiet en tooltip.
- Rollback: revert van admin schema/query + frontend rendering/labelwijzigingen.

## Notes / links
- Aanvraag gebruiker: “toon niet topic ID maar onderwerpregel, afgekort indien nodig; hernoem activiteit naar admin log”.

## Current status
Completed

## What changed
- Backend activity-schema uitgebreid met `topic_subject`:
  - `backend/app/schemas/admin.py` (`AdminActivityResponse`) bevat nu `topic_subject: str | None`.
  - `backend/app/api/admin.py` haalt in `GET /api/admin/activity` nu ook `Topic.subject` op via `outerjoin(Topic, Topic.id == AuditEvent.topic_id)` en mapt dit naar `topic_subject`.
- Frontend API-type uitgebreid:
  - `frontend/src/lib/api/client.ts` type `AdminActivity` bevat nu `topic_subject: string | null`.
- Admin UI aangepast:
  - `frontend/src/app/App.tsx` tablabel gewijzigd van `Activiteit` naar `Admin log`.
  - `frontend/src/app/App.tsx` heading gewijzigd van `Admin-activiteit` naar `Admin log`.
  - Topic-kolom toont nu afgekorte `topic_subject` (max 60 tekens) met volledige tekst in `title`-tooltip; fallback blijft `-`.
  - Nieuwe helper `truncateText(...)` toegevoegd voor consistente afkorting.
- Tests bijgewerkt:
  - `backend/tests/test_admin_api.py` controleert dat `topic_subject` aanwezig is in activity-payload.
  - `frontend/src/app/App.test.tsx` mockdata voor `listAdminActivity` uitgebreid met `topic_subject` en test toegevoegd voor tab `Admin log`.
- About/changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat nieuwe entry `iteration: "15"` met eindgebruikersuitleg over Admin log + onderwerpregels.

## How to verify
- `docker compose run --rm backend sh -lc "pip install -e .[dev] >/tmp/pip.log && pytest tests/test_admin_api.py -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Verification evidence
- `docker compose run --rm backend sh -lc "pip install -e .[dev] >/tmp/pip.log && pytest tests/test_admin_api.py -q"` -> geslaagd (`23 passed`, 1 warning).
- `cd frontend && npm test -- --run` -> geslaagd (`31 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript build + Vite productiebuild).
