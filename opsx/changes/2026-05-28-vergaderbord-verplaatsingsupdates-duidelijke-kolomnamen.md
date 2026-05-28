# Title
Vergaderbord-verplaatsingsupdates met duidelijke kolomnamen

## Context
De huidige automatische update bij het verplaatsen van een vergaderbord-kaart is al compacter gemaakt, maar de gewenste formulering voor deze follow-up is expliciet: `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.` Daarnaast moet in de kaartdetailweergave visueel duidelijk zijn dat `<oude kolom>` en `<nieuwe kolom>` kolomnamen zijn, met echte UI-emphasis (bold) in plaats van alleen quotes of badges.

Deze wijziging blijft bewust klein en gericht: alleen nieuw gegenereerde automatische move-updates, zonder migratie van bestaande updates en zonder wijziging aan handmatige updateberichten.

## Goals / Non-goals
### Goals
- Pas alleen nieuw gegenereerde automatische kaartverplaatsingsupdates aan.
- Gebruik exact deze basisboodschap voor nieuwe automatische move-updates: `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.`
- Render in de frontend kaartdetail-update-lijst `<oude kolom>` en `<nieuwe kolom>` in **bold** voor deze automatische move-updateboodschappen.
- Laat de bestaande metadataregel (datum/tijd en gebruiker) ongewijzigd in gedrag en presentatie.
- Werk relevante backend/frontend tests bij.
- Werk website/About changelog bij met een korte eindgebruikersnotitie conform repo DoD.

### Non-goals
- Geen migratie, backfill of herschrijving van bestaande opgeslagen updates.
- Geen wijzigingen aan handmatige updateberichten.
- Geen brede redesign van update-opslag, board-workflow, users, of audit trail.
- Geen badge/chip-styling als alternatief voor de gevraagde nadruk; bold kolomnamen is de gewenste weergave.

## Proposed approach
1. Update de backend message-builder voor automatische kaartverplaatsingen naar exact: `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.`
2. Introduceer in de frontend kaartdetail-updates een kleine, afgebakende renderlogica die alleen deze bekende automatische move-patroonboodschap detecteert en de twee kolomnaamsegmenten vet rendert.
3. Houd metadata-rendering (timestamp + gebruiker) volledig los van deze tekstnadruk en ongewijzigd.
4. Laat bestaande opgeslagen updates ongemoeid; alleen nieuw gegenereerde updates volgen het nieuwe patroon en krijgen gegarandeerde bold-rendering.
5. Update gerichte tests (backend + frontend) op tekstinhoud en bold-rendering.

## Implementation steps (ordered)
1. Lokaliseer de backend codepaden die automatische card move-updates aanmaken.
2. Pas de automatische move-teksttemplate aan naar exact: `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.`
3. Bevestig dat handmatige update-berichten buiten scope blijven en ongewijzigd zijn.
4. Lokaliseer de frontend kaartdetail update-lijst rendering voor updateberichten.
5. Implementeer een beperkte parser/render-helper voor het bekende automatische move-patroon die:
   - de oude en nieuwe kolomnaam uit het bericht haalt;
   - alleen voor patroonmatches bold-rendering toepast op die twee segmenten;
   - bij niet-match veilig terugvalt op plain tekstweergave.
6. Controleer dat metadataregel (datum/tijd + gebruiker) identiek blijft qua rendering en gegevensbron.
7. Werk backend tests bij voor nieuwe berichttekst.
8. Werk frontend tests bij voor bold kolomnamen in move-updates en ongewijzigde metadatazichtbaarheid.
9. Werk About/changelog bij met korte eindgebruikersnotitie conform repo DoD.
10. Leg verificatiestappen en resultaten vast onder `How to verify` en `Verification evidence`; zet status bij in `Current status`.

## Acceptance criteria
1. Nieuwe automatische move-updates worden opgeslagen/gegenereerd als exact: `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.`
2. In kaartdetail-updates worden `<oude kolom>` en `<nieuwe kolom>` vet weergegeven voor automatische move-updates die dit patroon volgen.
3. Metadata onder de update toont nog steeds datum/tijd en gebruiker zoals voorheen.
4. Bestaande opgeslagen updates worden niet gemigreerd of herschreven.
5. Relevante backend/frontend tests zijn bijgewerkt en slagen waar afhankelijkheden beschikbaar zijn.

