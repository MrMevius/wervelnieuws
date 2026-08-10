# Title
Verwijder JSON-backup en restore uit urenverantwoording

## Context
De urenverantwoording bevat nu een eigen JSON-backup-/importsubsystem met preview, merge, full restore, importbatches, importprovenance en downloadbare pre-importbackups. Dit subsystem is uitgebreid en heeft meerdere onopgeloste restoreblokkades veroorzaakt in de voorganger `opsx/changes/2026-08-09-compacte-urenregistratie-centraal-beheer.md`.

Die voorganger is definitief **Partial / NO-GO** en wordt door deze change niet alsnog Completed verklaard. Deze follow-up kiest bewust een kleinere productgrens: het problematische uren-specifieke JSON-backup-/restore-subsystem verdwijnt volledig. Reguliere operationele database- en storagebackups blijven de manier om de installatie als geheel veilig te stellen en om de destructieve migratie terug te draaien.

De gebruiker heeft permanente cleanup expliciet goedgekeurd. Bestaande `work_import_batches`, `WorkHourGroup.source_import_batch_id`, import-/backup-provenance en uren-specifieke JSON-backupbestanden hoeven daarom niet behouden of converteerbaar te blijven. CSV-export en recordniveau-herstel van soft-deleted urenregistraties en externe personen blijven wel productfunctionaliteit.

## Goals / Non-goals

### Goals
- Verwijder uren-JSON-backup/download, import preview, import commit, merge en full restore volledig uit frontend, API-client, backend routes, service, schemas, modellen, repository, instellingen en tests.
- Voeg een forward Alembic-migratie toe die `work_hour_groups.source_import_batch_id` inclusief FK/relatie verwijdert, `work_import_batches` inclusief indexen en rijen verwijdert en uitsluitend bij dit subsystem horende provenance opruimt.
- Verwijder permanent alle door dit subsystem gemaakte JSON-bestanden onder de urenexportlocatie en veilig herkende, in importbatches geregistreerde backupbestanden.
- Behoud CSV-export met exact dezelfde filtering, deleted-scope, total-dataset en canonical sorting als het urenoverzicht.
- Behoud individuele herstelacties voor soft-deleted urenregistraties en externe personen, inclusief bestaande autorisatie, optimistic concurrency en audit.
- Werk About/changelog, `docs/urenregistratie.md`, README-verwijzingen en overige actuele gebruikersdocumentatie bij zodat de verwijderde mogelijkheid nergens als beschikbaar wordt gepresenteerd.
- Vereis en verifieer vóór productie-upgrade een normale database- en storagebackup; herstel daarvan is het rollbackpad na de destructieve migratie.

### Non-goals
- Geen herontwerp van ureninvoer, tabel/cards, filters, totalen, deelnemers, historie of audit buiten het verwijderen van import-/backupprovenance.
- Geen wijziging aan centraal projectbeheer, globale posten/categorieën of hun beheer- en restoreacties.
- Geen wijziging aan rollen, autorisatie- of ownershipregels.
- Geen vervangend uren-specifiek backup-, import-, merge- of full-restoreformaat.
- Geen wijziging aan algemene database-/storagebackupdocumentatie of deploymentbackupfunctionaliteit, behalve verduidelijken dat die buiten de urenfeature valt en verplicht is voor deze migratie.
- Geen verwijdering van CSV-export.
- Geen wijziging aan imports/exports van andere modules, zoals planning-CSV.
- Geen poging om de voorgangerspec te sluiten of resterende NO-GO-punten daarin als opgelost te markeren.

## Proposed approach

### 1. Product- en API-grens
- Verwijder de volledige frontendsectie/modal **Import en backup**, inclusief JSON-editor, modekeuze, preview/commitstatus, waarschuwingen, backupdownload en bijbehorende state/mutations.
- Verwijder uit `frontend/src/lib/api/client.ts` uitsluitend de uren-import-/backuptypes en functies voor preview, commit en backupdownload. `exportWorkHoursCsv`, `restoreWorkHourGroup` en `restoreWorkExternalPerson` blijven bestaan.
- Verwijder deze routes zonder compatibiliteitsstub of redirect:
  - `POST /api/urenverantwoording/import/preview`
  - `POST /api/urenverantwoording/import/commit`
  - `GET /api/urenverantwoording/import/batches/{batch_id}/backup`
