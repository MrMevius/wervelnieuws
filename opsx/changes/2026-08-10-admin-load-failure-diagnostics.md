# Title

Repository-only herstel: veilige Compose runtime-targets, Alembic merge en reproduceerbare backenddiagnostiek

## Context

De diagnose identificeerde twee Alembic-heads (`20260630_0024` voor audio en `20260810_0029` voor projectvisibility) en niet-reproduceerbare testclaims die `pytest` achteraf in een runtimecontainer installeerden. De review-hersteluitbreiding is goedgekeurd.

De P0-risicofix is dat de canonical `backend`- en `migrate`-services in `docker-compose.yml` niet impliciet de laatste Dockerfile-stage mogen kiezen. Beide moeten expliciet `build.target: runtime` gebruiken, of de Dockerfile moet een aantoonbaar gelijkwaardige veilige default-stage hebben. Het test-target blijft expliciet en mag nooit de productie-default worden. `migrate` moet het production dependencycontract gebruiken en `alembic upgrade head` uitvoeren.

Deze change is uitsluitend repositorywerk. Omdat de primaire worktree dirty is, wordt al het vervolgwerk uitgevoerd in een **nieuwe, geïsoleerde Git-worktree** op een tijdelijke, uitsluitend lokale branch vanaf de bij aanvang vastgelegde huidige commit. De worktree staat buiten de primaire werkboom, onder een absoluut pad in `/tmp/opencode/` (of, indien `/tmp/opencode` niet bruikbaar is, een veilig repo-nevenpad dat eveneens buiten de primaire werkboom ligt). De primaire worktree mag nooit worden gewijzigd. Geen target-, productie-, deploy-, database-, backup-, restart-, migratie- of smokeactie buiten geïsoleerde lokale wegwerpresources is toegestaan.

## Goals / Non-goals

### Goals

- Lever één additieve no-op Alembic merge-revisie `20260811_0030` (of alleen een aantoonbaar noodzakelijke unieke naamvariant) met audio en visibility als parents.
- Los P0 op: canonical Compose `backend` en `migrate` bouwen expliciet de runtime target, met behoud van een expliciete test target.
- Verifieer gewone Dockerfile-builds en canonical Compose-structuur zonder secrets te tonen of services te starten.
- Bewijs dat runtime en migrate het production dependencycontract gebruiken, dat runtime geen `pytest` bevat, dat backend `CMD` Uvicorn is, en dat migrate `alembic upgrade head` gebruikt.
- Voer gerichte én bredere backendtests uitsluitend vanuit een vers gebouwd test-artifact uit.
- Isoleer de patch van externe audio-, visibility- en Admin-hunks en herverifieer na de landingvolgorde.
- Leg de worktree-locatie, tijdelijke branch, basiscommit, bronidentiteit, schoonheidschecks en cleanupbeslissing reproduceerbaar vast.

### Non-goals

- Geen wijziging aan bestaande audio- of visibility-migraties, productfunctionaliteit, schema-operaties of data.
- Geen installatie van `.[dev]` of `pytest` in runtime/migrate, geen testtarget als default release-stage en geen runtimecontainer-mutatie voor tests.
- Geen Compose up, deploy, target/prod-actie of migratie tegen een gedeelde database.
- Geen wijziging, staging, reset, clean, stash of andere ingreep in de primaire worktree; ook deze spec wordt daarin niet meer gewijzigd tijdens implementatie/verificatie.
- Geen commit, push, merge of worktree-cleanup. Cleanup gebeurt pas nadat resultaat is vastgelegd én de gebruiker daar expliciet toestemming voor geeft.
- Geen product- of About-changelogwijziging voor deze technische repository-only change; zie **Documentation impact**.

## Proposed approach

