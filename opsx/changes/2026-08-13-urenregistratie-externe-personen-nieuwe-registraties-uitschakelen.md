# Title
Urenregistratie: nieuwe registraties voor externe personen uitschakelen

## Context
Externe deelnemers worden in urenregistratie geïdentificeerd met `participant_kind=external_person`. Nieuwe urenregistraties mogen niet meer met zo'n deelnemer worden aangemaakt. De huidige gebruikersinterface mag externe personen daarom niet als selecteerbare deelnemers aanbieden voor een nieuwe registratie, maar de server moet deze regel ook afdwingen tegen rechtstreekse of gemanipuleerde API-aanroepen.

Bestaande registraties met externe deelnemers zijn historische gegevens. Zij moeten leesbaar en bewerkbaar blijven wanneer de deelnemerlijst niet verandert. Beheer van externe personen en bestaande historie blijven buiten de functionele wijziging.

## Goals / Non-goals

### Goals
- Verwijder externe personen uit alle deelnemerskiezers voor het aanmaken van een nieuwe urenregistratie, op desktop en mobiel.
- Laat de create-API een aanvraag met één of meer deelnemers met `participant_kind=external_person` afwijzen met HTTP 422.
- Laat de patch/update-API HTTP 422 retourneren wanneer een wijziging een externe deelnemer toevoegt of een huidige deelnemer door een externe deelnemer vervangt.
- Sta het bewerken van een bestaande registratie met externe deelnemer(s) toe zolang de deelnemersset inhoudelijk ongewijzigd blijft.
- Behoud externe-personenbeheer, historische leesbaarheid, audit-/versiegedrag en bestaande registraties ongewijzigd.

### Non-goals
- Geen verwijdering, deactivering, migratie of wijziging van externe personen in masterdata.
- Geen wijziging aan bestaande urenregistraties, hun deelnemers, historie, audittrail of exports.
- Geen verbod op andere edits aan een bestaande registratie met externe deelnemer(s), zoals datum, duur, project, post of toelichting, zolang de deelnemers ongewijzigd blijven.
- Geen wijziging van interne deelnemerselectie, rollen/rechten, API-routes, payloadveldvormen of het deelnemersdatamodel, behalve de beschreven validatie-uitkomst.
- Geen algemene herinrichting van de urenregistratiepagina, Admin-tabs of externe-personenbeheer.

## Proposed approach
1. Centraliseer of hergebruik de bestaande classificatie van deelnemeridentiteiten, waarbij uitsluitend `participant_kind=external_person` als extern geldt; baseer geen verbod op weergavetekst of naam.
2. Filter externe personen alleen uit create-oppervlakken in de frontend. Historische/editweergaven blijven de huidige gekoppelde deelnemers tonen, zodat bestaande gegevens niet verdwijnen.
3. Valideer server-side bij create dat geen geselecteerde deelnemer extern is en geef daarvoor een consistente Nederlandse HTTP-422-validatiefout terug.
4. Vergelijk bij patch de gevraagde deelnemersset met de opgeslagen set. Wijs alleen een toevoeging of vervanging door een externe persoon af; accepteer een patch waarvan de deelnemersset equivalent en ongewijzigd is, ook als die set al externe personen bevat.
5. Dek UI, create- en patchcontracten met gerichte regressietests af; voer daarna de relevante backend- en frontendsuites uit.

## Implementation steps (ordered)
1. **Inventarisatie en contractgrens**
   - Breng create- en patchroutes, schemas/services, participantidentity-representatie, frontend create- en editoppervlakken en bestaande uren-API-tests in kaart.
   - Leg vast hoe deelnemerssets canoniek worden vergeleken (identiteit en duplicaatbehandeling) zodat uitsluitend een werkelijke deelnemerswijziging als wijziging geldt.
2. **Create-UI beperken**
   - Verwijder/filter externe personen uit elke deelnemerskiezer voor een nieuwe urenregistratie, inclusief desktop- en mobiele weergave.
   - Behoud selectie en zichtbaarheid van toegestane interne deelnemers en wijzig geen externe-personenbeheer in Admin.