- Na uitrol geeft FastAPI voor ieder van deze niet meer geregistreerde route/methodecombinaties `404`; de requestbody wordt niet door uren-importcode geparseerd en er ontstaan geen writes of nieuwe auditevents.
- Behoud `GET /api/urenverantwoording/export.csv` en de bestaande recordniveau-routes `POST /api/urenverantwoording/groepen/{group_id}/herstellen` en `POST /api/urenverantwoording/externe-personen/{person_id}/herstellen` ongewijzigd in betekenis.

### 2. Backend-opruiming
- Verwijder `WorkImportBatch`, de model-export, repositorymethoden voor importbatches, `WorkImport*` schemas, importvalidators/resource-limitcode, envelopeconversie, backupserialisatie, preview/commit/downloadservices en import-only exceptionmapping.
- Verwijder `source_import_batch_id` uit het groupmodel, responses/snapshots en alle reads/writes. Normale groepsvelden, historische identities, legacy project-/postaliases en algemene audit blijven behouden voor zover zij niet uitsluitend importbatchprovenance zijn.
- Verwijder de ongebruikte settings `work_hours_import_max_bytes`, `work_hours_import_max_depth` en `work_hours_import_max_nodes` en eventuele voorbeeldconfiguratie/documentatie daarvan.
- Verwijder bestaande auditregels met eventtype `work_hours.import.*` of `work_hours.backup.*`, omdat deze uitsluitend provenance van het verwijderde subsystem zijn. Andere `work_hours.*` auditregels, historische identities en legacy project-/postaliases blijven behouden.

### 3. Destructieve forward migratie en bestandscleanup
- Voeg één nieuwe Alembic-revisie toe met `down_revision = "20260809_0027"`.
- De upgrade legt vóór DDL de bestaande `pre_import_backup_path`-waarden vast, verwijdert import-/backupauditregels, verwijdert `source_import_batch_id` inclusief FK uit `work_hour_groups` via SQLite-veilige batch-DDL en verwijdert daarna indexen en tabel `work_import_batches`.
- De upgrade verwijdert uitsluitend `.json`- en achtergebleven `.tmp`-bestanden die:
  1. onder de canoniek opgeloste `${STORAGE_ROOT}/${EXPORTS_DIR}/urenverantwoording/` staan; of
  2. via `pre_import_backup_path` geregistreerd zijn én na canonicalisatie binnen diezelfde directory vallen.
- Symlinks, paden buiten deze urenexportdirectory en niet-JSON-bestanden worden nooit gevolgd of verwijderd. Een pad buiten de grens laat de migratie vóór destructieve DB-DDL falen met een verklaarde fout, zodat operators het handmatig kunnen onderzoeken.
- De lege urenexportdirectory mag na cleanup worden verwijderd. Algemene storage, CSV-downloads die niet persistent worden opgeslagen en backups buiten deze directory blijven onaangeraakt.
- Bestandsverwijdering is niet transactioneel. De productieprocedure stopt daarom API en worker, maakt en verifieert eerst de database-/storagebackup en start writers pas nadat migratie en controles slagen.
- Downgrade reconstrueert hoogstens de lege tabel-/kolomstructuur die nodig is om de vorige code op een lege testdatabase te starten; verwijderde batchrijen, provenance, auditregels en JSON-bestanden worden niet gereconstrueerd. Op een database waarop de upgrade werkelijk data heeft verwijderd is alleen herstel van de verplichte pre-migratiebackup een ondersteund rollbackpad.
- NO-GO-remediation: auditcleanup gebruikt uitsluitend letterlijke prefixmatching voor `work_hours.import.` en `work_hours.backup.`; `_` en andere tekens krijgen nergens SQL-`LIKE`-wildcardbetekenis. Near matches zoals `workXhours.import.*`, `work-hours.import.*` en overeenkomstige backupvarianten blijven bytegelijk behouden.
- NO-GO-remediation: een symlink als geconfigureerde urenroot, iedere geneste directorysymlink en iedere gebroken directorysymlink laat de migratie tijdens volledige preflight falen vóór enige filedelete, audit-/provenancecleanup of destructieve DDL. Symlinks, targets en sentinels blijven onaangeraakt.