1. Voeg een graph-only merge toe met `down_revision = ("20260630_0024", "20260810_0029")`, `branch_labels = None`, `depends_on = None` en expliciete no-op `upgrade()`/`downgrade()`.
2. Maak de Dockerfile-stagecontracten expliciet: `runtime` bevat alleen production dependencies en behoudt `CMD` voor Uvicorn; `test` installeert de dev-extra en wordt uitsluitend via `--target test` gebruikt.
3. Zet bij de canonical Compose `backend` én `migrate` `build.target: runtime`. Dit is de gekozen P0-oplossing; een veilige default-stage is alleen toegestaan als een spec-update vooraf dezelfde controles expliciet behoudt. `migrate.command` blijft `alembic upgrade head`.
4. Leg eerst in de primaire worktree uitsluitend als read-only bronidentiteit de huidige `HEAD` vast. Maak vervolgens buiten die werkboom een tijdelijke lokale branch op exact die commit en voeg daar een nieuwe worktree aan toe. Inspecteer de nieuwe worktree vóór elke wijziging op een lege status, lege staged status en een schone diff-check; stop bij afwijking.
5. Gebruik alleen een nieuw gebouwde test-image voor Alembic- en pytest-controles; gebruik voor runtime/migrate een nieuw runtime-artifact en een geïsoleerde SQLite-database binnen de nieuwe worktree.
6. Behandel de audio- en visibility-parentmigraties als landingsafhankelijkheden: hun exact genoemde revisions moeten aanwezig en onveranderd zijn vóór de merge `20260811_0030` wordt gemaakt of gemerged.

## Dependency and landing order

1. Land/verkrijg eerst de audio-parentmigratie `20260630_0024_audio_topic_transcription.py` en de visibility-parentketen inclusief `20260810_0029_project_module_visibility.py` in de gekozen basis; controleer revision IDs, parents en hashes.
2. Bevestig in die basis met `alembic heads` precies de twee verwachte heads. Stop bij een andere graph.
3. Land daarna deze geïsoleerde change: Dockerfile/Compose P0-fix, testregressies en merge `20260811_0030`.
4. Herbouw en herverifieer vanaf de samengevoegde, geautoriseerde source identity. Eerdere resultaten van een dirty worktree of een basis vóór beide parents zijn ongeldig als releasebewijs.

## File ownership and change isolation

| Pad | Toegestane wijziging |
| --- | --- |
| `opsx/changes/2026-08-10-admin-load-failure-diagnostics.md` | Deze spec, actuele status en evidence. |
| `backend/alembic/versions/20260811_0030*_merge_audio_and_visibility_heads.py` | Nieuwe no-op merge, uitsluitend de twee genoemde parents. |
| `backend/Dockerfile` | Expliciete runtime/test stages en runtime Uvicorn-CMD behoud. |
| `docker-compose.yml` | Alleen expliciete `build.target: runtime` voor canonical backend en migrate (en uitsluitend noodzakelijke structurele ondersteuning). |
| `backend/tests/test_alembic_merge_revision.py` | Geïsoleerde merge-/migratieregressies. |
| Bestaande developer/release-documentatie | Alleen canonical build/test/preflightdocumentatie. |

Audio-, visibility-, Admin-UI-, frontend- en niet-genoemde testhunks zijn externe ownership. Leg vóór en na het werk in de **geïsoleerde worktree** `git status --short`, `git diff --name-status`, staged equivalenten en `git diff --check` vast. Stop wanneer een niet-owned pad in de patch, buildcontext of staging terechtkomt zonder voorafgaande spec-update. De primaire worktree is uitsluitend de read-only bron voor de initiële commitvastlegging en wordt daarna niet benaderd of gewijzigd.

## Implementation steps (ordered)

