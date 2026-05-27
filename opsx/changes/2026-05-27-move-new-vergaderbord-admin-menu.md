# Title
Move new vergaderbord action to admin menu

## Context
De actie **“Nieuw vergaderbord aanmaken”** staat momenteel in een dropdown. Voor beheerders op `/wervelnieuws/admin` is dit minder zichtbaar dan gewenst. De gewenste wijziging is om deze actie als duidelijk hoofditem in het echte admin menu te tonen, terwijl de bestaande aanmaakflow functioneel gelijk blijft.

## Goals / Non-goals
### Goals
- Toon **“Nieuw vergaderbord aanmaken”** als hoofditem in het admin menu op `/wervelnieuws/admin`.
- Verwijder dezelfde actie uit de huidige oude dropdown-locatie.
- Behoud de bestaande link/actie naar exact dezelfde aanmaakflow.
- Verifieer de wijziging met relevante frontend checks (tests en/of typecheck/build).

### Non-goals
- Geen backend- of API-wijzigingen.
- Geen functionele wijziging aan de vergaderbord-aanmaakflow zelf.
- Geen volledig herontwerp van het admin menu.

## Proposed approach
1. Lokaliseer de frontend admin-navigatiecomponent(en) die het menu op `/wervelnieuws/admin` renderen.
2. Verplaats of dupliceer tijdelijk de bestaande “Nieuw vergaderbord aanmaken”-actie naar een expliciet hoofdmenu-item op de juiste plek in het admin menu.
3. Verwijder de oude dropdown-optie zodra het nieuwe hoofditem actief is.
4. Zorg dat de actie dezelfde route/handler blijft gebruiken zodat gedrag ongewijzigd blijft.
5. Voer gerichte frontend verificatie uit (bestaande tests waar mogelijk; anders minimaal frontend build/typecheck).
6. Voeg een kleine, gebruikersgerichte About/changelog-entry toe conform repository Definition of Done.

## Implementation steps (ordered)
1. Inventariseer welke component(en) het admin menu en de dropdown-optie voor “Nieuw vergaderbord aanmaken” beheren.
2. Implementeer een hoofdmenu-item in het admin menu met label “Nieuw vergaderbord aanmaken”.
3. Koppel het hoofdmenu-item aan dezelfde bestaande aanmaakroute of click-handler als de huidige dropdown-optie.
4. Verwijder de oude dropdown-optie en eventuele dode/ongebruikte verwijzingen.
5. Werk of voeg frontend tests bij voor zichtbaarheid/plaatsing van menu-item en afwezigheid van de oude dropdown-optie.
6. Voer frontend verificatiecommando’s uit (gerichte tests en minimaal build/typecheck).
7. Update About/changelog met een korte functionele notitie voor eindgebruikers.
8. Leg resultaten vast in deze spec onder **What changed**, **How to verify** en **Verification evidence** en update status.

## Acceptance criteria
1. Op `/wervelnieuws/admin` is **“Nieuw vergaderbord aanmaken”** zichtbaar als hoofditem in het admin menu.
2. Klikken op dit hoofditem start dezelfde bestaande aanmaakfunctionaliteit als voorheen (zelfde route/flow).
3. De actie is niet langer aanwezig in de oude dropdown.
4. Relevante frontend verificatie slaagt (gerichte tests indien aanwezig, plus frontend typecheck/build), of blockers zijn expliciet gedocumenteerd met foutmelding en impact.
5. Een gebruikersgerichte About/changelog-entry voor deze wijziging is toegevoegd.

## Testing plan
- Lokaliseer bestaande frontend tests rond admin navigatie/menu en vergaderborden-aanmaakactie.
- Voer eerst gerichte tests uit voor betrokken component(en) (indien aanwezig).
- Voer daarna minimaal frontend typecheck/build uit om regressies in changed area te detecteren.
- Handmatige UI-check op `/wervelnieuws/admin`:
  - hoofditem zichtbaar;
  - klik opent dezelfde aanmaakflow;
  - dropdown-optie ontbreekt.

