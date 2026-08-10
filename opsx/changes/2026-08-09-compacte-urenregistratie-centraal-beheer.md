# Title
Compacte Excel-achtige urenregistratie met centraal beheer

## Context
De bestaande urenverantwoordingsmodule uit `opsx/changes/2026-07-30-urenverantwoordingsmodule.md` is als MVP afgerond. De module ondersteunt al groepsregistraties, deelnemers en externe personen, historie/audit, CSV-export, JSON-backup/import, restore, soft delete, totalen en server-side filtering. De huidige invoer opent echter in een modal, het overzicht gebruikt relatief veel ruimte en project- en postmasterdata staat op de urenpagina.

Daarnaast heeft de urenmodule eigen `work_projects` en projectgebonden `work_posts`, terwijl de applicatie al algemene `projects` beheert via **Admin > Projecten**. Dit veroorzaakt dubbel beheer en maakt posten onnodig afhankelijk van een project. Deze change maakt de algemene projecten leidend, maakt posten/categorieën globaal en verplaatst het beheer naar Admin. Registreren en filteren wordt een compacte, Excel-achtige tabelervaring zonder verlies van bestaande urendata of beheerwaarborgen.

## Goals / Non-goals
### Goals
- Laat urenregistraties rechtstreeks verwijzen naar de bestaande algemene `projects` uit **Admin > Projecten**.
- Vervang projectgebonden urenposten door één globale, gededupliceerde posten-/categorieënlijst die bij ieder actief project selecteerbaar is.
- Beperk project- en postenbeheer tot Admin; verwijder deze masterdatacontrols van de urenpagina.
- Vervang modalgebaseerde creatie door een permanent zichtbare, bewerkbare bovenste tabelrij met alle bestaande create-mogelijkheden, inclusief groepen/deelnemers en externe personen.
- Voeg compacte Excel-achtige filterdropdowns toe in toepasselijke kolomkoppen, met zoeken, selecteren en resetten.
- Maak overzicht, totalen en rijacties aantoonbaar compacter, met behoud van toegankelijkheid en responsive gedrag.
- Behoud bestaande uren, historische weergave, audit, CSV-export, backup/import, restore en soft-deletegedrag.
- Documenteer een deterministische, vooraf testbare migratie van `work_projects` naar `projects` en van projectgebonden `work_posts` naar globale posten.

### Non-goals
- Geen herontwerp van rollen, autorisatie of ownershipregels.
- Geen approval-, planning- of publicatieworkflows.
- Geen wijzigingen aan andere functionele modules, behalve waar het bestaande centrale projectbeheer of de About/changelog-vermelding direct geraakt wordt.
- Geen nieuwe urenfunctionaliteit zoals tarieven, facturatie, start/eindtijden of notificaties.
- Geen hard delete als normaal beheerpad en geen verlies van audit- of historiegegevens.

## Proposed approach
### 1. Doelmodel en compatibiliteitsgrens
- `WorkHourGroup.project_id` verwijst na de migratie naar `projects.id`; `WorkProject`/`work_projects` is niet langer actieve masterdata.
- `WorkPost` blijft urenmasterdata, maar verliest `project_id`. De globale canonieke uniekheidsregel is de genormaliseerde postnaam, niet langer `(project_id, name)`.
- Normalisatie voor migratie en toekomstige uniqueness is overal gelijk: Unicode-normalisatie, trimmen, interne whitespace tot één spatie reduceren en Unicode-casefold. De zichtbare naam behoudt de gekozen broncapitalisatie.
- Voeg duurzame legacy-aliasmapping toe voor iedere oude `work_project.id` en `work_post.id`. Daarmee kunnen audit/historie en oudere backupformaten naar de nieuwe IDs worden vertaald zonder stille heuristiek.
- Verhoog het urenbackupformaat. Nieuwe backups slaan algemene projectreferenties en globale posten op. De bestaande vorige formaatversie blijft importeerbaar via dezelfde alias- en normalisatieregels.
- Full restore verwijdert of overschrijft geen algemene projecten, omdat die gedeelde applicatiemasterdata zijn. Een restore vereist een eenduidige bestaande project-ID/alias/naam-mapping; een ontbrekende of ambigue koppeling levert een veilige preflightfout op voordat urenmoduledata wijzigt.

### 2. Deterministische projectmigratie
Voor iedere oude `WorkProject`, in stabiele volgorde op `created_at`, daarna `id`:
1. Match eerst een algemeen `Project` met exact dezelfde zichtbare naam.
2. Zonder exacte match: match alleen wanneer precies één algemeen project dezelfde genormaliseerde naam heeft.
3. Zonder match: maak één algemeen project aan met de oude naam en beschrijving, een lege invited-userlijst en de omgerekende actieve/gearchiveerde staat. Leg in de aliasmapping vast dat dit project door de migratie is gemaakt.
4. Bij meerdere genormaliseerde kandidaten zonder exacte match: stop de preflight/migratie zonder writes en rapporteer oude project-ID, naam en kandidaat-IDs. Er wordt nooit op “eerste resultaat” gekoppeld.
5. Schrijf voor iedere oude project-ID een alias naar de algemene project-ID en wijzig daarna alle `WorkHourGroup.project_id`-referenties via deze mapping.

Een bestaand algemeen project blijft leidend: de migratie overschrijft daarvan geen naam, beschrijving, leden of status. Historische uren blijven ook zichtbaar wanneer het algemene project later inactief/gearchiveerd is; alleen nieuwe selectie volgt de bestaande projectselecteerbaarheid.

### 3. Deterministische globale postmigratie
1. Groepeer alle oude `WorkPost`-records op de hierboven vastgelegde genormaliseerde postnaam, onafhankelijk van project.
2. Kies per groep de canonieke bron deterministisch: eerst actief/selecteerbaar, dan niet-gearchiveerd, dan niet-soft-deleted, vervolgens oudste `created_at`, en ten slotte lexicografisch kleinste `id`.
3. Gebruik de ID, zichtbare naam en eerste niet-lege beschrijving uit diezelfde stabiele rangorde voor de globale post.
4. De globale post is actief wanneer minimaal één bronrecord actief/selecteerbaar is. Als geen bron actief is, blijft de canonieke post historisch/inactief volgens de toestand van de hoogst gerangschikte bron; verwijderde bronvarianten blijven via aliases en audit herkenbaar.
5. Schrijf voor ieder oud post-ID een alias naar het canonieke globale post-ID en koppel iedere `WorkHourGroup.post_id` om. Verschillende oude posten met dezelfde genormaliseerde naam worden dus bewust één globale post.
6. De migratie valideert vóór commit dat iedere groep exact één geldige algemene projectreferentie en globale postreferentie krijgt, en dat group-, participant-, audit- en soft-deletetellingen niet onverwacht wijzigen.