## Testing plan
- Backend (gericht): tests voor automatische move-update berichtopbouw en exacte nieuwe tekst.
- Frontend (gericht): Vergaderborden kaartdetail-update tests die controleren dat oude/nieuwe kolomnaam bold gerenderd worden voor het nieuwe patroon.
- Frontend: build/typecheck uitvoeren indien frontend code wijzigt.
- Handmatige UI-check:
  1. Verplaats een kaart van kolom A naar kolom B.
  2. Verifieer berichttekst exact: `Kaart verplaatst van A naar B.`
  3. Verifieer dat `A` en `B` bold zichtbaar zijn in de update-tekst.
  4. Verifieer dat metadataregel (datum/tijd + gebruiker) ongewijzigd zichtbaar blijft.

## Risk + rollback plan
### Risico's
- Bold-rendering op basis van tekstpatroon kan fragiel worden als het berichtformat later zonder bijbehorende parser-update verandert.
- Oude opgeslagen updates in eerder format krijgen mogelijk geen bold-rendering, wat acceptabel is binnen de non-goals.

### Mitigatie
- Beperk parsing tot een klein, expliciet patroon met veilige fallback naar plain tekst.
- Dek patroonmatch en fallbackgedrag af met gerichte frontend tests.

### Rollback
- Herstel vorige backend berichttemplate en verwijder/disable specifieke bold-rendering voor move-patroon.
- Geen datamigratie nodig; rollback beïnvloedt alleen nieuw weergegeven of nieuw gegenereerde updates.

## Notes / links
- Inputbron: door gebruiker aangeleverde “Draft Change Spec Outline” (approved follow-up change).
- Gerelateerde bestaande speccontext: eerdere vergaderbord move-update tekstwijzigingen in `opsx/changes/`.

## Current status
Completed

## What changed
- Backend: automatische vergaderbord-verplaatsingsupdate gebruikt nu exact het berichtpatroon `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.` voor nieuw gegenereerde move-updates.
- Frontend: kaartdetail-updateweergave detecteert uitsluitend dit specifieke automatische patroon en rendert `<oude kolom>` en `<nieuwe kolom>` vet (`<strong>`).
- Frontend fallbackgedrag blijft veilig: niet-matchende berichten (incl. handmatige updates en oudere opgeslagen berichten) blijven plain tekst.
- Metadataregel onder updates (datum/tijd + auteur) is niet aangepast in codepad of presentatie.
- Tests bijgewerkt:
  - Backend assertions voor nieuwe exacte move-tekst.
  - Frontend assertions voor bold kolomnamen bij patroonmatch + ongewijzigde auteurmetadata.
- About/changelog bijgewerkt met eindgebruikersnotitie over nieuwe move-tekst en vet weergegeven kolomnamen.

## How to verify
1. Backend gericht:
   - `./backend/.venv/bin/pytest backend/tests/test_boards_api.py`
2. Frontend gericht:
   - `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` (run vanuit `frontend/`)
3. Frontend build/typecheck:
   - `npm run build` (run vanuit `frontend/`)
4. Handmatige UI-verificatie (optioneel):
   1. Verplaats een kaart van kolom A naar kolom B.
   2. Controleer berichttekst exact: `Kaart verplaatst van A naar B.`
   3. Controleer dat `A` en `B` vet zichtbaar zijn in de update-tekst.
   4. Controleer dat metadataregel (datum/tijd + gebruiker) ongewijzigd zichtbaar blijft.

## Verification evidence
- ✅ `./backend/.venv/bin/pytest backend/tests/test_boards_api.py`
  - Resultaat: 15 passed.
- ✅ `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` (in `frontend/`)
  - Resultaat: 1 file passed, 20 tests passed.
- ✅ `npm run build` (in `frontend/`)
  - Resultaat: geslaagde TypeScript/Vite productiebuild.
- ⚠️ `pytest backend/tests/test_boards_api.py` (zonder project-venv) faalt lokaal met `ModuleNotFoundError: No module named 'fastapi'`; opgelost door test in `backend/.venv` te draaien.

## Review notes
- Dedicated `opsx-review` subagent faalde met `ProviderModelNotFoundError`; daarom is een handmatige no-edit review uitgevoerd op de diff tegen deze spec.
- Review-uitkomst: geen blocking findings. De wijziging is beperkt tot nieuw gegenereerde move-updates en patroongebonden frontend-rendering; metadata, handmatige updates en bestaande opgeslagen updates blijven ongemoeid.

---
Status: completed
Owner: n.v.t.
Date: 2026-05-28
