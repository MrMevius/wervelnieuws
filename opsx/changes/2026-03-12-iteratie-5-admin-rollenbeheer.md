# Iteratie 5 Admin Menu + Rollenbeheer

## Context
In `ITERATIONS.md` vraagt iteratie 5 om een admin-menuoptie naast settings in het gebruikersmenu, voorlopig alleen zichtbaar/bruikbaar voor de admin-user, plus een adminpagina waar admins rechten kunnen geven aan andere users.

De huidige applicatie heeft wel user-authenticatie en een usermenu met settings/uitloggen, maar nog geen rollenmodel, geen admin-only routes en geen adminbeheer-UI.

## Goals / Non-goals
### Goals
- Voeg een expliciet admin-rolattribuut toe aan gebruikers.
- Toon in het usermenu naast `Settings` ook `Admin` voor admingebruikers.
- Voeg een adminpagina toe waar admins gebruikers adminrechten kunnen geven of afnemen.
- Beperk adminfunctionaliteit strikt tot admins (backend autorisatie + frontend gating).
- Houd de implementatie klein en iteratiegericht met testdekking voor kritieke paden.

### Non-goals
- Geen uitgebreid RBAC/permissiemodel met meerdere rollen of scopes.
- Geen aparte super-admin of organisatiehiërarchie.
- Geen usermanagement buiten adminflag (geen verwijderen, geen wachtwoordreset door admin).
- Geen audit-uitbreiding buiten bestaande basisflow, tenzij technisch nodig voor consistentie.

## Proposed approach
1. Breid `users` uit met boolean `is_admin` (default `False`) via model + Alembic migratie.
2. Breid `GET /api/auth/me` uit met `is_admin` zodat frontend conditioneel menu kan renderen.
3. Voeg admin API-routes toe (admin-only):
   - `GET /api/admin/users` voor overzicht van gebruikers en adminstatus.
   - `PATCH /api/admin/users/{user_id}` om `is_admin` te wijzigen.
4. Voeg backend dependency/guard toe voor adminrechten en blokkeer niet-admins met `403`.
5. Voeg frontend adminpagina en usermenu-link toe; toon `Admin` alleen voor admins.
6. Voeg veiligheidsregel toe: voorkom demotie van de laatste admin om lockout te vermijden.
7. Voeg gerichte backend/frontend tests toe voor toegang en rolwijzigingsflow.

## Implementation steps (ordered)
1. Maak migratie + modelupdate voor `User.is_admin`.
2. Werk seedpad en testfixtures bij zodat default admin-user adminrechten heeft.
3. Breid auth schema/endpoint uit met `is_admin`.
4. Voeg admin guard, schema's en router toe voor users-list + admin-toggle.
5. Implementeer lockout-preventie bij wijziging van adminrechten.
6. Voeg backend tests toe voor:
   - `GET /api/auth/me` met `is_admin`.
   - `403` op adminroutes voor niet-admin.
   - succesvolle admin-rights update door admin.
   - blokkeren van demotie laatste admin.
7. Breid frontend API client/types uit met adminvelden en admincalls.
8. Voeg frontend route `/admin` + pagina met userlijst en admin-toggle toe.
9. Update frontend tests voor menu-gating en adminbeheerflow.
10. Draai relevante checks en leg bewijs vast in deze spec.

## Acceptance criteria
- Gebruikersmenu toont `Admin` naast `Settings` voor admingebruikers.
- Niet-admingebruikers zien geen `Admin` menuoptie.
- Route `/admin` is functioneel voor admins en toont gebruikersoverzicht met adminstatus.
- Admin kan vanuit de adminpagina adminrechten voor andere users aan- en uitzetten.
- Backend blokkeert admin-endpoints voor niet-admins met `403`.
- `GET /api/auth/me` retourneert `is_admin`.
- Systeem voorkomt dat de laatste admin zijn eigen adminrechten verliest.
- Backend tests dekken minimaal toegangsbescherming + rights update + laatste-admin beveiliging.
- Frontend tests dekken minimaal menuzichtbaarheid en adminpagina basisflow.

## Testing plan
- Backend: `cd backend && pytest`
- Frontend tests: `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`
- Migraties: `docker compose build migrate && docker compose run --rm migrate`

