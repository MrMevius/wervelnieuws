# Title

Herstel vermoede schema-drift voor vergaderborden en borg de migratie-releaseketen

## Context

In de getroffen omgeving laden vergaderborden niet. Het discovery-resultaat wijst voorlopig op schema-drift: de runtime kan projectdata lezen via code die `projects.is_visible_in_boards` verwacht, terwijl die kolom mogelijk ontbreekt in de uitgerolde database. Dit kan een SQL-fout en vervolgens een 500 op de betrokken project-/boardroute veroorzaken.

De oorzaak is nog niet bewezen. De actieve releasebron, het uitgerolde image/commit, de toegepaste Alembic-revisie, de daadwerkelijke tabelmetadata en een met de storing gecorreleerde fout zijn nog niet als gesaniteerde runtime-evidence vastgelegd. Deze change beschrijft uitsluitend de toekomstige diagnose en, na afzonderlijke autorisatie, de kleinste veilige herstelroute.

## Goals / Non-goals

### Goals

- Met read-only evidence vaststellen of `projects.is_visible_in_boards` in de getroffen runtime ontbreekt en of dat de storing verklaart.
- De Alembic-graph en releasebron vóór een release reproduceerbaar valideren.
- Alleen indien schema-drift is bewezen: via de bestaande geautoriseerde migratieprocedure naar de verwachte head migreren.
- Aantonen dat de getroffen vergaderbordroute na herstel geauthenticeerd zonder 500 werkt.
- De diagnose-, release-, verificatie- en rollbackstappen documenteren.

### Non-goals

- Geen productieconfiguratie, deploy, service-restart, productiedatabasewijziging of productiemigratie in deze lokale implementatie.
- Geen herontwerp van projectvisibility, vergaderborden, rechten of authenticatie.
- Geen handmatige DDL/DML, directe productiedatabasefix of wijziging van historische Alembic-revisies.
- Geen conclusie over `/api/auth/me` of wijziging van auth/cookies/proxy zonder afzonderlijke reproduceerbare evidence.
- Geen secrets, tokens, cookies, connection strings of persoonsgegevens in log- of verificatiebewijs.

## Scope

In scope zijn de diagnose van de niet-ladende vergaderborden, de vermoedelijke kolom `projects.is_visible_in_boards`, de relevante Alembic-releaseketen en de gecontroleerde herstel- en smokecheckprocedure.

Uit scope zijn functionele uitbreidingen van boards/projecten, auth-wijzigingen en alle uitvoerende productiehandelingen totdat die expliciet zijn goedgekeurd.

## Proposed approach

1. Koppel de storing aan één identificeerbare uitgerolde artifact/source identity en verzamel uitsluitend read-only, gesaniteerde runtime-evidence.
2. Vergelijk de runtime-revisie en `projects`-metadata met de Alembic-graph en de migratie die `is_visible_in_boards` introduceert.
3. Valideer in een geïsoleerde tijdelijke SQLite-database dat de gekozen releasebron één verwachte Alembic-head heeft en naar `head` kan upgraden met de vereiste kolom.
4. Alleen als de diagnose schema-drift bevestigt én een release is geautoriseerd: maak en verifieer backups, stop writers, voer de reguliere migratie uit en doe een geauthenticeerde board-smokecheck.
5. Als de evidence een andere oorzaak toont, stop het schemaherstel, leg de classificatie vast en open/actualiseer een passende vervolgchange.

## Implementation steps (ordered)