3. **Server-side create-validatie**
   - Voeg in de canonieke create-validatie een expliciete afwijzing toe voor elke payload die een bestaande externe persoon als deelnemer opgeeft.
   - Retourneer HTTP 422 met een stabiele, Nederlandse foutmelding die uitlegt dat externe personen niet aan nieuwe urenregistraties kunnen worden toegevoegd.
4. **Server-side patch-validatie met historiecompatibiliteit**
   - Lees de bestaande deelnemersset vóór verwerking van een patch.
   - Wijs een patch met HTTP 422 af als deze een externe deelnemer toevoegt of een bestaande deelnemer door een externe deelnemer vervangt.
   - Sta een patch met een inhoudelijk ongewijzigde bestaande set externe deelnemers toe en behoud de huidige edit-, audit- en versieafhandeling.
5. **Regressies en verificatie**
   - Voeg backendtests toe voor create-afwijzing, patch-afwijzing bij toevoegen/vervangen en succesvolle patch met ongewijzigde historische externe deelnemer(s).
   - Voeg frontendtests toe die op beide create-oppervlakken de afwezigheid van externe opties en de behouden interne selectie bevestigen.
   - Voer de opdrachten uit het Testing plan uit en registreer feitelijke resultaten onder Verification evidence. Werk geen applicatiecode of documentatie bij binnen deze spec-authoring change.

## Acceptance criteria
1. In elke desktop- en mobiele deelnemerskiezer voor een **nieuwe** urenregistratie is geen participant met `participant_kind=external_person` zichtbaar of selecteerbaar; beschikbare interne personen blijven selecteerbaar.
2. Een create-request met minimaal één geldige externe participantidentity wordt afgewezen met HTTP 422 en een Nederlandse, gebruikersbegrijpelijke validatiefout; er wordt geen urenregistratie, deelnemerkoppeling of auditrecord voor de afgewezen create opgeslagen.
3. Een patch-request die aan een bestaande registratie een externe deelnemer toevoegt, wordt afgewezen met HTTP 422 zonder wijziging van de opgeslagen registratie, deelnemers, historie of audittrail.
4. Een patch-request die een huidige deelnemer vervangt door een externe deelnemer wordt afgewezen met HTTP 422 zonder gedeeltelijke persistente wijziging.
5. Een bestaande registratie met één of meer externe deelnemers blijft leesbaar en kan succesvol worden gewijzigd wanneer de patch dezelfde deelnemersset behoudt; de overige toegestane velden volgen daarbij de bestaande validatie- en auditsemantiek.
6. Externe personen blijven zichtbaar en beheerbaar via de bestaande Admin-flow; deze change verwijdert of wijzigt geen externe masterdata of historische deelnemersweergave.
7. Gerichte backend- en frontendtests, de volledige geraakte backend/frontendtests, de frontendproductiebouw en `git diff --check` slagen.

## Testing plan

### Automated tests
```bash
# Backend: create/patch-validatie, onveranderde historische deelnemers en API-contract
cd backend
uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q

# Frontend: create-deelnemerskiezer op desktop/mobiel en gekoppelde About-fixture
cd ../frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige geraakte regressiesets en productiebuild
cd ../backend
uv run --extra dev pytest -q
cd ../frontend
npm test -- --run
npm run build

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```

### Manual checks
- Open beide create-oppervlakken (desktop en mobiel) en bevestig dat alleen interne personen als deelnemer kunnen worden geselecteerd.
- Verstuur met een API-client een create-payload en patch-payloads die een externe participant toevoegen of vervangen; bevestig HTTP 422 en ongewijzigde data na opnieuw ophalen.
- Open een bestaande registratie met externe deelnemer(s), wijzig uitsluitend een toegestaan niet-deelnemerveld en sla op; bevestig dat de registratie en externe deelnemers leesbaar blijven.
- Controleer als Admin dat de bestaande externe-personenbeheerflow en historische urenweergaven nog beschikbaar zijn.

## Risk + rollback plan

