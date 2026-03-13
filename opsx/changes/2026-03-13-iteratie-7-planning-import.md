# Iteratie 7 Planning import en regelbeheer

## Title
Iteratie 7 Planning import en regelbeheer

## Context
In de planning ontbreken momenteel praktische invoeracties voor redacteurs: er is nog geen CSV-import, geen formulier voor losse planningsregels, geen per-regel doelmedia-selectie en geen verwijderactie.

Deze iteratie voegt deze mogelijkheden toe binnen de bestaande topic-gebaseerde workflow, zodat elke planningsregel exact één bericht representeert.

## Goals / Non-goals
### Goals
- CSV-import toevoegen op Planning met vaste kolommen.
- Individuele planningsregels handmatig kunnen toevoegen.
- Elke planningsregel modelleren als één `Topic`.
- Doelmedia per planningsregel configureerbaar maken (`website`, `facebook`, `newsletter`).
- Verwijderen van planningsregels mogelijk maken.
- About-changelog bijwerken in eindgebruikers-taal.

### Non-goals
- Geen herontwerp van de publicatie-workflow buiten kanaalselectie.
- Geen nieuwe publicatiekanalen toevoegen.
- Geen grootschalige planning-UX herbouw buiten import/toevoegen/verwijderen en doelmedia-kolom.

## Proposed approach
1. Breid `Topic` uit met persistent doelmedia-veld (`target_channels_json`) met veilige defaults.
2. Voeg backend CSV-import endpoint toe met vaste kolommen en rij-validatie.
3. Voeg backend delete endpoint toe voor planningsregels (`Topic`).
4. Pas publicatieworkflow aan zodat alleen geselecteerde doelmedia actief gepubliceerd worden.
5. Breid frontend Planning uit met:
   - CSV-import
   - handmatig toevoegen
   - doelmedia-weergave
   - verwijderen
6. Voeg regressietests toe voor backend en frontend.
7. Werk About-changelog bij.

## Implementation steps (ordered)
1. Datamodel + migratie: `Topic.target_channels_json` met default alle drie de kanalen.
2. Schemas/API uitbreiden voor `target_channels`.
3. `POST /api/topics/import-csv` implementeren met vaste kolommen:
   - `onderwerp,thema,geplande_datum,opmerkingen,website,facebook,nieuwsbrief`
4. `DELETE /api/topics/{topic_id}` implementeren.
5. Publicatieworkflow aanpassen voor kanaalselectie per topic.
6. Frontend Planning uitbreiden met importformulier, handmatige invoer, doelmedia-kolom en verwijderactie.
7. Backend/Frontend tests uitbreiden voor import/add/delete/channel-selectie.
8. About API changelog-entry voor deze iteratie toevoegen.
9. Verificatie draaien en vastleggen.

## Acceptance criteria
- CSV met vaste kolommen kan geïmporteerd worden via Planning.
- Gebruiker kan individuele planningsregels toevoegen.
- Iedere planningsregel resulteert in precies één `Topic`.
- Doelmedia zijn per planningsregel aan/uit te zetten.
- Alleen geselecteerde doelmedia worden gepubliceerd; niet-geselecteerde kanalen worden overgeslagen.
- Gebruiker kan planningsregels verwijderen.
- Frontend toont doelmedia per regel leesbaar.
- About toont een begrijpelijke changelog-update voor deze iteratie.
- Planning toont datum/tijd in 24-uursnotatie `yyyy-mm-dd hh:mm`.
- Planning toont doelmedia als 3 losse kolommen met per-regel aan/uit bediening.
- ID-kolom wordt niet weergegeven in de planningtabel.
- Alle planningkolommen zijn sorteerbaar.
- Statusweergave is beperkt tot: Nieuw, Gepland, Gereed, Akkoord, Gepubliceerd.
- Statusuitleg (tekst na `:`) is zichtbaar als mouse-over hulptekst.
- Planning detail heeft dummy-secties voor `Review`, `Wijzigingen` en `Publicatiebesluit`.
- Bij `Regel toevoegen` is `Thema` een dropdown (geen vrij tekstveld).
- Bij `Regel toevoegen` is `Onderwerp` een vrij tekstveld en `Datum` een datum/tijdselector.
- Bij `Regel toevoegen` is `Opmerkingen` verwijderd.

## Testing plan
- Migratie:
  - `docker compose build migrate && docker compose run --rm migrate`
- Backend targeted:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_auth_and_topics.py tests/test_publishing_idempotency.py tests/test_planning_import_api.py -q"`
- Backend full:
  - `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`

## Risk + rollback plan
- Risico: ongeldige CSV-bestanden geven verwarrende importresultaten.
  - Mitigatie: duidelijke foutregels met regelnummers en validatiefouten.
