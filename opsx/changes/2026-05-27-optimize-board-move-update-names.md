# Title
Optimize board card move update wording and display full names

## Context
Automatische kaartverplaatsings-updates op vergaderborden bevatten nu datum/tijd in de berichttekst, terwijl die metadata al apart onder elke update wordt getoond. Daarnaast tonen board-updates en andere board-gerelateerde gebruikersweergaven vaak `username` in plaats van de beter leesbare `full_name`.

Deze wijziging maakt de update-tekst korter en consistenter, en harmoniseert gebruikersnaamweergave in de vergaderborden-flow met een duidelijke fallback-regel.

## Goals / Non-goals
### Goals
- Pas de automatische move-update tekst aan naar: `Verplaatst van <oude kolom> naar <nieuwe kolom> door <volledige naam/fallback>.`
- Verwijder datum/tijd uit de move-update berichttekst (metadata blijft apart zichtbaar).
- Gebruik overal in scope `full_name` met fallback naar `username` wanneer `full_name` ontbreekt of leeg is.
- Houd backend-responses/types en frontend-rendering onderling consistent.
- Werk relevante backend- en frontend-tests bij voor move-bericht en display-name fallback.

### Non-goals
- Geen migratie of herschrijving van bestaande, reeds opgeslagen update-berichten.
- Geen wijzigingen aan audit trail, authenticatie, of publicatieflows.
- Geen redesign van board/card statemodel of workflow.

## Proposed approach
1. Centraliseer display-name-resolutie (bij voorkeur één gedeelde helper per laag) met regel: getrimde `full_name` indien aanwezig, anders `username`.
2. Pas message builder voor automatische kaartverplaatsing aan zodat alleen kolomovergang + actornaam in berichttekst staat.
3. Behoud compatibiliteit van API-contracten; voeg alleen een extra afgeleid veld toe als dat nodig is om frontend regressies te voorkomen.
4. Harmoniseer vergaderborden-UI op zichtbare gebruikersvelden binnen praktische scope met dezelfde display-name-logica.
5. Borg gedrag met gerichte tests in backend en frontend.

## Implementation steps (ordered)
1. Inventariseer huidige message builder(s) voor kaartverplaatsings-updates en alle vergaderborden-weergaven waar gebruikersnamen zichtbaar zijn.
2. Definieer en implementeer uniforme display-name-fallbacklogica (`full_name` -> `username`) op backend en/of frontend waar relevant.
3. Wijzig move-update berichtopbouw naar exact: `Verplaatst van <oude kolom> naar <nieuwe kolom> door <naam>.`
4. Controleer en align API-schema/types zodat frontend zonder contractbreuk de juiste naam kan tonen (compatibele velden behouden).
5. Pas kaartupdate-metadataweergave aan zodat actornaam ook `full_name` met fallback gebruikt.
6. Pas overige vergaderborden-user-displays binnen scope aan op dezelfde logica waar praktisch toepasbaar.
7. Voeg/werk tests bij voor:
   - move-update tekst zonder datum/tijd,
   - fallback bij ontbrekende/lege `full_name`,
   - relevante UI-weergaven van gebruikersnamen.
8. Werk About/changelog bij met een functionele, eindgebruikersvriendelijke notitie over kortere update-tekst en volledige namen.
9. Documenteer verificatie-uitkomsten in deze spec en update status na implementatie.

## Acceptance criteria
1. Nieuwe automatische move-updates bevatten géén datum/tijd in de berichttekst.
2. Nieuwe automatische move-updates volgen exact het patroon: `Verplaatst van <oude kolom> naar <nieuwe kolom> door <naam>.`
3. Bij naamweergave wordt `full_name` gebruikt; als `full_name` ontbreekt of leeg/whitespace is, wordt `username` gebruikt.
4. Metadata onder kaartupdates toont dezelfde display-name-logica (full_name met fallback).
5. Vergaderbord-UI gebruikt dezelfde display-name-logica op zichtbare gebruikersweergaven binnen afgesproken scope.
6. Relevante backend- en frontend-tests slagen.

## Testing plan
- Backend: voeg/actualiseer tests voor move-update berichtgenerator en display-name fallback.
- Frontend: voeg/actualiseer tests voor kaartupdate-rendering en vergaderborden gebruikersnaamweergave.
- Typecheck/build voor frontend uitvoeren om typeconsistentie te verifiëren.
- Exacte testpaden/commands bepalen op basis van bestaande repo-teststructuur; minimaal:
  - gerichte backend testcommand(s) voor board/card updates,
  - gerichte frontend testcommand(s) voor vergaderborden,
  - frontend typecheck/build command.