### 4. CSV- en record-restoreregressiegrens
- Lijst, totalen en CSV blijven één bestaand querycontract gebruiken. Voor dezelfde combinatie van datum, project, post, deelnemertype, deelnemerzoekterm, vrije zoekterm, deleted-scope en sortering bevat CSV alle en exact dezelfde group-IDs in dezelfde volgorde als de volledige ongepageerde lijstbasis.
- Soft-deleted groep- en externe-persoonrestore blijven afzonderlijke domeinacties en mogen niet worden verwijderd vanwege het woord “restore”. Tests moeten expliciet voorkomen dat een brede cleanup deze API-clientfuncties, routes, servicepaden of UI-acties verwijdert.

## Implementation steps (ordered)
1. **Inventariseer en isoleer de verwijdergrens**
   - Leg alle huidige frontend-, client-, route-, schema-, model-, repository-, service-, settings-, test-, documentatie- en changelogreferenties aan uren-JSON-backup/import vast.
   - Leg fixtures vast met meerdere importbatches, groups met nullable en non-null `source_import_batch_id`, bijbehorende FK's/auditregels, geldige JSON-/tmp-bestanden en een sentinelbestand buiten de urenexportdirectory.
2. **Maak de destructieve migratie en cleanup veilig**
   - Voeg de forward revisie na `20260809_0027` toe met padcanonicalisatie, fail-before-DDL voor onveilige geregistreerde paden, gerichte bestandsverwijdering, import-/backupauditcleanup en SQLite-veilige verwijdering van FK/kolom/tabel/indexen.
   - Voeg migratietests toe voor gevulde data, FK enforcement, bestanden, sentinelbehoud, idempotente file-absence en een lege structurele downgrade/upgrade-roundtrip.
3. **Verwijder backendsubsystem**
   - Verwijder import-/backuproutes, streaming JSON-parser, schemas, servicecode, model/repositorycode, import-only settings en exports.
   - Verwijder `source_import_batch_id` uit resterende groupmapping en responses zonder normale uren-, CSV-, audit- of record-restorecode te wijzigen.
4. **Verwijder frontend en API-clientoppervlak**
   - Verwijder de import-/backupsectie en alle bijbehorende state, callbacks, mutations, types en clientfuncties.
   - Behoud en regressietest CSV-download en de individuele restorecontrols voor urenregistraties en externe personen.
5. **Schoon tests gericht op**
   - Verwijder tests die het oude subsystem als gewenst gedrag vastleggen.
   - Vervang ze door route-afwezigheid, zero-write, migratiecleanup, CSV-pariteit en record-restoreregressies; behoud overige urentests en teststerkte.
6. **Werk documentatie en changelog bij**
   - Verwijder uren-JSON-backup/import/full-restore-instructies uit `docs/urenregistratie.md` en pas de README-omschrijving aan.
   - Behoud en verduidelijk algemene operationele database-/storagebackup-, verificatie- en restore-instructies, inclusief de verplichte pre-migratiebackup voor deze cleanup.
   - Voeg een gebruikersgerichte About/changelog-entry toe en herschrijf oudere actuele highlights die backup/import/full restore nog als beschikbare urenfunctionaliteit presenteren; historische iteratiedata hoeven niet te worden verwijderd.
7. **Voer volledige verificatie uit en leg evidence vast**
   - Draai gerichte migratie-/uren-/Abouttests, daarna volledige backend- en frontendsets, frontendbuild, veilige Alembic-roundtrip en diff-/verbodentermchecks.
   - Controleer vóór productie handmatig backupbewijs, gemigreerde schema/data/files, CSV met gecombineerde filters en beide recordniveau-restores.