### 4. API/services en UI
- Gebruik één canonical filtercontract voor lijst, totalen en CSV. Filterwijzigingen vanuit kolomkoppen resetten serverpaging naar pagina 1; CSV exporteert alle matches en niet alleen de zichtbare pagina.
- Behoud bestaande uren-API-routes waar mogelijk; wijzig schemas zodat projecten algemene projectopties zijn en posten globaal zijn. Legacy backup/import wordt expliciet geconverteerd, niet stil geaccepteerd met oude semantiek.
- Voeg globale posten toe aan Admin naast het bestaande projectbeheer. Alle muterende project- en postbeheeracties blijven backend-side admin-only.
- Render bovenaan de urentabel altijd één create-rij met datum, algemeen project, globale post, omschrijving, duur, deelnemers en opslaan/annuleren. Deelnemersselectie ondersteunt dezelfde eligible users, groepen en externe-personen-quick-add als de bestaande createflow; voor creatie opent geen registratieformuliermodal.
- Plaats filtertriggers in de toepasselijke kolomkoppen (datum, project, post, persoon/deelnemer, type en vrije zoektekst waar die al onderdeel van het contract is). Iedere dropdown ondersteunt filterwaarde zoeken, selecteren/toepassen en lokaal resetten; er blijft ook één “alle filters wissen”-actie.
- Gebruik compacte totalencards, tabelpadding en iconische rijacties met toegankelijke namen/tooltips. Een ingeklapte desktopdataregel is doelbewust maximaal 44 px hoog en de create-rij maximaal 56 px, behalve wanneer validatiefeedback of een deelnemer-/quick-addpaneel bewust is uitgeklapt.

## Implementation steps (ordered)
1. **Inventarisatie en migratie-fixtures**
   - Leg huidig schema, endpointschemas, backupformaat en Admin-projectcontract vast.
   - Maak representatieve fixtures voor exacte matches, unieke genormaliseerde matches, ontbrekende projecten, ambigue projectnamen, duplicate posten over projecten, archived/deleted masterdata en bestaande groups/participants/audit.
2. **Migratiepreflight en mappingcontract**
   - Implementeer één pure/deterministische mappinglaag volgens deze spec en laat die vóór schemawrites een mapping-/conflictrapport produceren.
   - Test determinisme, idempotentie, countbehoud en afwijzing zonder partial writes.
3. **Datamodel en Alembic-migratie**
   - Koppel urenregistraties aan `projects`, maak posten globaal, voeg uniqueness/constraints en legacy-aliasmappings toe en migreer bestaande data transactioneel.
   - Voeg een downgrade toe die vóór nieuwe post-migratiewrites de oude relaties uit aliases/snapshots kan reconstrueren; gebruik voor productie-rollback na live writes de verplichte pre-migratiebackup.
4. **Backend API, services, export en import**
   - Pas list/meta/create/update/masterdata, selecteerbaarheid, totalen en CSV aan op algemene projecten en globale posten.
   - Versioneer backup/export en ondersteun het vorige projectgebonden backupformaat via expliciete conversie en preflight.
   - Behoud soft delete, restore, optimistic concurrency en append-only audit; audit de oude en nieuwe referenties bij migratie-/beheerhandelingen waar van toepassing.
5. **Centraal Adminbeheer**
   - Gebruik het bestaande **Admin > Projecten** als enige projectbeheerplek.
   - Voeg admin-only beheer voor globale posten/categorieën toe, inclusief zoeken, aanmaken, wijzigen, archiveren/herstellen en historische zichtbaarheid volgens bestaande patronen.
6. **Compacte urenpagina**
   - Verwijder project-/postmasterdatapanelen en de create-modaltrigger van de urenpagina.
   - Bouw de permanent zichtbare create-rij met volledige groeps-, deelnemer- en externe-personenfunctionaliteit en toegankelijke inlinevalidatie/focusafhandeling.
   - Bouw kolomkopfilters en maak totalen, tabeldichtheid en acties compact zonder mobiele cards of keyboardbediening te breken.
7. **Regressietests en documentatie**
   - Voeg backend migratie/API/import/exporttests en frontend uren/Admin-tests toe.
   - Werk admin-/gebruikersdocumentatie bij indien aanwezig of voeg een gerichte urenbeheerpagina toe als die ontbreekt.
   - Voeg conform repositorybeleid een end-user-friendly About/changelog-regel toe over centrale projecten, globale posten en sneller inline uren registreren.
8. **Volledige verificatie en evidence**
   - Voer eerst gerichte checks uit, daarna de volledige backend/frontendsets, build, schone upgrade en rollback/roundtripproof.
   - Leg exacte outputs onder **Verification evidence** vast en zet de status alleen op Completed wanneer alle acceptance criteria zijn afgevinkt.

### NO-GO review remediation (approved 2026-08-09)
De onafhankelijke review heeft de change nog niet releasebaar verklaard. De gebruiker heeft de volgende begrensde herstelstappen expliciet goedgekeurd; deze stappen vullen de bestaande implementatiestappen aan zonder productscope te verbreden:

1. **Historische restoreselecteerbaarheid scheiden**
   - Laat import/full restore resolvabele historische groepen met inactieve/gearchiveerde algemene projecten of posten toe, ook wanneer de groep zelf actief was in de backup.
   - Houd create/update strikt op actuele selecteerbaarheid; voeg een archived-project/post format-3 roundtripregressie toe.
2. **Downgrade-writeguard en FK-veiligheid**
   - Leg een volledige migratiebaseline vast voor groups, participants en globale posten en weiger downgrade vóór reconstructie wanneer IDs, relevante waarden, row versions of aantallen na migratie zijn gewijzigd.
   - Dek nieuwe/bewerkte groepen, participantwijzigingen en globale post create/edit/archive/restore direct af.
   - Maak alias-FKs consistent en bewijs dat SQLite failure vóór destructieve downgrade-DDL plaatsvindt; productie na live writes blijft pre-migratiebackup-restore.
3. **Mobiele createpariteit**
   - Bied op mobiel een altijd zichtbare volledige createkaart met dezelfde datum/project/post/duur/omschrijving/deelnemers/quick-add/opslaan/reset-mogelijkheden; verberg nooit de enige createflow.
4. **Historische namen**
   - Bewaar en resolve project-/postweergavenamen via duurzame aliases/snapshots voor audit- en historieweergave; toon geen kale IDs wanneer een stabiele snapshot bestaat.
5. **Create-a11y en reset**
   - Gebruik stabiele error-IDs en `aria-describedby`, focus het werkelijk eerste ongeldige veld, wis elke veldfout bij geldige herinvoer en reset na succes of handmatige reset alle gecontroleerde en ongecontroleerde createvelden/deelnemers/panelen.
6. **Historische en datumveilige filters**
   - Vul filterwaardelijsten aan vanuit huidige resultaten/historische metadata naast selecteerbare meta-opties.
   - Gebruik voor datum een date-control zonder ongeldige tekst-doorvoer of dubbele conflicterende invoer.
7. **History-kindcontract**
   - Verwijder `kind=project` end-to-end uit urenhistory wanneer algemene projecten daar niet worden beheerd; schema/API/UI/client/tests moeten hetzelfde contract voeren.
8. **Premigratiebackupbewijs**
   - Documenteer exacte backup-, leesbaarheids-, restore- en controlecommands en voeg waar praktisch een uitvoerbare SQLite backup/restoreproof toe.
