# Title

Herstel vermoede schema-drift voor vergaderborden en borg de migratie-releaseketen

## Context

In de getroffen omgeving laden vergaderborden niet. Het discovery-resultaat wijst voorlopig op schema-drift: de runtime kan projectdata lezen via code die `projects.is_visible_in_boards` verwacht, terwijl die kolom mogelijk ontbreekt in de uitgerolde database. Dit kan een SQL-fout en vervolgens een 500 op de betrokken project-/boardroute veroorzaken.

De oorzaak is nog niet bewezen. De actieve releasebron, het uitgerolde image/commit, de toegepaste Alembic-revisie, de daadwerkelijke tabelmetadata en een met de storing gecorreleerde fout zijn nog niet als gesaniteerde runtime-evidence vastgelegd. Deze change beschrijft uitsluitend de toekomstige diagnose en, na afzonderlijke autorisatie, de kleinste veilige herstelroute.

## Goals / Non-goals

### Goals

- Met read-only evidence vaststellen of `projects.is_visible_in_boards` in de getroffen runtime ontbreekt en of dat de storing verklaart.
- De Alembic-graph en releasebron vóór een release reproduceerbaar valideren.
- De Docker-buildcontext en runtime-image voor deze releaseketen hardenen, zodat lokale data, `.env`, `.venv`, caches, tests en ontwikkelartefacten niet in het buildcontext of runtime-image terechtkomen.
- Een geïsoleerd, reproduceerbaar releaseartefact voor deze goedgekeurde schemaherstelchange vaststellen en de identity plus clean/dirty-state vastleggen.
- Alleen indien schema-drift is bewezen: via de bestaande geautoriseerde migratieprocedure naar de verwachte head migreren.
- Aantonen dat de getroffen vergaderbordroute na herstel geauthenticeerd zonder 500 werkt.
- De diagnose-, release-, verificatie- en rollbackstappen documenteren.

### Non-goals

- Geen productieconfiguratie, deploy, service-restart, productiedatabasewijziging of productiemigratie in deze lokale implementatie.
- Geen herontwerp van projectvisibility, vergaderborden, rechten of authenticatie.
- Geen handmatige DDL/DML, directe productiedatabasefix of wijziging van historische Alembic-revisies.
- Geen wijzigingen aan applicatiecode, deploymentconfiguratie of runtime-omgeving buiten de goedgekeurde Docker-/Compose-hardening voor release-isolatie.
- Geen conclusie over `/api/auth/me` of wijziging van auth/cookies/proxy zonder afzonderlijke reproduceerbare evidence.
- Geen secrets, tokens, cookies, connection strings of persoonsgegevens in log- of verificatiebewijs.

## Scope

In scope zijn de diagnose van de niet-ladende vergaderborden, de vermoedelijke kolom `projects.is_visible_in_boards`, de relevante Alembic-releaseketen, Docker buildcontext/runtime-image-isolatie, het geïsoleerde releaseartefact en de gecontroleerde herstel- en smokecheckprocedure.

Uit scope zijn functionele uitbreidingen van boards/projecten, auth-wijzigingen en alle uitvoerende productiehandelingen totdat die expliciet zijn goedgekeurd.

## Proposed approach

1. Koppel de storing aan één identificeerbare uitgerolde artifact/source identity en verzamel uitsluitend read-only, gesaniteerde runtime-evidence.
2. Vergelijk de runtime-revisie en `projects`-metadata met de Alembic-graph en de migratie die `is_visible_in_boards` introduceert.
3. Valideer in een geïsoleerde tijdelijke SQLite-database dat de gekozen releasebron één verwachte Alembic-head heeft en naar `head` kan upgraden met de vereiste kolom.
4. Valideer op de geselecteerde releasebron dat Docker buildcontext en runtime-image geen lokale data, `.env`, `.venv`, caches, tests of ontwikkelartefacten bevatten; leg gebruikte Dockerfile(s), ignore-regels, image identity en inspectieresultaat vast.
5. Maak of selecteer uitsluitend een geïsoleerd releaseartefact uit een schone, immutabele bron, en leg commit/ref, image digest (indien gebouwd), buildtijd en expliciete clean/dirty-state vast.
6. Alleen als de diagnose schema-drift bevestigt én een release is geautoriseerd: maak en verifieer backups, stop writers, voer de reguliere migratie uit en doe een geauthenticeerde board-smokecheck.
7. Als de evidence een andere oorzaak toont, stop het schemaherstel, leg de classificatie vast en open/actualiseer een passende vervolgchange.

