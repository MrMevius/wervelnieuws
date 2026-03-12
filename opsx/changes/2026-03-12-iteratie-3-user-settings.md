# Iteratie 3 User Settings + Dark Mode

## Context
In `ITERATIONS.md` is iteratie 3 gedefinieerd met focus op gebruikersinstellingen: settings-menu aanpassen, dark mode kiezen, volledige naam beheren, e-mailadres beheren, en suggesties tonen voor extra relevante instellingen.

De huidige app heeft alleen een dummy settings-pagina en het gebruikersmodel bevat nog geen profielvelden voor volledige naam/e-mail/themavoorkeur.

## Goals / Non-goals
### Goals
- Maak van de settings-pagina een werkende gebruikersinstellingen-pagina.
- Voeg backend-ondersteuning toe om profielvelden van de ingelogde gebruiker op te halen en bij te werken.
- Voeg dark mode keuze toe (`light`, `dark`, `system`) en pas deze toe in de UI.
- Voeg velden toe voor volledige naam en e-mail met validatie en veilige update-flow.
- Toon op de settings-pagina een korte sectie met suggesties voor aanvullende user settings.

### Non-goals
- Geen nieuw rollen/permissies model.
- Geen multi-factor-auth, sessiebeheer of account recovery-flow.
- Geen notificatie-instellingen backend-logica; alleen suggesties in de UI.
- Geen redesign buiten de noodzakelijke styling voor thema-ondersteuning en settings-formulier.

## Proposed approach
1. Breid het backend gebruikersmodel uit met `full_name`, `email`, `theme_preference`.
2. Voeg schema's en endpoint `PATCH /api/auth/me` toe voor profielupdate van de huidige gebruiker.
3. Breid `GET /api/auth/me` uit zodat frontend alle settings-data kan laden.
4. Breid frontend API-client en types uit met current-user update ondersteuning.
5. Vervang settings dummy door een echte formulierpagina met save-feedback.
6. Implementeer dark mode toepassen op root-niveau en ondersteun system-voorkeur.
7. Werk tests bij voor backend en frontend iteratie-3 gedrag.

## Implementation steps (ordered)
1. Update backend model/enums/repository + Alembic migratie voor nieuwe gebruikersvelden.
2. Update backend auth schema's en routes (`GET /auth/me`, `PATCH /auth/me`).
3. Voeg backend tests toe voor profielupdate, validatie en unieke e-mail.
4. Update frontend API client met nieuwe current-user velden en update-call.
5. Vervang settings dummy route met echte settings-pagina en user-menu naamweergave.
6. Voeg thema-logica en CSS-variabelen voor dark mode toe.
7. Voeg frontend tests toe voor settings update flow en dark mode gedrag.
8. Run relevante tests/build en documenteer verificatie.

## Acceptance criteria
- Settings vanuit gebruikersmenu opent een werkende settings-pagina (geen dummy).
- Gebruiker kan themavoorkeur kiezen (`light`, `dark`, `system`) en dit wordt toegepast in de UI.
- Gebruiker kan volledige naam opslaan/wijzigen en deze wordt teruggeleverd via `GET /api/auth/me`.
- Gebruiker kan e-mailadres opslaan/wijzigen met e-mailvalidatie.
- Backend voorkomt dubbel gebruik van hetzelfde e-mailadres over verschillende gebruikers.
- Settings-pagina toont suggesties voor aanvullende relevante instellingen.
- Frontend tests dekken minimaal settings-rendering, save-flow en thema-keuze.
- Backend tests dekken minimaal `GET /api/auth/me` uitgebreide payload en `PATCH /api/auth/me`.

## Testing plan
- Backend: `cd backend && pytest`
- Frontend tests: `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`

## Risk + rollback plan
- Risico: bestaande gebruikersrecords hebben geen nieuwe velden.
  - Mitigatie: nullable velden met veilige defaults (`theme_preference=system`).
- Risico: thema-aanpassingen veroorzaken contrastproblemen.
  - Mitigatie: beperkte variabele-set en gerichte regressietest op navigatie/settings.
- Rollback: revert iteratie-3 frontend settings wijzigingen en draai migratie terug.

## Notes / links
- User input: `ITERATIONS.md` (Iteratie #03).
- Repo regels: `/home/mevius/wervelnieuws/AGENTS.md`.

## Current status
Completed

## What changed
- Backend gebruikersprofiel uitgebreid met iteratie-3 velden:
  - `backend/app/models/entities.py`: `User.full_name`, `User.email` (unique), `User.theme_preference` toegevoegd.
  - `backend/app/models/enums.py`: nieuw enum `ThemePreference` (`light`, `dark`, `system`).
  - `backend/alembic/versions/20260312_0003_user_profile_theme.py`: migratie toegevoegd voor nieuwe users-kolommen + unieke e-mail constraint.
- Backend auth API uitgebreid:
  - `backend/app/schemas/auth.py`: `CurrentUserResponse` uitgebreid met profiel/thema velden.
  - `backend/app/schemas/auth.py`: `UpdateCurrentUserRequest` toegevoegd met normalisatie en e-mailvalidatie.
  - `backend/app/api/auth.py`:
    - `GET /api/auth/me` retourneert nu ook `full_name`, `email`, `theme_preference`.
    - `PATCH /api/auth/me` toegevoegd voor update van volledige naam, e-mail en thema.
  - `backend/app/repositories/user_repository.py`: `get_by_email` + `update_current_user` toegevoegd.
- Testdata uitgebreid:
  - `backend/tests/conftest.py` seedt nu extra gebruiker (`editor@example.com`) voor duplicate e-mail test.
- Backend tests uitgebreid in `backend/tests/test_meta_and_me.py`:
  - uitgebreide payload check voor `GET /api/auth/me`.
  - succespad `PATCH /api/auth/me`.
  - invalid email (422) en duplicate email (409) checks.
- Frontend iteratie-3 settings geïmplementeerd:
  - `frontend/src/lib/api/client.ts`:
    - `CurrentUser` type uitgebreid met profiel/thema.
    - `updateCurrentUser()` toegevoegd.
  - `frontend/src/app/App.tsx`:
    - settings-dummy vervangen door echte `SettingsPage`.
    - formulier voor volledige naam, e-mail en thema-keuze.
    - feedback bij opslaan en foutafhandeling.
    - topbar toont nu `full_name` fallback naar `username`.
    - dark mode (`light`/`dark`/`system`) wordt toegepast via `data-theme` op root.
    - suggesties voor extra user settings toegevoegd op de settings-pagina.
  - `frontend/src/styles.css`:
    - thema-variabelen voor dark mode toegevoegd.
    - settings-form layout en feedbackstijlen toegevoegd.
  - `frontend/src/test/setup.ts`: `window.matchMedia` mock toegevoegd voor thematests.
  - `frontend/src/app/App.test.tsx`:
    - API mocks aangepast aan nieuwe current-user shape.
    - nieuwe test voor settings opslaan + thema-applicatie.

## How to verify
- Backend tests:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Frontend tests + build:
  - `cd frontend && npm test && npm run build`

## Verification evidence
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Resultaat: `14 passed`.
- `cd frontend && npm test && npm run build`
  - Resultaat: frontend tests `6 passed`.
  - Resultaat: productiebuild geslaagd (Vite build voltooid).