9. **Regressiedekking herstellen**
   - Dek minimaal mobile create, reset/a11y, archived restore, historische filters/namen, downgradeguards, import-UI en geraakte edit/delete/restoreflows gericht af.
10. **Werktree-isolatie**
   - Wijzig of revert geen reeds aanwezige wijzigingen buiten deze change. Noteer expliciet dat onder meer audio-transcriptie- en eerdere UI/specwijzigingen niet tot deze change behoren.

Remediation is pas inhoudelijk gereed wanneer alle bovenstaande gerichte tests slagen. De change blijft `Partial` totdat een latere onafhankelijke `opsx-test` en `opsx-review` de volledige suites, losse migratiecommands en releasecriteria opnieuw hebben beoordeeld.

### Goedgekeurde frontend-verificatiefollow-up (2026-08-09)
- Herstel de drie niet-unieke testselectors door desktop- en mobiele create-oppervlakken via hun toegankelijke form/sectiecontext te benaderen; assertions mogen niet worden afgezwakt.
- Voeg gerichte regressiedekking toe voor volledige mobiele creatie, gecontroleerde reset na succes en handmatige reset, veldgekoppelde foutmeldingen/eerste-foutfocus, historische filters/auditnamen, import preview/commit en de geraakte edit-/soft-delete-/restoreflows.
- Repareer alleen echte productdefecten die deze tests aantonen en die binnen remediationcriteria 3–9 vallen.
- Draai daarna de gerichte frontend uren-/Admintests en direct geraakte backendtests. Houd de status `Partial` totdat latere onafhankelijke volledige verificatie en review slagen.
- De gebruiker heeft vervolgens ook de strikt begrensde testharnascorrectie goedgekeurd: wacht in de vier geraakte tests op `Project A` binnen het bedoelde desktop-/mobiele select voordat `p1` wordt gekozen, en controleer de importtextarea via zijn werkelijke stringwaarde in plaats van een niet-ondersteunde asymmetrische `toHaveValue`-matcher. Productcode en gedragsassertions blijven ongewijzigd.
- De gebruiker heeft ook de vijf daarna zichtbare expectationmismatches goedgekeurd: scope participantcontrols en dubbele fouttekst naar de bedoelde surface, behoud de veldkoppelingassertion, accepteer expliciet React Query's tweede mutation-contextargument en valideer importpreview volgens de echte clientsignature `(payload, mode)`. Dit is uitsluitend een testharnascorrectie; productgedrag en dekkingssterkte mogen niet veranderen.
- De gebruiker heeft ten slotte de enige frontend-buildblocker begrensd goedgekeurd: corrigeer uitsluitend de vijf test-TypeScriptfouten waarbij `Element` aan helpers voor `HTMLElement` wordt doorgegeven, met runtime-veilige/nauwe DOM-typing die de verwachte structuur blijft bewijzen. Geen brede casts en geen productcodewijzigingen; draai daarna de gerichte urentest en `npm run build`.

### Goedgekeurde finale NO-GO-remediation (2026-08-09)
1. **Lossless format-3 aliasroundtrip**
   - Versioneer/breid de format-3 aliasrepresentatie achterwaarts compatibel uit met optionele `legacy_snapshot_json` en, voor postalises waar van toepassing, de legacy projectreferentie die nodig is om historische namen eenduidig te reconstrueren.
   - Exporteer en herstel deze metadata transactioneel met de overige full-restoredata. Bestaande format-3 payloads zonder de nieuwe optionele velden blijven geldig en importeerbaar.
   - Voeg een volledige backup→full_restore-regressie toe waarin oude audit legacy project-/post-IDs na restore opnieuw de oorspronkelijke pre-migratienamen tonen en niet als kale IDs eindigen.
2. **Volledige create-/quick-addreset**
   - Zowel succesvolle create als handmatige reset wist de desktop- en mobiele quick-addforms, `selectedUserId`, `selectedExternalPersonId`, deelnemers, fouten, uitgeklapte panelen/duplicate-state en alle hoofdvelden op beide create-oppervlakken.
   - Voeg regressies toe met onopgeslagen quick-addwaarden en gewijzigde gecontroleerde participantselectors op de relevante desktop-/mobiele surfaces; assertions bewijzen zowel succesreset als handmatige reset.
3. **Releasegrens**
   - Draai gerichte backend backup/restore/audittests, gerichte frontend-urentests en daarna de frontendbuild. Houd de status `Partial` voor latere onafhankelijke volledige verificatie/review.
4. **Goedgekeurde auditregressiecorrectie**
   - Vraag het specifieke roundtrip-event op via het bestaande filter `action=work_hours.group.legacy_reference`, zodat nieuwere importauditregels de fixture niet uit de standaard eerste pagina drukken.
   - Behoud ongewijzigd de inhoudelijke assertions dat alias-snapshots na backup/full restore de oorspronkelijke pre-migratie project- en postnamen opleveren; wijzig geen productgedrag tenzij de gefilterde API een echte fout aantoont.
5. **Goedgekeurde fixture-lifecyclecorrectie**
   - Bouw aliases, audit-event en service-roundtrip op via dezelfde bestaande `get_db` dependency override als de `client`-fixture en sluit die sessie via de bijbehorende generatorlifecycle.
   - Laat de gefilterde API-request daardoor dezelfde testdatabase lezen; behoud alle metadata- en oorspronkelijke-naamassertions en wijzig geen productcode.
6. **Goedgekeurde desktop resetcorrectie**
   - Voeg aan de desktop WindWilly-user- en externe-persoonselects toegankelijke lege placeholderopties toe, gelijkwaardig aan mobiel, zodat controlled state `""` na succes- en handmatige reset ook zichtbaar leeg rendert.
   - Behoud participant-addvalidatie, keyboardbediening en de strikte resetregressies; wijzig verder geen productgedrag.

### Goedgekeurde restore-/selectie-edgecases (2026-08-09)
1. **Canonieke post-ID bij format-3 full restore**
   - Behoud bij `backup_version=3` plus `full_restore` iedere aangeleverde globale post-ID exact, onafhankelijk van bestaande huidige posten met dezelfde genormaliseerde naam.
   - Preflight vóór destructieve writes alle group-project/postreferenties en alle project-/postaliastargets tegen de uiteindelijke restore-targetset. Een onopgeloste alias is een verklaarde 422 zonder domain writes; nooit stil overslaan.
   - Regressie: backup bevat post A/`Werk`; de huidige database hernoemt A en bevat B/`Werk`; full restore herstelt A als canonieke ID en laat groepen/aliases naar A wijzen met lossless snapshots.
   - Behoud bestaande formaat-1/2-conversie en niet-full-restore/interactive importsemantiek.
2. **Expliciete externe-persoonselectie**
   - Wanneer `selectedExternalPersonId` leeg is (initieel of na reset), voegt desktop of mobiel geen eerste actieve externe persoon impliciet toe.
   - Regressies bewijzen initieel, mobiel en na reset dat toevoegen pas na expliciete selectie effect heeft; bestaande validatie/no-op blijft toegestaan.