1. Lees in de primaire worktree uitsluitend `git rev-parse HEAD` en `git status --short --untracked-files=all`; leg de commit als basiscommit en de volledige primaire source identity als diagnostische bron vast. Wijzig, stage, stash, reset of clean de primaire worktree niet.
2. Kies een absoluut, niet-bestaand worktreepad, bij voorkeur `/tmp/opencode/wervelnieuws-admin-load-failure-<basiscommit-kort>`, en een tijdelijke lokale branch `opsx/tmp-admin-load-failure-<basiscommit-kort>`. Maak met `git worktree add -b <branch> <absoluut-pad> <basiscommit>` de worktree op exact de basiscommit. Leg pad, branch, basiscommit en `git worktree list --porcelain` vast.
3. Werk uitsluitend vanuit het nieuwe absolute pad. Verifieer vóór wijzigingen dat `git rev-parse HEAD` gelijk is aan de basiscommit, `git status --short --untracked-files=all` en `git diff --cached --name-only` leeg zijn, en beide `git diff --check`-controles slagen. Stop bij enige vervuiling of afwijkende commit.
4. Controleer de precondition in een vers test-artifact: precies heads `20260630_0024` en `20260810_0029`, met de verwachte ancestry. Stop bij afwijking.
5. Voeg `20260811_0030` toe als uitsluitend metadata/no-op merge. Wijzig geen historische revision.
6. Pas `backend/Dockerfile` aan: expliciete `runtime` en `test`; runtime behoudt Uvicorn als `CMD`, installeert geen dev-extra en test installeert `.[dev]`.
7. Pas canonical `docker-compose.yml` aan zodat zowel `backend.build.target` als `migrate.build.target` exact `runtime` is; behoud `migrate.command: ["alembic", "upgrade", "head"]`.
8. Voeg regressietests toe voor de merge-startpunten (audio-head, visibility-head, beide heads, pre-branchpoint) op afzonderlijke tijdelijke SQLite-databases.
9. Bouw zonder cache de gewone Dockerfile default build, expliciete runtime build en expliciete test build. Inspecteer veilig dat de default/runtime `CMD` Uvicorn is; controleer runtime op afwezigheid van pytest en test op aanwezigheid ervan.
10. Voer een safe, secret-free Compose-inspectie uit; inspecteer alleen niet-gevoelige structurele velden voor backend/migrate, start geen service en sla geen gerenderde secrets op.
11. Voer in een wegwerp-SQLite-database vanuit het runtime/migrate-contract `alembic upgrade head` uit; bevestig één merge-head en production-only dependencies. Voer gerichte én bredere backendtests uit vanuit het verse test-artifact.
12. Herhaal stappen 9–11 na integratie van beide parents en deze change in de uiteindelijke schone source identity. Controleer isolatie opnieuw; corrigeer de spec met uitsluitend actuele evidence.
13. Leg eindstatus, path/branch/basiscommit/source identity, hashes, artifact IDs en het besluit **worktree behouden** vast. Documenteer de canonical route en de expliciete About-changelogbeslissing; zet status pas op voltooid wanneer alle AC's met actuele evidence zijn afgedekt. Verwijder worktree of tijdelijke branch uitsluitend na vastgelegd resultaat én expliciete toestemming van de gebruiker.

## Acceptance criteria