Voorkeurscommando’s (afhankelijk van aanwezige scripts/tests):
- `npm --prefix frontend run test -- <relevant-test-path>`
- `npm --prefix frontend run build`

## Risk + rollback plan
### Risico's
- Menu-layout of responsive gedrag kan verschuiven door extra hoofdmenu-item.
- Verkeerde plaatsing in navigatie kan discoverability juist verslechteren.
- Route-koppeling kan per ongeluk afwijken van bestaande aanmaakflow.

### Mitigatie
- Plaats het item in dezelfde admin-navigatiestructuur als vergelijkbare primaire acties.
- Verifieer expliciet dat route/handler gelijk blijft aan de oude actie.
- Doe een korte handmatige check op gangbare viewport-groottes.

### Rollback
- Revert de navigatiecomponent(en) naar de vorige versie waarin de actie in de dropdown staat.
- Herstel eventuele verwijderde dropdown-configuratie in dezelfde commit-revert.

## Notes / links
- Inputbron: user-approved Draft Change Spec Outline “Move new vergaderbord action to admin menu”.
- Doelpad: `/wervelnieuws/admin`.
- Scope beperkt tot frontend menu/navigatie en gerelateerde verificatie + changelogvermelding.

## Current status
Completed

## What changed
- In `frontend/src/app/shell/AppShell.tsx` is in de adminsectie van `/wervelnieuws/admin` een primair menu-item toegevoegd met label **“Nieuw vergaderbord aanmaken”**, gekoppeld aan `WERVEL_PATHS.adminVergaderborden`.
- In dezelfde file is de oude adminactie **“Nieuw project (admin)”** verwijderd uit de Vergaderborden-projectdropdown in de topnavigatie.
- De bestaande aanmaakflow is behouden: het nieuwe admin-menu-item navigeert naar dezelfde bestaande route die `VergaderbordenPage` met `canManageProjects` rendert.
- In `frontend/src/app/App.test.tsx` is een regressietest toegevoegd die controleert dat:
  - de oude dropdownoptie ontbreekt;
  - het nieuwe admin-menu-item zichtbaar is op de Admin-pagina;
  - klikken dezelfde bestaande create-flow opent (zichtbare knop “Nieuw project”).
- In `frontend/src/styles.css` is styling toegevoegd voor het nieuwe primaire admin-menu-item (`.admin-primary-actions`).
- In `backend/app/api/meta.py` is een gebruikersgerichte About/changelog-entry toegevoegd (iteratie 41).

## How to verify
1. Open `/wervelnieuws/admin` en controleer dat **“Nieuw vergaderbord aanmaken”** als hoofditem zichtbaar is.
2. Klik op dit hoofditem en controleer dat de bestaande vergaderbord-aanmaakflow opent (pagina met actie **“Nieuw project”**).
3. Open de Vergaderborden-projectdropdown in de topnavigatie en controleer dat **“Nieuw project (admin)”** daar niet meer staat.
4. Run gerichte test:
   - `npm --prefix frontend run test -- src/app/App.test.tsx`
5. Run volledige frontend testset:
   - `npm --prefix frontend test`
6. Run frontend build:
   - `npm --prefix frontend run build`
7. Run backend testset via de aanwezige virtualenv:
   - `.venv/bin/pytest`

## Verification evidence
- `npm --prefix frontend run test -- src/app/App.test.tsx` → **PASS** (47/47)
- `npm --prefix frontend test` → **PASS** (60/60)
- `npm --prefix frontend run build` → **PASS**
- `.venv/bin/pytest` → **PASS** (99/99)
- Omgevingsnotitie: `pip`, `python3 -m pip` en `.venv/bin/python -m pip` waren niet beschikbaar voor dependency-installatie, maar de bestaande `.venv/bin/pytest` kon de backend tests succesvol uitvoeren; er blijft daarom geen verificatieblocker open voor deze wijziging.

## Follow-ups
- Optioneel: zorg dat de backend virtualenv in deze ontwikkelomgeving ook `pip` bevat, zodat toekomstige dependency-installatiecommando's reproduceerbaar zijn.

---
Status: completed
Owner: n.v.t.
Date: 2026-05-27