3. **Release-isolatie**
   - Deze follow-up wijzigt uitsluitend restore/preflight, expliciete externe selectie, bijbehorende tests en deze spec. Reeds aanwezige audio/OpenAI/topic/AppShell/andere specwijzigingen blijven onaangeraakt; niet reverten, niet committen en niet pushen.
4. **Gerichte verificatie**
   - Draai eerst backend restoretests en frontend urentests, daarna gecombineerde backend/frontend-targetsets en de frontendbuild. Onafhankelijke volledige verificatie/review blijft een latere gate.
5. **Goedgekeurde stale-testcorrectie**
   - Selecteer in de bestaande multi-participanttest expliciet externe persoon `ep1` in de surface-scoped desktopselect vóór “Externe toevoegen”. Behoud de exacte payloadassertions voor zowel user `u2` als external `ep1`; wijzig geen productgedrag of dekkingssterkte.

## Acceptance criteria
1. **Algemene projecten**: gegeven bestaande uren met `work_projects`, levert de migratie voor iedere registratie exact één geldige `projects.id` op; nieuwe en gewijzigde registraties accepteren alleen selecteerbare algemene projecten uit **Admin > Projecten**.
2. **Deterministische projectmapping**: exacte en unieke genormaliseerde matches worden volgens de vastgelegde volgorde gekoppeld, ontbrekende matches maken één algemeen project en ambigue genormaliseerde matches stoppen vóór writes met een conflict waarin alle kandidaat-IDs staan.
3. **Globale posten**: posten met dezelfde genormaliseerde naam over twee of meer projecten resulteren in exact één globale post en zijn daarna voor ieder selecteerbaar algemeen project te kiezen.
4. **Posthistorie en aliases**: iedere oude post-ID en project-ID heeft een eenduidige alias; alle bestaande groepen, soft-deleted groepen en historische/auditweergaven tonen na migratie de correcte project- en postnaam.
5. **Inline volledige creatie**: de urenpagina toont zonder actie altijd een bewerkbare bovenste tabelrij. Een gebruiker kan daarin datum, project, post, omschrijving, duur en één of meer deelnemers kiezen, een externe persoon quick-adden en de groepsregistratie opslaan zonder create-modal.
6. **Validatie en herstelbaarheid create-rij**: ongeldige of incomplete invoer geeft Nederlandse, veldgekoppelde inlinefeedback zonder ingevoerde geldige waarden te verliezen; succesvolle opslag leegt/reset de create-rij en ververst lijst en totalen.
7. **Excel-achtige kopfilters**: ieder toepasselijk kolomfilter kan via de header worden geopend, doorzocht, geselecteerd/toegepast en afzonderlijk gereset; “alle filters wissen” herstelt de ongefilterde actieve dataset en filterwijzigingen resetten paging naar pagina 1.
8. **Querypariteit**: voor iedere afzonderlijke en gecombineerde headerfilterset bevatten lijst en CSV dezelfde matching registratie-IDs in dezelfde canonical sortering, bevat CSV alle matches onafhankelijk van paging en zijn total groups/people/group hours/person-hours exact over diezelfde gefilterde basis berekend.
9. **Centraal beheer**: de urenpagina bevat geen project- of postenbeheeracties. Projectbeheer staat alleen onder **Admin > Projecten** en globale postenbeheercontrols zijn alleen in Admin zichtbaar; directe muterende beheer-API-calls door niet-admins blijven 403.
10. **Compactheid**: op desktop zijn ingeklapte datarijen maximaal 44 px en de niet-uitgeklapte create-rij maximaal 56 px hoog; totalen en rijacties gebruiken geen afzonderlijke ruime beheerpanelen. Toegankelijke namen, keyboardbediening en bestaande mobiele cards blijven bruikbaar.
11. **Databehoud**: vóór/na een migratieroundtrip zijn aantallen en inhoud van groups, participants, verwijderstatussen, row versions en urenwaarden gelijk, behalve de expliciet gemapte project-/postreferenties; append-only auditregels gaan niet verloren of worden niet herschreven.
12. **Import/export en restore**: een nieuwe-format backup roundtript zonder dataverlies; het vorige projectgebonden backupformaat wordt deterministisch geconverteerd of vóór writes met een verklaarde conflictmelding afgewezen. Full restore overschrijft of verwijdert geen gedeelde algemene projecten.
13. **Rollbackbewijs**: een pre-migratiebackup wordt verplicht gedocumenteerd/getest; upgrade → downgrade → upgrade op een verse representatieve SQLite-database is reproduceerbaar. Als na upgrade nieuwe live writes bestaan, is databasebackup-herstel het gedocumenteerde productie-rollbackpad.
14. **Documentatie**: de About/changelog bevat één gebruikersgerichte regel en relevante admininstructies beschrijven dat projecten centraal en posten globaal worden beheerd.

### Aanvullende releasecriteria uit NO-GO review
- Full restore roundtript archived/inactive project-/posthistorie zonder selecteerbaarheid voor nieuwe create/update te versoepelen.
- Downgrade weigert aantoonbaar vóór destructieve reconstructie na iedere ondersteunde post-migratiewrite, met een verklaarde backup-herstelmelding.
- Desktop én mobiel hebben steeds een volledige create-oppervlakte; createfouten en resets voldoen aan de veld/focuscriteria hierboven.
- Historische filters en audit/history tonen snapshotnamen, datumfilters sturen alleen geldige ISO-datums en `kind=project` is geen ondersteund urenhistorycontract meer.
- Exacte pre-migratiebackup/read/restorecommands en gerichte regressietests zijn aanwezig; onafhankelijke full verification blijft een afzonderlijke releasegate.

## Testing plan
### Gerichte tests
- Backend migratie-/mappingtests: exacte/unieke/nieuwe/ambigue projectmapping, globale postdeduplicatie, aliases, archived/deleted historie, counts, transactionele rollback en upgrade/downgrade/upgrade.
- Backend API/service-tests: algemene projectselecteerbaarheid, globale posten voor ieder project, admin-only masterdata, create/update, list/totals/CSV-pariteit en oude/nieuwe backup-import.
- Frontend uren-tests: permanente create-rij, groep/deelnemers/externe quick-add, inlinevalidatie, kopfilters, reset/paging, compacte rijacties, keyboard/a11y en afwezigheid van masterdatabeheer.
- Frontend Admin-tests: bestaand projectbeheer blijft werken en globale posten kunnen uitsluitend door Admin worden beheerd.

### Exact intended verification commands
```bash
# Gerichte backend uren-, migratie- en Admin-API-tests
cd backend
STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_admin_api.py -q

# Gerichte frontend uren- en Admin-tests
cd frontend
npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx

# Volledige backendset
cd backend
STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest

# Volledige frontendset en TypeScript/Vite-productiebouw
cd frontend
npm test -- --run
npm run build

# Schone migratie; de implementatie voegt een gerichte roundtripfixture/test toe
cd backend
tmp=$(mktemp -d)
export DATABASE_URL="sqlite:///$tmp/compacte-uren.db"
export STORAGE_ROOT="$tmp/storage"
mkdir -p "$STORAGE_ROOT"
.venv/bin/alembic upgrade head
.venv/bin/alembic downgrade -1
.venv/bin/alembic upgrade head

# Repositorybrede whitespacecontrole
cd ..
git diff --check
```
- Als de uiteindelijke migratie niet de enige nieuwe Alembic-revisie na de huidige head is, vervang `downgrade -1` in het evidencecommando door de expliciet gedocumenteerde vorige revisie.
- Er is geen afzonderlijk lintscript in `frontend/package.json` en geen backendlinter in `backend/pyproject.toml`; `npm run build`, pytest en `git diff --check` zijn daarom de nu discoverable canonical checks. Voeg geen toolingdependency toe binnen deze change alleen om een lintcommando te creëren.

