# Website changelog verplicht per iteratie

## Context
De gebruiker vraagt om een vaste werkwijze: bij elke iteratie moet de website-changelog functioneel worden bijgewerkt en begrijpelijk blijven voor eindgebruikers.

In de huidige repo staat wel dat er een changelog is in About, maar er is nog geen expliciete projectregel die deze update als verplichte iteratie-afsluiting borgt.

## Goals / Non-goals
### Goals
- Leg als expliciete projectregel vast dat elke iteratie de website-changelog bijwerkt.
- Leg vast dat changelogteksten in eindgebruikers-taal worden geschreven.
- Leg vast welke minimale inhoud een changelog-item moet bevatten (wat is veranderd en wat heb je eraan).
- Vul de standaard About-changeloginhoud aan met iteraties 03, 04 en 05 in functionele eindgebruikers-taal.

### Non-goals
- Geen herontwerp van de About-pagina of changelog-API.
- Geen automatische changelog-generatie.
- Geen retroactieve herschrijving buiten iteraties 03, 04 en 05.

## Proposed approach
1. Voeg in `AGENTS.md` een expliciete engineering-/procesregel toe voor iteratie-afsluiting.
2. Voeg in `docs/` een korte richtlijn toe met schrijfstijl en minimale inhoud voor eindgebruikers.
3. Werk de standaard changelogdata in de About API bij met eindgebruikersgerichte items voor iteraties 03-05.
4. Houd de wijziging klein en beperkt tot inhoud (geen schema- of endpointwijzigingen).

## Implementation steps (ordered)
1. Actieve change spec aanmaken en acceptance criteria vastleggen.
2. Projectregel toevoegen aan `AGENTS.md`.
3. Richtlijnbestand toevoegen in `docs/`.
4. Standaard changelog in backend About-endpoint aanvullen met iteraties 03-05.
5. Gerichte tests uitvoeren voor About payload.
6. Deze spec bijwerken met status, wijzigingen en verificatie-evidence.

## Acceptance criteria
- `AGENTS.md` bevat een expliciete regel dat elke iteratie de website-changelog functioneel bijwerkt.
- De regel benoemt dat changelogtekst begrijpelijk moet zijn voor een niet-technische eindgebruiker.
- Er is een projectdocument in `docs/` met een kort, praktisch format voor changelog-items.
- De standaard About payload bevat functionele changelog-items voor iteraties 03, 04 en 05.
- De scope blijft beperkt tot documentatie plus changelog-inhoud (geen API-contractwijziging).

## Testing plan
- Inhoudsverificatie met gerichte file checks:
  - `read AGENTS.md`
  - `read docs/changelog-guidelines.md`
- Backend gericht:
  - `cd backend && pytest tests/test_meta_and_me.py -k about`

## Risk + rollback plan
- Risico: regel blijft te vaag en wordt inconsistent toegepast.
  - Mitigatie: concreet format met verplichte velden in docs opnemen.
- Rollback: verwijder de toegevoegde regel en richtlijnbestand als de werkwijze moet veranderen.

## Notes / links
- User request (chat): voeg vaste instructie toe om changelog op website per iteratie functioneel en eindgebruikersvriendelijk bij te werken.
- Repo regels: `/home/mevius/wervelnieuws/AGENTS.md`.

## Current status
Completed

## What changed
- `AGENTS.md` aangevuld in `Definition of done` met een expliciete iteratieregel:
  - bij elke afgeronde iteratie moet de website-changelog op de About-pagina functioneel worden bijgewerkt in eindgebruikers-taal.
- Nieuw document toegevoegd: `docs/changelog-guidelines.md`.
  - Bevat verplichte punten per iteratie.
  - Bevat een praktisch item-format (iteratie, datum, titel, highlights).
  - Bevat schrijfstijlrichtlijnen met goed/slecht voorbeeld voor niet-technische lezers.
- Standaard About-changelog uitgebreid in `backend/app/api/meta.py` met functionele items voor:
  - iteratie 03 (persoonlijke instellingen),
  - iteratie 04 (profielfoto uploaden en rond bijsnijden),
  - iteratie 05 (admin-menu en rollenbeheer).

## How to verify
- Controleer de DoD-regel in `AGENTS.md`:
  - `read /home/mevius/wervelnieuws/AGENTS.md` (sectie `Definition of done`).
- Controleer de richtlijn in `docs/changelog-guidelines.md`:
  - `read /home/mevius/wervelnieuws/docs/changelog-guidelines.md`.
- Controleer de standaard About-changelog inhoud:
  - `read /home/mevius/wervelnieuws/backend/app/api/meta.py`.
- Draai gerichte backendtest:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] >/tmp/pip-install.log && pytest tests/test_meta_and_me.py -k about"`.

## Verification evidence
- `read /home/mevius/wervelnieuws/AGENTS.md` toont de nieuwe verplichting:
  - "for each completed iteration, the website changelog (About page) is updated with a functional, end-user-friendly entry".
- `read /home/mevius/wervelnieuws/docs/changelog-guidelines.md` toont:
  - verplichte update per iteratie,
  - eindgebruikersgerichte taal,
  - praktisch format en schrijfstijlregels.
- `read /home/mevius/wervelnieuws/backend/app/api/meta.py` toont nieuwe default changelog-items voor iteraties 03, 04 en 05.
- Gerichte backendtest uitgevoerd:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] >/tmp/pip-install.log && pytest tests/test_meta_and_me.py -k about"`
  - Resultaat: `1 passed, 10 deselected`.
- Controle bestaande override-setting:
  - `docker compose run --rm backend python -c "from sqlalchemy import create_engine,text; e=create_engine('sqlite:////data/app.db'); c=e.connect(); rows=c.execute(text(\"select key from system_settings where key='about_page_content'\")).fetchall(); print(rows)"`
  - Resultaat: `[]` (geen override; default changelog uit code is actief).