- Risico: kanaalselectie veroorzaakt regressie in publicatieflow.
  - Mitigatie: gerichte workflowtests op geselecteerde/niet-geselecteerde kanalen.
- Rollback: endpoint en frontend-acties kunnen teruggedraaid worden; publicatieflow kan fallbacken op alle kanalen actief.

## Notes / links
- Bronwens: `ITERATIONS.md` (Iteratie #07 planning import-regels).
- Repo-richtlijnen: `AGENTS.md`.

## Current status
Completed

## What changed
- Datamodel en migratie toegevoegd voor doelmedia per planningsregel:
  - `backend/app/models/entities.py`:
    - `Topic.target_channels_json` toegevoegd met default `website/facebook/newsletter`.
    - property `target_channels` toegevoegd voor genormaliseerde lijstwaarden.
  - nieuwe migratie `backend/alembic/versions/20260313_0009_topic_target_channels.py`.
- Topic API en schema uitgebreid:
  - `backend/app/schemas/topic.py`:
    - `target_channels` toegevoegd aan `TopicCreate`, `TopicUpdate`, `TopicResponse`.
  - `backend/app/api/topics.py`:
    - `POST /api/topics/import-csv` toegevoegd met vaste kolommen:
      - `onderwerp,thema,geplande_datum,opmerkingen,website,facebook,nieuwsbrief`
    - CSV-validatie toegevoegd (UTF-8, kolomcontrole, datumparse, booleans, minimaal 1 medium).
    - `DELETE /api/topics/{topic_id}` toegevoegd.
    - create-flow geupdate om `target_channels` op te slaan.
- Publicatieworkflow kanaalselectief gemaakt:
  - `backend/app/workflows/publishing_workflow.py` publiceert alleen naar geselecteerde kanalen;
  - niet-geselecteerde kanalen worden als `skipped` gemarkeerd met reden.
- Frontend Planning uitgebreid:
  - `frontend/src/lib/api/client.ts`:
    - `Topic.target_channels` toegevoegd;
    - `createTopic` payload getypeerd;
    - `deleteTopic` en `importTopicsCsv` toegevoegd.
  - `frontend/src/app/App.tsx` (Planning):
    - CSV-import UI toegevoegd;
    - handmatig formulier voor planningsregel toegevoegd;
    - doelmedia-checkboxes toegevoegd;
    - kolom `Doelmedia` en actie `Verwijder` toegevoegd.
  - `frontend/src/styles.css`:
    - styles voor planning-acties/formulier/doelmedia toegevoegd.
- Changelog bijgewerkt:
  - `backend/app/api/meta.py` met nieuwe entry `07B` voor planning-import en doelmedia.
- Tests uitgebreid/gecorrigeerd:
  - `backend/tests/test_planning_import_api.py` toegevoegd (CSV-import + delete).
  - `backend/tests/test_auth_and_topics.py` uitgebreid met `target_channels` asserts.
  - `backend/tests/test_publishing_idempotency.py` uitgebreid met kanaalselectie-regressie.
  - `frontend/src/app/App.test.tsx` uitgebreid met planning add/import/delete tests en kolomchecks.
  - `backend/tests/test_database_api.py` robuuster gemaakt voor projectselectie in bulk move/copy test.
- Feedbackronde Planning UI doorgevoerd:
  - datum/tijdweergave in planningtabel nu 24-uurs `yyyy-mm-dd hh:mm` via bestaande formatter;
  - ID-kolom verwijderd;
  - doelmedia opgesplitst naar drie losse kolommen (`Website`, `Facebook`, `Nieuwsbrief`) met per-regel checkboxes;
  - statusweergave in overzicht is read-only met exact vijf opties:
    - `Nieuw`, `Gepland`, `Gereed`, `Akkoord`, `Gepubliceerd`;
  - statushulpteksten toegevoegd als mouse-over (`title`) op de statusweergave;
  - planningtabel breder gemaakt (`.planning-table`);
  - alle planningdatakolommen sorteerbaar gemaakt met sortknoppen in de kolomkoppen;
  - visuele sorteerrichting toegevoegd met kolomindicatoren (`↑`/`↓`) op de actieve sorteerkolom;
  - toegankelijkheid verbeterd met `aria-sort` op alle sorteerbare kolomkoppen;
  - frontend API-client uitgebreid met `updateTopic` voor per-regel media updates.
- Overzichts- en detailnavigatie aangepast op nieuwe feedback:
  - in planningoverzicht zijn `Illustratie` en `Opmerkingen` kolommen verwijderd;
  - actie `Verwijder` verwijderd uit planningoverzicht;
  - actie `Open` toegevoegd per regel;
  - nieuwe dummy detailroute toegevoegd: `/planning/:topicId`;
  - nieuwe dummy detailpagina toegevoegd met:
    - regelgegevens,
    - placeholders voor beoordelen/wijzigen,
    - bronpassages,
    - knop terug naar planning.
- Frontend tests bijgewerkt voor:
  - read-only status in overzicht,
  - `Open`-navigatie naar detail,
  - dummy detailweergave en bronpassages.
- Extra feedbackronde formulier/detail doorgevoerd:
  - bij `Regel toevoegen`:
    - `Onderwerp` blijft vrij tekstveld,
    - `Thema` is nu dropdown met vaste opties,
    - `Datum` blijft datum/tijdselector,
    - `Opmerkingen` veld verwijderd;
  - dummy detailpagina opnieuw gestructureerd met expliciete secties:
    - `Review (dummy)`
    - `Wijzigingen (dummy)`
    - `Publicatiebesluit (dummy)`
  - layout geoptimaliseerd voor deze secties (detailgrid in 3 kolommen op desktop).
- Frontend tests bijgewerkt voor nieuwe formulierverwachtingen en nieuwe detailsecties.
- Thema-categorieen beter afgestemd op redactionele praktijk:
  - `Thema` dropdown in planningformulier bouwt opties nu dynamisch op uit bestaande topic-thema's;
  - veilige fallback-opties blijven aanwezig als er nog weinig data is;
  - opties worden NL-lokaal alfabetisch gesorteerd voor consistent gebruik.
- Planning detail voortgangspad toegevoegd (dummy):
  - op `Planningsregel detail (dummy)` staat nu een stappenlijst met voortgang;
  - huidige positie in planning wordt expliciet getoond als `Huidige stap`;
  - afgeronde stappen zijn visueel groen gemarkeerd;
  - niet-afgeronde stappen tonen expliciet `moet nog gebeuren`.
- Feedbackronde planningvoortgang verfijnd:
  - planningvoortgang-venster compacter gemaakt (kleinere padding/spacing, compactere stapregels);
  - stap `Gepland` toont nu expliciet de geplande AI-generatiedatum;
  - stap `Gepubliceerd` toont expliciet de geplande publicatiedatum;
  - extra stap `Publicatie gepland` toegevoegd tussen `Akkoord` en `Gepubliceerd` zodat publicatiepad duidelijker is.
- Full HD desktop optimalisatie doorgevoerd:
  - `frontend/src/styles.css` gebruikt nu ruimere desktop-contentbreedte;
  - standaard `page-content` verbreed naar `1320px`;
  - extra desktop breakpoint (`min-width: 1600px`) met `page-content` tot `1740px`;
  - grotere paneel-gaps/padding voor betere leesbaarheid op 1920x1080;
  - topbar horizontale padding responsief gemaakt met `clamp(...)`;
  - database upload-controls verbreed op grote desktopresoluties.
- Frontend tests bijgewerkt voor nieuwe planningweergave en per-regel updates.

## How to verify
- Draai migraties:
  - `docker compose build migrate && docker compose run --rm migrate`
- Draai gerichte backend tests voor deze iteratie:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_auth_and_topics.py tests/test_planning_import_api.py tests/test_publishing_idempotency.py -q"`
- Draai volledige backend tests:
  - `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- Draai frontend tests:
  - `cd frontend && npm test -- --run`
- Draai frontend build:
  - `cd frontend && npm run build`

## Verification evidence
- `docker compose build migrate && docker compose run --rm migrate`
  - Resultaat: migratie succesvol uitgevoerd naar `20260313_0009`.
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_auth_and_topics.py tests/test_planning_import_api.py tests/test_publishing_idempotency.py -q"`
  - Resultaat: `7 passed`.
- `docker compose build backend && docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
  - Resultaat: `50 passed`.
- `cd frontend && npm test -- --run`
  - Resultaat: `24 passed`.
- `cd frontend && npm run build`
  - Resultaat: build geslaagd.
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na feedbackronde Planning UI).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na feedbackronde Planning UI).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na sorteerindicatoren + aria-sort).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na sorteerindicatoren + aria-sort).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na Full HD desktop optimalisatie).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na Full HD desktop optimalisatie).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na overzicht/detail dummy feedbackronde).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na overzicht/detail dummy feedbackronde).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na thema dropdown + detailsecties feedbackronde).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na thema dropdown + detailsecties feedbackronde).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na dynamische thema-categorieen update).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na dynamische thema-categorieen update).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na planningvoortgang-stappenlijst update).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na planningvoortgang-stappenlijst update).
- `cd frontend && npm test -- --run`
  - Resultaat: `25 passed` (na compacte planningvoortgang + datumlabels update).
- `cd frontend && npm run build`
  - Resultaat: build geslaagd (na compacte planningvoortgang + datumlabels update).