## Implementation steps (ordered)

1. Verkrijg afzonderlijke autorisatie voor read-only runtime-diagnose; noteer UTC-tijd, omgeving, service/container en uitgerold commit of image digest.
2. Verzamel read-only `alembic current`, `alembic heads` en `PRAGMA table_info(projects)` vanuit de daadwerkelijk uitgerolde backend-/migratiecontext. Leg uitsluitend revisie-ID's en kolommetadata vast.
3. Correlleer minimaal één falende vergaderbord- of projectroute met timestamp, route, status, request-ID (indien beschikbaar) en gesaniteerde exception class/ontbrekende kolom. Redacteer request bodies en credentials volledig.
4. Vergelijk de waarnemingen met `backend/alembic/versions/20260810_0029_project_module_visibility.py` en de actuele repositorygraph. Bevestig of `is_visible_in_boards` hoort te bestaan op de runtime-head.
5. Voer vóór iedere release op de geselecteerde, immutabele releasebron een geïsoleerde SQLite-preflight uit: controleer één Alembic-head, upgrade naar `head`, en controleer dat `projects.is_visible_in_boards` bestaat en `NOT NULL` is. Breid dit alleen uit met `is_visible_in_work_hours` wanneer de gekozen migratie dit eveneens contractueel vereist.
6. Voeg deterministische regressietests en een minimale release-preflight toe. Pas geen historische migraties aan; documenteer de concrete bestanden en testuitkomsten in deze spec.
7. Valideer de Docker-hardeningsreview op de gekozen releasebron: controleer de buildcontext en inspecteer het runtime-image op afwezigheid van lokale data, `.env`, `.venv`, caches, tests en ontwikkelartefacten. Leg per categorie de controle en uitkomst vast zonder gevoelige inhoud te tonen.
8. Produceer of selecteer een geïsoleerd releaseartefact uitsluitend vanaf een immutabele commit/ref met een schone werkboom. Leg commit SHA/ref, eventuele image digest, buildtijd, gebruikte buildcontext en de expliciete dirty-state vast; markeer een artefact met niet-verklaarde wijzigingen als ongeschikt voor release.
9. Als de runtime-evidence schema-drift bewijst, vraag afzonderlijke release-autorisatie aan. Verifieer consistente database- en storagebackups, stop writers, voer de bestaande migratieprocedure uit en leg artifact/revision identity vast.
10. Doe na de geautoriseerde migratie een geauthenticeerde smokecheck van de route die de storing reproduceerde. Bevestig een 2xx-respons en afwezigheid van de eerdere SQL-/kolomfout.
11. Bij een mislukking: houd de release gestopt, herstel database én passend voorafgaand artifact uit de geverifieerde backup, en actualiseer deze spec met de uitkomst.

## Acceptance criteria

1. Read-only evidence koppelt de getroffen runtime aan een commit/image digest, Alembic `current`/`heads`, `projects`-kolommetadata en minstens één gecorreleerde board/project-routefout, zonder secrets of credentials.
2. De diagnose classificeert de storing expliciet als bevestigde schema-drift, uitgesloten schema-drift, of onvoldoende evidence; bij onvoldoende evidence vindt geen migratie plaats.
3. Vóór release toont een geïsoleerde tijdelijke SQLite-upgrade naar `head` exact één verwachte Alembic-head en de aanwezigheid van `projects.is_visible_in_boards` als `NOT NULL` kolom.
4. Als een release wordt geautoriseerd, zijn database- en storagebackups aantoonbaar gemaakt en geverifieerd vóór writers worden gestopt of migraties draaien.
5. Na een geautoriseerd schemaherstel retourneert de oorspronkelijk falende, geauthenticeerde vergaderbord/projectroute 2xx en treedt de vastgelegde ontbrekende-kolom-/SQL-fout niet meer op.
6. Rollback herstelt bij falen de database en het bijpassende artifact uit backup; historische Alembic-revisies worden niet gewijzigd of handmatig teruggedraaid.
7. Deze spec bevat voor elke uitgevoerde stap command, exitcode/resultaat, artifact identity en gesaniteerde evidence. Niet-uitgevoerde stappen zijn expliciet als pending gemarkeerd.
8. De Docker-buildcontext en het runtime-image van het releaseartefact bevatten aantoonbaar geen lokale data, `.env`, `.venv`, caches, tests of ontwikkelartefacten; de uitgevoerde inspectie is per categorie vastgelegd.
9. Het voor release geselecteerde artefact is herleidbaar tot één immutabele commit/ref en, indien van toepassing, image digest; buildtijd en clean/dirty-state zijn expliciet vastgelegd. Een dirty of niet-herleidbaar artefact wordt niet vrijgegeven.