1. Exact één nieuwe merge-revisie `20260811_0030` heeft uitsluitend `20260630_0024` en `20260810_0029` als tuple-parents, bevat geen DDL/DML en wijzigt geen bestaande migratie.
2. Na landing van beide parents rapporteert de test-image exact één Alembic-head, de merge-revisie; alle vier geïsoleerde SQLite-startpunten upgraden foutloos naar die head.
3. `backend/Dockerfile` heeft een expliciete `runtime` target met Uvicorn als effectieve `CMD`; een gewone `docker build -f backend/Dockerfile .` resulteert eveneens in de veilige runtime/Uvicorn-artifact, niet in test.
4. `docker-compose.yml` stelt voor canonical `backend` én `migrate` expliciet `build.target: runtime` in; `migrate.command` is `alembic upgrade head`.
5. Een vers runtime-artifact bevat geen importeerbare/uitvoerbare `pytest`; een vers `--target test` artifact rapporteert `pytest --version`. Runtime/migrate gebruiken alleen het production dependencycontract.
6. In een wegwerp-SQLite-database slaagt `alembic upgrade head` vanuit het runtime/migrate-contract en eindigt de database op `20260811_0030`; geen gedeelde database wordt gebruikt.
7. Safe Compose-inspectie toont zonder geopenbaarde environmentwaarden, secrets of `.env`-inhoud de runtime targets en migrate-opdracht; er wordt geen Compose-service gestart.
8. Gerichte tests voor Admin/visibility/merge én de afgesproken bredere backend-suite slagen vanuit het verse test-artifact; rapporteer commando, exitcode en aantallen.
9. Voor en na de landing zijn source identity, Dockerfile/Compose hashes, artifact IDs en isolatiechecks geregistreerd. Evidence van oudere dirty sources wordt niet als geldig bewijs gebruikt.
10. De documentatie legt de build/test/preflightroute en de beslissing vast dat de AGENTS About-changelogplicht voor deze repository-only technische wijziging niet wordt toegepast, omdat er geen eindgebruikerzichtbare iteratie is.
11. Alle implementatie, builds, inspecties en verificatie gebeuren uitsluitend in een nieuw aangemaakte worktree buiten de primaire werkboom, op een tijdelijke lokale branch vanaf de vastgelegde basiscommit. Het absolute path, branch, basiscommit, bronidentiteit en geslaagde schoonheidschecks zijn geregistreerd; de primaire worktree is niet gewijzigd.
12. Er is geen commit, push, merge, reset, stash, clean of cleanup uitgevoerd. De geïsoleerde worktree en tijdelijke branch blijven bestaan totdat resultaat is vastgelegd en de gebruiker expliciet cleanup toestaat.

## Testing plan

Leg eerst vanuit de primaire worktree alleen de read-only basis vast; voer daarna **alle** onderstaande opdrachten uitsluitend in de nieuw gemaakte geïsoleerde worktree uit. Gebruik nooit een relatief pad voor de worktree. Vervang `<basiscommit>`, `<basiscommit-kort>`, `<branch>` en `<worktree-pad>` door de geregistreerde waarden; vervang `<test-command>` door de bestaande brede backendtestopdracht (bijvoorbeeld de volledige backendtestmap). Leg de exacte gebruikte opdracht en uitkomst vast.

```sh
# In primaire worktree: uitsluitend read-only bronvastlegging; niets wijzigen.
git rev-parse HEAD
git status --short --untracked-files=all

# Maak de geïsoleerde worktree buiten de primaire werkboom en werk daarna alleen daar.
mkdir -p /tmp/opencode
git worktree add -b <branch> <worktree-pad> <basiscommit>
git worktree list --porcelain
cd <worktree-pad>

# Verplichte schoonheids- en identiteitscheck vóór implementatie.
test "$(git rev-parse HEAD)" = "<basiscommit>"
test -z "$(git status --short --untracked-files=all)"
test -z "$(git diff --cached --name-only)"
git diff --check && git diff --cached --check

# Identity and ordinary/explicit Dockerfile artifacts
git rev-parse HEAD && git status --short && git diff --check && git diff --cached --check
sha256sum backend/Dockerfile docker-compose.yml backend/alembic/versions/20260630_0024_audio_topic_transcription.py backend/alembic/versions/20260810_0029_project_module_visibility.py
docker build --no-cache -f backend/Dockerfile -t wervelnieuws-backend-default:opsx .
docker build --no-cache --target runtime -f backend/Dockerfile -t wervelnieuws-backend-runtime:opsx .
docker build --no-cache --target test -f backend/Dockerfile -t wervelnieuws-backend-test:opsx .
docker image inspect --format '{{json .Config.Cmd}} {{.Id}}' wervelnieuws-backend-default:opsx wervelnieuws-backend-runtime:opsx
docker run --rm --entrypoint sh wervelnieuws-backend-runtime:opsx -lc '! command -v pytest && python -c "import fastapi, alembic"'
docker run --rm --entrypoint sh wervelnieuws-backend-test:opsx -lc 'pytest --version && alembic heads && alembic history --verbose'

# Secret-free, inspect-only Compose checks; do not persist the full rendered config.
docker compose config --no-interpolate --no-env-resolution | sed -n '/^  \(backend\|migrate\):/,/^  [^ ]/p' | grep -E '^(  (backend|migrate):|      target: runtime|    command:|      - alembic|      - upgrade|      - head)$'
docker compose config --no-interpolate --no-env-resolution --images

# Isolated runtime/migrate-contract migration and test-artifact tests.
docker run --rm -e DATABASE_URL='sqlite:////tmp/opsx-migrate.db' -e STORAGE_ROOT=/tmp/opsx-storage wervelnieuws-backend-runtime:opsx sh -lc 'mkdir -p "$STORAGE_ROOT" && alembic upgrade head && alembic current && ! command -v pytest'
docker run --rm -e DATABASE_URL='sqlite:////tmp/opsx-test.db' -e STORAGE_ROOT=/tmp/opsx-storage wervelnieuws-backend-test:opsx sh -lc 'mkdir -p "$STORAGE_ROOT" && pytest -q tests/test_project_visibility_migration.py tests/test_admin_api.py tests/test_alembic_merge_revision.py'
docker run --rm -e DATABASE_URL='sqlite:////tmp/opsx-full.db' -e STORAGE_ROOT=/tmp/opsx-storage wervelnieuws-backend-test:opsx sh -lc 'mkdir -p "$STORAGE_ROOT" && <test-command>'
```

