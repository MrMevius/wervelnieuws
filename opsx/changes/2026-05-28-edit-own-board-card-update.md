# Title
Gebruikers kunnen eigen vergaderbord-kaartje aanpassen

## Context
Op het vergaderbord plaatsen gebruikers updates op kaartjes binnen een kolom. Voor deze change moet een gebruiker zijn/haar **eigen update** kunnen aanpassen, met focus op de eerste versie: **tekst + afbeelding** aanpassen.

Belangrijke randvoorwaarden uit discovery en gebruikersantwoorden:
- Alleen de auteur van de update (`author_user_id`) mag wijzigen (server-side afdwingen).
- De bestaande board/card-structuur moet worden gevolgd (geen nieuw parallel model introduceren).
- Als een update al gepubliceerd is, moet opslaan gebeuren als nieuwe revisie/versie zonder automatische herpublicatie.
- Geen automatische herpublicatie naar nieuwsbrief na edits.

## Goals / Non-goals
### Goals
- Voeg een edit-flow toe voor vergaderbord-updates waarbij alleen de auteur mag bewerken.
- Ondersteun bewerken van kaarttekst en kaartafbeelding in v1 van deze change.
- Sla wijzigingen op als nieuwe revisie/versie zodat oude inhoud bewaard blijft (bij bestaand model), of specificeer en implementeer minimaal audit/revisiemechanisme als het model dat nog niet ondersteunt.
- Zorg dat gepubliceerde updates bij edit **niet** automatisch opnieuw gepubliceerd worden (incl. niet opnieuw naar nieuwsbrief).
- UI toont edit-actie alleen voor eigenaar, met duidelijke states: loading, edit, save, cancel, error.
- Voeg gerichte backend- en frontendtests toe voor ownership, succespad, forbidden, revisiegedrag en basis image-flow.

### Non-goals
- Geen wijziging van kolom/status/planning/publicatie-instellingen binnen deze change, behalve wanneer technisch direct noodzakelijk voor veilige opslag van revisies.
- Geen redesign van board- of card-informatiearchitectuur.
- Geen automatische bulk-migratie van historische kaartjes buiten wat strikt nodig is voor compatibiliteit.
- Geen wijziging in publicatiebeleid anders dan expliciet: geen automatische herpublicatie na edit.

## Proposed approach
1. Inspecteer bestaande backend board/card domeinstructuur en huidige opslag/publicatievelden voor kaartupdates.
2. Introduceer of hergebruik een update-endpoint voor "edit own card update" met server-side ownership-check op authenticated user vs. update-auteur (`author_user_id`).
3. Beperk mutable velden in dit endpoint tot tekst en afbeelding (plus technische metadata voor revisie).
4. Pas opslagpad aan zodat elke save een nieuwe revisie/versie oplevert en vorige inhoud raadpleegbaar blijft.
5. Behoud publicatiestatus-veiligheid: bij bewerken van reeds gepubliceerde update géén automatische republishing en géén automatische nieuwsbrief-resend.
6. Voeg frontend UI-actie toe (alleen zichtbaar voor eigenaar) met editformulier voor tekst+afbeelding en states voor loading/save/cancel/error.
7. Dek gedrag af met gerichte tests op backend en frontend.

## Implementation steps (ordered)
1. Inventariseer relevante backend onderdelen:
   - models/schemas/repositories/services rond vergaderbord-kaartjes;
   - owner-identificatie en auth-context;
   - velden/flags rond publicatie en eventuele bestaande versiehistorie.
2. Definieer API-contract voor edit-operatie (request/response, toegestane velden, foutcodes).
3. Implementeer server-side ownership-validatie:
   - eigenaar -> toegestaan;
   - niet-eigenaar -> 403 Forbidden;
   - niet-authenticated -> bestaande auth-foutflow.
4. Implementeer revisie-opslag bij save:
   - nieuwe versie/revisierecord per wijziging;
   - behoud oude inhoud (tekst/afbeeldingreferentie) binnen bestaand model of minimaal audittrail-mechanisme.