### Risks and mitigations
- **Onjuiste classificatie blokkeert interne personen:** gebruik uitsluitend de gecanoniseerde `participant_kind`-waarde en dek interne/externe voorbeelden met tests af.
- **Patch blokkeert historische edits te breed:** vergelijk de volledige canonieke deelnemersset met de opgeslagen set en test expliciet een ongewijzigde externe set.
- **Partial update vóór validatiefout:** valideer vóór persistente mutaties en test dat registratie, koppelingen en audittrail ongewijzigd blijven na 422.
- **Frontendfilter wordt omzeild:** server-side validatie is leidend en dekt gemanipuleerde clients en directe API-aanroepen af.
- **Onbedoelde impact op beheer/historie:** beperk UI-wijzigingen tot nieuwe registraties en voeg regressies toe voor Admin en bestaande registratie-editing.

### Rollback
1. Er is geen datamigratie; revert de betrokken frontend-, backend- en testwijzigingen als één change.
2. Een rollback herstelt de eerdere mogelijkheid om externe personen aan nieuwe registraties toe te voegen zonder bestaande uren- of masterdata te wijzigen.
3. Herhaal na rollback minimaal de gerichte backend- en frontendtests, `npm run build` en `git diff --check`.

## Notes / links
- Gerelateerde specs:
  - `opsx/changes/2026-07-30-urenverantwoordingsmodule.md`
  - `opsx/changes/2026-08-12-urenregistratie-vervolg-ux-en-externe-personenbeheer.md`
  - `opsx/changes/2026-08-13-urenregistratie-layout-en-paginering.md`
- Waarschijnlijke implementatiepunten:
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `backend/app/api/work_hours.py`
  - `backend/app/services/work_hours_service.py`
  - `backend/app/schemas/work_hours.py`
  - `backend/tests/test_work_hours_api.py`

### Assumptions
- “Nieuwe registratie” omvat iedere create-aanvraag voor urenregistratie, ongeacht of die vanuit desktop, mobiel of rechtstreeks via de API wordt gedaan.
- “Deelnemer ongewijzigd” betekent dat de canonieke set participantidentiteiten gelijk blijft; een alleen in volgorde afwijkende representatie geldt niet als toevoeging of vervanging.
- De bestaande patchroute ontvangt voldoende deelnemerinformatie om een opgegeven set met de opgeslagen set te vergelijken. Als een patch geen deelnemersveld bevat, blijft de bestaande deelnemersset per definitie ongewijzigd.
- HTTP 422 volgt het bestaande FastAPI/API-foutcontract voor semantische invoervalidatie.

## Current status
Completed.

## What changed
- De create-API weigert externe deelnemers vóór database- of auditwrites met HTTP 422 en een stabiele Nederlandse melding.
- De patch-API weigert het toevoegen of vervangen door een externe deelnemer vóór mutaties; een inhoudelijk ongewijzigde bestaande externe deelnemersset blijft toegestaan.
- De desktop- en mobiele create-kiezers tonen uitsluitend WindWilly-personen. De editweergave behoudt bestaande externe deelnemers, maar biedt geen toevoeging van externe personen.
- Backend- en frontendregressies zijn bijgewerkt; historische fixtures worden rechtstreeks als bestaande historie aangelegd waar dat nodig is voor filters, totalen en merge-tests.
- Rescue-repair: de `type_person`-sorteertest legt de externe deelnemer nu als historische fixture aan nadat de create-API een toegestane interne deelnemer heeft verwerkt. Daarmee test de bestaande verwachting opnieuw werkelijk extern-versus-intern sorteren, zonder het nieuwe createverbod te omzeilen via de API.
- Rescue-repair: een afzonderlijke patchregressie bewijst dat het toevoegen van een externe deelnemer naast een bestaande deelnemer HTTP 422 geeft en registratie plus audittrail bytegelijk/ongewijzigd laat.
- Final-review rescue-repair: patchdeelnemers worden nu eerst naar hun canonieke identity (`participant_kind` plus identity-id) gekoppeld. Daardoor zijn participant-row-id en payloadvolgorde niet bepalend, blijven equivalente historische externe sets toegestaan en worden bestaande participantrows hergebruikt.
- Final-review rescue-repair: regressies dekken een equivalente set zonder row IDs in omgekeerde volgorde, een externe-only historische registratie met alleen een niet-deelnemeredit en afwijzing van een vervangende externe identity zonder registratie- of auditmutatie.
- Final-review rescue-repair: uitsluitend de lokale frontend create-state, toggle en serialisatie zijn vernauwd tot `live_user`; brede API-, read- en edittypen blijven historische externe en historische identities ondersteunen.
- De gebruikersdocumentatie en About/changelog bevatten de nieuwe beperking; externe-personenbeheer in Admin is ongewijzigd.

