# Iteratie 6 Admin kan gebruikerswachtwoorden wijzigen

## Context
Na iteratie 5 kunnen admins rollen beheren, maar een admin kan nog geen wachtwoord van een andere gebruiker resetten. Voor beheer en support moet een admin dit rechtstreeks vanuit de adminpagina kunnen doen.

## Goals / Non-goals
### Goals
- Voeg een admin-only backend endpoint toe om het wachtwoord van een gebruiker te wijzigen.
- Voeg een admin UI-flow toe op de adminpagina om per gebruiker een nieuw wachtwoord in te stellen.
- Voeg validatie en foutafhandeling toe (minimale lengte, gebruiker bestaat, toegang).
- Breid tests uit voor backend en frontend op deze nieuwe flow.

### Non-goals
- Geen e-mailflow voor wachtwoordreset.
- Geen tijdelijke wachtwoorden of reset tokens.
- Geen extra rollen/permissies buiten bestaand `is_admin`.

## Proposed approach
1. Breid admin schema's uit met een requestmodel voor wachtwoordwijziging.
2. Voeg admin endpoint toe: `PATCH /api/admin/users/{user_id}/password`.
3. Hash nieuwe wachtwoorden met bestaande security helper en sla op via repository.
4. Voeg frontend API-client functie toe voor admin password update.
5. Voeg op de adminpagina een compact formulier toe per gebruiker voor nieuw wachtwoord + bevestiging en submit.
6. Toon duidelijke succes- en foutmeldingen.
7. Voeg backend/frontend tests toe.
8. Maak de admin-gebruikersbeheerweergave compacter door wachtwoordvelden alleen te tonen in een uitklapregel na klik op `Reset wachtwoord`.

## Implementation steps (ordered)
1. Schema-update backend voor admin wachtwoordwijziging.
2. Endpoint implementeren in `backend/app/api/admin.py` met admin guard.
3. Backend tests toevoegen voor access control en succesvolle wijziging.
4. Frontend API-client uitbreiden.
5. Adminpagina uitbreiden met wachtwoord reset UI.
6. Frontend tests uitbreiden voor deze flow.
7. Relevante checks draaien en resultaten vastleggen.
8. UI compact maken: standaard tabelrijen opschonen en een uitklapregel voor wachtwoordreset toevoegen.

## Acceptance criteria
- Admin kan vanuit de adminpagina het wachtwoord van een gebruiker wijzigen.
- Alleen admins kunnen het admin wachtwoord-endpoint gebruiken (`403` voor niet-admin).
- Nieuw wachtwoord wordt gehasht opgeslagen (niet plaintext).
- Endpoint valideert minimaal wachtwoordlengte conform bestaande authregels.
- Frontend toont duidelijke succes/fout feedback na submit.
- Backend en frontend tests dekken deze nieuwe flow.
- Gebruikersbeheer op de adminpagina is compacter: wachtwoordvelden zijn standaard verborgen en verschijnen pas na expliciete reset-actie.

## Testing plan
- Backend: `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Frontend tests: `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`

## Risk + rollback plan
- Risico: onbedoelde wijziging van verkeerde gebruiker.
  - Mitigatie: expliciete user_id route, usernaam zichtbaar in UI, duidelijke feedback.
- Risico: wachtwoord-policy inconsistenties.
  - Mitigatie: gedeelde validatie via Pydantic schema met bestaande minimale lengte.
- Rollback: endpoint en UI terugdraaien; bestaande wachtwoordwijziging via Settings blijft intact.

## Notes / links
- User request: admin moet wachtwoorden van gebruikers kunnen wijzigen.
- Actieve spec gekozen door user: nieuwe spec.

## Current status
Completed

## What changed
- Backend:
  - `backend/app/schemas/admin.py`: `UpdateAdminUserPasswordRequest` toegevoegd met wachtwoordvalidatie (`min_length=4`).
  - `backend/app/api/admin.py`: nieuw admin-only endpoint `PATCH /api/admin/users/{user_id}/password` toegevoegd.
  - Endpoint gebruikt bestaande hashing (`hash_password`) en bestaande repository-methode `update_password`.
- Backend tests:
  - `backend/tests/test_admin_api.py` uitgebreid met:
    - `test_admin_password_change_requires_admin_role`
    - `test_admin_can_change_user_password`
    - `test_admin_password_change_rejects_short_password`
- Frontend API:
  - `frontend/src/lib/api/client.ts`: `changeAdminUserPassword(userId, new_password)` toegevoegd.
- Frontend UI:
  - `frontend/src/app/App.tsx` (`AdminPage`):
    - per gebruiker invoervelden voor nieuw wachtwoord + bevestiging toegevoegd;
    - knop `Wijzig wachtwoord` met submitflow toegevoegd;
    - succes/fout feedback voor admin wachtwoordwijziging toegevoegd.
  - UI compact gemaakt (optie 1):
    - wachtwoordvelden staan niet meer permanent in de hoofdregel;
    - per user is er nu een actie `Reset wachtwoord` die een uitklapregel met wachtwoordformulier toont;
    - hoofdweergave van gebruikersbeheer is daarmee compacter en rustiger.
- Frontend tests:
  - `frontend/src/app/App.test.tsx`: test `allows admin to change another user password` toegevoegd.
  - `frontend/src/app/App.test.tsx` aangepast zodat eerst de reset-uitklapregel wordt geopend voor wachtwoordinvoer.
- Styling:
  - `frontend/src/styles.css`: compacte reset-uitklaplayout toegevoegd (`admin-password-row`, `admin-password-editor`, `admin-password-actions`) met mobiele fallback.

## How to verify
- Run backend tests:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Run frontend tests:
  - `cd frontend && npm test`
- Run frontend production build:
  - `cd frontend && npm run build`
- Controleer handmatig in Admin > Gebruikersbeheer:
  - wachtwoordvelden zijn standaard verborgen;
  - klik op `Reset wachtwoord` opent de compacte uitklapregel;
  - klik op `Verberg` of `Annuleer` sluit de uitklapregel weer.

## Verification evidence
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Resultaat: `26 passed`.
- `cd frontend && npm test`
  - Resultaat: `11 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (Vite productiebuild).
- Na compact UI-aanpassing:
  - `cd frontend && npm test` -> `11 passed`.
  - `cd frontend && npm run build` -> build geslaagd.
