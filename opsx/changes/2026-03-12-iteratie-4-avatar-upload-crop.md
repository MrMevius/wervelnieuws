# Iteratie 4 Profielfoto Upload + Ronde Crop

## Context
In `ITERATIONS.md` vraagt iteratie 4 om twee concrete functies: gebruikers moeten hun eigen profielfoto kunnen uploaden, en na upload moet die foto bijgesneden kunnen worden tot een mooie cirkel voor gebruik in de applicatie.

Iteratie 3 heeft al een werkende settings-pagina met profielvelden en themavoorkeur, maar nog geen avatar-veld, upload-endpoint of crop-flow.

## Goals / Non-goals
### Goals
- Voeg avatar-ondersteuning toe aan het gebruikersprofiel.
- Maak upload van profielfoto mogelijk vanuit de settings-pagina.
- Voeg client-side crop-flow toe waarmee gebruiker de foto rond bijsnijdt.
- Sla het resultaat op als transparante PNG (echt rond bestand, geen alleen-CSS masker).
- Toon avatar in de topbar naast gebruikersnaam met fallback als er geen avatar is.
- Voeg validatie en tests toe voor de kritieke paden.

### Non-goals
- Geen algemene media library of bestandsbeheer.
- Geen admin-functionaliteit om avatars van andere gebruikers te beheren.
- Geen geavanceerde beeldbewerking (filters, rotatie, AI-enhance).
- Geen publiek toegankelijke avatar URL; alleen geauthenticeerde toegang.

## Proposed approach
1. Breid het user-model uit met `avatar_path` en voeg migratie toe.
2. Breid `GET /api/auth/me` payload uit met `has_avatar`.
3. Voeg avatar endpoints toe voor huidige gebruiker:
   - `POST /api/auth/me/avatar` (multipart upload van gecropte PNG)
   - `GET /api/auth/me/avatar` (image response)
4. Implementeer veilige opslag in lokale storage (`/data/uploads/avatars`).
5. Bouw settings UI flow: bestand kiezen, ronde preview/crop, upload en feedback.
6. Toon avatar/fallback in topbar user trigger.
7. Voeg backend en frontend tests toe voor upload/render flow.

## Implementation steps (ordered)
1. Model + migratie: `users.avatar_path` toevoegen.
2. Schema/API uitbreiden voor `has_avatar` en avatar upload/download endpoints.
3. Frontend API client uitbreiden met avatar upload + blob fetch.
4. Settings UI uitbreiden met crop modal en PNG-export via canvas.
5. Topbar user trigger uitbreiden met avatar rendering + fallback.
6. Tests bijwerken/toevoegen voor backend en frontend iteratie-4 gedrag.
7. Relevante tests/build draaien en bewijs vastleggen.

## Acceptance criteria
- Settings bevat een sectie om profielfoto te uploaden.
- Gebruiker kan gekozen foto rond bijsnijden in de UI.
- Opslaan produceert en uploadt een transparante PNG avatar.
- `GET /api/auth/me` geeft `has_avatar` terug.
- `GET /api/auth/me/avatar` levert avatar image voor gebruiker met avatar, en foutstatus zonder avatar.
- Topbar toont avatar naast gebruikersnaam; zonder avatar is er een duidelijke fallback.
- Backend valideert bestandstype en bestandsgrootte.
- Backend tests dekken minimaal avatar upload + ophalen + validatie.
- Frontend tests dekken minimaal settings render en avatar-gerelateerde UI baseline.

## Testing plan
- Backend: `cd backend && pytest`
- Frontend tests: `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`

## Risk + rollback plan
- Risico: image-crop preview en geëxporteerde output wijken visueel af.
  - Mitigatie: eenvoudige vaste crop-viewport met voorspelbare mapping naar canvas.
- Risico: binaire avatar fetch introduceert browser-memory leaks via object URLs.
  - Mitigatie: object URLs consequent revoken bij cleanup.
- Rollback: verwijder avatar routes/UI en draai migratie terug; bestaande settings-flow blijft intact.