Als de gebruikte Compose-versie `--no-env-resolution` niet ondersteunt, stop de inspectie en specificeer vóór uitvoering een gelijkwaardig secret-free alternatief; gebruik niet de gewone geïnterpoleerde `docker compose config` als evidence.

Na verificatie: voer geen `git commit`, `git push`, `git worktree remove`, `git branch -D`, `git clean`, `git reset` of `git stash` uit. Registreer de eindchecks en behoud de worktree totdat de gebruiker expliciet cleanup toestaat.

## Risk + rollback plan

- **Implicit target regression:** een later Dockerfile-stage wisselt de default naar test. Mitigatie: AC voor gewone build én expliciete Compose runtime targets. Rollback: revert alleen deze Dockerfile/Compose-wijzigingen.
- **Verkeerde graph of ontbrekende parent:** stop vóór merge; hashes, head- en ancestrychecks zijn verplicht. Rollback: revert uitsluitend de nieuwe merge, nooit historische revisies.
- **Migrate bevat dev-dependencies of raakt een echte DB:** verifieer `pytest`-afwezigheid en gebruik uitsluitend `/tmp` SQLite. Bij afwijking: geen release en revert/corrigeer repositorypatch.
- **Compose-inspectie lekt secrets:** gebruik `--no-interpolate --no-env-resolution`, beperkte structurele output en sla geen volledige config op. Bij twijfel: verwijder ongewenste lokale output en gebruik deze niet als evidence.
- **Stale/dirty evidence of externe hunks:** herbouw/herverifieer na landing in een schone identity; oude claims zijn ingetrokken. Rollback is geen operationele actie omdat deze change geen targetactie uitvoert.
- **Primaire worktree wordt per ongeluk geraakt:** mitigatie: maak de worktree met een absoluut extern pad, registreer beide paden en voer na creatie alleen vanuit `cd <worktree-pad>` uit; primaire commands zijn beperkt tot read-only identitychecks. Stop bij een wijziging in de primaire status. Rollback: herstel de primaire worktree niet zelfstandig; leg de afwijking vast en vraag om instructie.
- **Verkeerde tijdelijke branch/basis of vervuilde nieuwe worktree:** mitigatie: gebruik `git worktree add -b` op de letterlijk vastgelegde commit en eis lege status, staged status en diff-check vóór werk. Rollback: stop zonder commit; behoud de worktree voor diagnose en verwijder die alleen na expliciete toestemming.
- **Voorbarige cleanup verliest reproduceerbaarheid:** mitigatie: worktree en lokale tijdelijke branch behouden na resultaat. Rollback: niet van toepassing zonder toestemming; leg cleanup alleen vast na expliciete gebruikersautorisatie.