## How to verify
- `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q`
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`
- `cd backend && uv run --extra dev pytest -q`
- `cd frontend && npm test -- --run && npm run build`
- `git diff --check`
- Doorloop aanvullend de handmatige checks voor een gemanipuleerde create/patch en een bestaande registratie met externe deelnemer.

## Verification evidence
- PRE-REPAIR FAIL — `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q`: 116 passed, 1 failed; `test_work_hours_sort_contract_accepts_person_and_type_and_rejects_extras` verwachtte een volgorde die niet bij de gewijzigde fixture met twee gelijke interne typen hoorde.
- PASS — gerichte rescue-regressies (`type_person`, externe toevoeging naast bestaande deelnemer, ongewijzigde historische externe deelnemersset): 3 passed, 36 warnings.
- PASS — `cd backend && uv run --extra dev pytest tests/test_work_hours_api.py tests/test_admin_api.py -q`: 118 passed, 587 warnings.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`: 127 passed.
- PASS — `cd backend && uv run --extra dev pytest -q`: 270 passed, 1 skipped, 1016 warnings.
- PASS — `cd frontend && npm test -- --run`: 191 passed.
- PASS — `cd frontend && npm run build`: geslaagd; bestaande Vite-waarschuwing voor een bundle groter dan 500 kB.
- PASS — `git diff --check`: geen uitvoer.
- De waarschuwingen zijn de bestaande pytest-asyncio-, passlib/`crypt`-, JWT/`utcnow`- en Vite chunk-sizewaarschuwingen; er ontstond geen nieuwe test- of buildfout.
- FINAL-REVIEW PRE-REPAIR — bestaande gerichte suites waren groen (backend 118 passed; frontend 127 passed), maar code-inspectie bevestigde dat patchvalidatie nog participant-row-id-gebonden was en lokale create-state/serialisatie nog externe/historische varianten toeliet.
- FINAL-REVIEW RESCUE ROUND 1 — de eerste nieuwe gerichte backendrun gaf 1 failed en 4 passed: een oudere vervangingstest construeerde na canonieke matching een dubbele bestaande external identity in plaats van een nieuwe/vervangende identity. De fixture is gecorrigeerd naar een werkelijk nieuwe externe identity; er was geen productcode-fout in deze ronde.
- PASS — gerichte final-review backendregressies (`no IDs`, reorder, external-only niet-deelnemeredit, toevoeging/vervanging zonder writes/audit): 5 passed, 84 deselected, 53 warnings.
- PASS — gerichte frontendtest plus typecheck/productiebouw: 37 passed; `tsc -b` en Vite-build geslaagd met alleen de bestaande chunk-sizewaarschuwing.
- PASS — geraakte backendset: 121 passed, 613 warnings.
- PASS — geraakte frontendset: 127 passed.
- PASS — volledige backendset: 273 passed, 1 skipped, 1042 warnings. Een eerste uitvoering bereikte de timeout na 300 seconden bij 78%; de ongewijzigde opdracht is met ruimere timeout opnieuw uitgevoerd en volledig geslaagd.
- PASS — volledige frontendset: 191 passed.
- PASS — finale frontendproductiebouw: geslaagd; bestaande Vite-waarschuwing voor een bundle groter dan 500 kB.
- PASS — finale `git diff --check`: geen uitvoer.
- Final-review diffcontrole: alleen de reeds in-scope changebestanden zijn gewijzigd; geen commit uitgevoerd.

---
Status: completed
Owner: —
Date: 2026-08-13