5. Waarborg publicatiegedrag:
   - edit van gepubliceerde update triggert geen automatische herpublicatie;
   - geen automatische nieuwsbrief-resend na edit.
6. Implementeer frontend owner-only editactie op kaartdetail/kaartweergave volgens bestaand UI-patroon.
7. Implementeer edit UX-states:
   - enter edit mode;
   - save met loading;
   - cancel met herstel originele weergave;
   - foutmelding bij API-falen.
8. Implementeer image-flow in de editvorm (behouden/vervangen/verwijderen volgens bestaand uploadpatroon).
9. Schrijf/actualiseer tests:
   - backend: ownership success, forbidden, revisie-aanmaak, publicatie-guard;
   - frontend: zichtbaarheid editactie (owner vs non-owner), save/cancel, foutstate, image-flow waar testbaar.
10. Documenteer uiteindelijke verificatie-uitvoer onder `How to verify` en `Verification evidence`, en update `Current status` gedurende uitvoering.

## Acceptance criteria
1. Een geauthenticeerde gebruiker kan alleen updates bewerken waarvan hij/zij auteur is; niet-auteurs krijgen server-side 403.
2. Editfunctie ondersteunt minimaal:
   - tekst aanpassen;
   - afbeelding aanpassen (volgens bestaand upload/renderpad).
3. Bij opslaan van een wijziging ontstaat een nieuwe revisie/versie; eerdere inhoud blijft beschikbaar binnen bestaand datamodel of minimaal audit/revisiepad.
4. Voor reeds gepubliceerde updates geldt: save triggert geen automatische herpublicatie en geen automatische nieuwsbrief-resend.
5. UI toont editactie alleen voor eigenaar en ondersteunt zichtbare states: loading, edit, save, cancel, error.
6. Backendtests dekken ownership-success, ownership-forbidden, revisie-aanmaak en no-auto-republishgedrag.
7. Frontendtests dekken zichtbaar/verborgen editactie, save/cancel-flow en image-flow waar technisch haalbaar.

## Testing plan
- Backend (gericht):
  - ownership autorisatie op edit-endpoint;
  - 403 voor niet-eigenaar;
  - revisierecord/versie-aanmaak bij save;
  - geen automatische republish/newsletter resend na edit van gepubliceerde update.
- Frontend (gericht):
  - edit-knop zichtbaar voor eigenaar en verborgen voor niet-eigenaar;
  - edit/save/cancel/error states;
  - image wijzigingsflow waar testbaar in bestaande testsetup.
- Integratie/smoke (handmatig):
  1. Owner opent kaartje met bestaande tekst+afbeelding.
  2. Owner wijzigt tekst en afbeelding en slaat op.
  3. Verifieer nieuwe revisie zichtbaar/traceerbaar en oude inhoud niet overschreven.
  4. Verifieer dat publicatiekanalen niet automatisch opnieuw afgaan.

## Risk + rollback plan
### Risico's
- Onvolledige ownership-check kan ongeautoriseerde edits toelaten.
- Revisie-opslag kan bestaande reads breken als versie-selectie onduidelijk is.
- Afbeeldingsflow kan regressies geven in upload/preview/persist.
- Impliciete publish hooks kunnen per ongeluk alsnog herpublicatie triggeren.

### Mitigatie
- Ownership uitsluitend server-side afdwingen en expliciet testen op 403.
- Revisiegedrag beperken tot bestaand model en default read-pad expliciet valideren.
- Gerichte regressietests voor image flow.
- Publicatie side-effects isoleren en assertions toevoegen dat auto-republish uitblijft.

### Rollback
- Schakel edit-endpoint/UI edit-actie uit via gerichte revert van deze change.
- Laat bestaande kaartdata en eerdere revisies intact (geen destructieve migratie).
- Indien nodig terugvallen op read-only kaartupdates totdat revisielogica is hersteld.