## Risk + rollback plan
- Risico: lockout door foutieve rolwijziging.
  - Mitigatie: laatste-admin beveiliging in service/API plus testcoverage.
- Risico: frontend toont adminnavigatie inconsistent met backendrechten.
  - Mitigatie: autorisatie altijd afdwingen in backend; frontend alleen als UX-filter.
- Rollback: verwijder adminroutes/UI en draai migratie terug; bestaande user settings flow blijft intact.

## Notes / links
- User input: `ITERATIONS.md` (Iteratie #05).
- Repo regels: `/home/mevius/wervelnieuws/AGENTS.md`.
- OPSX global regels: `/home/mevius/.config/opencode/AGENTS.md`.

## Current status
Completed

## What changed
- Backend gebruikersmodel uitgebreid met adminrol:
  - `backend/app/models/entities.py`: `User.is_admin` toegevoegd.
  - `backend/alembic/versions/20260312_0005_user_is_admin.py`: migratie toegevoegd voor `users.is_admin` met default `false`.
- Seed- en fixturegedrag aangepast zodat de standaard adminuser adminrechten heeft:
  - `backend/app/tasks/seed_admin.py`: bestaande/nieuwe `admin` user wordt nu expliciet admin.
  - `backend/tests/conftest.py`: test-user `admin` seeded met `is_admin=True`.
- Auth payload uitgebreid:
  - `backend/app/schemas/auth.py`: `CurrentUserResponse.is_admin` toegevoegd.
  - `backend/app/api/auth.py`: alle `CurrentUserResponse` returns bevatten nu `is_admin`.
- Admin-only backend autorisatie en endpoints toegevoegd:
  - `backend/app/api/deps.py`: `require_admin` dependency toegevoegd (`403 Admin access required`).
  - `backend/app/schemas/admin.py`: `AdminUserResponse` en `UpdateAdminUserRequest` toegevoegd.
  - `backend/app/api/admin.py`: toegevoegd met:
    - `GET /api/admin/users`
    - `PATCH /api/admin/users/{user_id}`
    - blokkade op demotie van de laatste admin.
  - `backend/app/repositories/user_repository.py`: `list_users`, `count_admins`, `update_admin_status` toegevoegd.
  - `backend/app/main.py`: admin-router geregistreerd.
- Backend tests uitgebreid:
  - `backend/tests/test_admin_api.py` toegevoegd voor admin access control, admin toggle, en laatste-admin beveiliging.
  - `backend/tests/test_meta_and_me.py`: `is_admin` assert toegevoegd + non-admin `GET /api/auth/me` test.
- Frontend adminrollenflow toegevoegd:
  - `frontend/src/lib/api/client.ts`:
    - `CurrentUser.is_admin` toegevoegd.
    - `AdminUser` type toegevoegd.
    - `listAdminUsers()` en `updateAdminUser()` toegevoegd.
  - `frontend/src/app/App.tsx`:
    - usermenu toont `Admin` naast `Settings` alleen wanneer `currentUser.is_admin` true is.
    - nieuwe route `/admin` toegevoegd.
    - nieuwe `AdminPage` met user-overzicht en acties `Maak admin` / `Verwijder admin`.
    - foutfeedback voor laatste-admin demotie verwerkt.
- Frontend tests uitgebreid:
  - `frontend/src/app/App.test.tsx`:
    - admin menu zichtbaar voor admin en verborgen voor non-admin.
    - adminpagina render + rolwijzigingsactie.

## How to verify
- Backend tests (container, aanbevolen):
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Frontend tests:
  - `cd frontend && npm test`
- Frontend build:
  - `cd frontend && npm run build`
- Migratie controleren:
  - `docker compose build migrate && docker compose run --rm migrate`

## Verification evidence
- Lokale backend test-run (`cd backend && pytest`) faalde door ontbrekende lokale dependency `fastapi` in host environment.
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Resultaat: `23 passed`.
- `cd frontend && npm test`
  - Eerste run: 1 testfail door test-order/mock leakage in `App.test.tsx` (admin test verwachtte `admin`, kreeg non-admin state).
  - Na testfix: `10 passed`.
- `cd frontend && npm run build`
  - Resultaat: productiebuild geslaagd (Vite build voltooid).
- `docker compose build migrate && docker compose run --rm migrate`
  - Resultaat: migratie succesvol uitgevoerd naar `20260312_0005`.
