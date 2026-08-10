# Urenregistratie beheren

## Registreren en filteren

- Open **Urenverantwoording** en gebruik de permanent zichtbare bovenste tabelrij.
- Kies datum, project, globale post, duur en omschrijving. Open **deelnemer(s)** om meerdere gebruikers of externe personen toe te voegen; daar kan ook direct een externe persoon worden aangemaakt.
- Gebruik de filters in de kolomkoppen om waarden te zoeken, te selecteren of per kolom te wissen. **Alle filters wissen** herstelt het actieve ongefilterde overzicht.
- De totalen en CSV-export gebruiken altijd precies dezelfde filters; CSV exporteert alle treffers en niet alleen de zichtbare pagina.

## Centrale masterdata

- Beheer algemene projecten uitsluitend via **Admin > Projecten**. Alleen actieve, niet-gearchiveerde projecten zijn voor nieuwe uren selecteerbaar; historische registraties blijven zichtbaar.
- Beheer urenposten/categorieën onder **Admin > Projecten > Globale urenposten / categorieën**. Een actieve post is bij ieder selecteerbaar project beschikbaar.
- Alleen admins kunnen projecten en posten aanmaken, wijzigen, archiveren of herstellen.

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