## Documentation impact

- Werk bestaande developer/release-documentatie bij met de runtime/test targets, default-buildverwachting, secret-free Compose-preflight, runtime-migratiecheck en test-artifactroute.
- **AGENTS About-changelogplicht — expliciete beslissing:** geen About-pagina/changelog aanpassen. Deze change is repository-only infrastructuurdiagnostiek zonder eindgebruikersfunctie of zichtbare iteratie. Leg deze uitzondering in de change-documentatie vast; een latere productchange volgt de normale plicht zelfstandig.

## Notes / links

- Parentmigraties: `backend/alembic/versions/20260630_0024_audio_topic_transcription.py` en `backend/alembic/versions/20260810_0029_project_module_visibility.py`.
- Canonical config: `docker-compose.yml`; dependencycontract: `backend/pyproject.toml`.
- Aanname: Docker Compose ondersteunt de genoemde secret-free flags. Bij onjuistheid is vooraf een spec-update nodig, niet een onveilige fallback.
- Worktree-conventie: voorkeurspad `/tmp/opencode/wervelnieuws-admin-load-failure-<basiscommit-kort>`; een veilig repo-nevenpad is alleen toegestaan wanneer `/tmp/opencode` niet beschikbaar is en moet vóór gebruik met absoluut path worden vastgelegd.

## Current status

Draft / blocked — uitsluitend de spec is bijgewerkt. Implementatie en verificatie zijn niet uitgevoerd. De gebruiker heeft gekozen voor een nieuwe geïsoleerde worktree/temporary branch; deze moet nog worden gemaakt op de vastgelegde basiscommit en de parent-landing blijft een gate. Zie actuele evidence.

## What changed

- Deze spec is heropend en uitgebreid met de goedgekeurde P0-expliciete Compose runtime-targetfix, default-build/CMD-controles, production migrate-contract, secret-free inspectie, landingsvolgorde en bredere testartifactverificatie.
- Alle eerdere implementatie- en testclaims zijn herroepen als stale totdat zij na de volledige landing in een schone source identity opnieuw zijn uitgevoerd.
- Geen repository-implementatiebestanden zijn in deze run gewijzigd. De bestaande ongetrackte merge, parentmigraties en regressietests zijn niet aangeraakt, omdat zij onderdeel zijn van externe, nog niet-gelandde worktree-hunks.
- De landingsvolgorde blijft: (1) audio-parent en visibility-parent inclusief hun volledige ketens landen in een gekozen basis, (2) in een schone worktree revision IDs, parents en hashes controleren en exact twee heads bevestigen, (3) deze geïsoleerde change landen, (4) alle artifact- en testchecks opnieuw uitvoeren vanaf die samengevoegde source identity.
- Documentatie-/About-beslissing bevestigd: geen About-pagina of eindgebruikers-changelog aanpassen; dit is repository-only infrastructuurdiagnostiek zonder zichtbare productiteratie. De canonical build/test/preflightdocumentatie kan pas veilig worden bijgewerkt in de schone, geautoriseerde source identity.
- De gekozen isolatieprocedure is toegevoegd: read-only vastlegging van de primaire bronidentiteit, `git worktree add -b` op exact die commit naar een absoluut extern pad, verplichte schoonheidschecks, exclusief werk in die worktree, geen commit/push en behoud tot expliciete cleanup-toestemming.

## How to verify

Voer de **Testing plan**-opdrachten uitsluitend uit na de dependency/landingsvolgorde, vanuit de nieuw gemaakte schone worktree op de vastgelegde commit en tijdelijke lokale branch. Registreer alleen gesaniteerde commandoutput, UTC-tijd, exitcode, testtelling, absoluut worktreepath, branch, basiscommit, primaire bronidentiteit, parent-hashes, Compose/Dockerfile-hashes en image IDs. Gebruik geen dirty buildcontext, wijzig de primaire worktree niet en voer geen target/prod/deployactie, commit, push of cleanup uit.