## Notes / links
- Bron: user-provided discovery-output en expliciete gebruikersantwoorden in deze opdracht.
- Repo-conventie toegepast: `opsx/changes/YYYY-MM-DD-<slug>.md`.
- Gerelateerde context: bestaande vergaderbord/card specs in `opsx/changes/` rond kaartupdates en board-UI.

## Current status
Completed

## What changed
- Verduidelijking vastgelegd en geïmplementeerd: "eigenaar" betekent de auteur van de update (`author_user_id`), server-side afgedwongen met 403 voor niet-auteurs.
- Backend uitgebreid met edit-endpoint voor board-updates: `PATCH /api/boards/cards/{card_id}/updates/{update_id}` met mutable velden voor tekst en afbeelding (toevoegen/vervangen/verwijderen).
- Revisiegedrag toegevoegd: bij elke edit wordt een nieuwe `card_updates` record aangemaakt met verwijzing `edited_from_update_id`; eerdere inhoud blijft behouden.
- Image-flow toegevoegd voor updates inclusief beveiligde downloadroute `GET /api/boards/updates/{update_id}/image`.
- Frontend vergaderbord-detail uitgebreid met owner-only update-bewerkactie (alleen auteur ziet "Bewerken") en states voor edit/save/cancel/loading/error.
- Overzicht/Detail toont update-afbeelding wanneer aanwezig.
- Gerichte backend- en frontendtests toegevoegd voor ownership, forbidden, revisie-opslag en image-flow.
- About/changelog bijgewerkt met gebruikersgerichte release-entry voor deze functionaliteit.
- Migratie `20260528_0018` SQLite-safe gemaakt: op SQLite wordt geen losse `ALTER TABLE ... ADD CONSTRAINT` uitgevoerd voor de self-FK (voorkomt Alembic `NotImplementedError`), terwijl kolommen `image_path` en `edited_from_update_id` wel aangemaakt worden.

## How to verify
- Alembic migratiecheck (SQLite):
  - `DATABASE_URL="sqlite:////tmp/opencode/review_card_update_migration.db" STORAGE_ROOT="/tmp/opencode/review_storage" ./.venv/bin/alembic -c alembic.ini upgrade head` (uitvoeren vanuit `backend/`)
- Backend tests (gericht):
  - `pytest backend/tests/test_boards_api.py -k "edit_own_update or edit_update"`
- Frontend tests (gericht):
  - `npm --prefix frontend test -- VergaderbordenPage.test.tsx`
- Frontend build:
  - `npm --prefix frontend run build`
- Handmatige smoke-check:
  1. Log in als gebruiker A en plaats update op een kaart.
  2. Bewerk die update als gebruiker A: wijzig tekst en voeg/vervang/verwijder afbeelding.
  3. Controleer dat een nieuwe update-revisie verschijnt en oude update-inhoud behouden blijft.
  4. Log in als gebruiker B en verifieer dat "Bewerken" niet zichtbaar is voor updates van gebruiker A en backend 403 geeft op directe API-call.
  5. Verifieer dat er geen automatische publicatie-/nieuwsbriefactie wordt getriggerd door deze board-update-editflow.

## Verification evidence
- Uitgevoerd:
  - `DATABASE_URL="sqlite:////tmp/opencode/review_card_update_migration.db" STORAGE_ROOT="/tmp/opencode/review_storage" ./.venv/bin/alembic -c alembic.ini upgrade head` (workdir `backend/`) → **PASS**
  - `./backend/.venv/bin/pytest backend/tests/test_boards_api.py -k "edit_own_update or edit_update"` → **PASS** (3 passed, 15 deselected)
  - `npm --prefix frontend test -- VergaderbordenPage.test.tsx` → **PASS**
  - `npm --prefix frontend run build` → **PASS**

---
Status: completed
Owner: n.v.t.
Date: 2026-05-28