## Testing plan

Alleen na implementatie- of release-autorisatie uitvoeren. Gebruik voor repositoryvalidatie een schone, immutabele releasebron en tijdelijke SQLite; productieinspectie blijft read-only tot de geautoriseerde migratiestap.

```bash
# Vanuit de backend-werkdirectory, tegen de geselecteerde releasebron
cd backend
.venv/bin/alembic heads
.venv/bin/alembic current

# Tijdelijke schema-validatie; pas de database-URL aan de bestaande configuratieconventie aan.
tmp=$(mktemp -d)
export DATABASE_URL="sqlite:///$tmp/schema-drift.db"
.venv/bin/alembic upgrade head
.venv/bin/python - <<'PY'
import os, sqlite3
db = sqlite3.connect(os.environ["DATABASE_URL"].removeprefix("sqlite:///"))
columns = {row[1]: row for row in db.execute("PRAGMA table_info(projects)")}
assert "is_visible_in_boards" in columns
assert columns["is_visible_in_boards"][3] == 1
print("board-visibility schema: ok")
PY
```

Na een eventuele implementatie worden de concrete gerichte pytest-commando's, volledige relevante suite, `git diff --check` en eventueel Docker/Compose-preflight hier toegevoegd. Na een geautoriseerde release wordt de route-smokecheck met een testaccount uitgevoerd; `Authorization`- en `Cookie`-waarden worden volledig geredigeerd.

Voor de review van de release-isolatie moeten de exacte, repository-conforme Docker build-/inspect-commando's worden vastgelegd, inclusief de inspectie op de uitgesloten categorieën. De build mag geen productie- of lokale applicatiedata gebruiken. Leg ook de uitvoer van de dirty-statecontrole en de commit/ref- en image-digestidentiteit vast.

## Risk + rollback plan

- **Onjuiste oorzaak:** voer geen migratie uit zonder correlatie tussen routefout, runtime-revision en kolommetadata.
- **Verkeerde releasebron/graph:** bind alle verificatie aan commit/image digest en valideer de graph in tijdelijke SQLite vóór release.
- **Mislukte productie-upgrade:** verifieer database- en storagebackups, stop writers tijdens het window en herstel bij falen database plus passend artifact; voer geen handmatige schemaingrepen uit.
- **Preflight raakt productie:** alle preflight-upgrades gebruiken uitsluitend een tijdelijk SQLite-bestand; runtime-inspectie is read-only.
- **Buildcontext lekt lokale of gevoelige bestanden:** bouw uitsluitend met de beoordeelde ignore-regels, inspecteer context en runtime-image vóór vrijgave, en blokkeer het artefact bij aanwezigheid van `.env`, data, `.venv`, caches, tests of ontwikkelartefacten.
- **Niet-reproduceerbaar of dirty artefact:** bind vrijgave aan een immutabele commit/ref en, indien relevant, image digest; een onverklaarde dirty-state of ontbrekende identity blokkeert release.
- **Gevoelige evidence:** redacteer tokens, cookies, headers, connection strings en secrets volledig.

## Notes / links

- Vermoedelijke visibility-migratie: `backend/alembic/versions/20260810_0029_project_module_visibility.py`.
- Mogelijk betrokken routes: `backend/app/api/boards.py` en projectgerelateerde API-routes.
- Gerelateerde voorganger: `opsx/changes/2026-08-10-admin-load-failure-diagnostics.md`; deze change sluit die spec niet af.
- Discovery-aanname: het niet laden van vergaderborden hangt vermoedelijk samen met schema-drift rond `projects.is_visible_in_boards`; dit is nog niet runtime-bewezen.
- Reviewbevindingen verwerkt: release-isolatie vereist nu expliciete uitsluiting van lokale data, `.env`, `.venv`, caches, tests en ontwikkelartefacten, plus traceerbare artefactidentity en dirty-state.

## Current status

