# Title
Improve Vergaderborden card creation and team member selection UI

## Context
Op de Vergaderborden-pagina staat momenteel per kolom standaard een volledig kaart-aanmaakformulier in beeld. Dit maakt het bord visueel druk en minder scanbaar. Daarnaast gebruikt de teamlid-selectie een native multi-select die minder gebruiksvriendelijk is in dagelijks beheer.

De gewenste wijziging is een frontend-only verbetering waarbij gebruikers per kolom eerst bewust op “+ Kaart toevoegen” / “Kaart toevoegen” klikken om het formulier te openen, en waarbij teamleden via een gebruiksvriendelijke dropdown multi-select gekozen worden met behoud van bestaand API-contract.

## Goals / Non-goals
### Goals
- Elke Vergaderborden-kolom toont een duidelijke actieknop om een kaart toe te voegen.
- Het kaart-aanmaakformulier is standaard verborgen en wordt contextueel per kolom geopend.
- Er kan maximaal één kaart-aanmaakformulier tegelijk openstaan.
- Teamleden worden gekozen via een gebruiksvriendelijke multi-select dropdown op basis van bestaande ledenlijst/API-data.
- Bestaande create payload blijft `assignment_user_ids: string[]`.
- Bestaande titel-validatie (“Titel is verplicht.”) blijft actief en voorkomt API-calls bij lege titel.
- Relevante tests worden aangepast/uitgebreid en blijven slagen.
- About/changelog wordt bijgewerkt volgens repository Definition of Done.

### Non-goals
- Geen backend-, database- of API-contractwijzigingen.
- Geen wijzigingen in rollen/rechten.
- Geen functionaliteit voor teamleden achteraf bewerken op bestaande kaarten.
- Geen wijzigingen aan projectbeheer/gebruikersbeheer.
- Geen wijzigingen aan drag-and-drop gedrag.
- Geen nieuwe dependency tenzij technisch strikt noodzakelijk.
- De nieuwe teamleden-dropdown wordt niet toegepast op het “Nieuw project”-formulier.

## Proposed approach
1. Pas in `frontend/src/app/features/admin/VergaderbordenPage.tsx` de kolom-UI aan zodat standaard alleen een “Kaart toevoegen”-actie zichtbaar is.
2. Introduceer state voor “actieve kolom met open formulier”, zodat openen/sluiten contextueel werkt en maximaal één formulier tegelijk open is.
3. Vervang de native multi-select in het kaartformulier door een gebruiksvriendelijke custom dropdown-multi-select zonder nieuwe dependency (tenzij tijdens implementatie aantoonbaar noodzakelijk).
4. Hergebruik bestaande ledenlijstdata (zoals nu in de interface/API aanwezig) voor dropdownopties.
5. Behoud submit- en validatielogica, inclusief verplichte titel en payload-veld `assignment_user_ids` als string-array.
6. Sluit formulier na succesvolle kaartcreatie en reset relevante tijdelijke form-state.
7. Werk styling bij in `frontend/src/styles.css` voor knop, formulier-visibility, dropdown en responsive gedrag (desktop/mobiel).
8. Update tests in `frontend/src/app/App.test.tsx` (en indien nodig aanvullende testbestanden) voor nieuw interactiepatroon en payload-validatie.
9. Werk changelog/About bij (verwacht in `backend/app/api/meta.py`) met eindgebruikersgerichte notitie.

## Implementation steps (ordered)
1. Inventariseer huidige Vergaderborden kaart-aanmaakflow en teamleden-selectie in `VergaderbordenPage.tsx`.
2. Voeg per kolom een zichtbare “+ Kaart toevoegen”/“Kaart toevoegen”-actie toe en verberg het formulier standaard.
3. Implementeer open/close-mechanisme met één actieve formuliercontext tegelijk.
4. Bouw dropdown multi-select UI voor teamleden in dezelfde componentscope, gevoed door bestaande ledenlijst.
5. Koppel geselecteerde teamleden aan bestaand submitmodel en borg `assignment_user_ids: string[]`.
6. Behoud/valideer titelverplichting en voorkom submit/API-call bij lege titel.
7. Zorg dat formulier na succesvolle submit sluit en state correct reset (incl. projectwissel-relevante state).
8. Werk CSS bij voor leesbaarheid en bruikbaarheid op smalle en brede schermen.
9. Pas geautomatiseerde tests aan/uitbreid voor knop-gestuurde formulieropening, validatie, multi-selectgedrag en payload.
10. Update About/changelog entry conform DoD.

## Acceptance criteria
1. Elke Vergaderborden-kolom toont een knop om een nieuw kaartje toe te voegen.
2. Het kaart-aanmaakformulier is standaard niet zichtbaar.
3. Klikken op de knop opent het formulier alleen voor de betreffende kolom.
4. Kaart aanmaken blijft werken met titel, beschrijving en geselecteerde teamleden.
5. Teamleden kunnen via een dropdown als multi-select worden gekozen.
6. De dropdown gebruikt de bestaande ledenlijst uit de interface/API.
7. Bij lege titel verschijnt nog steeds “Titel is verplicht.” en wordt geen API-call gedaan.
8. De create-card API-call ontvangt nog steeds `assignment_user_ids` als array.
9. Bestaande Vergaderborden-tests blijven slagen.
10. Nieuwe/gewijzigde UI blijft bruikbaar op desktop en mobiel.

