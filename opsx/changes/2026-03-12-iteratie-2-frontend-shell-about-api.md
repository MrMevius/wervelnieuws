# Iteratie 2 Frontend Shell + About API

## Context
De gebruiker wil iteratie 2 uitvoeren met een volledig vernieuwde look and feel, een tab-gebaseerde navigatie, een gebruikersmenu rechtsboven, dummy-pagina's voor main/log/database/settings, een planningstabel, en een About-pagina met begrijpelijke uitleg en changelog.

Belangrijke keuze: changelog moet read-only direct uit de backend API komen.

## Goals / Non-goals
### Goals
- Nieuwe frontend shell met tabs: main, planning, database, log, about.
- Gebruikersmenu rechts met settings-link en uitloggen.
- Dummy-pagina's voor main, database, log en settings.
- Planning-pagina met gevraagde kolommen.
- About-pagina die data vanuit backend API laadt.
- Backend read-only endpoint voor About + changelog.
- Backend endpoint om ingelogde gebruiker op te halen voor weergave in topbar.
- Frontend en backend tests voor de nieuwe iteratie-2 functionaliteit.

### Non-goals
- Geen changelog beheer-API (create/update/delete).
- Geen nieuwe publicatie/workflow-logica.
- Geen redesign van backend domeinmodel buiten benodigde read-only metadata endpoints.

## Proposed approach
1. Voeg backend endpoint `GET /api/auth/me` toe voor gebruikersnaam weergave in UI.
2. Voeg backend endpoint `GET /api/meta/about` toe met fallback-content en optionele JSON uit `system_settings`.
3. Refactor frontend `App` naar een shell met topbar, tabs, user-menu en routes.
4. Implementeer iteratie-2 pagina's met dummy-inhoud en planningstabel.
5. Laad About-data via API in de About-route.
6. Werk tests bij voor backend endpoints en frontend navigatie/weergave.

## Implementation steps (ordered)
1. Maak backend schema's en API-routes voor `auth/me` en `meta/about`.
2. Registreer nieuwe meta-router in FastAPI app.
3. Breid frontend API-client uit met `getCurrentUser` en `getAboutContent`.
4. Bouw nieuwe app-shell met routes/tabbar/usermenu en vernieuwde styling.
5. Vervang oude dashboard-UI door iteratie-2 pagina-structuur.
6. Pas frontend tests aan voor login + navigatie + about/planning/settings gedrag.
7. Voeg backend tests toe voor de nieuwe endpoints.
8. Voer relevante tests/build uit en documenteer evidence.

## Acceptance criteria
- Topbar toont tabs: main, planning, database, log, about.
- Rechtsboven staat gebruikersnaam; klik toont settings en uitloggen.
- Settings route bestaat als dummy pagina.
- Main pagina toont dummyblokken met welkom + upload + KPI's + planning-overzicht.
- Planning pagina toont tabel met kolommen: ID, Onderwerp, Thema, Status, Geplande datum, Plaatsingdatum, Illustratie, Opmerkingen.
- Log pagina bestaat als dummy.
- About pagina toont korte uitleg, disclaimer, ontwikkeld-door tekst, en changelog die via backend API wordt opgehaald.
- Backend bevat read-only endpoint voor About/changelog en endpoint voor huidige gebruiker.
- Frontend tests dekken ten minste login + tabnavigatie + user menu + about/planning rendering.
- Backend tests dekken ten minste `GET /api/auth/me` en `GET /api/meta/about`.

## Testing plan
- Backend: `cd backend && pytest`
- Frontend tests: `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`

## Risk + rollback plan
- Risico: frontend breekt bestaande testverwachtingen door layoutwijziging.
  - Mitigatie: tests meeschrijven met nieuwe route-structuur.
- Risico: about-content ontbreekt in DB.
  - Mitigatie: server-side fallback payload teruggeven.
- Rollback: revert naar vorige `App.tsx` en verwijder nieuwe meta-route als release problemen geeft.

## Notes / links
- User input: `ITERATIONS.md` en aanvullende keuze "read only" voor changelog API.
- Repo regels: `/home/mevius/wervelnieuws/AGENTS.md`.

## Current status
Completed

## What changed
- Backend uitgebreid met gebruikers- en metadata endpoints:
  - `GET /api/auth/me` toegevoegd in `backend/app/api/auth.py`.
  - `GET /api/meta/about` toegevoegd in `backend/app/api/meta.py` met read-only fallback payload.
  - Nieuwe schema's toegevoegd:
    - `backend/app/schemas/auth.py` (`CurrentUserResponse`)
    - `backend/app/schemas/meta.py` (`AboutResponse`, `ChangelogEntry`)
  - `backend/app/main.py` registreert nu ook de meta-router.
- Frontend API-client uitgebreid in `frontend/src/lib/api/client.ts`:
  - `getCurrentUser()` voor topbar-gebruikersnaam.
  - `getAboutContent()` voor About/changelog data vanuit backend API.
- Frontend shell volledig herbouwd in `frontend/src/app/App.tsx`:
  - Topbar tabs: Main, Planning, Database, Log, About.
  - Gebruikersmenu rechts met `Settings` en `Uitloggen`.
  - Nieuwe route-structuur met dummy pagina's voor Main/Database/Log/Settings.
  - Planningpagina met gevraagde tabelkolommen.
  - About-pagina laadt uitleg/disclaimer/ontwikkelaar/changelog vanuit API.
- Visuele refresh doorgevoerd in `frontend/src/styles.css` met nieuwe layout, typografie, tabbar, kaarten en responsieve weergave.
- Tests bijgewerkt:
  - Backend: `backend/tests/test_meta_and_me.py` toegevoegd voor `/api/auth/me` en `/api/meta/about`.
  - Frontend: `frontend/src/app/App.test.tsx` herschreven voor login, navigatie, user-menu, planningkolommen en about-API render.
- Iteratienummering gecorrigeerd naar iteratie 2 conform `ITERATIONS.md`:
  - `ITERATIONS.md` kop aangepast naar `Iteratie #02`.
  - Backend About fallback changelog-entry aangepast naar `iteration: "02"` in `backend/app/api/meta.py`.
  - Frontend About testverwachting aangepast naar `Iteratie 02` in `frontend/src/app/App.test.tsx`.
- About-changelogtekst in backend fallback inhoudelijk herschreven naar niet-technische, duidelijkere formuleringen in `backend/app/api/meta.py`.
- About `description` en `disclaimer` in backend fallback compacter en eenvoudiger geformuleerd in `backend/app/api/meta.py`.
- About laadfoutmelding in frontend gebruiksvriendelijker geformuleerd in `frontend/src/app/App.tsx`.

## How to verify
- Backend tests:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - of gericht voor iteratienummer-correctie: `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py"`
- Frontend tests:
  - `cd frontend && npm test`
- Frontend build:
  - `cd frontend && npm run build`

## Verification evidence
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Resultaat: `11 passed`.
- `cd frontend && npm test`
  - Resultaat: `5 passed`.
- `cd frontend && npm run build`
  - Resultaat: productiebuild geslaagd (Vite build voltooid).
- Nacontrole na iteratienummer-correctie:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py"`
  - Resultaat: `2 passed`.
  - `cd frontend && npm test`
  - Resultaat: `5 passed`.
- Nacontrole na tekstuele opschoning van About-changelog:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py"`
  - Resultaat: `2 passed`.
- Nacontrole na compacter maken van About description/disclaimer:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py"`
  - Resultaat: `2 passed`.
- Nacontrole na frontend About foutmelding copy-update:
  - `cd frontend && npm test`
  - Resultaat: `5 passed`.