Completed — lokale implementatie en review zijn afgerond. De schema-/release-preflight, regressietests, Docker buildcontext- en runtime-image-isolatie en de incidentele in-scope reparaties zijn lokaal groen geverifieerd. Dit bevestigt geen immutable releaseartefact, productieherstel of productie-runtime; artifact identity/digest, runtime-diagnose, release, productiemigratie en productievalidatie blijven pending operator-evidence en afzonderlijke autorisatie. Er is niet gedeployed.

## What changed

- Toegevoegd: de additieve migratie `20260810_0029_project_module_visibility.py`, die `projects.is_visible_in_boards` en het contractueel gekoppelde `is_visible_in_work_hours` als `NOT NULL` booleans met een veilige standaardwaarde toevoegt.
- Toegevoegd: de no-op release-head `20260811_0030`, zodat de geselecteerde repositorygraph één expliciete release-head heeft zonder historische revisies te wijzigen.
- Toegevoegd: `scripts/release_schema_preflight.py`, die uitsluitend een tijdelijke SQLite-database gebruikt, exact één verwachte Alembic-head eist, naar `head` upgradet en beide visibility-kolommen op aanwezigheid en `NOT NULL` controleert.
- Toegevoegd: regressietests voor upgrade/downgrade van bestaande project-, bord- en urenrelaties, upgrade naar de release-head en geauthenticeerde project-/boardroutes na upgrade.
- Geen auth-, CORS-, proxy-, deploy-, productieconfiguratie- of productieruntimewijziging uitgevoerd. De bestaande About/changelog- en iteratieverwachtingen zijn geïnspecteerd en niet gewijzigd, omdat deze technische herstelchange geen eindgebruikersfunctionaliteit toevoegt.
- De lokale review is akkoord bevonden; de releaseprovenance is gebaseerd op isolated verification vanaf base `761c5799830e8772f20c0e5b0a71dee36e845961`.
- Reviewscope uitgebreid en verwerkt: de releaseketen moet Docker-buildcontext en runtime-image isoleren van lokale data, `.env`, `.venv`, caches, tests en ontwikkelartefacten. Dit specwerk wijzigt geen code of configuratie.
- Artefactregistratie-eis toegevoegd: `761c5799830e8772f20c0e5b0a71dee36e845961` is uitsluitend de reeds gemelde base identity, geen vastgelegde finale releasecommit of image digest. De finale immutable commit/ref, eventuele image digest, buildtijd en clean/dirty-state zijn nog niet als evidence aangeleverd en blijven pending.
- Geïmplementeerd: root `.dockerignore` sluit secrets (`.env*`), lokale data/database/storage/config, virtualenvs, dependency- en testcaches, tests, ontwikkelmetadata en gegenereerde output uit vóór Docker de context ontvangt. De backend kopieert niet langer README/documentatie of een test-stage; backend, worker en frontend leveren uitsluitend hun expliciete `runtime` stage aan Compose.
- Geïmplementeerd: `scripts/build_isolated_release_artifact.py` eist een volledige immutable commit-SHA, exporteert die met `git archive` naar een tijdelijke buildcontext en bouwt daar de drie runtime-images. Iedere image wordt vóór successregistratie automatisch geïnspecteerd; bij build- of inspectiefalen worden alle al aangemaakte tags verwijderd. Daardoor kan geen dirty worktree, lokaal bestand of partieel/niet-geverifieerd resultaat deel uitmaken van een releaseartefact. `scripts/verify_docker_image_isolation.py` exporteert een image zonder hem te starten en blokkeert uitgesloten applicatiepaden, inclusief losse `.db`-bestanden; de regressietest dekt iedere uitgesloten categorie.
- Hersteld tijdens verificatie: de eerste contextinspectie vond bestaande lokale `backend/data/`-inhoud terug in de runtime-image. De ignore-regels sluiten daarom ook alle geneste data/storage/database/config directories uit; de herbouwde backend- en worker-images bevatten deze inhoud niet.
- Hersteld (in scope): README- en spec-commandoguidance voert Alembic-, backend-pytest- en backend-preflightopdrachten expliciet vanuit `backend/` uit; root-level aanroepen zijn geen ondersteund verificatiepad.
- Hersteld (in scope, review): Compose behandelt `.env` als optioneel voor clean-checkout build/config-preflight; deployment gebruikt nog steeds de expliciet geverifieerde serverconfig. De Docker-smoke-workflow maakt daarom geen `.env` meer aan en README CI-documentatie beschrijft de feitelijke workflowstappen.
- Hersteld (in scope): de releasebuilder ondersteunt nu rechtstreeks de gedocumenteerde uitvoering `cd backend && python scripts/build_isolated_release_artifact.py <full-sha>`; een regressietest voert veilig alleen de `--help`-seam via precies die werkdirectory en scriptvorm uit. Docker negeert gegenereerde `*.egg-info`-directories in iedere contextlocatie en de runtime-verifier weigert ze expliciet. Backend en worker installeren het pakket niet-editable en verwijderen de door `pip` gegenereerde projectmetadata onder `/app/backend`.