## Risk + rollback plan
### Risico's en mitigaties
- **Verkeerd gekoppelde gelijknamige projecten**: exacte match gaat voor genormaliseerde match; ambiguïteit stopt vóór writes en vereist expliciete datacorrectie.
- **Onbedoelde postdeduplicatie**: normalisatie en winnerselectie zijn vastgelegd; iedere bron-ID blijft via een alias traceerbaar en fixtures bewijzen de mapping.
- **Gedeelde projectdata beschadigen**: bestaande algemene projecten worden niet door migratiegegevens overschreven en full restore beheert ze niet als urenmoduledata.
- **Historie/import breekt door gewijzigde IDs**: duurzame aliases, een versioned backupformaat en legacy preflight/conversietests zijn verplicht.
- **Filterdrift tussen UI, totalen en CSV**: alle drie gebruiken één backend querycontract en krijgen paritytests met gecombineerde filters.
- **Compactheid schaadt toegankelijkheid**: compacte targets gelden alleen voor ingeklapte desktopweergave; labels, focus, keyboardflow, inlinefouten en mobiele cards blijven acceptance gates.

### Rollback
1. Maak vóór productie-upgrade een consistente database- en storagebackup en verifieer dat deze leesbaar is.
2. Bij migratiefout: rol de transactie volledig terug; alias- en schemawijzigingen mogen niet gedeeltelijk zichtbaar zijn.
3. Vóór nieuwe writes kan de geteste Alembic-downgrade de projectgebonden structuur uit alias-/migratiesnapshots reconstrueren.
4. Na nieuwe writes onder de globale-postsemantiek: stop writers en herstel de pre-migratie database-/storagebackup. Een automatische downgrade mag nieuwe globale data niet stil dupliceren of aan willekeurige projecten koppelen.
5. Draai na rollback de gerichte uren-API-tests en controleer handmatig een actieve, historische en soft-deleted registratie plus CSV-export.

## Notes / links
- Bronspec: `opsx/changes/2026-07-30-urenverantwoordingsmodule.md` (Status: Completed (MVP), 2026-08-04).
- Relevante huidige bestanden:
  - `backend/app/models/entities.py` (`Project`, `WorkProject`, `WorkPost`, `WorkHourGroup`)
  - `backend/app/services/work_hours_service.py`
  - `backend/app/schemas/work_hours.py`
  - `backend/alembic/versions/20260730_0026_work_hours_module.py`
  - `backend/tests/test_work_hours_api.py`
  - `backend/tests/test_admin_api.py`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.tsx`
  - `frontend/src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx`
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/lib/api/client.ts`
- Repositorycommands zijn afgeleid uit `README.md`, `backend/pyproject.toml` en `frontend/package.json`.

### Assumptions
- “Posten/categorieën” gebruikt in code en API voorlopig de bestaande domeinnaam `WorkPost`/`post`; deze change vereist geen terminologiebrede rename.
- Algemene projecten zijn de bestaande records in `projects` en het bestaande tabblad **Admin > Projecten** blijft de enige projectbeheerinterface.
- Een oude `WorkProject` zonder algemene match moet als algemeen project worden aangemaakt om historische uren zonder handmatige datavulling te behouden.
- Gelijke genormaliseerde postnamen betekenen bewust dezelfde globale categorie; verschillen in omschrijving leiden niet tot meerdere globale posten maar blijven via legacy aliases/audit traceerbaar.
- Externe-personen-quick-add blijft beschikbaar vanuit registratie, terwijl volledig masterdatabeheer Admin-only blijft; dit is bestaand registratiegedrag en geen autorisatiewijziging.
- Bestaande edit-, delete-, restore- en historiedetailflows mogen hun huidige modal/paneelpatroon behouden; alleen creatie moet volledig vanuit de permanente bovenste rij werken.
- Full restore blijft urenmodulegebonden en mag daarom algemene projecten niet verwijderen of overschrijven.
- Exacte testnamen voor de nieuwe migratierevisie zijn nog niet discoverable; de bestaande canonieke testbestanden en uitvoercommando's zijn wel vastgelegd.

## Current status
**Partial / NO-GO (finalized 2026-08-10).** De gebruiker heeft expliciet gekozen de resterende bevindingen niet te herstellen. Deze change mag niet worden vrijgegeven of als Completed worden gemarkeerd. Gerichte regressies zijn grotendeels groen, maar de hieronder vastgelegde functionele en handmatige verificatieblokkades blijven open. De gemengde worktree moet vóór een eventuele release bovendien worden geïsoleerd.