## Verification evidence

### Herroepen/stale evidence

Alle eerder vermelde resultaten, inclusief vermeende `20260811_0030`-implementatie, image-digests, Compose-inspectie en **37 passed**, zijn stale en expliciet geen bewijs voor deze heropende change. Zij kunnen afkomstig zijn van een dirty source, ontbreken de P0-expliciete Compose-targetcontrole, of dateren van vóór de vereiste landingsvolgorde. Gebruik ze niet voor acceptatie of vrijgave.

### Huidige run

UTC-datum: 2026-08-11 (shell levert geen tijdstempel in deze vastlegging).

- Source identity bij start: `9797aeae7607d2cc1333c381c2301a8d4d45be90`.
- Isolatiecheck: **FAIL / stopvoorwaarde geraakt**. `git status --short --untracked-files=all` toont omvangrijke externe gewijzigde Admin-, audio-, visibility-, frontend- en work-hours-hunks. Daarnaast zijn de vereiste parentmigraties, merge en regressietests ongetrackt. `git diff --name-status` bevat onder meer externe wijzigingen aan `backend/alembic/versions/20260729_0025_board_card_lifecycle.py`, Admin API's en frontendbestanden. Staging is leeg. `git diff --check` en `git diff --cached --check` slagen zonder whitespace-output, maar maken de worktree niet schoon.
- Parent-/Dockerfile-/Compose-hashes op deze ongeldige dirty identity (uitsluitend vastgelegd voor diagnose, niet als releasebewijs): `backend/Dockerfile` `705f9ee2223fb6ce4f7d6b8372d1a7eaabb92d273423fbcac4f87fa76b8efe37`; `docker-compose.yml` `1e891c2ca3262a5379ab2c673eaa8c5b081c427bf3674a38943d21832509fd8f`; audio-parent `6d2ff9c6d1ef472cdf7d6ac9d04808942985aea92c7da75f425289581d7c0dc4`; visibility-parent `187a56a9856ffb0fd1ecee79906f5edfdb74fba72ca06ff1e5c6006b2e79bdc1`.
- Aanvullende stopreden: de externe wijziging aan `20260729_0025_board_card_lifecycle.py` verandert diens `down_revision` van `20260630_0024` naar `20260616_0023`; hierdoor kan de Alembic-ancestry in deze worktree niet als de vereiste landed graph worden geaccepteerd.
- Niet uitgevoerd: Docker-builds, Compose-inspectie, runtime-migratie en pytest. Die zouden de onschone buildcontext gebruiken en zijn daarom volgens implementatiestap 1 en AC9 geen geldig bewijs.
- Geen secrets, `.env`-inhoud, gerenderde Compose-configuratie, services, doelomgeving, gedeelde database, deployment, commit of externe hunk zijn aangeraakt.
- Externe gates vóór hervatting: maak eerst de in stappen 1–3 beschreven schone worktree op de vastgelegde commit; bevestig daarin dat beide onveranderde parentketens aanwezig zijn, de juiste `20260729_0025` ancestry en precies de twee verwachte heads in een vers test-artifact; voer daarna de resterende implementatie- en testplanstappen uit.
- Besluit gebruiker: een nieuwe geïsoleerde Git-worktree met tijdelijke lokale branch gebruiken wegens de dirty primaire worktree. In deze spec-run is die worktree nog niet aangemaakt; er is daarom nog geen absoluut path, tijdelijke branch of nieuwe-worktree source identity te registreren.
- Geen implementatie, verificatie, commit, push, merge, cleanup of wijziging aan de primaire worktree uitgevoerd in deze run. De volgende uitvoering moet de worktreeprocedure in stappen 1–3 volgen en daarna de resterende stappen uitvoeren.

---
Status: draft / blocked
Owner: —
Date: 2026-08-11