## Notes / links
- User input: `ITERATIONS.md` (Iteratie #04).
- Repo regels: `/home/mevius/wervelnieuws/AGENTS.md`.

## Current status
Completed

## What changed
- Backend gebruikersprofiel uitgebreid met avatar-pad:
  - `backend/app/models/entities.py`: `User.avatar_path` toegevoegd.
  - `backend/alembic/versions/20260312_0004_user_avatar_path.py`: migratie toegevoegd voor `users.avatar_path`.
- Backend settings uitgebreid:
  - `backend/app/core/settings.py`: `avatar_max_bytes` toegevoegd (default 5 MB).
- Backend auth API uitgebreid met avatar-functionaliteit:
  - `backend/app/schemas/auth.py`: `CurrentUserResponse` bevat nu `has_avatar`.
  - `backend/app/api/auth.py`:
    - `GET /api/auth/me` retourneert `has_avatar`.
    - `POST /api/auth/me/avatar` toegevoegd voor PNG upload van huidige gebruiker.
    - `GET /api/auth/me/avatar` toegevoegd voor geauthenticeerde avatar download.
    - Upload validatie toegevoegd voor lege upload, max grootte en PNG content type.
- Backend tests uitgebreid in `backend/tests/test_meta_and_me.py`:
  - avatar upload + ophalen (succespad).
  - non-PNG upload validatie (400).
  - avatar ophalen zonder bestaande avatar (404).
  - bestaande `GET /api/auth/me` checks geüpdatet met `has_avatar`.
- Frontend API client uitgebreid:
  - `frontend/src/lib/api/client.ts`:
    - `CurrentUser` uitgebreid met `has_avatar`.
    - `uploadCurrentUserAvatar()` toegevoegd (multipart).
    - `getCurrentUserAvatarBlob()` toegevoegd (binaire fetch met auth header).
- Frontend settings + topbar avatar flow geïmplementeerd:
  - `frontend/src/app/App.tsx`:
    - Topbar user-trigger toont avatar of initialen-fallback.
    - Avatar blob ophalen en veilig object URL cleanup (revoke).
    - Settings-pagina bevat profielfoto-sectie met bestandkeuze.
    - Crop modal toegevoegd met zoom + X/Y offset sliders.
    - Canvas-export naar ronde transparante PNG toegevoegd (`createCircularAvatarPng`) en uploadflow met feedback.
- Frontend styling uitgebreid:
  - `frontend/src/styles.css`: avatar componenten, upload-sectie en cropper-modal stijlen toegevoegd.
- Frontend tests bijgewerkt:
  - `frontend/src/app/App.test.tsx`: API mocks aangepast voor nieuwe current-user shape en avatar API exports.
- UX-verbetering cropper toegevoegd:
  - `frontend/src/app/App.tsx`: crop preview ondersteunt nu direct verslepen met muis en touch naast de bestaande sliders.
  - `frontend/src/styles.css`: `grab/grabbing` cursor en drag-vriendelijke image instellingen toegevoegd.

## How to verify
- Backend tests (container):
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py"`
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
- Frontend tests:
  - `cd frontend && npm test`
- Frontend build:
  - `cd frontend && npm run build`
- Migraties:
  - `docker compose build migrate && docker compose run --rm migrate`

## Verification evidence
- Lokale backend test-run (`cd backend && pytest tests/test_meta_and_me.py`) faalde door ontbrekende lokale dependency `fastapi` in host environment (verwacht; containerpad gebruikt voor geldige verificatie).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_meta_and_me.py"`
  - Resultaat: `7 passed`.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest"`
  - Resultaat: `16 passed`.
- `cd frontend && npm test`
  - Resultaat: `7 passed`.
- `cd frontend && npm run build`
  - Resultaat: productiebuild geslaagd (Vite build voltooid).
- `docker compose build migrate && docker compose run --rm migrate`
  - Resultaat: migratie succesvol uitgevoerd naar `20260312_0004`.
- Nacontrole na cropper drag/touch UX-update:
  - `cd frontend && npm test`
  - Resultaat: `7 passed`.
  - `cd frontend && npm run build`
  - Resultaat: productiebuild geslaagd (Vite build voltooid).