## Acceptance criteria
1. **Geen UI-oppervlak:** de urenpagina bevat geen knop, modal, JSON-tekstveld, modekeuze of status voor backup, import, preview, merge of full restore; een frontendtest bewijst dit na volledig renderen.
2. **Geen clientcontract:** uren-import-/backuptypes en preview-, commit- en downloadfuncties ontbreken uit de API-client, terwijl CSV-export en `restoreWorkHourGroup`/`restoreWorkExternalPerson` typechecken en door tests worden aangeroepen.
3. **Routes verwijderd:** de drie vastgelegde import-/backuproutes retourneren voor admin en niet-admin `404`; geen request maakt rows, files of `work_hours.import.*`/`work_hours.backup.*` auditevents.
4. **Backendcode verwijderd:** er zijn buiten oude OPSX-specs en migratiehistorie geen runtime-referenties meer aan `WorkImportBatch`, `WorkImportEnvelope`, preview/commit/full-restore, importbatchrepositorymethoden of uren-importlimietsettings.
5. **Schema destructief opgeschoond:** na upgrade bestaan tabel `work_import_batches`, kolom/FK `work_hour_groups.source_import_batch_id` en de twee importbatchindexen niet meer; `PRAGMA foreign_key_check` geeft geen rows.
6. **Provenance opgeschoond:** bestaande importbatchrows, groupbronverwijzingen en auditregels met `work_hours.import.*`/`work_hours.backup.*` zijn verwijderd; aantallen en inhoud van hour groups, participants, external people, historical identities, projects, posts en overige auditregels blijven gelijk.
7. **Bestanden veilig verwijderd:** alle bestaande `.json`/`.tmp` urenbackupbestanden binnen de canonieke urenexportdirectory zijn weg en de directory is leeg of afwezig; een sentinel buiten die directory en overige storagebestanden zijn bytegelijk behouden. Een geregistreerd pad buiten de grens stopt vóór DB-DDL.
8. **CSV-pariteit:** voor minimaal één gecombineerde filterset en beide sorteerrichtingen zijn de group-IDs en volgorde in CSV exact gelijk aan de volledige ongepageerde lijstbasis; CSV bevat alle matches, niet alleen de zichtbare pagina.
9. **Groepsrestore behouden:** een admin kan een soft-deleted urenregistratie met correcte `expected_row_version` individueel herstellen; stale version en onbevoegde gebruiker behouden hun bestaande conflict-/autorisatiegedrag en er ontstaat een `work_hours.group.restored` auditregel.
10. **Externe-persoonrestore behouden:** een admin kan een gearchiveerde/soft-deleted externe persoon individueel herstellen met behoud van bestaande uniqueness-, row-version-, autorisatie- en auditregels.
11. **Geen zijdelingse herontwerpen:** ureninvoer, filters, totalen, centraal project-/postbeheer, algemene audit en autorisatie hebben buiten expliciete import-/backupprovenance geen contractwijzigingen en hun bestaande gerichte tests blijven groen.
12. **Documentatie klopt:** About/changelog en urenadmindocumentatie presenteren JSON-backup/import/full restore niet als beschikbare urenfunctie; algemene operationele database-/storagebackupguidance blijft aanwezig en maakt de productievoorwaarde en rollback expliciet.
13. **Rollbackbewijs:** een geverifieerde pre-migratie database- én storagebackup is als verplichte deploymentgate gedocumenteerd. Lege upgrade→downgrade→upgrade is groen; voor een gevulde destructief gemigreerde omgeving is restore van die backup aantoonbaar het enige ondersteunde rollbackpad.
14. **Volledige kwaliteitsgate:** gerichte en volledige backend/frontendtests, frontendbuild, veilige Alembicchecks en `git diff --check` slagen; de forbidden-symbolcheck vindt geen runtime-/actuele-docsreferenties buiten expliciet toegestane historische Alembic- en OPSX-bestanden.

## Testing plan

### Gerichte dekking
- Backend migratie: populated `work_import_batches`, nullable/non-null group-FK's, FK enforcement, import-/backupaudit, geldige JSON/tmp-bestanden, ontbrekend bestand, extern/symlinkpad en sentinelbehoud.
- Backend routes/services: alle verwijderde routes 404 en zero-write; list/totals/CSV-pariteit; soft-delete plus individueel restore van group en external person.
- Frontend: import-/backupoppervlak afwezig; CSV-download blijft dezelfde filters/sortering gebruiken; beide individuele restoreflows blijven zichtbaar en functioneel.
- Docs/About: nieuwste changelogentry en afwezigheid van actuele claims over uren-JSON-backup/import/full restore.

### Exact intended verification commands
Voer vanuit de repositoryroot uit, tenzij anders aangegeven:

```bash
# Gerichte backend uren-, migratie-, route-, CSV-, restore- en Abouttests
cd backend
STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest \
  tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q

# Volledige backendset
STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest

# Gerichte frontend uren-/shelltests
cd ../frontend
npm test -- --run \
  src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx \
  src/app/App.test.tsx

# Volledige frontendset en TypeScript/Vite-productiebouw
npm test -- --run
npm run build

# Structureel veilige roundtrip op een lege tijdelijke database/storage
cd ../backend
tmp=$(mktemp -d)
export DATABASE_URL="sqlite:///$tmp/uren-backup-removal.db"
export STORAGE_ROOT="$tmp/storage"
mkdir -p "$STORAGE_ROOT"
.venv/bin/alembic upgrade head
.venv/bin/alembic downgrade 20260809_0027
.venv/bin/alembic upgrade head
.venv/bin/python - <<'PY'
import os, sqlite3
db = sqlite3.connect(os.environ["DATABASE_URL"].removeprefix("sqlite:///"))
assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
assert not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='work_import_batches'").fetchone()
assert "source_import_batch_id" not in {row[1] for row in db.execute("PRAGMA table_info(work_hour_groups)")}
print("alembic roundtrip: ok")
PY

# Runtime-/actuele-docscheck: verwacht geen output en exit 1 van rg
cd ..
! rg -n \
  'WorkImportBatch|WorkImportEnvelope|source_import_batch_id|work_hours_import_max_|previewWorkHoursImport|commitWorkHoursImport|downloadWorkHoursBackup|/urenverantwoording/import|full_restore' \
  backend/app backend/tests frontend/src docs README.md

# Repositorybrede whitespace-/conflictcontrole
git diff --check
```

De populated migratie- en bestandscleanup wordt deterministisch vanuit `backend/tests/test_work_hours_api.py` getest; de shellroundtrip hierboven is bewust alleen structureel en leeg. Een downgrade van een gevulde, reeds opgeschoonde productieomgeving geldt niet als dataterugwinningstest.

Er is momenteel geen afzonderlijk frontend-lintscript in `frontend/package.json` en geen backendlinter in `backend/pyproject.toml`. Pytest, Vitest, `npm run build`, Alembiccontroles, de gerichte `rg`-check en `git diff --check` zijn daarom de discoverable canonical checks voor deze change.

## Risk + rollback plan

### Risico's en mitigaties
- **Permanent verlies van importhistorie/backups:** dit is expliciet goedgekeurd en wordt vóór productie afgedekt met een geverifieerde normale database-/storagebackup.
- **Verkeerd storagebestand verwijderd:** cleanup canonicaliseert paden, volgt geen symlinks, beperkt extensies en root, bewaart sentinels in tests en stopt vóór DDL bij een onveilig geregistreerd pad.
- **Niet-transactionele file/DB-combinatie:** stop API en worker, maak backup, voer migratie in een maintenance window uit en controleer files/schema vóór writers opnieuw starten.
- **Brede “restore”-cleanup verwijdert recordherstel:** specifieke regressietests en forbidden-diffreview bewaken group- en external-personrestore.
- **CSV raakt los van lijstfilters/sortering:** paritytests vergelijken IDs en volgorde voor gecombineerde filters en beide sorteerrichtingen.
- **Oude code verwacht verdwenen schema:** applicatie en migratie worden als één release-eenheid uitgerold; geen rolling deploy met gemengde oude/nieuwe containers.
- **Auditverlies buiten scope:** voor/na-counts en inhoudsvergelijking bewijzen dat alleen `work_hours.import.*` en `work_hours.backup.*` worden verwijderd.

### Productieprocedure en rollback
1. Stop API en worker zodat database en storage stabiel zijn.
2. Maak een consistente databasebackup en storage-archive met de algemene operationele procedure; voer SQLite integrity/read/restoreproof, archive listing en checksums uit en bewaar evidence.
3. Draai de nieuwe Alembic-upgrade met dezelfde `STORAGE_ROOT` en `EXPORTS_DIR` als productie.
4. Controleer schema, `PRAGMA foreign_key_check`, afwezigheid van urenbackupbestanden, CSV-export en individuele restore op een testrecord voordat writers starten.
5. Bij iedere fout na destructieve cleanup: houd writers gestopt, bewaar de mislukte staat voor diagnose en herstel database én storage samen uit de pre-migratiebackup. Draai niet alleen downgrade om data of bestanden terug te verwachten.
6. Start eerst API, herhaal smokechecks en start daarna worker.