## Risk + rollback plan
### Risico's
- API-veldwijzigingen kunnen frontend rendering breken.
- Inconsistente fallbackimplementatie tussen backend/frontend kan tot afwijkende naamweergave leiden.
- Brede UI-aanpassing “waar users zichtbaar zijn” kan onbedoelde regressies introduceren.

### Mitigatie
- Behoud bestaande velden en voeg afgeleide velden alleen compatibel toe indien nodig.
- Leg fallbackregel één-op-één vast en test zowel null/empty/whitespace scenario’s.
- Voer gerichte regressietests uit op kaartupdates en vergaderborden-overzichten/detailweergaven.

### Rollback
- Revert move-message builder naar vorige tekstopbouw.
- Revert display-name mapping naar vorige naambron.
- Laat bestaande opgeslagen data ongewijzigd; rollback raakt alleen nieuwe rendering/generatie.

## Notes / links
- Bronscope (user input): Draft Change Spec Outline “Optimize board card move update wording and display full names”.
- Verwachte impactgebieden:
  - backend board/card update message builder en serializers/schemas,
  - frontend vergaderborden card update components en user display fields,
  - gerelateerde unit/integratietests,
  - About/changelog entry (Definition of Done).

## Current status
Completed

## What changed
- Backend move-update berichtopbouw aangepast naar exact: `Verplaatst van <oude kolom> naar <nieuwe kolom> door <naam>.` zonder datum/tijd in de berichttekst.
- Backend display-name helper toegevoegd met regel: `full_name.strip()` als die bestaat, anders `username` (fallback).
- Backend board responses uitgebreid met compatibele extra velden:
  - `CardAssignmentResponse.user_display_name`
  - `CardUpdateResponse.author_display_name`
  Bestaande velden (`username`, `author_username`) blijven ongewijzigd voor API-compatibiliteit.
- Vergaderborden-frontend bijgewerkt om display names te tonen waar users zichtbaar zijn binnen scope:
  - assignment chips (tooltip) via `user_display_name`
  - update-metadata auteur via `author_display_name` met fallback
  - user labels in project-uitnodiging en teamselectie via `full_name -> username`
- Relevante backend/frontend tests bijgewerkt en uitgebreid voor move-tekst en display-name gedrag.
- About/changelog entry toegevoegd voor deze functionele wijziging (iteratie 40).
- Backend admin user update-flow gecorrigeerd zodat `PATCH /api/admin/users/{user_id}` meegegeven `full_name` (getrimd), `email` en optioneel `is_active` toepast zonder bestaande waarden te wissen wanneer velden ontbreken. Daardoor tonen board assignment labels na user-update de juiste `user_display_name`.

## How to verify
1. Backend (vereist backend dependencies, incl. FastAPI):
   - `pytest backend/tests/test_boards_api.py`
2. Frontend gerichte tests:
   - `npm --prefix frontend run test -- src/app/features/admin/VergaderbordenPage.test.tsx`
3. Frontend typecheck/build:
   - `npm --prefix frontend run build`
4. Handmatig in Vergaderborden:
   - Verplaats een kaart tussen kolommen en controleer update-tekst exact op:
     `Verplaatst van <oude kolom> naar <nieuwe kolom> door <naam>.`
   - Controleer dat datum/tijd alleen in metadata staat, niet in de berichttekst.
   - Controleer dat zichtbare user labels full name tonen met fallback naar username.

## Verification evidence
- `pytest backend/tests/test_boards_api.py` → **failed in huidige omgeving** met `ModuleNotFoundError: No module named 'fastapi'` (backend dependencies niet beschikbaar in deze runner).
- `npm --prefix frontend run test -- src/app/features/admin/VergaderbordenPage.test.tsx` → **pass** (13/13).
- `npm --prefix frontend run build` → **pass** (`tsc -b && vite build` succesvol).
- `./.venv/bin/pytest tests/test_boards_api.py -k test_board_uses_full_name_with_trimmed_fallback_for_display_labels` (workdir `backend/`) → **pass** (1 passed, 11 deselected).
- `./.venv/bin/python -m pytest tests/test_boards_api.py` (workdir `backend/`) → **pass** (12 passed, 43 warnings).

---
Status: completed
Owner: n.v.t.
Date: 2026-05-27