## How to verify

Lokaal, vanuit de geïsoleerde releasebron (base `761c5799830e8772f20c0e5b0a71dee36e845961`); iedere backend-opdracht start expliciet vanuit `backend/`:

```bash
cd backend
.venv/bin/alembic heads
.venv/bin/python scripts/release_schema_preflight.py
.venv/bin/pytest -q tests/test_project_visibility_migration.py tests/test_release_schema_preflight.py tests/test_boards_api.py
cd .. && git diff --check
```

De preflight gebruikt alleen een tijdelijke SQLite-database en wijzigt geen gedeelde of productieomgeving.

Aanvullend zijn de volledige backendtests, frontendtests/build en de geselecteerde Docker-validatie uitgevoerd volgens de repository-releasechecklist. Verwacht resultaat: alle checks slagen; runtime-operatorchecks worden niet lokaal gesimuleerd.

Vóór een release moet OPSX-test daarnaast op een schone, immutabele releasebron de artifact identity, `alembic current`/`heads`, `PRAGMA table_info(projects)` en een gesaniteerde foutcorrelatie vastleggen. Pas na bewezen drift en afzonderlijke release-autorisatie volgen backup-, writer-stop-, migratie- en geauthenticeerde runtime-smokecheckstappen uit dit document.

Voor de geïmplementeerde isolatie, uitsluitend lokaal en zonder services te starten:

```bash
docker build --no-cache --target runtime -f backend/Dockerfile -t wervelnieuws-backend-runtime:isolation .
docker build --no-cache --target runtime -f worker/Dockerfile -t wervelnieuws-worker-runtime:isolation .
docker build --no-cache --target runtime -f frontend/Dockerfile -t wervelnieuws-frontend-runtime:isolation .
cd backend && .venv/bin/python scripts/verify_docker_image_isolation.py \
  wervelnieuws-backend-runtime:isolation wervelnieuws-worker-runtime:isolation wervelnieuws-frontend-runtime:isolation
cd ..
env WERVEL_STORAGE_DIR=/tmp/opsx-storage WERVEL_CONFIG_DIR=/tmp/opsx-config \
  VITE_API_BASE_URL=http://localhost:8001/api docker compose config --images
```

Een release build gebruikt daarna uitsluitend `cd backend && python scripts/build_isolated_release_artifact.py <full-sha>` en registreert de uitvoer. De lokaal gebouwde `:isolation-r2` images zijn alleen verificatieartefacten uit deze dirty worktree en niet vrijgavegeschikt.

De builder valideert alle drie runtime-images zelf vóór hij een `artifact=`-record schrijft. Bij een mislukte build of isolatiecontrole verwijdert hij alle reeds aangemaakte tags; er is dan geen bruikbaar partieel artefact.

## Verification evidence