## Notes / links
- Predecessor: `opsx/changes/2026-08-09-compacte-urenregistratie-centraal-beheer.md` — **Partial / NO-GO**. Deze follow-up verwijdert bewust het subsystem achter meerdere open restoreblokkades en verandert de status van die voorganger niet.
- Oorspronkelijke urenspec: `opsx/changes/2026-07-30-urenverantwoordingsmodule.md`.
- Huidige primaire raakvlakken:
  - `backend/app/api/work_hours.py`
  - `backend/app/services/work_hours_service.py`
  - `backend/app/repositories/work_hours_repository.py`
  - `backend/app/schemas/work_hours.py`
  - `backend/app/models/entities.py` en `backend/app/models/__init__.py`
  - `backend/app/core/settings.py`
  - `backend/alembic/versions/20260730_0026_work_hours_module.py`
  - `backend/alembic/versions/20260809_0027_central_work_hour_masterdata.py`
  - `backend/tests/test_work_hours_api.py`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/lib/api/client.ts`
  - `backend/app/api/meta.py`, `docs/urenregistratie.md` en `README.md`
- Uren-specifieke JSON-backups staan momenteel onder `${STORAGE_ROOT}/${EXPORTS_DIR}/urenverantwoording/<batch-id>.json`; algemene operationele backups staan buiten deze featuregrens.

### Assumptions
- “Related import provenance” betekent: `work_import_batches`, `work_hour_groups.source_import_batch_id`, importbatchsnapshots/velden, uren-import-/backupauditevents en bijbehorende JSON/tmp-artifacts. Historische identities en legacy project-/postaliases blijven behouden wanneer bestaande uren/auditweergave ze nog gebruikt.
- De actuele Alembic-head vóór deze change is `20260809_0027`; de nieuwe revisie gebruikt die als directe predecessor.
- `EXPORTS_DIR` behoudt zijn bestaande default/configuratie en de migratie draait met dezelfde storageconfiguratie als de applicatie.
- Oude OPSX-specs en historische Alembic-revisies blijven als onveranderde historie bestaan en zijn uitgezonderd van de forbidden-symbolcheck; actuele runtimecode, tests en gebruikersdocs zijn niet uitgezonderd.
- De bestaande operationele backuphelper mag blijven bestaan of generiek worden gemaakt als die database/storagebackup bewijst; hij mag niet langer als product-JSON-backup/importfunctie worden gepresenteerd.
- Success criteria en permanente cleanup zijn door de gebruiker in de opdracht bevestigd; geen aanvullende productkeuze is nodig vóór speccreatie.

## Current status
**Implemented / code-complete — deployment blocked.** Alle code-, documentatie- en onafhankelijke kwaliteitsgates voor deze change zijn groen, inclusief volledige backend- en frontendsets, build, populated migratiedekking, lege Alembic-roundtrip, forbidden-symbol-/diffchecks en finale review (**CODE GO**, geen codebevindingen). Productie-uitrol is nadrukkelijk niet afgerond: het verplichte bewijs van een echte productie database- én storagebackup met lees-/restoreproof, de migratie op productie en de post-migratie smokechecks ontbreken nog. Daarnaast moet de gemengde worktree eerst voor release worden geïsoleerd. De voorganger `2026-08-09-compacte-urenregistratie-centraal-beheer.md` blijft **Partial / NO-GO**.

## What changed
- De uren-specifieke JSON-preview, import, merge, full restore en backupdownload zijn verwijderd uit de UI, API-client en backend. De drie voormalige import-/backuproutes zijn niet meer geregistreerd.
- CSV-export en de afzonderlijke herstelacties voor soft-deleted urenregistraties en externe personen zijn behouden, inclusief hun regressiedekking.
- Alembicrevisie `20260810_0028` verwijdert importbatchprovenance, gerichte import-/backupaudits, de voormalige FK/kolom en `work_import_batches`; JSON/tmp-artifacts worden uitsluitend binnen de veilige urenexportgrens opgeruimd. Onveilige paden en root-, geneste of gebroken directorysymlinks falen vóór destructief werk.
- About/changelog (iteratie 97), `docs/urenregistratie.md`, README en voorbeeldsettings zijn aangepast: de urenpagina biedt geen JSON-backup/import meer; de normale database- en storagebackup blijft de verplichte pre-migratie deployment- en rollbackvoorziening.
- Finale onafhankelijke review gaf **CODE GO** zonder codebevindingen.

## How to verify
- Voer de gerichte en volledige backend- en frontendcommands, `npm run build`, de lege Alembic-roundtrip, forbidden-symbolcheck en `git diff --check` uit **Testing plan** uit. Verwacht respectievelijk `135`, `226`, `92` en `154` passerende tests, een groene build, `alembic roundtrip: ok`, geen forbidden-symboloutput en een schone diffcheck.
- Controleer vóór productie volgens **Productieprocedure en rollback**: een consistente databasebackup én storage-archive, lees-/restoreproof, integriteitschecks, archive listing en checksums. Stop API en worker, migreer, controleer schema/bestanden/CSV/beide individuele herstelacties, start API voor smokechecks en daarna pas de worker.
- Isoleer de release uit de gemengde worktree voordat een deployable release-artefact wordt gemaakt. De voorgangerspec blijft daarbij **Partial / NO-GO**.

## Acceptance-criteria mapping / checklist

- [x] **AC1–4:** UI, clientcontract, routes en runtime zijn verwijderd; gerichte frontend/backendtests en forbidden-symbolcheck zijn groen.
- [x] **AC5–7:** populated migratietests bewijzen schema-, provenance- en begrensde bestandscleanup, behoud van niet-targetdata en fail-before-DDL voor onveilige paden/symlinks; `PRAGMA`-checks slagen in de lege roundtrip.
- [x] **AC8–10:** backendtests bewijzen CSV/list-pariteit in beide sorteerrichtingen en beide individuele restorecontracten; frontendtests bewijzen de behouden herstelbediening.
- [x] **AC11–12:** gerichte regressies en actuele About/docschecks zijn groen; docs-impact is verwerkt in About/changelog, `docs/urenregistratie.md`, README en voorbeeldsettings.
- [ ] **AC13:** de verplichte productiebackup en het ondersteunde rollbackpad zijn gedocumenteerd en de lege roundtrip is groen, maar echte productie database-/storagebackup, lees-/restoreproof en post-migratie smoke zijn niet uitgevoerd.
- [x] **AC14:** targeted/full backend en frontend, frontendbuild, populated migratiedekking, lege Alembic-roundtrip, forbidden-symbolcheck en `git diff --check` zijn groen.

**Follow-ups before deployment:** voltooi AC13-productiebewijs, voer de productieprocedure en post-migratie smokechecks uit, en isoleer de gemengde worktree voor release. Tot dan is deze change niet deployed en niet als volledig afgeronde productie-uitrol te markeren.

## Verification evidence
- FAIL — `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` stopte tijdens collectie met `In test_work_hours_project_and_post_duplicate_create_update_are_controlled: function uses no argument 'participants'`; exitcode 2, geen tests uitgevoerd. Daarnaast alleen bestaande pytest-asyncio/passlib-deprecationwaarschuwingen.
- PASS — de goedgekeurde minimale correctie verwijderde alleen de verweesde `participants`-decorator uit `backend/tests/test_work_hours_api.py`; de eerder gemelde collectiefout verschijnt niet meer.
- FAIL — herhaling van `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` stopte tijdens collectie met `In test_person_picker_returns_all_eligible_active_users_and_external_people: function uses no argument 'user_id'`; exitcode 2, geen tests uitgevoerd. Alleen de bestaande pytest-asyncio/passlib-deprecationwaarschuwingen zijn daarnaast gemeld.
- PASS — de tweede goedgekeurde minimale correctie verwijderde alleen de verweesde `user_id,with_metadata`-decorator uit `backend/tests/test_work_hours_api.py`; de eerder gemelde `user_id`-collectiefout verschijnt niet meer.
- FAIL — de volgende herhaling van `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` stopte tijdens collectie met `In test_external_update_hard_email_uniqueness_and_status_fields_are_controlled: function uses no argument 'endpoint'`; exitcode 2, geen tests uitgevoerd. Alleen de bestaande pytest-asyncio/passlib-deprecationwaarschuwingen zijn daarnaast gemeld.
- PASS — de derde goedgekeurde minimale correctie verwijderde alleen de verweesde `endpoint`-decorator uit `backend/tests/test_work_hours_api.py`; de gerichte set collecteert daarna volledig.
- FAIL — herhaling van `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` → `17 failed, 112 passed, 469 warnings in 63.92s`. De failures zijn: acht bestaande centrale urenmigratie-/downgradeguardcases, zeven uren-API-cases door `TypeError` bij `WorkHoursService.list_meta` of `relink_historical_identity`, `test_remembered_login_persistence_failure_falls_back_to_normal_session`, en `test_about_returns_read_only_payload`. Pytest meldt ook dat de external-update-test nog een `asyncio`-mark heeft terwijl de test synchroon is. Geen verdere commands uitgevoerd wegens de stopregel.
- PASS — na de goedgekeurde gerichte remediation: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` → `129 passed, 471 warnings in 71.57s`. Alleen bestaande pytest-asyncio-configuratie-, passlib/crypt- en python-jose/datetime-deprecationwaarschuwingen; geen failures of collection warnings.
- PASS — na sluiting van de AC6–10/AC12-dekkingsgaten: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` → `132 passed, 517 warnings in 72.68s`. Alleen bestaande pytest-asyncio-configuratie-, passlib/crypt- en python-jose/datetime-deprecationwaarschuwingen.
- PASS — `git diff --check` → geen output, exitcode 0.
- PASS — na NO-GO-migratieveiligheidsremediation: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` → `135 passed, 520 warnings in 77.04s`. Alleen bestaande pytest-asyncio-configuratie-, passlib/crypt- en python-jose/datetime-deprecationwaarschuwingen.
- PASS — `git diff --check` na NO-GO-remediation → geen output, exitcode 0.
- PASS — `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → `2 passed` testfiles, `92 passed` tests in `8.27s` (urenpagina: 15 tests; App: 77 tests).
- PASS — `cd frontend && npm run build` → TypeScript/Vite-build groen, 96 modules, build in `1.14s`; alleen de bestaande niet-blokkerende Vite chunk-sizewaarschuwing voor de 515.13 kB JS-bundle.
- PASS — forbidden-symbolcheck uit het testplan (`! rg -n ... backend/app backend/tests frontend/src docs README.md`) → geen output, exitcode 0.
- PASS — afsluitende `git diff --check` → geen output, exitcode 0.
- PASS (statische inventaris, geen kwaliteitsgate) — gerichte forbidden-symbolzoekopdrachten vonden geen matches in `backend/app`, `backend/tests`, `frontend/src` en `docs` voor de symbols uit het testplan; de volledige shellcheck is wegens de stopregel niet uitgevoerd.
- PASS — laatste onafhankelijke gerichte backendrun: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_meta_and_me.py tests/test_admin_api.py -q` → **135 passed**. De populated migratie/FK/filecleanup-, route-404/zero-write-, CSV-pariteit- en recordrestoredekking maakt deel uit van deze run.
- PASS — laatste onafhankelijke volledige backendrun: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest` → **226 passed**.
- PASS — laatste onafhankelijke gerichte frontrun: `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → **92 passed** in 2 testbestanden.
- PASS — laatste onafhankelijke volledige frontrun: `cd frontend && npm test -- --run` → **154 passed**.
- PASS — `cd frontend && npm run build` → TypeScript/Vite-productiebouw groen.
- PASS — populated migratiesafety/cleanup is groen in de gerichte backendset; de lege Alembic upgrade → downgrade `20260809_0027` → upgrade-roundtrip uit **Testing plan** is groen met `alembic roundtrip: ok`, `PRAGMA integrity_check = ok`, lege `foreign_key_check`, geen `work_import_batches` en geen `source_import_batch_id`.
- PASS — forbidden-symbolcheck uit **Testing plan** → geen output; `git diff --check` → geen output, exitcode 0.
- PASS — finale onafhankelijke review: **CODE GO**, geen codebevindingen.
- NOT PERFORMED / deployment blocker — echte productie database- én storagebackup met lees-/restoreproof, productie-migratie en post-migratie smokechecks zijn niet uitgevoerd. De gemengde worktree is nog niet voor release geïsoleerd.

---
Status: implemented / code-complete — deployment blocked
Owner: —
Date: 2026-08-10
