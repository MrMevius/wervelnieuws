# Urenregistratie beheren

## Registreren en overzicht houden

- Open **Urenregistratie** en kies **Uren registreren**. Nieuwe en bestaande registraties krijgen een los formulier; de lijst is uitsluitend het overzicht.
- Kies een werkdatum, begintijd, duur, één project en minimaal één persoon. Een post/categorie en beschrijving zijn optioneel. Datum en begintijd zijn lokale tijden in **Europe/Amsterdam**. Een werkdatum in de toekomst is niet toegestaan; de duur mag over middernacht lopen en hoort bij de gekozen werkdatum.
- Registreer van **1 minuut tot 24 uur per persoon**. Vul bijvoorbeeld `7` minuten of `1,5` uur in, of gebruik een snelkeuze. Komma en punt worden ondersteund bij uren. Alleen hele minuten worden opgeslagen, zonder afronden naar halve uren. Wisselen van eenheid verandert de duur niet.
- Kies één of meer personen met de keuzevakjes; bij nieuwe registraties ben je zelf alvast geselecteerd wanneer je selecteerbaar bent. Bij veel personen verschijnt een zoekveld. Nieuwe deelnemers zijn actieve, selecteerbare WindWilly-gebruikers. Bestaande historische deelnemers blijven behouden bij het bewerken.
- De duur geldt voor iedere deelnemer. Onderaan staat steeds de berekening: **30 minuten × 3 personen = 1,5 persoon-uur**. De knop **Registratie opslaan** blijft zichtbaar, ook op een telefoon. Bij fouten blijft de invoer staan; sluiten met niet-opgeslagen wijzigingen vraagt bevestiging.
- Het overzicht toont datum en begintijd, werk/project, personen en duur. De nieuwste werkdatum staat bovenaan; binnen dezelfde datum komt de nieuwste begintijd eerst. Oudere registraties zonder tijd tonen **Tijd niet vastgelegd**.
- Zoek op inhoud of filter op project en werkdatum. Het totaal boven de lijst omvat de volledige selectie, niet alleen de huidige pagina. **Per project** toont de totalen uitgesplitst per project voor diezelfde selectie. Onder de lijst kun je pagineren en het aantal registraties per pagina kiezen.
- **CSV export** exporteert alle registraties binnen de huidige filters, met één rij per deelnemer. De oorspronkelijke kolommen blijven behouden; begintijd en exacte duur in minuten zijn toegevoegd. Gebruik de minutenkolom wanneer de duur niet exact in decimale uren uit te drukken is.

### Upgrade naar minutenregistratie

Migratie `20260910_0032` (vanaf `20260909_0031`) rekent elke bestaande duur exact om: `duration_minutes = duration_half_hours × 30`. Bestaande datums, projecten, posten, deelnemers en auditregels blijven behouden. Begintijden worden niet verzonnen en blijven voor oude registraties leeg. Posten zijn voortaan optioneel.

Maak vóór deze upgrade een database- en storageback-up en stop de API en worker tijdens de omzetting. Controleer daarna de schema-versie, integriteit, oorspronkelijke registraties en exports voordat writers opnieuw starten. De API accepteert nog het oude veld `duration_half_hours` als alternatief voor `duration_minutes`, maar nooit beide tegelijk. Bij een duur die geen veelvoud van 30 is, is het oude responseveld `null`.

Een downgrade weigert als die een ingevulde begintijd, een registratie zonder post of een exacte minutenduur zou verliezen. Herstel bij een rollback de geverifieerde back-up en bijbehorende release; een downgrade mag nooit tijden afronden of een post verzinnen.

## Centrale masterdata

- Beheer algemene projecten uitsluitend via **Admin > Projecten**. Alleen actieve, niet-gearchiveerde projecten zijn voor nieuwe uren selecteerbaar; historische registraties blijven zichtbaar.
- Beheer urenposten/categorieën onder **Admin > Projecten > Globale urenposten / categorieën**. Een actieve post is bij ieder selecteerbaar project beschikbaar.
- Alleen admins kunnen projecten en posten aanmaken, wijzigen, archiveren of herstellen.
- Alleen admins kunnen externe personen aanmaken via **Admin > Urenhistorie en identiteiten > Externe persoon aanmaken**. Daar zijn naam, optioneel e-mailadres en een optionele notitie beschikbaar; beheer en historische weergave blijven beschikbaar, maar externe personen zijn niet selecteerbaar voor nieuwe urenregistraties.

## Historie en audit

- Beheerders vinden **Urenhistorie en identiteiten** en **Uren-audit** als afzonderlijke tabs in **Admin**.
- De dagelijkse urenpagina toont geen overzicht of herstelactie voor verwijderde registraties meer.

## Operationele backup en rollback

- De urenpagina heeft geen eigen JSON-backup of import. Gebruik CSV alleen voor rapportage; CSV kan niet worden teruggezet.
- Individueel herstellen van een soft-verwijderde urenregistratie of externe persoon blijft beschikbaar voor admins.
- Maak vóór de upgrade die het oude urensubsystem opruimt verplicht een leesbare database- én storagebackup. Stop API en worker eerst en start writers pas nadat migratie, schema, bestanden, CSV en beide individuele herstelacties zijn gecontroleerd.
- De cleanup verwijdert oude importprovenance en uren-JSON-/tmp-bestanden permanent. Een Alembic-downgrade reconstrueert die data en bestanden niet; herstel database en storage samen uit de geverifieerde pre-migratiebackup.

### Verplicht pre-migratiebewijs (SQLite productie)

Stop eerst API en worker zodat de database en storage niet wijzigen. Voer vanuit de repositoryroot uit, met de echte paden ingevuld:

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "backups/$stamp"
python backend/scripts/verify_work_hours_backup.py \
  "data/wervelnieuws.db" \
  "backups/$stamp/wervelnieuws.pre-uren.db" \
  "backups/$stamp/wervelnieuws.restore-proof.db"
tar -C "data" -czf "backups/$stamp/storage.pre-uren.tar.gz" "storage"
python -c 'import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"; print("backup readable: ok")' \
  "backups/$stamp/wervelnieuws.pre-uren.db"
tar -tzf "backups/$stamp/storage.pre-uren.tar.gz" >/dev/null
sha256sum "backups/$stamp/wervelnieuws.pre-uren.db" "backups/$stamp/storage.pre-uren.tar.gz" \
  > "backups/$stamp/SHA256SUMS"
```

Het Python-script is een operationele helper voor de volledige database, niet voor een import in de urenpagina. Het maakt de databasebackup met SQLite's online-backup-API, opent de backup opnieuw, herstelt die naar een afzonderlijk proofbestand, draait `PRAGMA integrity_check` op alle drie en vergelijkt aantallen plus inhoudshashes van de relevante tabellen. Bewaar de JSON-uitvoer en `SHA256SUMS` als deploymentbewijs.

Productierestore na post-migratiewrites:

```bash
# writers blijven gestopt
cp "data/wervelnieuws.db" "data/wervelnieuws.failed-$stamp.db"
cp "backups/$stamp/wervelnieuws.pre-uren.db" "data/wervelnieuws.db"
rm -rf "data/storage"
tar -C "data" -xzf "backups/$stamp/storage.pre-uren.tar.gz"
python -c 'import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"; print("restore integrity: ok")' "data/wervelnieuws.db"
```

Start daarna eerst de API zonder worker, controleer een actieve, historische en verwijderde urenregistratie, CSV en individueel herstel van een testgroep en externe persoon, en start pas daarna de worker.