## What changed
- Een pure, Unicode-NFKC/casefold-gebaseerde migratieplanner en Alembic-revisie `20260809_0027` koppelen oude urenprojecten deterministisch aan algemene projecten, maken ontbrekende algemene projecten, stoppen ambigue mappings vóór writes, dedupliceren posten globaal en bewaren project-/postaliases plus rollback-groepssnapshots.
- `WorkHourGroup.project_id` gebruikt algemene `projects`; `WorkPost` is globaal met `normalized_name`-uniqueness. De downgrade reconstrueert oude post/projectreferenties vóór nieuwe writes en weigert veilig wanneer post-migratiewrites worden aangetroffen.
- Backend meta/create/update/list/totals/CSV gebruiken centrale projecten en globale posten. De canonical query bevat ook een deelnemersnaamfilter; CSV bevat registratie-IDs en exporteert dezelfde volledige sortering/filterbasis.
- Backupformaat 3 bewaart algemene projectreferenties, globale posten en aliases. Formaten 1/2 worden vooraf deterministisch geconverteerd; full restore schrijft of verwijdert geen algemene projecten.
- De urenpagina heeft een permanente inline create-rij, uitklapbare meervoudige deelnemerskeuze en externe-personen-quick-add, Nederlandse veldfouten, compacte totalen/icoonacties en zoekbare/selecteerbare/resetbare kolomkopfilters. Project-/postbeheer is van de urenpagina verwijderd.
- Globale posten staan in het bestaande Admin-tabblad Projecten met zoeken, aanmaken, wijzigen, archiveren en herstellen; centrale projecten blijven daar beheerd.
- About kreeg iteratie 96 en `docs/urenregistratie.md` plus README-link documenteren gebruik, centraal beheer, backups en rollback.
- Tests zijn vernieuwd voor deterministische mapping, gevulde upgrade→downgrade→upgrade, globale posten/admin-only API, inline creatie, quick-add, kopfilters, querypariteit en Adminbeheer.
- Goedgekeurde verificatie-follow-up: pas uitsluitend `test_about_returns_read_only_payload` aan zodat iteratie 96 als nieuwste verplichte changelogentry wordt gevalideerd; productgedrag blijft ongewijzigd.
- De follow-up is uitgevoerd in `backend/tests/test_meta_and_me.py`: de test controleert nu iteratie-ID `96`, de nieuwe titel en de gebruikersgerichte Admin-highlight. Er is geen productcode gewijzigd voor deze follow-up.
- NO-GO reviewbevindingen 1–10 zijn als goedgekeurde, begrensde remediationstappen en aanvullende releasecriteria in deze spec vastgelegd; applicatiewijzigingen voor deze remediation volgen pas hierna.
- Werktree-isolatie: reeds aanwezige audio-transcriptie-, OpenAI-, topic-, eerdere AppShell- en andere specwijzigingen zijn geen onderdeel van deze change en worden niet gewijzigd of teruggedraaid.
- De per-write downgradeguardregressie en de bestaande gevulde migratieroundtrip zijn weer als afzonderlijke tests opgebouwd; een tijdens testuitbreiding onbedoeld gesplitste testbody is hersteld zonder productcode te wijzigen.
- De gebruiker heeft de gerichte frontend-verificatiefollow-up expliciet goedgekeurd: toegankelijke surface-specifieke selectors en ontbrekende regressies voor mobiel, reset/a11y, historische weergave/filters, import en edit/delete/restore worden toegevoegd zonder assertions af te zwakken.
- De frontend-urentest bevat nu gerichte scenario's voor volledige mobiele create/quick-add/succesreset, handmatige cross-surface reset, veldgekoppelde fout-IDs en eerste-invalidfocus, historische filterfacets en audit-snapshotnamen, format-3 import preview/commit en edit/soft-delete/restore. De eerste run toont uitsluitend testharnascorrecties die nog nodig zijn: wachten totdat async meta-opties werkelijk in de bedoelde select staan en de textarea-inhoud rechtstreeks als string controleren.
- De strikt begrensde harnascorrectie is uitgevoerd met een surface-scoped `waitForSelectOption` helper en een directe `HTMLTextAreaElement.value`-controle. Deze vijf oorspronkelijke failures zijn niet teruggekeerd; productcode is niet gewijzigd.
- De vijf daarna goedgekeurde expectationmismatches zijn surface-specifiek gecorrigeerd: desktop participantcontrols worden vanuit hun uitgeklapte editor benaderd, de desktop postfout wordt via `aria-describedby` en het stabiele error-ID bewezen, mutationpayloads accepteren expliciet React Query-context en importpreview valideert `(payload, mode)`. Alle gedragsassertions zijn behouden; hiervoor is geen productcode gewijzigd.
- De frontend-buildblocker is uitsluitend in de urentest opgelost met `closestHTMLElement`: de helper controleert runtime dat het verwachte ancestor-element werkelijk een `HTMLElement` is en geeft anders een gerichte fout. Daarmee verdwijnen de vijf `Element`→`HTMLElement` typefouten zonder non-null assertion, brede cast of productcodewijziging.
- Format-3 aliases exporteren nu achterwaarts compatibele string-of-snapshotwaarden. Nieuwe projectaliassnapshots bewaren target, `migration_created_project` en `legacy_snapshot_json`; postaliassnapshots bewaren target, legacy projectreferentie en `legacy_snapshot_json`. Prepare/restore resolveert beide vormen en werkt aangeleverde metadata binnen dezelfde importtransactie bij.
- Create-reset wist nu ook beide quick-addforms en de gecontroleerde user-/external-selectiestate; automatische herselectie is verwijderd en mobiele selectors hebben een expliciete lege optie. De succes- en handmatige-resettests zijn uitgebreid met onopgeslagen desktop-/mobiele quick-addvelden en gewijzigde participantselectors, maar zijn na de backend-stop nog niet uitgevoerd.
- De desktop user- en externe-persoonselects hebben nu dezelfde toegankelijke lege placeholderopties als mobiel. Daardoor rendert de controlled lege state na succes- en handmatige reset werkelijk leeg; participant-add en keyboardgedrag blijven via gewone native selects behouden.
- Format-3 full restore is nu mode-aware: het bewaart aangeleverde canonieke post-IDs exact, gebruikt voor deze restore uitsluitend aangeleverde aliases, en preflight group-/aliastargets vóór destructieve writes. Een ontbrekend postalistarget geeft 422 en wordt ook in commit nooit stil overgeslagen; formaat-1/2 en merge blijven de bestaande normalisatie/conversie volgen.
- Externe deelnemers worden niet langer impliciet uit de eerste actieve persoon gekozen wanneer de controlled selectie leeg is. Desktop, mobiel en post-reset vereisen expliciete selectie; de nieuwe regressie hiervoor slaagt.
- De bestaande multi-participanttest selecteert nu expliciet `ep1` binnen de desktop participanteditor voordat toevoegen wordt geklikt en behoudt de exacte payloadassertions voor user `u2` en external `ep1`.
- Finalisatie: About-iteratie 96, `docs/urenregistratie.md` en de README-link voor centraal projectbeheer, globale posten, backup en rollback zijn reeds opgeleverd. Voor deze finalisatie zijn geen applicatiecode of tests gewijzigd.
- Niet opgelost op expliciete gebruikerskeuze: format-3 full restore vervangt de volledige `WorkProjectLegacyAlias`-staat niet exact; een stale `selectedExternalPersonCandidate` kan een lege of afwijkende expliciete selectie overschrijven; directe commitpaden voor onoplosbare project-, post- en groepsreferenties missen zero-write-regressies.