## Testing plan
- Frontend geautomatiseerd:
  - `npm test`
  - `npm run build`
- Gerichte testdekking (unit/integration in bestaande frontend teststack):
  - Per kolom zichtbare “Kaart toevoegen”-knop.
  - Formulier standaard verborgen.
  - Formulier opent alleen in aangeklikte kolom (en slechts één tegelijk open).
  - Titelvalidatie blokkeert submit/API-call bij lege titel.
  - Teamleden-dropdown verwerkt multi-select correct.
  - API-call bevat `assignment_user_ids` als `string[]`.
- Handmatige UI-checks:
  - Desktop: scanbaarheid, dropdown interactie, submit flow.
  - Mobiel: layout, tappable controls, dropdown bruikbaarheid, geen overlap/cutoff.

## Risk + rollback plan
### Risico’s
- Custom dropdown kan focus/keyboard/accessibility regressies introduceren.
- State-overgangen (projectwissel, submit succes) kunnen formulier- of selectiestate onbedoeld laten hangen.
- Smalle kolommen/mobiele schermen kunnen layoutproblemen geven.

### Mitigatie
- Houd de wijziging strikt component-lokaal en frontend-only.
- Voeg gerichte tests toe rond open/close-state, validatie en payload.
- Voer expliciete handmatige checks uit op desktop en mobiel.
- Behoud bestaande create-flow als functionele baseline tijdens refactor.

### Rollback
- Frontend-only rollback: herstel vorige gedrag met altijd zichtbaar formulier en native multi-select.
- Revert van betrokken frontend/CSS commits zonder backend-impact.

## Notes / links
- Bron van waarheid: door gebruiker aangeleverde discovery-outline in deze sessie.
- Scopebestanden (verwacht):
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/styles.css`
  - `frontend/src/app/App.test.tsx`
  - `backend/app/api/meta.py` (About/changelog update)
- Slug: `improve-vergaderborden-card-ui`

## Current status
Partial (implementation completed, volledige verificatie nog deels open)

## What changed
- `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - Per kolom is het kaart-aanmaakformulier nu standaard verborgen achter een `+ Kaart toevoegen`-knop.
  - Er is state toegevoegd voor exact één actieve open formuliercontext (`activeCreateColumn`), inclusief reset bij projectwissel.
  - Het kaartformulier sluit nu na succesvolle submit en reset relevante tijdelijke state.
  - De titelvalidatie `Titel is verplicht.` blijft actief en voorkomt submit/API-call zonder titel.
  - Teamleden-selectie is vervangen door een custom dropdown multi-select (zonder nieuwe dependency), gevoed door bestaande `admin-users` data.
  - Create payload blijft ongewijzigd qua contract: `assignment_user_ids` blijft `string[]`.
- `frontend/src/styles.css`
  - Nieuwe stijlen toegevoegd voor de kolom-knop, custom multi-select dropdown, optieregels en formulier-acties.
  - Formulierlayout en controls zijn bijgewerkt voor leesbaarheid en bruikbaarheid op verschillende viewportgroottes.
- `frontend/src/app/App.test.tsx`
  - Bestaande Vergaderborden-test voor titelvalidatie aangepast aan nieuw knop-gestuurd patroon.
  - Nieuwe test toegevoegd voor: één formulier tegelijk open, teamleden-selectie via dropdown, payload-assertie op `assignment_user_ids: string[]`, en sluiten na succesvolle submit.
- `backend/app/api/meta.py`
  - About/changelog geüpdatet met iteratie 32 (eindgebruikersgerichte release-notitie over rustiger kaart-aanmaak en verbeterde teamselectie).

## How to verify
1. Frontend gericht:
   - `cd frontend && npm test -- src/app/App.test.tsx --run`
2. Frontend build:
   - `cd frontend && npm run build`
3. Volledige frontend regressie (nog uit te voeren via opsx-test):
   - `cd frontend && npm test`
4. Handmatige UI-checks (nog uit te voeren):
   - Desktop en mobiel op Vergaderborden:
     - Per kolom zichtbaar: `+ Kaart toevoegen`
     - Formulier standaard verborgen
     - Maximaal één formulier tegelijk open
     - Submit sluit formulier
     - Dropdown multi-select bruikbaar zonder overlap/cutoff

## Verification evidence
- ✅ `cd frontend && npm test -- src/app/App.test.tsx --run`
  - Resultaat: geslaagd (`44 passed, 0 failed`).
  - Inclusief nieuwe regressiedekking voor knop-gestuurde opening, single-open-form gedrag, multi-select teamleden en payload `assignment_user_ids`.
- ✅ `cd frontend && npm run build`
  - Resultaat: geslaagd (`tsc -b && vite build`, production bundle gegenereerd).
- ⏳ Nog open voor volledige afronding via opsx-test:
  - `cd frontend && npm test` (volledige suite)
  - Handmatige desktop/mobiele UI-checks op Vergaderborden

---
Status: partial
Owner: n.t.b.
Date: 2026-05-26