- 2026-08-12 — geïsoleerde releasebron vanaf base `761c5799830e8772f20c0e5b0a71dee36e845961`: backendtests — exit 0; `263 passed, 1 skipped`.
- 2026-08-12 — geïsoleerde releasebron vanaf base `761c5799830e8772f20c0e5b0a71dee36e845961`: frontendtests — exit 0; `158 passed`.
- 2026-08-12 — geïsoleerde releasebron vanaf base `761c5799830e8772f20c0e5b0a71dee36e845961`: frontend build — exit 0; build geslaagd.
- 2026-08-12 — geïsoleerde releasebron vanaf base `761c5799830e8772f20c0e5b0a71dee36e845961`: geselecteerde Docker-validatie — exit 0; `102` geselecteerde checks geslaagd.
- 2026-08-12 — lokaal vanuit `backend/`: `.venv/bin/python scripts/release_schema_preflight.py` — exit 0; tijdelijke SQLite-upgrade naar `20260811_0030` geslaagd en preflight meldde `Release schema preflight passed: 20260811_0030`.
- 2026-08-12 — lokale review — akkoord; geen blocking bevindingen.
- 2026-08-12 — implementatie-goedkeuring — akkoord, met opgenomen reviewbevindingen voor Docker buildcontext/runtime-image-isolatie en traceerbare releaseartefacten.
- Pending artifact-evidence: finale immutable commit/ref, eventuele image digest, buildtijd, gebruikte buildcontext, exacte dirty-statecontrole en de per uitgesloten categorie vastgelegde Docker-context/runtime-image-inspectie. Zonder deze evidence is geen releaseartefact vrijgegeven.
- 2026-08-12 — gericht vanuit `backend/`: `.venv/bin/pytest -q tests/test_docker_image_isolation.py tests/test_release_schema_preflight.py tests/test_project_visibility_migration.py tests/test_boards_api.py` — exit 0; `46 passed`. De nieuwe image-isolatietest dekt `.env`, `.venv`, tests, data/storage/database/config, caches, bytecode, node_modules en OPSX-/Git-metadata.
- 2026-08-12 — gericht vanuit `backend/`: `.venv/bin/python scripts/release_schema_preflight.py` — exit 0; tijdelijke SQLite-preflight meldde `Release schema preflight passed: 20260811_0030`.
- 2026-08-12 — Docker context/runtime: drie no-cache runtime-builds (backend, worker, frontend) — exit 0. De eerste backendinspectie faalde terecht op lokale `backend/data/`; na uitbreiding van `.dockerignore` naar geneste durable-state directories slaagden de herbouwde backend/worker-images en frontend-image.
- 2026-08-12 — Docker image content vanuit `backend/`: `.venv/bin/python scripts/verify_docker_image_isolation.py wervelnieuws-backend-runtime:isolation-r2 wervelnieuws-worker-runtime:isolation-r2 wervelnieuws-frontend-runtime:isolation-r2` — exit 0; per image geen uitgesloten applicatiepaden. Extra backend runtime-assertie op ontbrekende `pytest`, tests, `.venv`, `.env` en `backend/data` — exit 0.
- 2026-08-12 — Compose-preflight: met uitsluitend tijdelijke, niet-gevoelige placeholder-paden `env WERVEL_STORAGE_DIR=/tmp/opsx-storage WERVEL_CONFIG_DIR=/tmp/opsx-config VITE_API_BASE_URL=http://localhost:8001/api docker compose config --images` — exit 0; backend, worker, frontend en migrate renderen zonder service-start. `git diff --check` en `git diff --cached --check` — exit 0.
- 2026-08-12 — lokale verificatiebron is bewust dirty (bestaande externe wijzigingen plus deze niet-gecommitteerde patch); de checks bewijzen de implementatie maar geen releaseprovenance. Geen image digest/buildtijd van een immutable releasecommit is geregistreerd en geen artefact is vrijgegeven.
- 2026-08-12 — in-scope documentatiereparatie: Alembic-, backend-pytest- en backend-preflightcommandoguidance is gecontroleerd en gewijzigd naar uitvoering vanuit `backend/`; de gerichte validatie is geslaagd (zie volgende regels).
- 2026-08-12 — gericht vanuit `backend/`: `.venv/bin/alembic heads` — exit 0; `20260811_0030 (head)`.
- 2026-08-12 — gericht vanuit `backend/`: `.venv/bin/python scripts/release_schema_preflight.py` — exit 0; `Release schema preflight passed: 20260811_0030`.
- 2026-08-12 — gericht vanuit `backend/`: `.venv/bin/pytest -q tests/test_release_schema_preflight.py tests/test_project_visibility_migration.py` — exit 0; `6 passed` (5 bestaande deprecation warnings).
- 2026-08-12 — documentatiereparatie: `git diff --check` — exit 0.
- 2026-08-12 — bronartefact-isolatie: actieve-changepatch overgezet van de dirty hoofdwerkboom naar schone worktree `/tmp/opencode/release-isolation-artifact-20260812`, branch `opsx/release-isolation-artifact-20260812`, gebaseerd op `761c5799830e8772f20c0e5b0a71dee36e845961`. `git diff --check`, `git diff --cached --check` en een exacte elfpadenvergelijking — exit 0; geen niet-actieve wijzigingen in de worktree.
- 2026-08-12 — geïsoleerde bron: Python 3.12 syntaxcompile en isolatiepad-policyassertie — exit 0. De repository-`.venv` wordt niet naar de clean worktree gekopieerd; daarom zijn de pytest/Alembic-preflightcommando's daar niet uitvoerbaar.
- 2026-08-12 — geïsoleerde Docker-validatie: drie `--no-cache --target runtime` builds vanuit de worktree plus `python3 backend/scripts/verify_docker_image_isolation.py` — exit 0; backend-, worker- en frontend-runtime-images bevatten geen geblokkeerde applicatiepaden. Dit zijn reviewimages uit een oncommitted source artifact, geen vrijgaveartefacten.
- 2026-08-12 — grouped IN_SCOPE_REPAIR in uitsluitend `/tmp/opencode/release-isolation-artifact-20260812`: verifier blokkeert nu ook losse `.db`-bestanden; 15 gerichte unittests dekken volledige SHA-export, alle drie buildtargets, automatische verificatie vóór successrecord en cleanup bij build-/verificatiefalen, plus `.dockerignore`-categorieën, runtime-stagecontracten en optionele Compose-`.env`.
- 2026-08-12 — grouped IN_SCOPE_REPAIR in uitsluitend `/tmp/opencode/release-isolation-artifact-20260812`: de gedocumenteerde `cd backend && python scripts/build_isolated_release_artifact.py <full-sha>`-vorm is regressiegetest via de veilige `--help`-seam; `.dockerignore` sluit gegenereerde `*.egg-info`-directories uit en de runtime-verifier weigert ze. De eerste runtime-inspectie vond door de editable backendinstallatie gegenereerde projectmetadata; in dezelfde reparatie is deze vervangen door een niet-editable installatie.
- 2026-08-12 — gericht: `/tmp/opencode/release-isolation-venv/bin/python -m pytest -q backend/tests/test_docker_image_isolation.py` — exit 0; `16 passed` (één bestaande `crypt`-deprecationwarning). Dit omvat de exacte gedocumenteerde commandovorm via een tijdelijke `python`-seam, egg-info-verwerping en Dockerfile-contracten.
- 2026-08-12 — Docker-isolatie: `docker compose build backend frontend worker` gevolgd door `python3 backend/scripts/verify_docker_image_isolation.py release-isolation-artifact-20260812-backend:latest release-isolation-artifact-20260812-worker:latest release-isolation-artifact-20260812-frontend:latest` — exit 0; alle drie runtime-images schoon. De eerste inspectie blokkeerde terecht door de door `pip -e` aangemaakte egg-info; backend en worker zijn in dezelfde reparatieronde naar non-editable installatie plus cleanup gebracht.
- 2026-08-12 — Compose-/diff-preflight: `docker compose config --images`, `git diff --check` en `git diff --cached --check` — exit 0. `git clean -fd -- backend/wervelnieuws_backend.egg-info` verwijderde uitsluitend de ongetrackte gegenereerde testmetadata.
- 2026-08-12 — gericht: tijdelijke testomgeving buiten de worktree met `python -m pytest -q backend/tests/test_docker_image_isolation.py` — exit 0; `15 passed` (1 bestaande `crypt`-deprecationwarning).
- 2026-08-12 — clean-checkout Compose: `docker compose config --images` zonder repository-root `.env` — exit 0; backend, worker, frontend en migrate renderen.
- 2026-08-12 — Docker: `docker compose build backend frontend worker` — exit 0; daarna `python3 backend/scripts/verify_docker_image_isolation.py release-isolation-artifact-20260812-backend:latest release-isolation-artifact-20260812-worker:latest release-isolation-artifact-20260812-frontend:latest` — exit 0; alle drie runtime-images zijn schoon. `git diff --check` en `git diff --cached --check` — exit 0.
- Pending operator-evidence: runtime artifact identity, read-only runtime-`alembic current`/`heads`, runtime-`PRAGMA table_info(projects)`, gesaniteerde routefoutcorrelatie, deploy, restart, backup, writer-stop, productiemigratie en geauthenticeerde productiesmokecheck. Deze zijn niet lokaal uitgevoerd en blijven pending voor OPSX-test en de vereiste afzonderlijke autorisaties.

---
Status: Completed locally; immutable releaseartefactevidence, runtime operator-evidence en productie-release blijven pending. Geen deploy uitgevoerd.
Owner: —
Date: 2026-08-12