## How to verify
- `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_admin_api.py -q`
- `cd frontend && npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx`
- `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest`
- `cd frontend && npm test -- --run && npm run build`
- De gevulde migratieroundtrip draait als `test_populated_work_hours_migration_upgrade_downgrade_upgrade_preserves_rows`; voer daarnaast vóór completion het losse schone Alembic-commando uit het Testing plan uit.
- `cd .. && git diff --check`
- Voor de goedgekeurde minimale About-testfollow-up: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_meta_and_me.py::test_about_returns_read_only_payload -q`. Volledige suites worden bewust pas in `opsx-test` opnieuw uitgevoerd.
- Voor een eventuele vervolgchange: los eerst alle NO-GO-bevindingen op, herhaal daarna de gerichte backend/frontend-opdrachten, de volledige backend- en frontendsets, `npm run build`, de schone Alembic upgrade→downgrade→upgrade-proef en `git diff --check`. Voer ook handmatige browser- en screenreaderchecks voor compactheid en toegankelijkheid uit in een geïsoleerde release-worktree.

## Verification evidence
- PASS — gerichte NO-GO backendselectie: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'format3_full_restore or downgrade_refuses or meta_filter_facets or history_rejects or audit_and_alias or pre_migration_sqlite_backup or populated_work_hours_migration' --maxfail=3` → `13 passed, 82 deselected, 14 warnings in 10.91s`.
- FAIL — gerichte frontend-urentest: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `4 passed, 3 failed`. De drie failures zijn testambiguïteiten door de bedoelde gelijktijdige desktop-/mobiele create-oppervlakken: twee `findByRole("option", { name: "Project A" })`-selectors vinden beide projectopties en `findByText("Nieuwe externe")` vindt zowel de desktop- als mobiele deelnemersweergave. Productexceptions of API-fouten zijn in deze run niet gerapporteerd; de selectors en aanvullende regressiedekking moeten gericht worden bijgewerkt voordat verificatie doorgaat.
- FAIL — eerste uitgebreide frontend-follow-uprun: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `8 passed, 5 failed`. Vier failures proberen `p1` te selecteren nadat het bedoelde selectelement bestaat maar voordat de async meta-optie is gerenderd; de tests moeten binnen die surface op de optie wachten. De importtest gebruikt `toHaveValue(expect.stringContaining(...))`, wat jest-dom niet ondersteunt ondanks dat de ontvangen textarea aantoonbaar `"backup_version": "3"` bevat; controleer hiervoor de DOM-stringwaarde rechtstreeks. De nieuwe historical/audit- en edit/delete/restoretests slagen al. Geen productdefect of API-exception is in deze run aangetoond.
- FAIL — frontendrun na de goedgekeurde vijf harnascorrecties: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `8 passed, 5 failed` in `6.69s`. De oorspronkelijke ontbrekende-option- en textarea-matcherfouten zijn opgelost. Nu zichtbaar: twee desktop participant-selectors matchen door Testing Library labelnormalisatie ook het mobiele label; één fouttekstselector vindt terecht de veldmelding op beide surfaces; twee API-mockassertions houden geen rekening met de echte aanroepvorm (`createWorkHourGroup(payload, React Query context)` en `previewWorkHoursImport(payload, mode)`). De ontvangen mobile-createpayload bevat aantoonbaar beide deelnemers en alle verwachte velden, en de ontvangen previewcall bevat format 3 plus `full_restore`. Dit zijn aanvullende harnasasserties, geen aangetoonde productdefecten. Volgens de stopregel zijn de gecombineerde frontend- en backendcommands niet gedraaid.
- PASS — frontend uren na alle goedgekeurde harnascorrecties: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `13 passed` in `3.89s`.
- PASS — gecombineerde gerichte frontend uren-/Adminset: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → `2 test files passed`, `90 passed` in `7.68s`.
- PASS — gerichte backend NO-GO-remediatieset opnieuw uitgevoerd: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'format3_full_restore or downgrade_refuses or meta_filter_facets or history_rejects or audit_and_alias or pre_migration_sqlite_backup or populated_work_hours_migration' --maxfail=3` → `13 passed, 82 deselected, 14 warnings in 11.97s`. Alleen bestaande pytest-asyncio/passlib/python-jose deprecationwaarschuwingen.
- REMAINING RELEASE GATE — geen gerichte failures meer. Onafhankelijke volledige backend/frontendsets, losse migratiecommands en review blijven volgens afspraak voor latere `opsx-test`/`opsx-review`; daarom blijft de status `Partial`.
- DIAGNOSTIC FAIL / RESOLVED — eerste `npm run build` voor deze follow-up stopte met exact vijf `TS2345`-fouten in `UrenverantwoordingPage.test.tsx` (regels 74–76 en 165–166): `Element` was niet toewijsbaar aan `HTMLElement`. Dit bevestigde de begrensde blocker; Vite startte toen nog niet.
- PASS — urentest na veilige DOM-narrowing: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `13 passed` in `3.66s`.
- PASS — frontendproductiebouw na veilige DOM-narrowing: `npm run build` → TypeScript project build en Vite-build geslaagd, `96 modules transformed`, voltooid in `1.19s`. Alleen de bestaande waarschuwing voor de minified JS-chunk van `518.51 kB` (>500 kB); geen buildfouten.
- REMAINING RELEASE GATE — de enige frontend-buildblocker is opgelost; onafhankelijke eindreview/finalisatie blijft volgens afspraak voor later en de status blijft `Partial`.
- FAIL — eerste gerichte finale backendrun: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'format3 or backup_full_restore or audit_and_alias' --maxfail=3` → `3 passed, 1 failed, 92 deselected, 7 warnings in 1.84s`. In de nieuwe test slagen alle export- en full-restoreassertions voor project/post `legacy_snapshot_json`, `migration_created_project`, post `legacy_project_id` en bestaande string-only format-3 import. Alleen `next(...)` op de standaard eerste auditpagina faalt: preview/commit voegde genoeg nieuwere auditregels toe om het oudere custom event buiten de eerste 25 te plaatsen. Voorgestelde gerichte correctie: vraag het event via de bestaande `action=work_hours.group.legacy_reference` filter op en behoud de project-/postnaamassertions. Volgens de stopregel zijn frontend uren/build nog niet gedraaid.
- FAIL — rerun na goedgekeurde actionfilter: hetzelfde gerichte commando → `3 passed, 1 failed, 92 deselected, 7 warnings in 1.85s`. De request `GET /api/urenverantwoording/audit?action=work_hours.group.legacy_reference` retourneert 200 maar geen fixture-event. Onderzoek toont dat `_service_session()` een afzonderlijke in-memory SQLite-engine maakt, terwijl `client` via zijn eigen `get_db` override een andere testdatabase gebruikt; het endpoint kan het in de eerste database aangemaakte event dus nooit zien. Aliasexport/-restoreassertions blijven vóór dit punt slagen. Benodigde volgende harnascorrectie: laat service en gefilterd endpoint in deze regressie dezelfde client-fixturedatabase gebruiken, zonder inhoudelijke naamassertions of productcode te wijzigen. Volgens de stopregel zijn full targeted backend, frontend en build niet gedraaid.
- PASS — gerichte alias/restore/audit na gedeelde fixture-session: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'format3 or backup_full_restore or audit_and_alias' --maxfail=3` → `4 passed, 92 deselected, 7 warnings in 1.77s`. De gefilterde API ziet nu hetzelfde event en retourneert na full restore exact `Oorspronkelijk project` en `Oorspronkelijke post`.
- PASS — volledige gerichte backend uren-/Adminset: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` → `127 passed, 546 warnings in 67.78s`. Alleen bestaande pytest-asyncio/passlib/python-jose deprecationwaarschuwingen.
- FAIL — gecombineerde gerichte frontend uren-/Adminset: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → `88 passed, 2 failed` (`1 failed | 1 passed` test files) in `7.35s`. Beide failures zijn dezelfde echte resetdefectvariant: na succesreset en handmatige reset is de mobiele gecontroleerde userselect leeg, maar de opnieuw geopende desktop `WindWilly-persoon`-select toont `u1` omdat die desktopselect geen `<option value="">` bevat. De snelle invoervelden, overige state en backendgedrag falen niet. Benodigde minimale productcorrectie binnen het goedgekeurde resetcriterium: voeg lege placeholderopties toe aan beide desktop participantselects, gelijk aan mobiel, en behoud de lege controlled state. Volgens de stopregel is `npm run build` niet uitgevoerd.
- PASS — gecombineerde gerichte frontend uren-/Adminset na desktopplaceholdercorrectie: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → `2 test files passed`, `90 passed` in `7.29s`. Beide succes-/handmatige-resetregressies bewijzen lege desktop/mobile selectors en gewiste quick-addvelden.
- PASS — frontendproductiebouw: `npm run build` → TypeScript en Vite geslaagd, `96 modules transformed`, build in `1.13s`. Alleen de bestaande chunk-sizewaarschuwing voor `518.64 kB` minified JS (>500 kB).
- READY — geen bekende gerichte failures meer; deze change is gereed voor de afgesproken onafhankelijke volledige verificatie/review, maar blijft tot die gate `Partial`.
- PASS — gerichte backend restore/alias-edgecases: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'format3 or backup_full_restore or audit_and_alias' --maxfail=3` → `5 passed, 92 deselected, 7 warnings in 1.82s`. Dit omvat A/`Werk` versus huidige B/`Werk`, exact herstel van A voor post/group/alias, lossless snapshots en unresolved-alias 422 zonder domain writes.
- FAIL — gerichte frontend urentest: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `13 passed, 1 failed` in `5.45s`. De nieuwe desktop/mobile/post-reset expliciete-selectietest slaagt. Alleen de bestaande test “creates a group with multiple participants” klikt nog “Externe toevoegen” zonder eerst `ep1` te kiezen en verwacht daardoor ten onrechte de verwijderde fallback. Benodigde gerichte testcorrectie: selecteer `ep1` in de reeds surface-scoped desktop externe-persoonselect vóór de klik; behoud daarna exact de payloadassertion met user `u2` én external `ep1`. Volgens de stopregel zijn gecombineerde backend/frontendcommands en build nog niet uitgevoerd.
- PASS — gerichte frontend urentest na stale-testcorrectie: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `14 passed` in `4.40s`.
- PASS — gecombineerde gerichte frontend uren-/Adminset: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → `2 test files passed`, `91 passed` in `7.62s`.
- PASS — volledige gerichte backend uren-/Adminset inclusief restore-edgecases: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py tests/test_admin_api.py -q` → `128 passed, 546 warnings in 68.55s`. Alleen bestaande pytest-asyncio/passlib/python-jose deprecationwaarschuwingen.
- PASS — frontendproductiebouw: `npm run build` → TypeScript en Vite geslaagd, `96 modules transformed`, build in `1.13s`. Alleen de bestaande waarschuwing voor de `518.64 kB` minified JS-chunk (>500 kB).
- READY — geen bekende gerichte blockers; onafhankelijke volledige verificatie/review blijft volgens afspraak de volgende gate en de status blijft daarom `Partial`.
- PASS — gerichte backend uren-/Adminset: `114 passed, 532 warnings`.
- PASS — gerichte frontend uren-/Adminset: `84 passed`.
- PASS — volledige frontendset: `146 passed`.
- PASS — `npm run build`; TypeScript en Vite-productiebouw voltooid, alleen de bestaande chunk-sizewaarschuwing (>500 kB).
- PASS — gevulde SQLite upgrade→downgrade→upgrade regressietest, inclusief behoud van group, participant, row versions, referenties en aliastellingen.
- PASS — backup/full-restore- en legacy-conversietests binnen `test_work_hours_api.py`; nieuwe format-3 roundtrip en veilige centrale-projectgrens slagen in de gerichte set.
- PASS — `git diff --check` zonder output.
- HISTORICAL FAIL — de eerdere volledige backendset gaf `228 passed, 1 failed` doordat `test_about_returns_read_only_payload` nog iteratie 95 als eerste entry verwachtte; deze stale verwachting is nu gericht gecorrigeerd, maar de volledige suite is volgens opdracht niet opnieuw gedraaid.
- PASS — goedgekeurde gerichte follow-up: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_meta_and_me.py::test_about_returns_read_only_payload -q` → `1 passed, 2 warnings in 0.62s`.
- NOT RUN — losse schone Alembic-commandogroep na de laatste migratie-env-aanpassing; de equivalente gevulde programmatische roundtrip slaagt wel.
- NOT RUN — handmatige browser-/screenreadercontrole van 44px/56px-layout; CSS-targets en frontend-interactietests zijn aanwezig.
- Follow-up voor `opsx-test`: draai volledige backend, losse schone Alembic-roundtrip, frontendset/build en `git diff --check` opnieuw. Zet pas daarna status op Completed.

### Final verification record and acceptance status (2026-08-10)
- **Latest targeted evidence (reliable):** backend `tests/test_work_hours_api.py tests/test_admin_api.py -q` → **128 passed**; frontend `UrenverantwoordingPage.test.tsx` plus `App.test.tsx` → **91 passed**; remediation-specifieke backendselectie → **13 passed**. De laatste gerichte frontend-build slaagde; deze gerichte resultaten lossen de hieronder genoemde bevindingen niet op.
- **Earlier independent full evidence (not final evidence for the latest edge fixes):** volledige backend → **242 passed**; volledige frontend → **152 passed**; frontendbuild, schone Alembic-proef en `git diff --check` slaagden. Deze runs vonden plaats vóór de laatste edge-fixes en mogen dus niet als finale volledige verificatie worden geclaimd.
- **Latest reviewer observation:** volledige frontend → **153 passed**, `npm run build` en `git diff --check` slaagden. De volledige backendset voltooide niet binnen **300 s**. Er is daarom geen geslaagde, actuele volledige backendverificatie.
- **AC-status:** AC1, AC2, AC3, AC5, AC7, AC8, AC9, AC11 en AC14 zijn geïmplementeerd en door gerichte of eerder onafhankelijke evidence ondersteund. AC13 heeft eerdere roundtrip-/Alembic-evidence, maar vereist vóór release opnieuw een schone, actuele verificatie. **AC4 is Partial** (format-3 full restore herstelt `WorkProjectLegacyAlias` niet exact); **AC6 is Partial** (stale `selectedExternalPersonCandidate` kan de expliciete selectie overrulen); **AC10 is Partial** (handmatige browser-/screenreaderchecks voor compactheid/a11y ontbreken); **AC12 is Partial** (directe commitpaden missen zero-write-regressies voor onoplosbare project-, post- en groepsreferenties, naast de alias-state-afwijking).
- **NO-GO blockers / follow-ups:** (1) maak format-3 aliasrestore lossless voor de volledige `WorkProjectLegacyAlias`-staat; (2) laat alleen de actuele expliciete externe-persoonselectie de payload bepalen; (3) voeg directe commit-path zero-write-regressies toe voor onoplosbare project-, post- en groepsreferenties; (4) voer handmatige browser- en screenreaderchecks uit; (5) isoleer de gemengde worktree, inclusief niet-gerelateerde audio/OpenAI/topic/AppShell/specwijzigingen, vóór release; (6) voer daarna alle volledige gates opnieuw uit. Geen commit of push is uitgevoerd.
- **Final status:** **Partial / NO-GO**. Niet Completed.

---
Status: Partial / NO-GO
Owner: (optional)
Date: 2026-08-10