1. Verkrijg afzonderlijke autorisatie voor read-only runtime-diagnose; noteer UTC-tijd, omgeving, service/container en uitgerold commit of image digest.
2. Verzamel read-only `alembic current`, `alembic heads` en `PRAGMA table_info(projects)` vanuit de daadwerkelijk uitgerolde backend-/migratiecontext. Leg uitsluitend revisie-ID's en kolommetadata vast.
3. Correlleer minimaal één falende vergaderbord- of projectroute met timestamp, route, status, request-ID (indien beschikbaar) en gesaniteerde exception class/ontbrekende kolom. Redacteer request bodies en credentials volledig.
4. Vergelijk de waarnemingen met `backend/alembic/versions/20260810_0029_project_module_visibility.py` en de actuele repositorygraph. Bevestig of `is_visible_in_boards` hoort te bestaan op de runtime-head.
5. Voer vóór iedere release op de geselecteerde, immutabele releasebron een geïsoleerde SQLite-preflight uit: controleer één Alembic-head, upgrade naar `head`, en controleer dat `projects.is_visible_in_boards` bestaat en `NOT NULL` is. Breid dit alleen uit met `is_visible_in_work_hours` wanneer de gekozen migratie dit eveneens contractueel vereist.
6. Voeg deterministische regressietests en een minimale release-preflight toe. Pas geen historische migraties aan; documenteer de concrete bestanden en testuitkomsten in deze spec.
7. Als de runtime-evidence schema-drift bewijst, vraag afzonderlijke release-autorisatie aan. Verifieer consistente database- en storagebackups, stop writers, voer de bestaande migratieprocedure uit en leg artifact/revision identity vast.
8. Doe na de geautoriseerde migratie een geauthenticeerde smokecheck van de route die de storing reproduceerde. Bevestig een 2xx-respons en afwezigheid van de eerdere SQL-/kolomfout.
9. Bij een mislukking: houd de release gestopt, herstel database én passend voorafgaand artifact uit de geverifieerde backup, en actualiseer deze spec met de uitkomst.

## Acceptance criteria

1. Read-only evidence koppelt de getroffen runtime aan een commit/image digest, Alembic `current`/`heads`, `projects`-kolommetadata en minstens één gecorreleerde board/project-routefout, zonder secrets of credentials.
2. De diagnose classificeert de storing expliciet als bevestigde schema-drift, uitgesloten schema-drift, of onvoldoende evidence; bij onvoldoende evidence vindt geen migratie plaats.
3. Vóór release toont een geïsoleerde tijdelijke SQLite-upgrade naar `head` exact één verwachte Alembic-head en de aanwezigheid van `projects.is_visible_in_boards` als `NOT NULL` kolom.
4. Als een release wordt geautoriseerd, zijn database- en storagebackups aantoonbaar gemaakt en geverifieerd vóór writers worden gestopt of migraties draaien.
5. Na een geautoriseerd schemaherstel retourneert de oorspronkelijk falende, geauthenticeerde vergaderbord/projectroute 2xx en treedt de vastgelegde ontbrekende-kolom-/SQL-fout niet meer op.
6. Rollback herstelt bij falen de database en het bijpassende artifact uit backup; historische Alembic-revisies worden niet gewijzigd of handmatig teruggedraaid.
7. Deze spec bevat voor elke uitgevoerde stap command, exitcode/resultaat, artifact identity en gesaniteerde evidence. Niet-uitgevoerde stappen zijn expliciet als pending gemarkeerd.

## Testing plan

Alleen na implementatie- of release-autorisatie uitvoeren. Gebruik voor repositoryvalidatie een schone, immutabele releasebron en tijdelijke SQLite; productieinspectie blijft read-only tot de geautoriseerde migratiestap.

```bash
# In backend, tegen de geselecteerde releasebron
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

## Risk + rollback plan

- **Onjuiste oorzaak:** voer geen migratie uit zonder correlatie tussen routefout, runtime-revision en kolommetadata.
- **Verkeerde releasebron/graph:** bind alle verificatie aan commit/image digest en valideer de graph in tijdelijke SQLite vóór release.
- **Mislukte productie-upgrade:** verifieer database- en storagebackups, stop writers tijdens het window en herstel bij falen database plus passend artifact; voer geen handmatige schemaingrepen uit.
- **Preflight raakt productie:** alle preflight-upgrades gebruiken uitsluitend een tijdelijk SQLite-bestand; runtime-inspectie is read-only.
- **Gevoelige evidence:** redacteer tokens, cookies, headers, connection strings en secrets volledig.

## Notes / links

- Vermoedelijke visibility-migratie: `backend/alembic/versions/20260810_0029_project_module_visibility.py`.
- Mogelijk betrokken routes: `backend/app/api/boards.py` en projectgerelateerde API-routes.
- Gerelateerde voorganger: `opsx/changes/2026-08-10-admin-load-failure-diagnostics.md`; deze change sluit die spec niet af.
- Discovery-aanname: het niet laden van vergaderborden hangt vermoedelijk samen met schema-drift rond `projects.is_visible_in_boards`; dit is nog niet runtime-bewezen.

## Current status

Lokaal geïmplementeerd, geïsoleerd volledig geverifieerd en lokaal goedgekeurd bij review. Runtime-diagnose, release, productiemigratie en productievalidatie blijven pending operator-evidence en afzonderlijke autorisatie.

## What changed

- Toegevoegd: de additieve migratie `20260810_0029_project_module_visibility.py`, die `projects.is_visible_in_boards` en het contractueel gekoppelde `is_visible_in_work_hours` als `NOT NULL` booleans met een veilige standaardwaarde toevoegt.
- Toegevoegd: de no-op release-head `20260811_0030`, zodat de geselecteerde repositorygraph één expliciete release-head heeft zonder historische revisies te wijzigen.
- Toegevoegd: `scripts/release_schema_preflight.py`, die uitsluitend een tijdelijke SQLite-database gebruikt, exact één verwachte Alembic-head eist, naar `head` upgradet en beide visibility-kolommen op aanwezigheid en `NOT NULL` controleert.
- Toegevoegd: regressietests voor upgrade/downgrade van bestaande project-, bord- en urenrelaties, upgrade naar de release-head en geauthenticeerde project-/boardroutes na upgrade.
- Geen auth-, CORS-, proxy-, deploy-, productieconfiguratie- of productieruntimewijziging uitgevoerd. De bestaande About/changelog- en iteratieverwachtingen zijn geïnspecteerd en niet gewijzigd, omdat deze technische herstelchange geen eindgebruikersfunctionaliteit toevoegt.
- De lokale review is akkoord bevonden; de releaseprovenance is gebaseerd op isolated verification vanaf base `13774235`.

## How to verify

Lokaal, vanuit de geïsoleerde releasebron (base `13774235`):

```bash
.venv/bin/alembic heads
.venv/bin/python scripts/release_schema_preflight.py
.venv/bin/pytest -q tests/test_project_visibility_migration.py tests/test_release_schema_preflight.py tests/test_boards_api.py
git diff --check
```

De preflight gebruikt alleen een tijdelijke SQLite-database en wijzigt geen gedeelde of productieomgeving.

Aanvullend zijn de volledige backendtests, frontendtests/build en de geselecteerde Docker-validatie uitgevoerd volgens de repository-releasechecklist. Verwacht resultaat: alle checks slagen; runtime-operatorchecks worden niet lokaal gesimuleerd.

Vóór een release moet OPSX-test daarnaast op een schone, immutabele releasebron de artifact identity, `alembic current`/`heads`, `PRAGMA table_info(projects)` en een gesaniteerde foutcorrelatie vastleggen. Pas na bewezen drift en afzonderlijke release-autorisatie volgen backup-, writer-stop-, migratie- en geauthenticeerde runtime-smokecheckstappen uit dit document.

## Verification evidence

- 2026-08-12 — geïsoleerde releasebron vanaf base `13774235`: backendtests — exit 0; `263 passed, 1 skipped`.
- 2026-08-12 — geïsoleerde releasebron vanaf base `13774235`: frontendtests — exit 0; `158 passed`.
- 2026-08-12 — geïsoleerde releasebron vanaf base `13774235`: frontend build — exit 0; build geslaagd.
- 2026-08-12 — geïsoleerde releasebron vanaf base `13774235`: geselecteerde Docker-validatie — exit 0; `102` geselecteerde checks geslaagd.
- 2026-08-12 — lokaal: `.venv/bin/python scripts/release_schema_preflight.py` — exit 0; tijdelijke SQLite-upgrade naar `20260811_0030` geslaagd en preflight meldde `Release schema preflight passed: 20260811_0030`.
- 2026-08-12 — lokale review — akkoord; geen blocking bevindingen.
- Pending operator-evidence: runtime artifact identity, read-only runtime-`alembic current`/`heads`, runtime-`PRAGMA table_info(projects)`, gesaniteerde routefoutcorrelatie, deploy, restart, backup, writer-stop, productiemigratie en geauthenticeerde productiesmokecheck. Deze zijn niet lokaal uitgevoerd en blijven pending voor OPSX-test en de vereiste afzonderlijke autorisaties.

---
Status: done (lokale implementatie, isolated verification en lokale review); runtime operator-evidence en productie-release blijven pending
Owner: —
Date: 2026-08-12
