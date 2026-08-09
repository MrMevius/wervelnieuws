# Title
Urenverantwoordingsmodule: vervang placeholderroute met volledige urenregistratie

## Context
De placeholderroute `/urenverantwoording` wordt vervangen door een volledige urenverantwoordingsmodule binnen de bestaande applicatieshell. Route, menuplaatsing, header, layout en theme blijven gelijk; alleen de inhoud en ondersteunende API/database-logica veranderen.

De bestaande repo-conventies blijven leidend: React + TypeScript frontend, FastAPI backend, SQLAlchemy/Alembic, native modals/forms/tables, globale CSS, append-only audit, `User.is_admin`/`require_admin`, SQLite-first met PostgreSQL-migratievriendelijk ontwerp.

Deze spec maakt de module expliciet, testbaar en volledig: groepsregistraties, project/post-masterdata, personenbeheer, CSV-export, JSON-backup/import, audit, soft delete, restore, autorisatie, foutafhandeling en beheerfuncties.

## Goals / Non-goals
### Goals
- Vervang de placeholderroute door een werkende urenmodule in dezelfde shell.
- Ondersteun groepsregistraties met één of meer personen.
- Laat een actieve ingelogde gebruiker urenregistraties maken, bewerken en soft-deleten, ook voor een andere persoon.
- Voeg adminbeheer toe voor projects, posts, personen, audit, backup/import en restore.
- Implementeer CSV-export en backup/import met preview, conflictcontrole en rollback-bescherming.
- Leg alle mutaties vast in een append-only audittrail.
- Houd de interface volledig Nederlands en timezone-correct.

### Non-goals
- Geen approval-, draft- of publicatieworkflow.
- Geen billing, tarieven, geldbedragen, payroll, kilometerregistratie, start/eindtijden of dagelijkse caps.
- Geen e-mail- of interne notificaties.
- Geen externe accounting- of payrollkoppelingen.
- Geen default/sample/seed data in migraties.
- Geen individuele participant-detailbewerkingsflow als aparte losse UI; participantwijzigingen lopen via groepsbewerking.
- Geen harde verwijdering van gebruikte urenregistraties, projects, posts of personen via gewone UI/API-acties. De technisch afgeschermde full-restore-transactie mag uitsluitend urenmodule-rows vervangen om de backup exact te herstellen.
- Geen hard delete van deelnemers via gewone UI/API-acties; uitsluitend full restore mag deelnemers technisch vervangen, inclusief eerder verwijderde deelnemers.
- Geen redesign van shell, theme of algemene app-architectuur buiten deze module.

## Functional requirements
1. Registreren van uren als groepsregistratie met datum, project, post, beschrijving, duur en 1+ deelnemers.
2. Eénpersoonssave moet direct overzicht, totalen en detailweergave updaten.
3. Groepsregistraties tonen compact als één rij; uitklappen toont alle deelnemers.
4. Groepduur geldt voor de volledige groep; person-hours = duur × aantal deelnemers.
5. Wijziging in duur, deelnemers, project, post of beschrijving schrijft een nieuwe versie/auditregel.
6. Participant add/remove is toegestaan binnen de groepsbewerking en wordt apart geaudit.
7. Een normale User mag registraties maken, wijzigen en soft-deleten, ook wanneer de registratie aan een andere persoon gekoppeld is.
8. Admin beheert project- en post-masterdata, personen, restore, audit en import/export.
9. Project/post-selecties zijn afhankelijke masterdata; posts zijn alleen te kiezen binnen hun project.
10. Gearchiveerde of gedeactiveerde masterdata blijft historisch zichtbaar.
11. CSV-export bevat exact minimaal deze kolommen en volgorde: `datum; naam persoon; type persoon (WindWilly-gebruiker/extern); project; post; aantal uren; beschrijving; aangemaakt door; aangemaakt op; laatst gewijzigd door; laatst gewijzigd op`.
12. In v1 worden geen extra CSV-kolommen toegevoegd tenzij expliciet goedgekeurd.
13. Backup/import werkt alleen voor de urenmodule en ondersteunt preview, merge en full restore.
14. Full restore vervangt/pakt alleen urenmodule-data; andere app-data blijft buiten scope.
15. Historische identiteit-snapshots worden opgeslagen voor ontbrekende users.
16. Import/export, audit en masterdata zijn admin-only waar expliciet benoemd.
17. Alle UI is volledig Nederlands.
18. Timestamps worden in UTC opgeslagen en in Europe/Amsterdam getoond.
19. Default lijstgrootte is 25; beschikbare page sizes zijn 25, 50 en 100.
20. Sorteerbare keys zijn: datum, naam persoon, type persoon, project, post, aantal uren, aangemaakt op, laatst gewijzigd op.

## Non-functional requirements
- Performance: overzicht, totalen en export moeten server-side gefilterd en gepagineerd zijn.
- Accessibility: toetsenbordbediening, focus management, semantische alternatieven voor grafieken en modals.
- Security: endpoint-autorisatie, CSRF voor cookie-auth waar van toepassing, inputvalidatie, CSV-injectionpreventie en uploadlimieten.
- Consistency: dezelfde filters moeten identiek werken in overview, tabel, totalen, export en import-preview.
- Traceability: alle mutaties zijn herleidbaar via audit en immutabele snapshots.
- Reliability: preview mag nooit stilzwijgend overschrijven; conflicten worden zichtbaar afgewezen.

## Gebruikersrollen- en rechtenmatrix
| Actie | User | Admin |
|---|---:|---:|
| Overzicht/filters bekijken | ja | ja |
| Urenregistratie maken/bewerken/soft-deleten | ja | ja |
| Registratie voor andere persoon muteren | ja | ja |
| Groepsdeelnemers toevoegen/verwijderen | ja | ja |
| Externe persoon quick-add | ja | ja |
| Externe persoon volledige masterdata beheren | nee | ja |
| Project aanmaken/wijzigen/archiveren | nee | ja |
| Post aanmaken/wijzigen/archiveren | nee | ja |
| Soft-deleted registratie herstellen | nee | ja |
| CSV-export | ja | ja |
| Backup/download | nee | ja |
| Import/restore/merge | nee | ja |
| Audit inzien | nee | ja |
| Direct API-call naar masterdata/audit/import | geweigerd | toegestaan |
| Gewone hard-deleteactie op moduledata | nee | nee |
| Technische row replacement binnen bevestigde full restore | nee | ja, uitsluitend via import/restore-service |

## Gebruikersflows
1. **Eén persoon registreren**: gebruiker kiest datum, project, post, duur en één deelnemer; save werkt direct door naar overzicht en totalen.
2. **Groepsregistratie**: gebruiker maakt of bewerkt één groep, voegt meerdere deelnemers toe en ziet de compacte groepsrij met uitklapdetails.
3. **Externe persoon quick-add**: gebruiker of admin zoekt, ziet duplicate-waarschuwingen, bevestigt bewust en maakt de persoon direct selecteerbaar.
4. **Masterdata beheren**: admin maakt project/post aan, archiveert of herstelt; gebruikte masterdata kan niet hard worden verwijderd.
5. **Import/restore**: admin uploadt backup/import, ziet preview en conflicten, downloadt pre-import backup, bevestigt en voert merge/full restore uit.
6. **Restore soft-deleted groep**: admin opent deleted-items, herstelt de groep en daarmee alle bijbehorende deelnemers.
7. **Historische identiteit**: import treft ontbrekende user aan, maakt historische snapshot, optioneel relink naar live user blijft auditeerbaar.

## Proposed approach
1. Ontwerp een uren-domein met expliciete entities, UUID-sleutels, indexes, soft delete/archivering en historiserende snapshots.
2. Bouw services/repositories voor groepsregistratie, aggregatie, export, backup/import, restore en audit.
3. Gebruik de bestaande auth-patronen; voeg per endpoint expliciete server-side checks toe.
4. Vervang de placeholderroute door een volledige modulepagina in dezelfde shell.
5. Voeg adminbeheer toe voor masterdata, deleted items, audit en import/export.
6. Gebruik een JSON backup/import-envelope met stabiele IDs en conflictvrije reconciliation-regels.
7. Verifieer met de standaard repo-commands; in deze specfase worden geen runtime tests uitgevoerd.

### Smalle closure-remediation (approved, reopened 2026-08-04)
- Beperk deze reopening tot twee open verificatieblokkades: de terugkerende `VergaderbordenPage` toolbar-Tab-focusregressie en één schone Alembic+SQLite-FK-proof.
- Repareer de toolbar met de kleinst mogelijke compatibele frontendwijziging. De toolbar blijft zichtbaar zolang focus binnen de volledige update-editor-shell staat en verdwijnt pas wanneer focus die shell verlaat, voor zowel **Nieuwe update** als **Update bewerken**.
- Behoud de bedoelde accessibility-semantiek: wijzig geen toegankelijke namen, rollen, tabvolgorde, focusbaarheid, keyboardbediening of focus-returncontracten en maak geen toolbarcontrol onbereikbaar om de test groen te krijgen.
- Wijzig geen urenmodule-, backend-, migratie- of datamodelcode voor de toolbarrepair en neem geen andere Vergaderborden-UX mee.
- Herhaal de SQLite-proof vanaf een aantoonbaar lege tijdelijke database. Exporteer `DATABASE_URL` en `STORAGE_ROOT` in dezelfde shell vóór Alembic én vóór ieder proofsubprocess, zodat alle subprocessen exact dezelfde schrijfbare storage en database gebruiken.
- Voer eerst de twee gerichte verificaties uit en daarna de volledige frontendtestset, frontendbuild, gerichte backend-FK-tests en volledige backendset. Bestaande unrelated worktreewijzigingen blijven onaangeroerd.

### Expliciete contradiction resolutions (goedgekeurd)
- **Ontbrekende users**: een ontbrekende `live_user`-referentie met voldoende, eenduidige snapshotmetadata wordt tijdens import/full restore geconverteerd naar of gekoppeld aan een `WorkHistoricalUserIdentity`. Alleen een referentie zonder voldoende metadata, met inconsistente metadata of anderszins niet-identificeerbare identiteit retourneert 422. Create/PATCH buiten import mogen geen ontbrekende live user introduceren en retourneren 422.
- **Importrollback**: bij een mislukte importcommit rollen alle urenmodule-domeinmutaties en hun mutatie-audits atomisch terug. Daarna/buiten die rollback worden de betreffende `WorkImportBatch` met status `failed` en precies één veilige import-failure-audit vastgelegd. Die failure-records bevatten geen gedeeltelijke domeinsnapshots of gevoelige uploadinhoud.
- **Hard delete versus full restore**: het verbod op hard delete geldt voor gewone UI/API-acties. Een admin-bevestigde full restore mag intern urenmodule-rows transactioneel vervangen om de backup exact terug te zetten; andere applicatiedata en de append-only audittrail worden niet vervangen of verwijderd.
- Deze resoluties vervangen alle oudere criteria of formuleringen die respectievelijk (a) elke ontbrekende user altijd als 422 behandelden, (b) ook de failed batch/failure-audit wilden terugrollen, of (c) technische row replacement tijdens full restore volledig verboden.

## Final-review remediation increment (approved, open)
- Reopen de eerder gesloten spec uitsluitend voor de laatst gemelde final-review findings; geen scope-uitbreiding en geen toepassing van unrelated audio/GenAI worktree changes.
- **Participant pre-write validation**: PATCH en import mogen pas schrijven wanneer elke groep minimaal 1 deelnemer heeft en elke deelnemer exact 1 geldige identity-reference heeft.
- **Semantic uniqueness conflicts**: import preview en commit moeten conflicten detecteren op projectnaam, post-combinatie `(project, name)` en externe genormaliseerde naam/email, óók wanneer IDs verschillen; resultaat is een gecontroleerde 409 zonder partial DB error.
- **CSV sort contract**: CSV-export gebruikt exact dezelfde goedgekeurde `sort_key`-enum als de lijst/API en wijst ongeldige waarden af.
- **Deleted-items cache/query invalidation**: de deleted-items query-key moet alle filters, sortering en paging dependencies bevatten en na restore correct invalidaten.
- **Restore UI authorization**: restore-acties zijn alleen zichtbaar/enabled voor admins; de backend blijft server-side beschermd tegen niet-admin calls.
- **CSV timezone rendering**: `created_at`/`updated_at` uit opslag in UTC worden in export geconverteerd naar Europe/Amsterdam en in gedocumenteerde Dutch-compatible output geschreven.
- **Verification gate**: eerst gerichte regressietests voor bovenstaande punten, daarna de volledige canonieke backend/frontend/build/migratieverificatie.

## Remediation increment (approved)
- Onderzoek en fix de backend-regressie `test_about_returns_read_only_payload` die faalt door een changelog expected/current title discrepancy, zonder ongewenste overschrijvingen van niet-gerelateerde worktree-inhoud.
- Breid de frontend `App.test`-mock uit zodat `listWorkHoursMeta` beschikbaar is voor de nieuwe route/pagina.
- Werk de eerder geïdentificeerde onvolledige scope volledig af: group edit en participant add/remove, deleted items/restore-UI, volledige backup/import preview/merge/full restore met missing-user relink, permissions, pagination/sorting en responsive/a11y coverage.
- Vereis volledige backend- en frontend-testsuites plus build en migratie als sluitende verificatie voor deze remediation.
- Voeg een smalle, onafhankelijke frontend-remediation toe voor `VergaderbordenPage.test.tsx`: herstel het verwachte gedrag waarbij de toolbar unmount zodra focus de editor shell verlaat, terwijl keyboardnavigatie, focus management en accessibility-gedrag ongewijzigd en correct blijven.

## Final completion increment (historical approved scope)
- Scope blijft volledig intact; deze increment sluit de resterende open urenmodule-acceptatiecriteria af zonder reductie.
- **Group editing + participant add/remove**: volledige UI/API-pariteit voor groepsbewerkingen, inclusief add/remove van deelnemers, server-side validatie, audit, restore-veiligheid en regressietests voor overzicht/detail/inline edit.
- **Deleted items + admin restore UI**: admin kan soft-deleted groepen en gerelateerde items in de UI bekijken, filteren en herstellen; restore moet alle child-records en auditsporen behouden.
- **JSON backup/import**: preview, merge, full restore, automatische pre-import backup, missing-user historic relink, conflict-afwijzing en security limits (uploadgrootte, JSON-diepte, object/node-aantallen, no silent overwrite) moeten volledig beschikbaar en testbaar zijn.
- **Pagination/sorting/filter/report/export**: lijst, totalen, export en import-preview gebruiken identieke filters; sortering, page sizes, report/export-output en CSV-kolommen blijven exact conform contract.
- **Masterdata/external management**: project/post/external-person beheer moet merge/visibility/archive/restore-gedrag consistent afhandelen met historische zichtbaarheid en blocked hard delete.
- **Audit**: alle mutaties, restore/merge/import/denied acties en counts/resultaten moeten append-only en end-to-end controleerbaar zijn.
- **Responsive/a11y**: desktop/tablet/mobile gedrag, focus management, keyboard flows, semantische alternatieven en modal controls moeten volledig gedekt zijn.
- **Unrelated frontend blocker**: repareer de falende `VergaderbordenPage.test.tsx` toolbar-focus regressie met een smalle, compatibele fix die geen andere admin-flow wijzigt.
- **Toolbar blur/unmount regression**: herstel specifiek dat de toolbar verdwijnt wanneer focus de editor shell verlaat in `VergaderbordenPage.test.tsx`, met behoud van toetsenbordbediening, focus return en a11y-gedrag.
- **Verification gate**: geen completion status zonder volledige canonical backend/frontend checks en bouw/migratieverificatie.

## Review remediation increment (approved)
- Scope-preserving review remediation only; geen nieuwe features en geen scope-uitbreiding.
- **Import conflict handling**: reject conflicterende updates in zowel preview als commit; geen stille overwrite, expliciete conflictmelding in beide fases.
- **Pagination**: implementeer echte server-side query pagination; de UI toont functionele previous/next controls die de serverresultaten volgen.
- **Filter/sort contract**: één gedeeld contract voor UI, backend, CSV-export en import-preview; dezelfde filters/sortering leveren identieke resultsets op.
- **Soft-delete protection**: PATCH op een soft-deleted group wordt server-side geweigerd; restore first is het enige toegestane pad.
- **Audit metadata**: audit registreert de feitelijke request method en request path zoals ontvangen door de backend, niet een afgeleide variant.
- **External merge guard**: self-merges van external people worden afgewezen; een persoon kan niet met zichzelf of dezelfde canonieke identity worden samengevoegd.
- **Regression coverage**: elk punt hierboven krijgt een gerichte backend- of frontend-regressietest, plus een relevante integratietest waar de flow over de API/UI-grens loopt.

## Integrity remediation increment (approved)
- Scope-preserving vervolgremediation; geen redesign en geen uitbreiding buiten de urenmodule.
- **Import commit binding**: bind het import-commit payload cryptografisch/semantisch aan de preview `source_hash` en batch-identiteit; elke mismatch tussen preview en commit wordt server-side geweigerd.
- **Pre-import backup guarantee**: zorg dat de automatische pre-import backup daadwerkelijk is aangemaakt en beschikbaar is vóór bevestiging, óf corrigeer de UI/API-flow zodat aan dezelfde vereiste wordt voldaan zonder race of verborgen state.
- **Pagination correctness under participant filters**: dedupliceer/groepeer server-side vóór `LIMIT/OFFSET` wanneer participant filters actief zijn, zodat paginaresultaten, totalen en volgende/vorige navigatie stabiel blijven.
- **Sort contract hardening**: accepteer sort keys alleen voor exact de goedgekeurde keys en implementeer de person/type sort correct, inclusief consistente UI/backend/export-preview.
- **Deleted-items refresh**: invalideer de deleted-items query/cache na restore zodat herstelde items direct uit de deleted list verdwijnen en de UI opnieuw laadt.
- **Regression coverage**: voeg voor elk punt hierboven een gerichte regressietest toe; geen punt mag alleen door handmatige verificatie worden afgedekt.

## Implementation steps (ordered)
0A. **Smalle closure-remediation (eerst uitvoeren)**
   - Reproduceer uitsluitend de falende keyboard-Tab-test in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`.
   - Herstel de editor-shell/focusgrens met de kleinst mogelijke wijziging en behoud alle bestaande a11y- en keyboardsemantiek; pas de test niet aan door assertions te verzwakken of controls uit de Tab-volgorde te halen.
   - Verifieer gericht **Nieuwe update** en **Update bewerken**: toolbar standaard verborgen, zichtbaar bij focus binnen de shell, zichtbaar tijdens Tab-navigatie binnen de shell en verborgen na Tab/Shift+Tab of expliciete focusverplaatsing buiten de shell.
   - Maak een verse tijdelijke directory, exporteer daarin `DATABASE_URL` en `STORAGE_ROOT`, voer Alembic naar `head` uit en laat de aansluitende proofsubprocessen dezelfde exports erven. Bewijs minimaal twee nieuwe connections met `PRAGMA foreign_keys=1`, afwijzing/rollback van een directe orphan-FK-write en opnieuw `foreign_keys=1` op een daarna geopende connection.
   - Draai na de gerichte checks de volledige frontend- en backendtests plus frontendbuild. Leg uitsluitend werkelijk uitgevoerde outputs vast; maak geen completionclaim bij een failure.

0. **Remediation- en regressieclosure**
   - Analyseer `test_about_returns_read_only_payload` en corrigeer de changelog title/expected-current mismatch met de kleinst mogelijke wijziging; behoud ongewijzigde, niet-gerelateerde code.
   - Update de frontend `App.test`-mock met `listWorkHoursMeta` voor de nieuwe route/pagina zodat de testcontext volledig is.
   - Sluit de resterende scopegaten af voor groepsbewerking, participant add/remove, deleted-items/restores, backup/import preview/merge/full restore, missing-user relink, permissions, pagination/sorting en responsive/a11y.
   - Rond deze stap pas af na volledige backend- en frontend-suites, build en migratie-verificatie.

1. **Datamodel en relaties**
   - Definieer de volgende entities in `backend/app/models/entities.py`:
     - `WorkProject`
     - `WorkPost`
     - `WorkExternalPerson`
     - `WorkHistoricalUserIdentity`
     - `WorkHourGroup`
     - `WorkHourGroupParticipant`
     - `WorkImportBatch` (operationeel, voor preview/commit/restore metadata)
     - audit-eventuitbreidingen op de bestaande audit-structuur
   - Gebruik UUID PK’s, `created_at`, `created_by_user_id`, `updated_at`, `updated_by_user_id`, `deleted_at`, `deleted_by_user_id`, `row_version`.
   - Sla timestamps op in UTC; toon in de UI Europe/Amsterdam.
   - Gebruik `duration_half_hours` als integer opslag voor duur.
   - `WorkProject`:
     - kolommen: `id`, `name`, `description`, `is_active`, `is_archived`, `archived_at`, `archived_by_user_id`, timestamps, soft-deletevelden, `row_version`.
     - unieke naam; archiveren zet `is_archived=true` en `is_active=false`.
   - `WorkPost`:
     - kolommen: `id`, `project_id` FK, `name`, `description`, `is_active`, `is_archived`, `archived_at`, `archived_by_user_id`, timestamps, soft-deletevelden, `row_version`.
     - unieke combinatie `(project_id, name)`.
   - `WorkExternalPerson`:
     - kolommen: `id`, `display_name`, `normalized_name`, `email`, `normalized_email`, `note`, `is_active`, timestamps, soft-deletevelden, `row_version`.
     - duplicate-detectie op exact naam/email geeft waarschuwing; geen stille overschrijving.
   - `WorkHistoricalUserIdentity`:
     - kolommen: `id`, `source_key`, `source_user_id` (nullable FK naar live User voor herkomst), `snapshot_name`, `snapshot_email`, `snapshot_display_label`, `linked_user_id` (nullable FK naar live User), `linked_at`, `linked_by_user_id`, `is_active`, timestamps, soft-deletevelden, `row_version`.
     - dit is een snapshot; het creëert nooit een User-account.
     - link-to-live-user is een auditeerbare, nullable associatie en nooit een destructieve transfer.
   - `WorkHourGroup`:
     - kolommen: `id`, `work_date`, `project_id` FK, `post_id` FK, `description`, `duration_half_hours`, timestamps, soft-deletevelden, `row_version`, optioneel `source_import_batch_id`.
     - constraints: datum mag niet in de toekomst liggen; project/post-combinatie moet geldig zijn.
   - `WorkHourGroupParticipant`:
     - kolommen: `id`, `group_id` FK, `participant_kind` (`live_user`/`external_person`/`historical_identity`), `user_id` nullable FK, `external_person_id` nullable FK, `historical_identity_id` nullable FK, `display_name_snapshot`, `display_email_snapshot`, `display_type_snapshot`, `sort_order`, timestamps, soft-deletevelden, `row_version`.
     - check constraint: exact één van de drie referenties is gevuld.
     - de UI kan de actuele live naam tonen; de immutable snapshot bewaart de naam op participatiemoment en audit behoudt eerdere namen.
     - immutable snapshot voorkomt ontraceerbare naamwijzigingen en duplicerende rechten.
   - `WorkImportBatch`:
     - kolommen: `id`, `requested_by_user_id`, `format_version`, `backup_version`, `mode`, `source_filename`, `source_hash`, `pre_import_backup_path`, `status`, `counts_json`, `warnings_json`, `errors_json`, timestamps.
   - Indexes minimaal op datum, project, post, participant kind, created_at, updated_at, deleted_at, `is_active`, `is_archived`, en import lookup keys.
   - Soft delete semantics:
     - groepen en deelnemers krijgen `deleted_at/deleted_by_user_id`;
     - archiveren gebruikt `is_archived/is_active` voor project/post;
     - historische records blijven leesbaar maar verdwijnen uit standaardselecties.
   - Geen seed data in de initiële migratie.

2. **Gezamenlijke registraties**
   - Eén `WorkHourGroup` is de canonieke registratie.
   - De groep bevat de gezamenlijke duur; deelnemers zijn losse child-rows.
   - Overzichten tonen één compacte rij per groep.
   - Uitklappen toont alle deelnemers.
   - Bij 1 persoon is save direct zichtbaar als een normale regel in overview en totalen.
   - Bij 3 personen en duur 2 uur blijft de groepsrij compact, toont 3 personen en totalen rekenen 6 person-hours.
   - Wijziging van de groepduur werkt voor de hele groep en herberekent alle totalen.
   - Deelnemer toevoegen/verwijderen blijft onderdeel van groepsbewerking en wordt apart geaudit.
   - Groep delete werkt op de hele groep en alle deelnemers; admin restore zet alles terug.

3. **Autorisatieontwerp**
   - Twee autorisatieniveaus: actieve authenticated User en Admin.
   - User mag uren muteren zonder ownership-check op de gekoppelde persoon.
   - Admin is vereist voor project/post/person masterdata, audit, backup/import en restore van deleted items.
   - Directe endpointcalls naar masterdata/audit/import worden server-side geweigerd voor niet-admins.
   - Hidden UI is nooit de enige bescherming.
   - CSRF wordt toegepast op state-changing requests volgens de bestaande authroute: alleen waar de app cookie-auth gebruikt; Bearer-gebaseerde calls krijgen geen kunstmatige extra CSRF-claim in deze spec.

4. **Auditlogontwerp**
   - Append-only tabel/eventstream; geen edit of delete op auditregels.
   - Per event vastleggen: actor, action, target type/id, before/after snapshot, correlation id, request path/method, UTC timestamp, outcome.
   - Audit actor blijft de daadwerkelijke gebruiker die handelt; bij User A die User B bewerkt is actor dus User A.
   - Log events voor create/update/soft-delete/restore van groepen en deelnemers, project/post create/update/archive/restore, quick-add/merge/deactivate, import preview/backup/commit/reject en authorization denials.
   - Past names blijven in audit bewaard via snapshots.

5. **CSV-exportontwerp**
   - Export is semicolon-separated, UTF-8 met BOM, Excel-vriendelijk, met veilige quoting en formule-injectiepreventie.
   - Eén groep genereert één regel per persoon.
   - Kolommen exact in deze volgorde: `datum`, `naam persoon`, `type persoon (WindWilly-gebruiker/extern)`, `project`, `post`, `aantal uren`, `beschrijving`, `aangemaakt door`, `aangemaakt op`, `laatst gewijzigd door`, `laatst gewijzigd op`.
   - Geen organisatie-kolom of groep-kolommen als vervanging.
   - Geen extra kolommen in v1 tenzij expliciet goedgekeurd.
   - Actieve filters zijn altijd leidend voor de export.

6. **Backup- en importontwerp**
   - JSON backup/import gebruikt een versioned envelope met `format_version` en `backup_version`.
   - Import werkt met stabiele IDs voor reconciliatie.
   - Preview toont counts, warnings, errors, conflicten en de gekozen importmodus.
   - Preview rejecteert conflicterende, niet-equivalente updates; er is geen stille overschrijving.
   - De applicatie maakt vóór commit automatisch een backup-export die als download beschikbaar blijft.
   - Full restore is beperkt tot de urenmodule en laat andere app-data ongemoeid.
   - Import houdt rekening met ontbrekende users via `WorkHistoricalUserIdentity` snapshots.
   - Parser-limieten zijn expliciete configbesluiten: maximale uploadgrootte, maximale JSON-diepte en maximale node/object-aantallen; geen gevaarlijke automatische object-expansie.

7. **UI- en integratieontwerp**
   - Volledig Nederlandse interface.
   - Datumweergave: `dd-mm-jjjj`; tijdstempels: Europe/Amsterdam; opslag: UTC.
   - Hoofdweergave: overzicht, totalen, filters, tabel en compacte grafiekcards.
   - Horizontale staafdiagrammen worden custom gebouwd met toegankelijke semantische alternatieven (tekst, tabel en aria-labels), niet met een extra chartlibrary.
   - Desktop: tabel met compacte rij, uitklapdetails en sticky kernkolommen.
   - Tablet: compacte tabel of cards met horizontaal scrollbare kerninformatie.
   - Mobiel: stacked cards met duidelijke acties, geen onleesbare microtabellen.
   - Modals: focus trapping, initial focus, ESC om te sluiten, focus return naar trigger, en behoud van bestaande UX-patterns waar mogelijk.
   - Integratie gebeurt via de bestaande API-laag; route en shell blijven behouden.

8. **Beheerfuncties**
   - Project aanmaken/wijzigen/archiveren/herstellen.
   - Post aanmaken/wijzigen/archiveren/herstellen.
   - Externe personen quick-add, zoeken, duplicate-warning, activeren/deactiveren en merge-beheer.
   - Deleted groups inzien en herstellen.
   - Import/backup beheren met preview, download en commit.
   - Audit inzien met filters.

9. **Migratieaanpak lege initiële module**
   - De eerste migratie creëert alleen schema, constraints, indexes en noodzakelijke operationele kolommen.
   - Geen seed data.
   - Geen backfill van niet-bestaande urendata.
   - De migratie is forward/rollback-vriendelijk en module-gebonden.

10. **Foutafhandeling**
   - 401/403 voor auth/rights mismatch.
   - 409 voor conflict, versie-race of niet-equivalente importreconciliatie.
   - 422 voor validatiefouten.
   - 400 voor onleesbare upload of formaatfout.
   - Nederlandse, veldgerichte foutmeldingen.
   - Duplicate-detectie op naam/email toont bestaande kandidaten en vraagt expliciete bevestiging om door te gaan.
   - Hard delete-pogingen leveren een duidelijke blokkade op.

11. **Beveiligingsmaatregelen**
    - Authorisatie op elke endpoint, niet alleen in de UI.
    - CSRF alleen daar waar cookie-auth de bestaande route is.
    - Uploadvalidatie op type, grootte en parserlimieten.
   - Geen stille objectexpansie bij JSON import.
   - SQL-injectionpreventie via parameter binding.
    - CSV-injectionpreventie via escaping/prefixing.
    - XSS-preventie via escaping en veilige rendering.
    - Geheimen nooit loggen.
    - Audit blijft append-only.

12. **Final completion work package**
    - Sluit alle open acceptance criteria af zonder scope-reductie of nieuwe feature-uitbreiding.
    - Werk UI/API samenhang af voor groepsbewerking, inclusief participant add/remove en restore-safe edit paths.
    - Maak deleted-items-beheer en admin restore volledig beschikbaar in de UI, inclusief terugzetten van volledige groep- en deelnemerstructuren.
    - Voltooi JSON backup/import: preview, merge, full restore, auto-backup, missing-user historic relink, conflict handling en security-limieten.
    - Controleer dat filters, pagination, sorting, reports en export exact dezelfde querycontracten gebruiken.
    - Maak masterdata/external management compleet, inclusief merge/visibility, archive/restore en historische zichtbaarheid.
    - Verifieer audit coverage voor create/update/delete/restore/import/merge/reject/deny gebeurtenissen.
    - Verifieer responsive layout en toegankelijkheid op desktop/tablet/mobile met keyboard en focus gedrag.
     - Repareer de `VergaderbordenPage.test.tsx` toolbar-focus/blur failure met de kleinst mogelijke compatibele wijziging, zodat de toolbar unmount bij focusverlies buiten de editor shell zonder keyboard/a11y regressie.
     - Testen voor deze remediation: targeted regression test voor `VergaderbordenPage.test.tsx`, relevante urenmodule tests, daarna de volledige frontend-suite, en vervolgens de volledige canonical backend- en frontend-suites plus build en migratie.

13. **Review remediation hardening**
    - Implementeer server-side pagination met echte previous/next controls in de UI; geen lokale slicing of fake paging.
    - Harmoniseer filters en sort keys over overzicht, totalen, export en import-preview via één expliciete contractlaag.
    - Reconcile import preview en commit met dezelfde conflictregels; conflicterende updates worden in beide fases expliciet afgewezen.
    - Weiger PATCH op soft-deleted groups totdat restore first is uitgevoerd.
    - Leg in audit de daadwerkelijke request method en path vast.
    - Weiger self-merges van external people.
    - Voeg per item gerichte regressietests toe in backend en/of frontend, plus end-to-end tests waar de flow de API/UI-grens passeert.

14. **Integrity remediation hardening**
    - Verbind import commit requests met de preview-batch via `source_hash` en batch-identiteit; mismatch = reject.
    - Maak pre-import backup-aangemaakte staat expliciet controleerbaar vóór commit confirmation of pas de flow aan totdat die garantie eenduidig wordt afgedwongen.
    - Verplaats dedupe/group-logica vóór pagination voor participant-filtered queries en laat list/total/export dezelfde server-side resultset gebruiken.
    - Beperk sort keys tot exact de geautoriseerde set en implementeer person/type sort eenduidig in backend, UI en export-preview.
    - Forceer cache/query invalidatie van deleted-items na restore.
    - Voeg regressietests toe voor elk van bovenstaande punten, inclusief mismatch rejection, pre-backup availability, pagination stability, sort validation en restore refresh.

15. **TypeScript typing remediation (historical approved scope)**
    - Type frontend `sort_key` op beide gerapporteerde sites als het gedeelde `WorkHourQueryParams`-toegestane union, zodat de compiler het canonical work-hour sort contract afdwingt.
    - Voeg of pas alleen de kleinste relevante frontend-test aan als dat nuttig is om de toegestane sort keys vast te zetten en ongeldige waarden af te wijzen.
    - Houd deze increment scope-preserving; geen runtime-gedragswijziging behalve typing en eventuele regressiedekking.

16. **Final-review remediation closure**
    - Maak PATCH- en import-validatie fail-fast: requireer minimaal één deelnemer per groep en valideer per deelnemer exact één geldige identity-reference vóór enige write-operatie.
    - Detecteer semantic uniqueness conflicts in import preview en commit op projectnaam, post-uniekheid binnen project en externe genormaliseerde naam/email, ook bij verschillende IDs; return een gecontroleerde 409 zonder partial DB write.
    - Hardening van CSV export: `sort_key` accepteert uitsluitend de goedgekeurde enum; ongeldige sortwaarden worden afgewezen met een expliciete validatiefout.
    - Fix deleted-items query-key dependencies: neem alle actieve filters, sort, page en relevante dataset-flags op zodat invalidatie na restore de lijst direct ververst.
    - Beperk restore-acties in de UI tot admins (zichtbaar + enabled) en behoud backend-autorisatie als harde server-side bescherming.
    - Converteer CSV `created_at` en `updated_at` uit UTC naar Europe/Amsterdam en formatteer in de gedocumenteerde, Dutch-compatible weergave.
    - Registreer bij deze increment gerichte regressietests plus de volledige canonieke verificatiepijplijn.

17. **Latest review findings (reopened, scope-preserving)**
    - Scope is beperkt tot deze drie findings; unrelated changes blijven expliciet buiten scope.
    - Backup/import/full restore moet registraties die verwijzen naar gearchiveerde of soft-deleted externe personen behouden via historische snapshot/reference-semantiek; admin history mag deze personen tonen, maar niet selecteerbaar maken voor nieuwe entries.
    - Create/edit-form postopties moeten strikt afhangen van het project dat in dat specifieke formulier geselecteerd is; bij projectwijziging wordt een nu-invalide post-selectie gecleared en niet meer enabled.
    - Duplicate external quick-add moet concrete bestaande kandidaten tonen met privacy-safe velden voor normale users, een bestaande kandidaat selecteerbaar maken, of een expliciete force-create-flow aanbieden.

18. **Approved latest findings (reopened, scope-preserving)**
    - **Missing live_user on import/full restore**: wanneer een import of full restore een registratie zonder live_user treft maar wel backup identity metadata bevat, moet de flow een `WorkHistoricalUserIdentity` snapshot creëren of hergebruiken op basis van die metadata, alle gekoppelde registraties behouden, geen accountrechten aan een User-account toekennen, en een optionele admin relink volledig auditeerbaar maken.
    - **Role-safe duplicate candidate 409 payload**: wanneer een duplicate external candidate-conflict een 409 oplevert, mag de payload voor normale users geen `email` of interne `note` bevatten; admins ontvangen alleen de toegestane details volgens het rol-schema.
    - **Append-only audit for denied hours admin calls**: geweigerde calls naar hours admin endpoints moeten append-only worden geaudit met actor, path, method en result/decision, zonder request body of andere gevoelige payloaddata in de auditregel.

19. **Latest four findings (reopened, scope-preserving)**
    - **Controlled identity handling for invalid/missing live_user participant references**: create en update wijzen elke ongeldige of ontbrekende `live_user` participant-reference af met gecontroleerde 422. Import/full restore converteert een ontbrekende user met voldoende, eenduidige snapshotmetadata naar een historische identiteit; alleen onvoldoende, inconsistente of niet-identificeerbare referenties leveren 422. Geen flow retourneert 500 of gebruikt een undefined-variable path.
    - **Historical duplicate candidate visibility**: duplicate detection voor external people moet gearchiveerde en soft-deleted people meenemen in de candidate search, ze tonen als historical candidates die niet selecteerbaar zijn voor nieuwe entries, en admin guidance tonen voor recovery of merge waar toepasselijk.
    - **Edit-group picker parity**: de group edit UI moet dezelfde picker semantics gebruiken als create, zodat elke eligible actieve live user of external person toegevoegd kan worden, terwijl historische of inactieve people display-only blijven en niet selecteerbaar zijn.
    - **Amsterdam calendar default date**: een nieuwe registratie default naar de huidige Europe/Amsterdam kalenderdatum, niet naar een UTC ISO-date afgeleid van de serverclock.

20. **Latest approved review remediation (reopened, scope-preserving)**
    - Deze increment omvat uitsluitend de vier hieronder gegroepeerde review findings. Niet-gerelateerde worktree-, product- of refactorwijzigingen zijn expliciet uitgesloten.
    - **Participant identity validation (create/update/import)**:
      - Verwijder alle write/validation-paden waarin `allow_missing_live_user` undefined of conditioneel ongeïnitialiseerd kan zijn.
      - Create en update valideren iedere participant-reference vóór de eerste write; een onbekende `live_user` levert daar deterministisch HTTP 422 op. Import/full restore past eerst de goedgekeurde historische-conversieregel toe en retourneert uitsluitend 422 als voldoende/eenduidige snapshotidentificatie ontbreekt.
      - PATCH valideert voor iedere deelnemer de toegestane `participant_kind`, exact de bijbehorende ID, het bestaan van het doel en de selecteerbaarheid ervan. Een al gekoppelde historische/inactieve participant mag alleen onveranderd als display-only historie behouden blijven; toevoegen, vervangen door of opnieuw selecteren van zo'n identity wordt met 422 geweigerd.
      - Begrens iedere gewone mutatie in één transactie. Bij importcommit worden participant-gerelateerde FK/check/unique-integriteitsfouten gecontroleerd vertaald en rollen alle domeinmutaties plus mutatie-audits terug; de failed `WorkImportBatch` en één veilige import-failure-audit worden daarna/buiten de domeintransactie duurzaam vastgelegd.
    - **Create/edit person-picker completeness**: create en edit gebruiken hetzelfde server-side eligibility-contract en tonen iedere actieve/selecteerbare WindWilly-user en iedere actieve/selecteerbare externe persoon, onafhankelijk van de actuele actor en dus niet alleen de ingelogde gebruiker. Inactieve, gearchiveerde, soft-deleted en historische identities mogen alleen als bestaande/historische displaywaarde zichtbaar zijn en zijn nooit als nieuwe deelnemer selecteerbaar.
    - **Useful admin audit UI**: de admin-auditweergave ondersteunt minimaal server-side filters op actor, action, result, HTTP-method, request-path en een inclusief `from`/`to` tijdsbereik. Elke resultaatregel toont actor, tijd in Europe/Amsterdam, action, de daadwerkelijk ontvangen request path, de daadwerkelijk ontvangen HTTP-method en result/decision. Niet-admins krijgen geen toegang.
    - **Import semantic-conflict contract**:
      - Semantic conflicts op projectnaam, `(project, post)` en genormaliseerde externe naam/email leveren bij preview HTTP 409. Commit past exact dezelfde detector vóór modulewrites toe en retourneert bij een conflict eveneens 409; een race die pas bij flush/commit zichtbaar wordt, wordt naar hetzelfde contract vertaald en rolt de hele commit terug.
      - Beide 409-responses gebruiken exact `detail.code = "work_hours_import_semantic_conflict"`, een Nederlandse niet-gevoelige `detail.message`, `detail.counts = {"total": <int>, "projects": <int>, "posts": <int>, "external_people": <int>}` en `detail.candidates` als array van `{entity_type, incoming_id, existing_id, conflict_fields}`.
      - `entity_type` is exact `project`, `post` of `external_person`; `conflict_fields` bevat alleen de conflicterende canonieke veldnamen. Candidate-details blijven conform het bestaande rol- en privacycontract.
      - Een previewconflict schrijft geen urenmoduledata. Een commitconflict laat alle urenmodule-domeindata ongewijzigd en rolt voorbereide records/mutatie-audits terug; alleen de failed batchstatus en veilige failure-audit mogen conform de rollbackresolutie persisteren.
    - Voeg uitsluitend de hieronder benoemde gerichte regressietests toe en voer daarna de canonieke checks uit; maak geen implementatieclaim voordat verificatiebewijs in deze spec is vastgelegd.
    - Werk als verplichte Definition-of-Done-documentatie de About-changelog bij met één gebruikersgerichte regel over deze vierdelige hardening; dit breidt het functionele scope niet uit.

21. **Adversarial hardening increment (approved, reopened, scope-preserving)**
    - **Faithful backup roundtrip**:
      - Backup bevat alle urenmodule-records die nodig zijn voor een exacte roundtrip, inclusief vaste group- en participant-ID's, actieve én soft-deleted/verwijderde participants, `deleted_at`, `deleted_by_user_id`, create/update actors en timestamps, `row_version`, identity snapshots, relaties en volgorde.
      - Full restore op een lege module en full restore over bestaande moduledata reconstrueren exact dezelfde urenmodule-domeintoestand. Technische replacement is daarbij toegestaan volgens de contradiction resolution; auditregels buiten de backup en andere app-data blijven intact.
      - Merge behoudt bestaande stabiele IDs en mag verwijderde deelnemers niet stil overslaan of als actieve deelnemers terugbrengen.
    - **Historische user conversion en relink**:
      - Ontbrekende live users met voldoende snapshotnaam plus een eenduidige bronidentifier en/of snapshot-email worden deterministisch als historische identiteit gecreëerd/hergebruikt; ambigue, inconsistente of onvoldoende metadata retourneert 422 vóór domeinwrites.
      - Relink is admin-only, compare-and-update beschermd, behoudt de historische snapshot en schrijft een volledige before/after-audit zonder een User-account te creëren of rechten over te dragen.
    - **Role-safe datasets**:
      - De algemene hours-meta-response voor User en Admin bevat uitsluitend actieve/selecteerbare projects, bijbehorende actieve/selecteerbare posts en actieve/selecteerbare participantopties, plus alleen de minimale displaymetadata die nodig is voor reeds gekoppelde historische waarden.
      - Deleted-items, archived/history datasets, volledige identity snapshots en relinkinformatie zijn admin-only. Niet-admin directe calls leveren 403 en lekken geen dataset, aantallen, email, interne notes, deletion actors of interne IDs.
    - **Complete import preflight**:
      - Preview en commit gebruiken dezelfde validator en valideren de volledige envelope vóór de eerste domeinwrite: alle IDs/references, exact-één participantidentity, group-participantrelaties, project-postrelaties, actor/relinkreferenties, UUID/type/enum-formaten, uniqueness, deletion-statecoherentie, `duration` in stappen van 0,5 uur binnen inclusief 0,5..24 uur, en `work_date` niet later dan de Europe/Amsterdam-kalenderdag.
      - Geen onbekend recordtype, ongeldige row of unresolved reference wordt stil overgeslagen. De response rapporteert gecontroleerd alle gevonden fouten met stabiele recordlocaties; commit voert niets gedeeltelijk uit.
      - Voeg portable DB-checks toe waar SQLite én PostgreSQL dit betrouwbaar afdwingen: minimaal duration half-hours `1..48`, exact-één identityreference en participant uniqueness. Cross-row/project-post/selectability/nonfuture-regels blijven daarnaast verplicht service-side gevalideerd.
    - **Importtransaction en failure records**:
      - Domain rows en mutation audits delen één transactie. Elke fout rolt die transactie volledig terug.
      - Een failed batchstatus en precies één gesaniteerde failure-audit worden pas na rollback in een afzonderlijke veilige transactie geschreven. Deze bevatten batch-ID, actor, operation, status, foutcode en niet-gevoelige counts, maar geen requestbody, broninhoud of half-afgeronde before/after-snapshots.
    - **SQL audit query en auditatomiciteit**:
      - Actor/action/result/method/path/from/to filtering, deterministic sorting en paging gebeuren volledig in SQL; default page size 25, toegestaan 25/50/100, met totaalcount uit dezelfde filterquery.
      - `from`/`to` input wordt als Europe/Amsterdam geïnterpreteerd en inclusief naar UTC-querygrenzen geconverteerd, ook rond zomer-/wintertijd. Resultaattimestamps worden als Europe/Amsterdam weergegeven.
      - Elke geslaagde domeinmutatie en bijbehorende auditcommit zijn atomisch. Update/delete/restore/relink/importmutatie-audits bevatten volledige geserialiseerde before/after-state voor alle gewijzigde relevante velden en child-relaties; een auditwrite-fout rolt de domeinmutatie terug.
    - **Masterdata selectability**:
      - Nieuwe of gewijzigde registraties accepteren uitsluitend actieve, niet-gearchiveerde, niet-soft-deleted projects en posts waarbij de post tot het gekozen project behoort. Bestaande historische koppelingen blijven display-only; het ongewijzigd bewaren ervan mag, maar opnieuw selecteren of naar een niet-selecteerbaar item wijzigen retourneert 422.
      - Meta/pickers en backend-validatie gebruiken hetzelfde selectability-contract.
    - **Optimistic concurrency**:
      - Elke update, soft delete, restore, relink en relevante masterdatamutatie vereist `expected_row_version`. De repository voert één compare-and-update uit met `WHERE id = :id AND row_version = :expected`; exact één row wordt gewijzigd en `row_version` wordt atomisch verhoogd.
      - Een stale/missing expected version of zero-row update retourneert 409 met huidige veilige versie-informatie, zonder domein- of mutatie-auditwrite.
    - **Participant uniqueness**:
      - Per groep kan dezelfde canonieke identity maximaal één actieve participant zijn. Dit wordt vóór writes service-side gevalideerd en transactioneel/DB-side afgedwongen met een portable uniqueness-strategie die soft-deleted historie toestaat zonder races.
      - Create, PATCH, import, restore en relink gebruiken hetzelfde contract; duplicate input of een concurrency-race retourneert gecontroleerd 409/422 volgens requestsemantiek en laat geen partial writes achter.
    - **JSON resource limits**:
      - De HTTP-laag stopt de requeststream zodra de configureerbare maximale bytegrootte wordt overschreden, vóór volledige buffering of JSON-parse, en retourneert 413.
      - Na parse en vóór preview/domeinwrites worden maximale nesting depth en totale node/object/array/scalar-count iteratief en begrensd gecontroleerd; overschrijding retourneert 422. Content-Length ontbrekend of misleidend omzeilt de bytecounter niet.
    - **Responsive en toegankelijkheid**:
      - Mobiel gebruikt cards zonder horizontale viewportoverflow; primaire data en acties blijven zichtbaar/bedienbaar bij 320 CSS px en 200% zoom. Desktop/tablet behouden bruikbare tabel/cardsemantiek.
      - Alle controls hebben toegankelijke namen, foutmeldingen zijn gekoppeld aan velden, keyboard-only flows werken, en modals hebben initial focus, focus trap, ESC-close en focus return naar de trigger (of een logisch opvolgend element als de trigger verdwijnt).
      - Grafieken hebben geen kleur-alleen-betekenis en bieden dezelfde waarden/labels via een screenreader-toegankelijke tabel of lijst; decoratieve chartdelen zijn verborgen voor assistive technology.
    - **SQL totals**:
      - Groepsuren, participantcount en person-hours worden met SQL-aggregaties berekend over exact dezelfde gefilterde en deduplicerende basisquery als de lijst/export, zonder alle matchende rows in applicatiegeheugen te materialiseren. Soft-deleted groups/participants tellen standaard niet mee.
    - **Scope en evidence**:
      - Alleen urenmodule-spec/implementatie in een latere implementatiefase; unrelated audio/GenAI en andere worktreewijzigingen zijn uitgesloten.
      - Deze spec-update claimt geen implementatie of testresultaat. Bestaande evidence geldt niet voor deze increment; exacte suite-aantallen worden pas na uitvoering opnieuw gemeten en in Verification evidence uitgelijnd.

22. **Latest adversarial findings remediation (approved, reopened, scope-preserving)**
    - Deze increment vervangt geen eerder goedgekeurde interpretatie, behalve waar hieronder een striktere privacy-, coherentie- of uniquenessgrens expliciet is vastgelegd. Alleen de urenmodule en de bestaande routecompatibiliteit vallen binnen scope; unrelated changes blijven uitgesloten.
    - **Admin-only deleted CSV parameters**:
      - `GET /urenverantwoording/export.csv` blijft beschikbaar voor iedere actieve authenticated User met de standaard actieve dataset.
      - Zodra `include_deleted=true` of `deleted_only=true` expliciet of effectief wordt aangevraagd, is Admin vereist vóór query-uitvoering, count of CSV-opbouw. Een niet-admin krijgt 403 en geen CSV-body, records, counts of deleted metadata. `deleted_only=true` impliceert `include_deleted=true`; de combinatie `deleted_only=true&include_deleted=false` wordt canoniek genormaliseerd naar deleted-only en dus niet gebruikt om de admincheck te omzeilen.
    - **Role-safe public response schemas**:
      - Gebruik afzonderlijke, expliciete schemas voor niet-admin meta- en groupresponses; serialiseer geen adminmodel en filter daarna geen keys ad hoc.
      - Niet-admin meta-opties bevatten uitsluitend de voor selectie benodigde resource-ID/opaque selection key, displaynaam, displaytype, `selectable`, en voor posts de benodigde project-selection key. Niet-admin groupresponses bevatten uitsluitend groupresource-ID, datum, project/post-display, beschrijving, duur, veilige `row_version`, create/update timestamps en participantresource-ID, immutable displaynaam/type en volgorde.
      - Niet-admin meta/groupresponses bevatten nergens email, username, note, `source_key`, identity-FK's (`user_id`, `external_person_id`, `historical_identity_id`, `source_user_id`, `linked_user_id`), importbatch/provenancevelden, deletion/archivevelden, actor-ID's/namen, interne auditmetadata of volledige identitysnapshots. Resource-ID's die nodig zijn om de group of selectie te adresseren gelden niet als identity-/actorlekkage.
      - Admin history/masterdata gebruikt eigen adminschemas en mag uitsluitend via admin-only endpoints uitgebreidere velden leveren. Dezelfde serializergrens geldt voor success-, 409-, 422- en empty-state responses.
    - **Complete import preflight en late constraint mapping**:
      - Preview en commit gebruiken één pure, volledige preflight over de hele envelope vóór de eerste domein- of mutatie-auditwrite. Die valideert recordtypes/formaten, alle stabiele IDs en intra-envelope/externe references, source-batchreferences, `source_user_id`, create/update/archive/delete/link actors, project→post-parentage, group→participant-parentage, exact-één identity, uniqueness, versions/timestamps, selectability en alle statuscombinaties.
      - Actorreferences mogen alleen null zijn waar het backupcontract dat veld expliciet nullable maakt; anders moeten ze naar een bestaande User of een in de envelope geldig gereconcilieerde actorreference wijzen. Een unresolved actor/ref wordt nooit gewist of overgeslagen.
      - Statuscoherentie volgt het transitioncontract hieronder. Tevens gelden: child `deleted_at/deleted_by` is coherent met zijn eigen state; een active participant kan geen deleted group als parent hebben; een post kan niet actief/selecteerbaar zijn onder een inactive/archived/deleted project; relinkvelden zijn alle-null of als complete linkage aanwezig.
      - Preflight retourneert alle gevonden fouten met stabiele JSON-locaties en een niet-gevoelige constraintcode. Een late `IntegrityError` wordt op constraintnaam/kolommen specifiek vertaald naar hetzelfde domeincontract: semantic uniqueness/race = 409, shape/FK/check/state-invaliditeit = 422. Onbekende DB-fouten blijven een gesaniteerde 500, maar rollen eveneens volledig terug; nooit raw SQL, constrainttekst, stacktrace of partial write in de response.
    - **Faithful provenance en stabiele-ID merge-equivalentie**:
      - Backup v2 bevat `source_batches` voor iedere door moduledata gerefereerde importbatch, met stabiel batch-ID en de niet-gevoelige provenancevelden die nodig zijn om references te herstellen. Lokale bestandspaden, requestbody/source content en gevoelige errors worden niet geëxporteerd. Een handmatig aangemaakte group heeft expliciet `source_import_batch_id=null`; een non-null reference zonder bijbehorende batch in envelope of target is 422.
      - `WorkHistoricalUserIdentity.source_user_id` wordt in backup altijd als aanwezig nullable veld geëxporteerd en bij merge/full restore behouden. Een non-null waarde wordt alleen als live FK hersteld als de User bestaat; bij de reeds goedgekeurde missing-userconversie blijft de originele stabiele bron-ID duurzaam in `source_key`/provenance bewaard en wordt de nullable live-FK-grens expliciet `source_user_id=null`, zonder stil verlies of accountcreatie.
      - Merge vergelijkt per stabiel ID alle contractvelden van project, post, external person, historical identity, group, participant en source batch, inclusief nulls, snapshots, actors, timestamps, row versions, status, relaties en volgorde. Alleen veld-voor-veld equivalente records zijn no-op. Iedere niet-equivalente collision is een gelokaliseerde 409; geen veld, child of deleted record wordt stil overschreven, overgeslagen, gereactiveerd of van nieuw ID voorzien.
    - **Audit completeness en atomiciteit**:
      - Import preview, backup creation en backupdownload schrijven elk een append-only audit event met actor, batch/artifact-ID, action, result, request method/path, UTC timestamp en veilige counts; geen bestandsinhoud, lokaal pad, email of requestbody. Een download audit gebruikt success pas nadat autorisatie en artifactvalidatie slagen; denial/not-found/failure gebruikt het passende result.
      - Een backupartifact wordt pas als beschikbaar gepubliceerd wanneer artifactmetadata en de bijbehorende backup-audit duurzaam zijn. Bij auditfailure krijgt de caller geen downloadbaar artifact/successresponse.
      - Update/delete/restore/import en external-person merge auditen volledige parent plus alle getroffen participant-child before/after-snapshots in dezelfde transactie als de mutatie. Auditfailure rolt parent, children, versions en status volledig terug. Alleen de eerder goedgekeurde failed-import boundary blijft de expliciete uitzondering.
    - **Immutable participant display snapshots bij external merge**:
      - Een external-person merge mag participantreferences naar het target reconciliëren, maar wijzigt nooit bestaande `display_name_snapshot`, `display_email_snapshot` of `display_type_snapshot`. Het volledige child before/after-audit toont de referentiewijziging én identieke display snapshots. Nieuwe registraties na de merge gebruiken de actuele targetdisplaygegevens.
      - Wanneer source en target al als actieve participant in dezelfde group voorkomen, wordt niet stil gededupliceerd: preview/merge retourneert 409 vóór writes, tenzij een afzonderlijke expliciete, volledig geaudite participant-resolutionactie in dezelfde request is gespecificeerd; zo'n nieuwe resolution-UI valt in deze increment buiten scope.
    - **Force-create versus uniqueness**:
      - Duplicate candidates worden ingedeeld in hard en advisory conflicts. Een gelijk genormaliseerd niet-leeg emailadres of dezelfde stabiele identity is een hard conflict: kiezen van de bestaande record, admin recovery/merge, of 409 zijn toegestaan; `force_create` kan dit niet omzeilen.
      - Een naamgelijkenis zonder gelijk genormaliseerd niet-leeg emailadres is advisory. Alleen daarvoor mag `force_create=true` na een expliciete UI-bevestiging een nieuwe persoon maken. Zonder `force_create` retourneert de API de bestaande role-safe candidate response. Een stale/race hard conflict wordt constraint-specifiek 409 en laat geen row/audit-success achter.
      - `force_create` ontbrekend is gelijk aan `false`, is alleen een boolean requestveld, en verleent geen adminrechten of bypass van validation/selectability/statusregels.
    - **Admin archived masterdata/history en geldige restore**:
      - Admin krijgt server-side gepagineerde endpoints/UI voor archived projects, posts en external people plus historical identities; default 25, toegestaan 25/50/100, deterministische sortering met stabiele ID tie-breaker, total uit dezelfde filterquery. Niet-admin krijgt 403 zonder items/counts.
      - Restore vereist `expected_row_version`, valideert hard/semantic uniqueness en parentstatus vóór de write en retourneert gecontroleerd 409 bij stale/conflict of 422 bij incoherente state. Een post kan alleen naar active worden hersteld als zijn project active, niet archived en niet deleted is; anders blijft alles ongewijzigd. Een geldig restore herstelt precies de vooraf bepaalde state, verhoogt de versie éénmaal, ververst meta/history en schrijft atomisch full before/after-audit.
    - **Coherent `is_active`/`is_archived` transitions en parent checks**:
      - Project/post active: `is_active=true`, `is_archived=false`, `archived_at=null`, `archived_by_user_id=null`, `deleted_at=null`, `deleted_by_user_id=null`. Archived: `is_active=false`, `is_archived=true`, beide archivevelden non-null en deletionvelden null. Soft-deleted: `is_active=false`, beide deletionvelden non-null; een eerder archived item behoudt de complete archived tuple, een niet-archived item houdt `is_archived=false` en beide archivevelden null. Halfgevulde tuples of `is_active=true` samen met archived/deleted zijn ongeldig.
      - Archive, soft delete en restore worden alleen via domeinacties uitgevoerd; generieke PATCH mag geen willekeurige flagcombinatie zetten. Restore van een niet eerder archived item wordt active; restore van een eerder archived item wordt archived en blijft niet-selecteerbaar totdat de afzonderlijke unarchive/activate-actie slaagt.
      - Een postcreate, postupdate, postrestore, groupcreate/groupupdate/import en meta-selectie valideert altijd de actuele parentprojectstate. Archive/delete van een project maakt childposts onmiddellijk niet-selecteerbaar; er is geen stil cascade-restore. Herstel/activatie van children is expliciet en pas toegestaan na geldig parentherstel.
    - **Routecompatibiliteit**:
      - `/wervelnieuws/urenverantwoording` mag de frontendcanonical blijven. Een directe browsernavigation naar `/urenverantwoording` moet dezelfde module renderen of met één gedocumenteerde redirect naar de canonical route gaan; geen 404 of placeholder. Een redirect behoudt querystring en hash en veroorzaakt geen loop. De bestaande backend-APIprefix `/urenverantwoording` blijft ongewijzigd.
    - **Canonical list/export filtercontract**:
      - Eén gedeeld backend/frontend queryschema definieert exact `work_date`, `project_id`, `post_id`, `participant_kind`, `query`, `include_deleted`, `deleted_only`, `sort_key` en `sort_direction`; lijst voegt alleen `page`/`page_size` toe. Export negeert geen actieve selectie/sortering en exporteert alle matches, niet slechts de zichtbare pagina.
      - Defaults en normalisatie zijn identiek: trim `query`, lege waarden worden null, `sort_direction` is exact `asc|desc`, sort keys blijven de goedgekeurde enum, en onbekende/duplicaat-conflicterende queryparameters worden 422. List, totals en export gebruiken dezelfde gededupliceerde basisquery; alleen list past daarna pagination toe. Deleted flags volgen de adminregel hierboven.
    - **Robuuste modal- en fouttoegankelijkheid**:
      - Create, edit, delete, import/preview, restore, merge en force-create confirmation gebruiken native `<dialog>` of een equivalent met `role="dialog"`, `aria-modal="true"`, initial focus op heading/eerste fout/eerste veld, volledige tab/shift-tab trap en een inert achtergrond (`inert`, met geteste fallback). Achtergrondcontrols zijn niet focusbaar of activeerbaar zolang de modal open is.
      - ESC sluit alleen de bovenste dismissible modal, voert geen submit/mutatie uit en respecteert een expliciet non-dismissible committing state. Na close keert focus terug naar de zichtbare enabled trigger; als die verdween, naar het eerstvolgende logisch benoemde control. Geneste confirmation sluit/retourneert eerst naar de parentmodal.
      - Iedere veldfout is zichtbaar Nederlands, gebruikt `aria-invalid=true` en is via unieke `aria-describedby`/`aria-errormessage` aan exact het veld gekoppeld. Een focussprong naar de eerste fout en een `role="alert"` of `aria-live="assertive"` samenvatting kondigen submit/API-errors aan; async success/status gebruikt een niet-dubbel aankondigende polite live region. Fouten blijven aanwezig totdat het betreffende veld geldig is of opnieuw gevalideerd wordt.
    - **Evidence gate**:
      - Voeg de hieronder exact benoemde adversarial tests toe en draai daarna alle canonical commands. Deze specwijziging maakt geen applicatie-, migratie- of testresultaatclaim; bestaande evidence is uitsluitend historisch en sluit deze reopening niet.

23. **Latest ten code-finding remediation (approved, reopened, scope-preserving)**
    - Deze increment omvat uitsluitend de tien hieronder benoemde bevindingen. Alle eerdere contradiction resolutions, privacygrenzen, statusinterpretaties, rollbackgrenzen en force-create-interpretaties blijven van kracht. Unrelated app-, audio-, GenAI-, dependency- en refactorwerk is uitgesloten.
    - **SQLite foreign-key enforcement op iedere verbinding**:
      - De gedeelde SQLite-engine/connection-initialisatie zet `PRAGMA foreign_keys=ON` voor iedere nieuw geopende DBAPI-connection, inclusief connections gebruikt door API/services, tests en Alembic. PostgreSQL-paden voeren geen SQLite-PRAGMA uit.
      - Bewijs vereist zowel `PRAGMA foreign_keys` = `1` op minstens twee afzonderlijk nieuw geopende connections uit dezelfde engine als een mislukte directe orphan-FK-insert met volledige rollback. Een connection uit de pool of een tweede enginepad mag de instelling niet verliezen.
    - **Volledige importpreflight**:
      - De ene gedeelde preview/commit-preflight valideert vóór body-afgeleide domeinwrites alle project-, post-, external-person- en historical-identityreferences; alle create/update/archive/delete/link actors; source users/batches; group/participant-parentage; en iedere overige intra-envelope of bestaande-targetreference.
      - De validator controleert per record state-, actor-, timestamp- en `row_version`-coherentie, inclusief actor/timestamp-paren, create ≤ update ≤ archive/delete/link waar die events bestaan, positieve geldige versions en de eerder goedgekeurde statusmatrix. Iedere niet-verwijderde group moet na reconciliation minimaal één actieve participant hebben; een deleted group mag zijn immutable verwijderde participant-historie behouden maar mag niet door import als actieve lege group ontstaan.
      - Preview en bound commit verzamelen dezelfde gelokaliseerde fouten en schrijven bij preflightfailure geen domein- of mutatie-auditrows; de bestaande failed-importboundary geldt pas voor een bevestigde commitfailure.
    - **Historische identityprovenance en deterministische missing-userconversie**:
      - Model en backup v2 representeren voor historical identities expliciet de create/update/delete/link actorprovenance en bijbehorende timestamps/statusvelden; nullable velden blijven expliciet aanwezig en roundtrip/merge vergelijken ze veld-voor-veld.
      - Missing-userconversie hergebruikt deterministisch eerst een exact gelijk `source_key`. Alleen als zo'n match niet bestaat, mag exact één historical identity met gelijk genormaliseerd non-empty snapshot-email worden hergebruikt. Een conflicterende source-keymatch, meerdere emailmatches, lege/ongeldige email zonder bruikbare source key of metadata die met de kandidaat botst geeft 422 zonder writes; er is geen naam-only fallback.
      - Conversie of hergebruik wijzigt nooit de uit de bron afkomstige immutable participantvelden `display_name_snapshot`, `display_email_snapshot` en `display_type_snapshot`; die worden byte-for-byte uit de participantbackup behouden, ook als de historical identity zelf andere actuele displaymetadata heeft.
    - **Complete atomische auditsnapshot na flush**:
      - Voor iedere aggregate-mutatie wordt `before` vóór mutatie vastgelegd en wordt `after` pas na een succesvolle ORM `flush` geserialiseerd, zodat gegenereerde IDs, FKs, timestamps, status en verhoogde versions hun definitieve persistentiestaat hebben. Commit volgt pas nadat de auditrow met die snapshot succesvol is geflusht.
      - Parent `before` en `after` bevatten telkens de volledige childcollectie binnen scope, inclusief ongewijzigde, toegevoegde, verwijderde en soft-deleted participants, stabiele IDs, identityreference, immutable snapshots, volgorde, actors, timestamps, status en version. Create gebruikt `before=null`/lege children waar toepasselijk; delete/restore/merge/import verliezen geen childstate.
      - Een fout bij domeinflush, after-serialisatie, auditflush of commit rolt parent, alle children, versions en successaudit atomisch terug, behoudens uitsluitend de bestaande failed-importboundary.
    - **Admincheck en denied audit vóór importbody-read**:
      - Import preview/commit/full-restore endpoints authenticeren en autoriseren Admin vóór requeststream-consumptie, multipart parsing, bytebuffering, hashing, JSON parsing, artifactcreatie of importbatchcreatie.
      - Een authenticated niet-admin krijgt 403 en precies één gesaniteerde append-only denied audit met actor, werkelijke method/path en decision, zonder body/content/hash/filename. Zelfs een malformed of oversized body wordt voor die actor niet gelezen en verandert de response niet in 400/413/422.
    - **Canonical CSV-filters onafhankelijk van deleted-management UI**:
      - CSV bouwt uitsluitend op het canonical exportqueryschema en de expliciet aan de exportactie meegegeven urenoverzichtfilters. Lokale filters, page state, selectie of open/gesloten toestand van de admin deleted/history-management UI mogen geen exportparameter of dataset beïnvloeden.
      - Deleted data komt alleen mee via de reeds goedgekeurde expliciete admin-only `include_deleted`/`deleted_only` exportparameters; export gebruikt nooit impliciet deleted-managementstate en past geen listpagination toe.
    - **Audit-UI paging en page size**:
      - De audit-UI rendert server-side previous/next paging, huidige pagina, totaal/paginagrenzen en een page-sizekeuze met exact 25/50/100 en default 25. Iedere filter- of page-sizewijziging reset naar pagina 1; navigatie verstuurt `page` en `page_size` samen met alle actieve filters.
      - Controls volgen servermetadata, zijn correct disabled op eerste/laatste/lege pagina en tonen door deterministische server-side sortering met stabiele ID tie-breaker geen duplicates of omissions.
    - **External-person update uniqueness en statustransities**:
      - Een profielupdate gebruikt `expected_row_version`, normaliseert naam/email met hetzelfde canonical contract als create/import en weigert een gelijk non-empty normalized email van een andere canonical identity met gecontroleerde 409, ook bij een late race. `force_create` is geen updateparameter en kan deze grens nooit omzeilen; name-only gelijkenis blijft uitsluitend advisory volgens de bestaande interpretatie.
      - Een gewone profiel-PATCH mag geen `is_active`, deletevelden of andere statusvelden zetten. Deactivate/activate/soft-delete/restore blijven expliciete domeinacties: active betekent `is_active=true` en geen deletiontuple; inactive betekent `is_active=false` zonder deletiontuple; soft-deleted betekent `is_active=false` met beide deletionvelden gevuld. Halfgevulde of tegenstrijdige tuples, activate van soft-deleted en restore zonder geldige version/uniqueness geven 422 respectievelijk 409 volgens het bestaande conflictcontract, zonder partial write/audit-success.
    - **Duplicate UI force-creategrens**:
      - De quick-add UI toont force-create uitsluitend voor een advisory name-only conflict zonder gelijk non-empty normalized email. Bij hard stable-identity- of emailconflict bestaat geen force-createcontrol, wordt nooit `force_create=true` verstuurd en biedt de UI alleen een bestaande kandidaat kiezen of de toegestane admin recovery/merge-route.
      - Als een serverresponse tegelijk advisory en hard candidates bevat, is de hardste grens leidend en blijft force-create afwezig. Een gemanipuleerde clientrequest blijft backend-side 409.
    - **Alle overview/card-datums in `dd-mm-jjjj`**:
      - Iedere zichtbare kalenderdatum in urenoverzicht-rijen, uitklapdetails, desktop/tablet/mobile cards en totalen-/samenvattingscards gebruikt exact `dd-mm-jjjj`, met voorloopnullen en Europe/Amsterdam als een timestamp naar een kalenderdatum wordt omgezet. ISO `yyyy-mm-dd`, US-notatie en locale-afhankelijke output zijn daar niet toegestaan.
      - Zichtbare timestamps mogen tijd tonen, maar beginnen eveneens met `dd-mm-jjjj`; machinewaarden zoals API ISO-timestamps en native inputwaarden mogen hun technische formaat behouden en vallen niet onder deze displayregel.
    - **Evidence gate**: deze spec-only reopening claimt geen implementatie of nieuw testresultaat. Voor MVP vereisen criteria 111–120 representatieve gerichte dekking van de essentiële auth/privacy/data-integriteits- en rollbackpaden plus alle canonical commands; één-op-één varianten die uitsluitend onder de negen geaccepteerde deferred punten vallen zijn post-MVP. PostgreSQL- en echte-browserevidence blijven afzonderlijke follow-ups en mogen nooit als uitgevoerd worden voorgesteld.

### Accepted post-MVP follow-up / niet-blokkerende technische schuld (product-ownerbesluit 2026-08-04)
De product owner heeft op 2026-08-04 bevestigd dat **exact de onderstaande negen laatst beoordeelde punten niet essentieel zijn voor de MVP**. Ze blijven bewust in deze spec staan om reviewhistorie en toekomstig werk te bewaren, maar zijn vanaf dit besluit geen MVP-acceptatiecriterium, geen MVP-completion gate en geen reden om MVP-closeout te blokkeren. Oudere strengere formuleringen en exact benoemde tests blijven historische/post-MVP referenties en worden voor MVP-status door deze sectie vervangen. Dit besluit verlaagt geen auth-, privacy- of data-integriteitsgrens en wijzigt de canonieke volledige test-, build-, migratie- of SQLite-FK-gates niet.

1. **Deleted dataset parity**: volledige onderlinge pariteit van deleted list, deleted totals en CSV voor expliciet opgevraagde deleted datasets. Admin-only autorisatie vóór query/serialisatie, geen datalek en correct actieve-datasetgedrag blijven MVP-gates.
2. **Preview stable-ID conflict responsevorm**: de keuze tussen HTTP 409 en een gestructureerde HTTP 200-conflictpreview voor stable-ID-collisions. Geen stille overwrite, geen partial write en een zichtbaar/gestructureerd conflict blijven MVP-gates; de definitieve statuscodeconventie is post-MVP.
3. **Exhaustive source-batch provenance reconciliation**: volledige veld-voor-veld roundtrip/reconciliation van alle source-batchprovenance en alle randgevallen. Herstelbare kernregistraties, veilige import, ontbrekende-referenceafwijzing en geen gevoelige provenancelekkage blijven MVP-gates.
4. **Perfect audit refresh/removal snapshots**: perfect vernieuwde audit-timestamps en volledig uitgeschreven snapshots van iedere participant-removalvariant. Append-only audit, actor/action/result, mutatie-atomiciteit en voldoende before/after-traceerbaarheid blijven MVP-gates.
5. **Create-form conveniences**: participant-removal als extra create-formgemak en verdere external-person-deduplicatieconvenience. Minimaal één geldige deelnemer, veilige duplicategrenzen, privacy en backend-validatie blijven MVP-gates; participant add/remove bij bestaande groepsbewerking blijft eveneens binnen MVP.
6. **Independent deleted-list pagination**: een volledig onafhankelijke pagination-state/UX voor de deleted list. Admin-only deleted-items bekijken en herstellen blijft MVP; de deleted list mag voor MVP een begrensde/eenvoudigere paging- of laadflow gebruiken zolang die geen data lekt of restore-integriteit schaadt.
7. **Explicit historical relink target selector**: een expliciete UI-selector voor het historische relinkdoel in plaats van de bestaande veilige defaultflow. Relink blijft admin-only, auditeerbaar, versioned en zonder account- of rechtenoverdracht.
8. **Exhaustive field-error association in every modal**: volledige veldniveau-associatie en first-invalid-focus voor iedere foutvariant in iedere modal. Basis modaltoegankelijkheid, keyboardbediening, focus trap/return, ESC-contract en begrijpelijke Nederlandse foutfeedback blijven MVP-gates.
9. **One-to-one adversarial tests for deferred paths**: iedere hierboven uitgestelde variant als afzonderlijk één-op-één benoemde adversarial testcase. Representatieve gerichte regressiedekking plus de canonieke volledige suites blijven MVP-gates; de fijnmazige één-op-één matrix is post-MVP technische schuld.

**MVP-scopegrens:** alleen deze negen punten zijn gedeferd. Essential auth/privacy/data-integrity requirements, transactionele rollback/no-partial-write, veilige importconflicten, canonical full backend/frontend tests, frontendbuild, verse migratie en SQLite-FK-proof blijven onverkort blokkerend voor MVP-closeout. PostgreSQL-runtime/FK- en echte-browserbewijs blijven afzonderlijke environment-follow-ups en worden niet als lokale PASS voorgesteld, maar blokkeren de lokale MVP-closeout niet.

## Acceptance criteria
### Functioneel/Given-When-Then
1. **Given** een actieve ingelogde User en een registratie met precies één persoon, **when** die de registratie opslaat, **then** verschijnt die direct in overview en totalen met één rij, person count 1 en totalen die de duur reflecteren.
2. **Given** een groepsregistratie met duur 2 uur en drie personen, **when** die wordt opgeslagen, **then** is de tabelrij compact als één groep zichtbaar, toont duration 2, persons 3, total 6, en het uitklappen lijst alle drie deelnemers.
3. **Given** een bestaande groep, **when** de groepsduur wordt gewijzigd, **then** geldt de wijziging voor de hele groep, worden person-hours herberekend en bevat de audit een volledige before/after registratie.
4. **Given** een bestaande groep, **when** een deelnemer wordt toegevoegd of verwijderd, **then** blijft het één groepsregistratie, worden add/remove-acties afzonderlijk geaudit en blijft restore mogelijk.
5. **Given** User A opent en bewaart een registratie die aan User B gekoppeld is, **when** de mutatie wordt opgeslagen, **then** is de audit actor User A en niet User B.
6. **Given** een soft-deleted groep, **when** een normale gebruiker de overview bekijkt, **then** is die groep uitgesloten; **when** een admin restore uitvoert, **then** komt de groep met alle deelnemers terug en blijft historie intact.
7. **Given** een admin een project of post aanmaakt, **when** die masterdata daarna gebruikt wordt in registraties, **then** blijft die selecteerbaar als masterdata, kan die niet hard worden verwijderd, en verloopt archiveren/deactiveren alleen via expliciete statussemantiek die historische verwijzingen behoudt.
8. **Given** een User quick-addt een externe persoon en exact dezelfde naam/email al bestaat, **when** de kandidaat wordt getoond, **then** verschijnt een expliciete waarschuwing met bestaande kandidaten en moet de gebruiker bewust doorgaan of kiezen voor een bestaande persoon.
9. **Given** een externe persoon eenmaal is aangemaakt, **when** alle gebruikers later registreren, **then** is die persoon globaal selecteerbaar, terwijl beschermde velden niet door normale Users te wijzigen zijn.
10. **Given** actieve filters in de urenmodule, **when** de CSV-export wordt gedownload, **then** bevat die exact de vereiste kolommen in de vereiste volgorde, één rij per persoon, en is de output geschikt voor Nederlands Excelgebruik.
11. **Given** een export of lijst, **when** een gebruiker zoekt naar extra CSV-kolommen, **then** zijn die er in v1 niet tenzij expliciet goedgekeurd.
12. **Given** een admin een import-preview draait, **when** een targetrecord een niet-equivalente conflictwijziging heeft, **then** wordt die conflictregel afgewezen in preview in plaats van stil overschreven.
13. **Given** een admin een import bevestigt, **when** de commit start, **then** maakt de applicatie automatisch eerst een pre-import backup die als download behouden blijft en beperkt de restore/merge zich tot de urenmodule.
14. **Given** een import met ontbrekende live user in de bron, **when** de import verwerkt wordt, **then** ontstaat een `WorkHistoricalUserIdentity` snapshot, wordt nooit een nieuwe User-account gemaakt en blijft een auditeerbare relink optioneel beschikbaar.
15. **Given** een normale User een directe API-call doet naar masterdata-, audit- of import-endpoints, **when** die geen admin is, **then** wordt de call server-side geweigerd.
16. **Given** de module opent zonder filterkeuze, **when** de lijst laadt, **then** is de default page size 25, zijn page sizes 25/50/100 beschikbaar en zijn de sort keys exact datum, naam persoon, type persoon, project, post, aantal uren, aangemaakt op en laatst gewijzigd op.
17. **Given** de UI opent op een desktop, tablet of mobiel scherm, **when** de module wordt gebruikt, **then** blijft de tabel bruikbaar, wordt de mobiele layout naar cards/stacks omgezet en werken modals met focus trap, return en ESC.
18. **Given** een record of masterdata-item waarvoor een gewone hard-deleteactie wordt geprobeerd, **when** de actie uit de UI of via de API komt, **then** wordt hard delete geblokkeerd en blijft restore of archiveren/deactiveren het enige toegestane gebruikerspad; alleen de interne admin full-restore-service mag module-rows technisch vervangen volgens criterium 80.
19. **Given** audit, backup/import of restore wordt uitgevoerd, **when** de operatie slaagt of faalt, **then** bevat de audit de actor, het doel, counts en het resultaat.
20. **Given** de backend-regressie `test_about_returns_read_only_payload`, **when** de full backend-suite draait, **then** faalt die test niet meer en blijft de read-only payload consistent met de huidige changelog-titel zonder dat niet-gerelateerde code is overschreven.
21. **Given** de nieuwe frontend route/pagina en zijn tests, **when** `App.test` wordt uitgevoerd, **then** bevat de mock `listWorkHoursMeta` en wordt de pagina zonder mock-fouten gerenderd.
22. **Given** een bestaande groep met deelnemers, **when** een gebruiker of admin de groep bewerkt en deelnemers toevoegt/verwijdert, **then** blijven groep en audit consistent en zijn add/remove-acties volledig afgedekt door UI en API.
23. **Given** soft-deleted items, **when** een admin de deleted-items-UI opent, **then** kan de admin deze items bekijken en herstellen vanuit de UI.
24. **Given** een backup/import van de urenmodule, **when** een admin preview, merge of full restore uitvoert, **then** zijn preview, conflictgedrag, full restore-scope en missing-user relink volledig beschikbaar en testbaar.
25. **Given** admin-only en user-only acties, **when** een niet-gemachtigde gebruiker een restricted flow opent of een directe API-call doet, **then** worden permissions overal consequent afgedwongen in UI én backend.
26. **Given** de module op desktop, tablet of mobiel draait, **when** de lijst met pagination/sorting en de a11y-controls worden gebruikt, **then** werken default page size, sortering, responsieve layout en toetsenbord/focus-gedrag volledig.

### Uitdrukkelijk out of scope
27. Individuele participant-edit als losse detailflow, hard deletion vanuit de interface, payroll/tarief/uurcaps, notificaties, en niet-urenmodule-data blijven buiten scope.

### Completion acceptance criteria mapping
28. **Group editing + participant add/remove**: UI en API moeten groepsbewerkingen volledig ondersteunen, deelnemers toevoegen/verwijderen, audit vastleggen en overzicht/detail direct consistent verversen.
29. **Deleted items + restore**: admin moet soft-deleted items kunnen zien en herstellen vanuit de UI, inclusief terugzetten van volledige groep- en deelnemerstructuren. Volledige onafhankelijke deleted-listpagination en deleted list/totals/CSV-pariteit vallen onder de geaccepteerde post-MVP-punten 1 en 6.
30. **JSON backup/import**: preview, merge, full restore, auto-backup, missing-user historic relink en security limits moeten functioneel zijn en conflicten expliciet afwijzen.
31. **Pagination/sorting/filter/report/export**: de lijst, totalen, report en CSV-export moeten identieke filters/sortering gebruiken en exact het contract blijven volgen.
32. **Masterdata/external management**: projects, posts en external persons moeten merge/visibility/archive/restore-gedrag correct en historisch zichtbaar afhandelen.
33. **Audit**: mutaties, restore, import, merge en denied actions moeten append-only en volledig traceerbaar zijn.
34. **Responsive/a11y**: desktop/tablet/mobile, focus management en keyboard accessibility moeten volledig werken.
35. **Vergaderborden fix**: de volledige frontend suite moet groen zijn na een smalle, compatibele repair van de toolbar-focus regression.
36. **Import conflict handling**: preview en commit rejecteren conflicterende updates expliciet; geen stille overwrite in beide fases.
37. **Pagination**: lijstweergaven gebruiken echte server-side pagination en tonen functionele previous/next controls die overeenkomen met API-resultaten.
38. **Filter/sort contract**: overzicht, totalen, export en import-preview gebruiken exact dezelfde filters en sortering via één gedeeld contract.
39. **Soft-delete PATCH guard**: PATCH op soft-deleted groups faalt totdat restore first is uitgevoerd.
40. **Audit request metadata**: auditregels bevatten de daadwerkelijke request method en request path van de backend-call.
41. **External self-merge guard**: self-merges van external people worden server-side afgewezen.
42. **Regression tests**: ieder essentieel MVP review-remediationpunt heeft gerichte of aantoonbaar equivalente regressiedekking. Eén-op-één adversarial uitsplitsing voor de negen geaccepteerde deferred paths is post-MVP.
43. **Import commit binding**: een commit zonder matchende preview `source_hash` en batch-identiteit wordt server-side geweigerd; de preview/commit pair is cryptografisch/semantisch gekoppeld.
44. **Pre-import backup availability**: de auto-generated pre-import backup bestaat en is beschikbaar vóórdat de gebruiker bevestigt, of de flow verhindert bevestiging totdat die garantie aantoonbaar geldt.
45. **Participant-filter pagination**: queries met participant filters groeperen/dedupliceren vóór pagination, zodat page boundaries en totalen stabiel zijn.
46. **Sort contract enforcement**: alleen de goedgekeurde sort keys zijn toegestaan; person/type sort werkt correct en consistent in list, export en preview.
47. **Deleted-items refresh after restore**: na restore wordt de deleted-items query/cache invalidated en verdwijnt het item direct uit de deleted list.
48. **Targeted regressiecoverage**: ieder essentieel MVP-punt hierboven heeft gerichte of aantoonbaar equivalente regressiedekking; de deferred één-op-één matrix blokkeert MVP-closeout niet.
49. **TypeScript sort_key typing**: beide frontend-sites gebruiken het gedeelde `WorkHourQueryParams`-toegestane union voor `sort_key`; ongeldige sort keys falen type-checking en de relevante frontend-test/bouw blijft groen.
50. **Participant write guard**: **Given** een PATCH of import die een groep zou opslaan met 0 deelnemers of met een deelnemer zonder exact één geldige identity-reference, **when** de operatie wordt gevalideerd, **then** faalt die vóór elke write met een expliciete validatiefout en blijft de database ongewijzigd.
51. **Semantic uniqueness conflicts**: **Given** import preview of commit een projectnaam, `(project, post)` of externe genormaliseerde naam/email colliden, ook als de IDs verschillen, **when** de validatie draait, **then** volgt een gecontroleerde 409 conflict response zonder partial DB error of half toegevoegde records.
52. **CSV sort_key contract**: **Given** een CSV-exportrequest met een `sort_key`, **when** de waarde buiten de exact goedgekeurde enum valt, **then** wordt die afgewezen; alleen de canonical sort keys worden geaccepteerd.
53. **Deleted-items query invalidation**: **Given** filters/sort/page voor deleted-items, **when** een restore plaatsvindt, **then** bevat de query-key alle relevante dependencies en wordt de lijst direct invalidated zodat het herstelde item verdwijnt.
54. **Admin-only restore UI**: **Given** een niet-admin gebruiker, **when** de restore UI rendert, **then** is restore niet zichtbaar of niet enabled; **when** die direct de backend aanspreekt, **then** blijft server-side autorisatie de actie blokkeren.
55. **CSV timezone conversion**: **Given** opgeslagen UTC timestamps, **when** de CSV export wordt gegenereerd, **then** worden `created_at` en `updated_at` geconverteerd naar Europe/Amsterdam en weergegeven in de gedocumenteerde Dutch-compatible output.
56. **External-person quick-add authorization split**: **Given** een niet-admin gebruiker, **when** die de external-person quick-add UI opent, **then** kan die de quick-add flow gebruiken; **and given** dezelfde gebruiker een bestaand external-person record bekijkt, **when** beschermde velden of beheeracties aan bod komen, **then** blijven die hidden of disabled en blijft de backend elke mutatie-/beheerpoging server-side weigeren.
57. **Import commit batch state consistency**: **Given** een import commit die tijdens verwerking faalt en een rollback triggert, **when** de domeintransactie is teruggedraaid, **then** wordt daarna/buiten die rollback de batch als `failed` met veilige foutmetadata en precies één failure-audit vastgelegd, en blijft die niet `committing` of in een andere transient state.
58. **Deleted-items invalidation breadth**: **Given** een deleted-items lijst met actieve filters, sortering en paging, **when** een delete-, import-, full-restore- of restore-actie de dataset wijzigt, **then** worden de relevante query keys geïnvalideerd zodat de deleted list direct ververst.
59. **Duplicate project/post handling**: **Given** project- of post create/update met een semantische duplicate, **when** een conflict vooraf wordt gedetecteerd of de database alsnog een `IntegrityError` werpt, **then** volgt een gecontroleerde 409 of 422 met veldveilige foutmelding en zonder 500.
60. **Historical snapshot/reference restore semantics**: **Given** een backup/import/full restore met registraties die verwijzen naar een archived of soft-deleted external person, **when** de restore wordt voltooid, **then** blijft de registratie gekoppeld aan dezelfde historische snapshot/reference, kan admin history de archived persoon tonen, en kan die persoon niet als nieuwe entry gekozen worden.
61. **Project-scoped post options**: **Given** een create- of edit-formulier met een geselecteerd project, **when** het project verandert, **then** worden de postopties uitsluitend opnieuw opgebouwd uit dat ene project, wordt een ongeldig geworden postselectie direct gewist of disabled, en blokkeert de form submit een post die niet bij het actuele project hoort.
62. **Missing live_user snapshot/relink audit**: **Given** een import of full restore een registratie zonder live_user maar met backup identity metadata treft, **when** de flow wordt bevestigd, **then** is er een `WorkHistoricalUserIdentity` snapshot die uit die metadata is gecreëerd of hergebruikt, blijven alle registraties behouden, worden geen accountrechten toegekend aan een User-account, en blijft een optionele admin relink auditeerbaar.
63. **Role-safe duplicate candidate 409 payload**: **Given** een normale user een duplicate external candidate-conflict triggert, **when** de API een 409 retourneert, **then** bevat de payload geen `email` of interne `note`; **when** een admin dezelfde flow ziet, **then** bevat de payload alleen de toegestane duplicate-details.
64. **Denied hours-admin audit coverage**: **Given** een niet-gemachtigde call naar een hours admin endpoint, **when** de backend de call weigert, **then** schrijft de audit append-only een event met actor, path, method en result/decision en zonder request body, interne note of andere gevoelige payloadvelden.
65. **Controlled live_user participant validation/conversion**: **Given** create of update een ontbrekende/ongeldige `live_user`-reference bevat, **when** validatie draait, **then** volgt gecontroleerd 422 zonder writes of 500. **Given** import/full restore een ontbrekende live user bevat, **when** voldoende eenduidige snapshotmetadata aanwezig is, **then** wordt een historische identiteit gebruikt en blijft de registratie behouden; **when** metadata onvoldoende, inconsistent of niet-identificeerbaar is, **then** volgt 422 zonder domeinwrites. Geen branch bevat een undefined-variable write path.
66. **Historical duplicate candidate visibility**: **Given** duplicate detection voor een external person een archived of soft-deleted kandidaat vindt, **when** de kandidatenlijst rendert, **then** verschijnt die kandidaat als historical candidate in read-only/non-selectable staat met admin guidance voor recovery of merge; **and given** een normale user dezelfde lijst ziet, **then** kan die kandidaat niet als nieuwe entry worden gekozen.
67. **Edit-group picker parity**: **Given** een gebruiker een bestaande groep bewerkt, **when** die een extra deelnemer toevoegt, **then** gebruikt de edit-flow dezelfde picker semantics als create zodat elke eligible actieve live user of external person selecteerbaar is; **and when** historische of inactieve people in de lijst staan, **then** zijn die display-only en niet selecteerbaar.
68. **Amsterdam calendar default date**: **Given** een nieuwe registratie wordt aangemaakt, **when** de datum default ingevuld wordt, **then** is de default de huidige Europe/Amsterdam kalenderdatum; **and when** de serverclock of een UTC ISO-bron een andere datum suggereert, **then** blijft de Amsterdam-kalenderdag leidend.
69. **No undefined live-user validation path**: **Given** create, update en import/full restore worden aangeroepen met onbekende of ontbrekende `live_user`-IDs, **when** elke branch draait, **then** geven create/update steeds 422; import/full restore converteert alleen bij voldoende eenduidige snapshotmetadata en geeft anders 422. Geen branch geeft 500/`UnboundLocalError`/`NameError`. Bij 422 blijven domeintabellen en mutatie-audits ongewijzigd; een commitfailure mag uitsluitend de failed batch en veilige failure-audit nalaten. Er bestaat geen codepad dat een conditioneel ongeïnitialiseerde validatievariabele leest.
70. **PATCH validates every participant atomically**: **Given** een bestaande groep en één PATCH-payload per negatieve variant—onbekende `participant_kind`, nul of meerdere identity-ID-velden, onbekende ID, inactieve live user, inactieve/gearchiveerde/soft-deleted external person, of nieuw geselecteerde historical identity—**when** PATCH wordt uitgevoerd, **then** retourneert iedere variant gecontroleerd 422 met aanwijzing naar de betreffende participant en blijven groep, deelnemers, `row_version` en mutatie-audit exact gelijk. **Given** een geldige payload maar een tijdens flush geforceerde participant-gerelateerde `IntegrityError`, **when** PATCH wordt uitgevoerd, **then** volgt eveneens een gecontroleerde 422, wordt de volledige transactie teruggedraaid en verschijnt geen 500. Een onveranderd behouden historisch/inactief participantrecord blijft als display-only historie toegestaan.
71. **Complete create/edit picker eligibility**: **Given** de actor, minimaal twee andere actieve WindWilly-users, één inactieve WindWilly-user, twee actieve externe personen en één inactieve/gearchiveerde/soft-deleted of historische persoon, **when** create en edit de person picker openen, **then** bevatten beide pickers de actor, alle andere actieve WindWilly-users en alle actieve externe personen als selecteerbare opties. De inactieve/historische records zijn uitsluitend zichtbaar waar nodig om bestaande deelnemers te tonen, zijn display-only en kunnen niet nieuw worden toegevoegd. Een directe gemanipuleerde submit met zo'n niet-selecteerbare identity wordt backend-side met 422 geweigerd.
72. **Admin audit filters and actual request metadata**: **Given** auditregels met verschillende actors, actions, results, methods, paths en timestamps, **when** een admin elk filter afzonderlijk en een gecombineerde actor/action/result/method/path/from/to-query gebruikt, **then** retourneert en rendert de UI uitsluitend de server-side matchende regels. Elke rij toont actor, Europe/Amsterdam-tijd, action, feitelijke request method, feitelijk request path en result/decision. Een path-substringfilter matcht op de opgeslagen daadwerkelijke request path en niet op een afgeleide routenaam; een niet-admin krijgt 403 en ziet geen auditdata of auditcontrols.
73. **Preview semantic conflict 409 contract**: **Given** aparte imports met een projectnaamconflict, `(project, post)`-conflict en externe genormaliseerde naam- of emailconflict terwijl IDs verschillen, **when** preview draait, **then** retourneert ieder geval HTTP 409 met `detail.code = "work_hours_import_semantic_conflict"`, de vier exacte integer-countkeys `total/projects/posts/external_people`, en minimaal één passende candidate met alleen `entity_type/incoming_id/existing_id/conflict_fields`; alle counts corresponderen met de candidates en er zijn geen writes. Een conflictvrije preview blijft succesvol en wordt niet ten onrechte 409.
74. **Commit semantic conflict 409 and bounded persistence**: **Given** een eerder geldige preview waarna vóór commit een semantisch conflict ontstaat, of een conflict dat pas bij flush/commit als integriteitsrace zichtbaar wordt, **when** commit draait, **then** retourneert die HTTP 409 volgens hetzelfde contract als preview, blijven alle urenmodule-domeintabellen en bestaande auditdata inhoudelijk ongewijzigd en worden geen gedeeltelijk geïmporteerde records zichtbaar. Alleen de batchstatus `failed` en precies één veilige failure-audit mogen na rollback worden toegevoegd. Een conflictvrije, correct aan preview gebonden commit blijft succesvol.
75. **Duplicate external quick-add safety**: **Given** een duplicate external quick-add met bestaande kandidaten, **when** de UI de waarschuwing rendert, **then** toont die privacy-safe feedback en kan een hard conflict niet via force-create worden omzeild. Verdere create-form deduplicatieconvenience en gestroomlijnde bestaande-kandidaatselectie zijn post-MVP.
76. **Missing live_user snapshot on import/full restore**: **Given** een import of full restore een registratie treft zonder live_user maar met voldoende eenduidige backup identity metadata, **when** de restore/import wordt bevestigd, **then** ontstaat of hergebruikt de flow een `WorkHistoricalUserIdentity` snapshot uit die metadata, blijven alle registraties behouden, wordt geen User-account aangemaakt of extra rechten toegekend, en blijft een optionele admin relink in audit zichtbaar met before/after linkage. Onvoldoende, inconsistente of ambigue metadata geeft 422 vóór domeinwrites.
77. **Role-safe duplicate candidate 409 payload**: **Given** een normale user een duplicate external candidate-conflict triggert, **when** de API een 409 retourneert, **then** bevat de payload geen `email` of interne `note`; **when** een admin dezelfde flow ziet, **then** bevat de payload alleen de toegestane duplicate-details.
78. **Denied hours-admin audit coverage**: **Given** een niet-gemachtigde call naar een hours admin endpoint, **when** de backend de call weigert, **then** schrijft de audit append-only een event met actor, path, method en result/decision en zonder request body, interne note of andere gevoelige payloadvelden.
79. **Faithful backup roundtrip**: **Given** moduledata met vaste group/participant-ID's, actieve en verwijderde participants, deletion actor/timestamp, create/update actors/timestamps, snapshots, sort order en niet-default `row_version`, **when** backup → full restore op een lege module → backup wordt uitgevoerd, **then** zijn de genormaliseerde domeinenvelopes veld-voor-veld gelijk en zijn alle genoemde IDs/states/actors/timestamps/versions en removed participants behouden.
80. **Full restore replacement boundary**: **Given** bestaande urenmoduledata en niet-urenmoduledata, **when** een admin full restore bevestigt, **then** mag de service urenmodule-rows technisch vervangen, komt de module exact overeen met de backup, en blijven Users, overige app-data en bestaande append-only auditregels ongewijzigd. Er bestaat geen gewone hard-delete-UI/API-route.
81. **Historical conversion and safe relink**: **Given** drie imports met respectievelijk voldoende eenduidige, onvoldoende en conflicterende identitymetadata voor een ontbrekende user, **when** preview en commit draaien, **then** slaagt alleen de eerste via een historische identiteit; de andere twee retourneren 422 zonder domeinwrites. **When** de bestaande veilige relinkflow wordt gebruikt, **then** is die admin-only en versioned, blijft de snapshot bestaan en is de linkage auditeerbaar; een niet-admin krijgt 403 en een stale versie 409. Een expliciete UI-targetselector bovenop de veilige defaultflow is post-MVP.
82. **Role-safe meta/history split**: **Given** dezelfde dataset en calls als User en Admin, **when** hours meta wordt opgevraagd, **then** bevatten beide alleen actieve/selecteerbare opties en minimale displaymetadata. **When** deleted/history/relink endpoints worden opgevraagd, **then** krijgt User 403 zonder records/counts/gevoelige velden en krijgt alleen Admin de gepagineerde dataset.
83. **Complete pre-write import validation**: **Given** afzonderlijke envelopes met een dangling reference, verkeerde project-postrelatie, ongeldige actor/relinkreference, 0/multiple identityrefs, duplicate participant, duur 0/0,25/24,5, toekomstige Amsterdam-datum, onbekend recordtype en ongeldige deletion-state, **when** preview en commit elk worden aangeroepen, **then** worden alle ongeldige varianten vóór domeinwrites gecontroleerd afgewezen met recordlocatie; geen row wordt stil overgeslagen. Duur 0,5 en 24 en de huidige Amsterdam-datum worden geaccepteerd.
84. **Portable DB integrity checks**: **Given** directe persistence-pogingen die servicevalidatie omzeilen, **when** duration half-hours buiten 1..48, niet exact één identityreference of een duplicate actieve participant wordt geschreven op SQLite en waar ondersteund PostgreSQL, **then** weigert de database de transactie. Project-post/selectability/nonfuture blijven aantoonbaar service-side afgedekt.
85. **Failed import persistence boundary**: **Given** een import die na voorbereiding faalt door validatie-, audit-, flush- of commitfout, **when** rollback voltooit, **then** zijn alle urenmodule-domeinrows en mutatie-audits gelijk aan vóór de request, bestaat één `WorkImportBatch(status="failed")` en precies één gesaniteerde failure-audit, en bevatten die geen requestbody, source content of gedeeltelijke before/after-state.
86. **SQL audit filters/paging/timezones**: **Given** meer dan 25 auditregels over twee Amsterdam-kalenderdagen inclusief een DST-grens, **when** actor/action/result/method/path en inclusief Amsterdam `from`/`to` gecombineerd worden met page sizes 25/50/100, **then** filtert/sorteert/pagineert SQL deterministisch, total count en pagina's corresponderen zonder duplicates/omissions, en UI-tijden plus grensinclusie zijn Europe/Amsterdam-correct.
87. **Atomic full before/after audit**: **Given** update, participant add/remove, soft delete, restore, relink en importmutatie, **when** de mutatie slaagt, **then** commit domein en audit samen en bevat audit volledige relevante parent/child before/after-state. **When** audit persistence geforceerd faalt, **then** rolt de domeinmutatie terug en verandert `row_version` niet.
88. **Active/selectable masterdata enforcement**: **Given** actieve, inactieve, archived en soft-deleted projects/posts plus een post uit een ander project, **when** create/PATCH/import een nieuwe of gewijzigde keuze indient, **then** wordt alleen de actieve geldige project-postcombinatie geaccepteerd en geven alle andere 422 zonder writes. Een bestaande historische keuze mag onveranderd display-only blijven maar niet opnieuw worden geselecteerd.
89. **Compare-and-update row versions**: **Given** twee clients met dezelfde `expected_row_version`, **when** client A update/delete/restore/relink/masterdata-mutatie commit en client B daarna schrijft, **then** wijzigt A exact één row en verhoogt de versie met één; B krijgt 409 met veilige actuele versie-informatie en schrijft geen domein- of mutatie-auditrow. Ontbrekende `expected_row_version` wordt eveneens afgewezen.
90. **Participant uniqueness under races**: **Given** duplicate identity in één payload, duplicate via restore/relink en twee concurrerende transacties die dezelfde identity aan één groep toevoegen, **when** elke flow draait, **then** kan maximaal één actieve participant bestaan; de verliezende flow retourneert gecontroleerd 409/422, rolt volledig terug en soft-deleted historische participantrows blijven behouden.
91. **Pre-parse and post-parse JSON limits**: **Given** uploads exact op en één byte boven de limiet, met ontbrekende/vervalste `Content-Length`, plus JSON exact op en boven depth/node-limieten, **when** upload wordt gestreamd, **then** wordt exact-op geaccepteerd, boven-byte vóór volledige buffering/parsing met 413 gestopt, en boven-depth/nodes vóór preview/writes met 422 afgewezen zonder batch/domainwrite.
92. **Responsive cards and modal accessibility**: **Given** keyboard-only bediening van de kernmodals, **when** create/edit/delete/import wordt gebruikt, **then** blijven labels/waarden/acties bereikbaar, hebben controls toegankelijke namen, blijft focus binnen de actieve modal, sluit ESC waar toegestaan en keert focus terug naar trigger of logisch opvolgend element. Exhaustieve field-error/first-invaliddekking voor iedere modal en echte-browser 320px/200%-zoomvalidatie zijn afzonderlijke follow-ups.
93. **Accessible charts**: **Given** een screenreader of uitgeschakelde kleurwaarneming, **when** totalengrafieken worden gelezen, **then** zijn titel, categorie en exacte waarde ook beschikbaar in een semantische tabel/lijst, is betekenis niet kleur-only en zijn decoratieve elementen verborgen.
94. **SQL totals aggregation parity**: **Given** groepen met meerdere participants, participantfilters en soft-deleted groups/participants, **when** list, totals en CSV dezelfde filters gebruiken, **then** komen group count, participant count, group hours en person-hours exact overeen met de deduplicerende basisquery, tellen deleted rows standaard niet mee en materialiseert de totals-route niet alle matchende ORM-records in applicatiegeheugen.
95. **Evidence alignment gate**: **Given** deze spec-only scopescherpstelling, **when** de spec wordt beoordeeld, **then** staat status op `ready for MVP closeout verification` en bevat deze update geen nieuwe PASS- of implementatieclaims. **When** closeoutverificatie draait, **then** worden aantallen rechtstreeks uit de laatste canonical outputs overgenomen; alleen daarna kan status `Completed` worden.
96. **Admin guard on deleted CSV params**: **Given** een niet-admin authenticated User, **when** die CSV export aanroept met `include_deleted=true`, `deleted_only=true`, of `deleted_only=true&include_deleted=false`, **then** retourneert iedere variant 403 vóór exportquery/count/serialization, zonder CSV-body of deleted counts/metadata en met een veilige denied audit. **Given** dezelfde User beide flags false/afwezig gebruikt, **then** blijft export van alleen actieve matches toegestaan. **Given** een Admin deleted-only exporteert, **then** bevat de CSV uitsluitend soft-deleted matches uit het canonical filtercontract.
97. **Role-safe meta/group schemas**: **Given** fixtures met email, notes, identity/source/link/import IDs, archive/deletevelden en create/update/delete actors, **when** een niet-admin `/meta`, list- of groupdetail-success, empty result, 409 of 422 ontvangt, **then** bevat de gerecursiveerde response nergens die verboden keys/waarden en uitsluitend de expliciete public allowlist. **When** een Admin het afzonderlijke history/masterdata-endpoint gebruikt, **then** wordt uitsluitend het adminschema toegepast; een niet-admin call geeft 403 zonder items of total.
98. **All-envelope preflight and constraint mapping**: **Given** één envelope met meerdere fouten verspreid over source batches, actors, source users, parent/child references, exact-één identity, stable IDs, versions/timestamps, uniqueness en statuscoherentie, **when** preview en bound commit ieder draaien, **then** rapporteren zij vóór de eerste domeinwrite alle fouten met stabiele JSON-locaties/codes en slaan geen record stil over. **Given** per named FK/check/unique constraint een geforceerde late `IntegrityError`, **when** commit flush/commit bereikt, **then** wordt uniqueness/race exact 409 en shape/FK/check exact 422, zonder raw DB-detail of partial domain/mutation-audit; een onbekende DB-fout is gesaniteerd 500 met dezelfde rollbackgrens.
99. **Post-MVP — exhaustive provenance reconciliation (historisch criterium)**: veld-voor-veld source-batch/source-userprovenance-roundtrip blijft gewenst, maar blokkeert MVP-closeout niet. Voor MVP blijven dangling references gecontroleerd afgewezen, writes atomisch en gevoelige provenance afgeschermd.
100. **Stable-ID merge safety; responsevorm post-MVP**: **Given** een niet-equivalente stable-ID-collision, **when** preview of merge draait, **then** vindt geen stille overwrite, partial write, reactivatie of her-ID plaats en krijgt de gebruiker gestructureerde conflictinformatie. Of preview dit als HTTP 409 dan wel gestructureerde HTTP 200 representeert, wordt post-MVP gestandaardiseerd.
101. **Audited preview/backup/download and atomic full snapshots**: **Given** import preview, backup creation en authorized/denied/not-found download, **when** iedere flow eindigt, **then** bestaat exact één passend veilig audit event met actor, action/result, method/path, batch/artifact-ID en counts zonder body/content/path/email. Een artifact is pas downloadbaar na succesvolle artifactmetadata+auditcommit. **Given** update/delete/restore/import/external merge participants wijzigt, **then** bevat één atomische mutation audit de volledige parent en alle getroffen child before/after-states; een geforceerde auditfailure laat artifact/domain/children/versions/status ongewijzigd, behoudens de eerder goedgekeurde failed-importboundary.
102. **Immutable participant display snapshots on external merge**: **Given** bestaande participants van een te mergen external source, **when** een geldige merge naar target slaagt, **then** wijzen de gereconcilieerde references naar target maar zijn alle drie display-snapshotvelden byte-for-byte ongewijzigd en toont audit dat expliciet. Nieuwe participants gebruiken targetdisplaydata. **Given** source en target al actief in dezelfde group staan, **then** retourneert merge 409 vóór writes en vindt geen stille dedupe plaats.
103. **Force-create aligned with uniqueness**: **Given** een advisory normalized-namecandidate zonder gelijk non-empty normalized email, **when** `force_create` ontbreekt/false is, **then** volgt role-safe candidate feedback en geen create; **when** na expliciete confirmation `force_create=true` wordt verzonden, **then** mag precies één nieuwe row ontstaan. **Given** dezelfde stable identity of hetzelfde non-empty normalized email al bestaat of tijdens een race ontstaat, **when** `force_create` false of true is, **then** volgt gecontroleerd 409, blijft één canonieke row bestaan en wordt geen successaudit geschreven. Niet-boolean force input is 422.
104. **Paged admin archive/history and valid restore**: **Given** meer dan 100 archived projects/posts/external people en historical identities, **when** Admin pagina's 25/50/100 met filters/sortering doorloopt, **then** komen total/page boundaries uit dezelfde SQL-query en zijn er door stable-ID tie-break geen duplicates/omissions; User krijgt 403 zonder count. **Given** restorevarianten valid, stale, uniqueness-conflicting, incoherent en post-under-unavailable-parent, **when** restore draait, **then** slaagt alleen valid restore met één versionincrement, atomische full audit en meta/history invalidation; stale/conflict is 409, incoherent is 422, en alle failures schrijven geen domain mutation.
105. **Coherent status transitions and parent checks**: **Given** de volledige matrix active, archived, deleted-from-active, deleted-from-archived en iedere halfgevulde/tegenstrijdige tuple, **when** create/PATCH/import/archive/delete/restore/unarchive wordt gevalideerd, **then** worden uitsluitend de vier vastgelegde coherente states en toegestane domeintransities geaccepteerd. **Given** een post of group een inactive/archived/deleted of verkeerd parentproject gebruikt, **then** geven create/update/import/restore 422 zonder writes; projectarchive/delete verwijdert childselectability direct maar herstelt children nooit stil. Restore-from-active wordt active en restore-from-archived blijft archived.
106. **`/urenverantwoording` browser compatibility**: **Given** een directe browsernavigation naar `/urenverantwoording?project_id=p1#overzicht`, **when** routing voltooit, **then** rendert de urenmodule daar of volgt exact één niet-loopende redirect naar `/wervelnieuws/urenverantwoording?project_id=p1#overzicht`; er verschijnt geen 404/placeholder. De canonical route en backend-APIprefix blijven functioneel en APIrequests worden niet door de frontendredirect onderschept.
107. **Canonical active list/totals/export filters**: **Given** de actieve dataset en iedere afzonderlijke/combinatievariant van `work_date`, `project_id`, `post_id`, `participant_kind`, trimmed `query`, iedere toegestane `sort_key` en `asc|desc`, **when** list, totals en CSV worden opgevraagd, **then** komen IDs/order/totals uit dezelfde deduplicerende basisquery en bevat CSV alle matches onafhankelijk van listpage. Lege waarden normaliseren naar null, onbekende sort/direction/params en conflicterend gedupliceerde params geven 422. Niet-admin deleted flags geven altijd 403; volledige list/totals/CSV-pariteit voor expliciete admin deleted datasets is post-MVP.
108. **Modal focus, inertness, ESC and return**: **Given** create/edit/delete/import/restore/merge/force-confirm modals en keyboard-only bediening, **when** elke modal opent, tab/shift-tab cyclust, achtergrond wordt aangeklikt/gefocused, ESC sluit en trigger wel/niet meer bestaat, **then** staat initial focus correct, verlaat focus de bovenste modal niet, is achtergrond inert/onactiveerbaar, sluit ESC alleen dismissible topmost zonder mutatie en keert focus naar trigger of logisch opvolgend control. Een committing modal negeert ESC en geneste confirm retourneert eerst naar de parentmodal.
109. **Post-MVP — exhaustive field-error association (historisch criterium)**: volledige `aria-invalid`/error-ID/first-invalid-focusdekking over iedere foutvariant in iedere modal blijft gewenst maar blokkeert MVP niet. Voor MVP blijven Nederlandse zichtbare foutfeedback en de basis keyboard-, focus trap/return- en ESC-contracten verplicht.
110. **MVP evidence gate and scope**: **Given** de negen expliciet geaccepteerde post-MVP-punten, **when** MVP-closeout wordt beoordeeld, **then** blokkeren ontbrekende één-op-één tests voor uitsluitend die deferred paths niet. Completion vereist wel representatieve gerichte checks voor essentiële auth/privacy/data-integriteitsflows én alle canonical commands met actuele exit-0-evidence; deze specupdate zelf claimt geen implementatie of nieuw testresultaat.
111. **SQLite FK PRAGMA op iedere connection**: **Given** twee afzonderlijk nieuw geopende SQLite DBAPI-connections via de gedeelde engineinitialisatie en een verse Alembic-database, **when** `PRAGMA foreign_keys` op iedere connection wordt gelezen, **then** is de waarde telkens exact `1`. **When** servicevalidatie wordt omzeild en een orphan FK-row direct wordt geflusht, **then** weigert SQLite de transactie, blijven parent/child/auditcounts gelijk en werkt een daarna nieuw geopende connection nog steeds met `foreign_keys=1`. PostgreSQLinitialisatie probeert geen PRAGMA uit te voeren.
112. **Complete preflight refs, coherence en actieve participants**: **Given** één envelope met tegelijk dangling project/post/external/historical/source/actor/linkreferences, verkeerde parents, create/update/archive/delete/link actor-timestampmismatches, niet-positieve of incoherente versions/timestamps/statussen en een actieve group met nul actieve participants, **when** preview en bound commit afzonderlijk draaien, **then** rapporteren beide alle varianten met dezelfde stabiele codes/JSON-locaties vóór de eerste domein- of mutatie-auditwrite. **Given** een deleted group met geldige verwijderde participanthistorie en een actieve group met minimaal één geldige actieve participant, **then** wordt alleen die coherente vorm door deze preflightgrens geaccepteerd.
113. **Historical actor provenance en deterministische reuse**: **Given** een historical identity met create/update/delete/link actorprovenance en nullable velden, **when** backup → full restore → backup en stable-ID merge draaien, **then** blijven alle actor-ID's, timestamps, status en nulls veld-voor-veld gelijk. **Given** missing-userimports met (a) exacte source-keymatch, (b) geen source-keymatch maar exact één normalized-emailmatch, (c) conflicterende source-keymetadata, (d) meerdere emailmatches en (e) alleen een naam, **then** hergebruiken alleen (a) en (b) deterministisch respectievelijk via source key en daarna email; (c)–(e) geven 422 zonder writes. In alle gevallen blijven participant display snapshots byte-for-byte gelijk aan de bron en worden ze niet uit de identity opnieuw opgebouwd.
114. **Atomic audit MVP-grens**: **Given** een essentiële domeinmutatie, **when** die slaagt, **then** worden domein en append-only audit atomisch vastgelegd met actor/action/result en voldoende before/after-state om de mutatie te reconstrueren. **When** domein- of auditpersistency faalt, **then** rolt de mutatie volledig terug, behoudens alleen de goedgekeurde failed-importrecords. Perfect vernieuwde audit-timestamps en volledige participant-removal snapshots voor iedere randvariant zijn post-MVP.
115. **Importadmin denial vóór body-read**: **Given** een authenticated niet-admin en per import preview/commit/full-restore een malformed body, een body boven de limiet en een requeststream die bij de eerste read faalt, **when** het endpoint wordt aangeroepen, **then** volgt steeds 403 zonder dat `receive`/multipart/hash/parser/artifact/batchcode is aangeroepen. Er ontstaat precies één veilige denied audit met actor en werkelijke method/path/decision en zonder filename, hash, body of content; er zijn geen domeinrows. Een Admin doorloopt daarna wel de bestaande stream- en parservalidatie.
116. **CSV onafhankelijk van deleted-managementstate**: **Given** dezelfde urenoverzichtfilters en achtereenvolgens gesloten, geopende, gefilterde en gepagineerde deleted/history-management UI-state, **when** gewone export wordt gestart, **then** zijn requestquery, rij-IDs, volgorde en CSV byte-equivalent en bevatten ze uitsluitend de canonical actieve matches. Alleen expliciete admin exportflags wijzigen dit naar include-deleted/deleted-only; listpage, deleted-UI-page en lokale deletedfilters worden nooit meegestuurd of toegepast.
117. **Audit UI serverpaging**: **Given** 126 gefilterde auditregels, **when** een Admin default pagina's en page sizes 25/50/100 doorloopt, **then** verstuurt de UI correcte `page/page_size` plus alle filters, toont correct total en grenzen en levert ieder stabiel ID exact één keer zonder omissions. Filter- en sizewijziging reset naar pagina 1; previous/next zijn op eerste/laatste/lege pagina correct disabled. Een niet-admin ziet geen controls en kan paging niet gebruiken om data te verkrijgen.
118. **External update uniqueness/statuscoherentie**: **Given** external-personupdates met gelijk normalized non-empty email, een flush-race op dat email, ontbrekende/stale version, statusvelden in gewone PATCH, iedere halfgevulde deletiontuple, activate-while-deleted en restore met uniquenessconflict, **when** elke variant draait, **then** volgt gecontroleerd 409 voor uniqueness/race/stale en 422 voor shape/state-invaliditeit, zonder 500, partial row/versionwijziging of successaudit. **Given** geldige profielupdate, deactivate, activate, soft-delete en restore, **then** gebruikt iedere flow compare-and-update, verhoogt de version exact éénmaal en eindigt uitsluitend in active, inactive of coherent soft-deleted state; name-only similarity blijft advisory en force-create bestaat niet op update.
119. **UI force-create alleen advisory**: **Given** afzonderlijk een advisory name-only candidate, hard normalized-emailcandidate, hard stable-identitycandidate en een gemengde advisory+hard response, **when** quick-add rendert, **then** toont alleen de eerste variant na expliciete bevestiging een force-createcontrol en verstuurt alleen daar `force_create=true`. De overige varianten tonen geen force-createcontrol en verzenden dit veld nooit; een handmatig hard-conflictrequest met `force_create=true` krijgt 409 en maakt geen row/successaudit.
120. **Datumnotatie in overview/cards**: **Given** kalenderdatums met enkelcijferige dag/maand en timestamps aan beide zijden van UTC-middernacht/DST, **when** desktopoverzicht, expanded row, tablet/mobile cards en totalen-/samenvattingscards renderen, **then** gebruikt iedere zichtbare datum exact `dd-mm-jjjj` met voorloopnullen en waar nodig de Europe/Amsterdam-kalenderdag; geen zichtbare ISO- of US-datum komt voor. Eventuele zichtbare tijdstempels beginnen met hetzelfde datumformaat, terwijl technische input/API-values ongewijzigd mogen blijven.
121. **Vergaderborden toolbar Tab-focus closure**: **Given** **Nieuwe update** of **Update bewerken** geopend is, **when** een keyboardgebruiker voorwaarts en achterwaarts door focusbare controls binnen de volledige editor-shell navigeert, **then** blijft de toolbar zichtbaar zolang focus binnen die shell staat en verdwijnt die pas zodra focus de shell verlaat. De bestaande toegankelijke namen, rollen, Tab-volgorde, focusbaarheid, keyboardacties en focus-returnsemantiek blijven ongewijzigd; geen control wordt uit de accessibility tree of Tab-volgorde gehaald om de test te laten slagen.
122. **Gerichte en volledige frontendgate**: **Given** de smalle toolbarrepair, **when** eerst `VergaderbordenPage.test.tsx` en daarna de volledige frontendtestset en productiebuild draaien, **then** zijn alle drie exit 0 en de gerichte test dekt standaard verborgen, focus-in, Tab/Shift+Tab binnen de shell en focus buiten de shell voor create en edit. Een alleen aangepaste/verzwakte test zonder overeenkomstige gedragsrepair voldoet niet.
123. **Schone Alembic+SQLite-FK-proof**: **Given** een nieuwe tijdelijke directory en aantoonbaar niet-bestaande SQLite-database, **when** `DATABASE_URL` en `STORAGE_ROOT` vóór Alembic in dezelfde shell worden geëxporteerd en door alle proofsubprocessen worden geërfd, **then** migreert Alembic tot `head` met exit 0, rapporteren minimaal twee afzonderlijke nieuwe app-engineconnections exact `PRAGMA foreign_keys=1`, wordt een directe orphan-FK-insert geweigerd en volledig teruggedraaid, en rapporteert een daarna geopende connection opnieuw exact `1`.
124. **Scope- en evidencegate voor deze reopening**: **Given** alleen deze specupdate is goedgekeurd, **when** vóór implementatie de worktree wordt beoordeeld, **then** bevat deze handeling geen app-, test-, dependency-, migratie- of configwijzigingen en geen nieuwe PASS-/implementatieclaim. Completion vereist nieuw bewijs voor criteria 121–123 plus de hieronder benoemde gerichte en volledige commands; historische evidence telt daarvoor niet.
125. **Product-owner MVP deferment**: **Given** het product-ownerbesluit van 2026-08-04, **when** MVP-closeout wordt beoordeeld, **then** worden uitsluitend de negen punten in **Accepted post-MVP follow-up / niet-blokkerende technische schuld** niet als completion blockers geteld. Alle overige essentiële criteria en de canonieke test/build/migratie/FK-gates blijven blokkerend; status wordt pas `Completed` na actuele closeoutverificatie.

## Testing plan
### Strategie
- Voor MVP-closeout zijn de negen expliciet geaccepteerde post-MVP-punten niet blokkerend. De hieronder historisch opgesomde één-op-één tests die uitsluitend die negen paths bewijzen, vormen een post-MVP-backlog; zij hoeven niet te bestaan of afzonderlijk groen te zijn voor MVP-closeout.
- De MVP-gate blijft: representatieve gerichte regressietests voor essentiële auth/privacy/data-integriteit en daarna alle canonical backend/frontend tests, frontendbuild, verse migratie en SQLite-FK-proof met exit 0.
- Voor deze smalle reopening: reproduceer en draai eerst de gerichte Vergaderborden-test, draai vervolgens de gerichte SQLite-FK-tests en de schone geëxporteerde Alembic+FK-shellproof, en pas daarna de volledige frontend/backendsets en frontendbuild.
- Toolbarverificatie moet echte `userEvent.tab()`- en `Shift+Tab`-navigatie gebruiken voor zowel create als edit en moet de actieve focuspositie plus toolbar-zichtbaarheid vóór en na het verlaten van de shell assert-en. Geen snapshot-only of mouse-only vervanging.
- De Alembic-proof gebruikt één shellcontext met expliciete `export DATABASE_URL=...` en `export STORAGE_ROOT=...`; een commandprefix op alleen Alembic of ontbrekende exports in de aansluitende Python-/testsubprocessen is ongeldig bewijs.
- Gebruik per suite een tijdelijke SQLite-database en tijdelijke storage.
- Test eerst de gerichte regressiepunten van de reopened increments, waaronder historische conversie bij voldoende metadata versus 422 bij onvoldoende identiteit, exacte importrollbackgrenzen, faithful roundtrip, role-safe datasets, preflight/DB-integriteit, SQL audit/totals, row-version concurrency, resource limits en responsive/a11y; draai daarna volledige backend/frontend-suites, build en migratie.
- Voor deze final completion is `npm run build` verplicht naast de volledige canonical verificatie; status mag pas naar Completed als alle canonical checks groen zijn.
- Voor de backend-verificatie moet expliciet de repository `.venv` worden gebruikt met een writable tijdelijke `STORAGE_ROOT`; voer canonical backend checks niet via system Python uit.
- Test happy paths, permissies, conflictgedrag, backup/import en restore, plus pagination/sorting en responsive/a11y-coverage.
- Voeg voor de review-remediation gerichte tests toe voor import-conflictafwijzing, server-side pagination met previous/next, gedeelde filter/sort-contracten, soft-delete PATCH weigering, audit method/path logging en external self-merge rejection.
- Voeg voor de integrity-remediation gerichte tests toe voor preview/commit binding, pre-import backup availability, participant-filter pagination dedupe/grouping vóór LIMIT/OFFSET, sort-key whitelisting en person/type sort, en deleted-items cache invalidation na restore.
- Voeg voor deze reopened final-review remediation gerichte regressietests toe voor: PATCH/import participant-count en identity-reference guarding, semantic uniqueness conflict-detectie in preview en commit, CSV sort_key enum rejection, deleted-items query-key/invalidation, admin-only restore UI plus backend protection, en UTC→Europe/Amsterdam CSV timestamp rendering.
- Voeg voor de latest review findings gerichte regressietests toe voor: historische snapshot/reference-preservation bij backup/import/full restore van registraties met archived/soft-deleted external people; admin history surface-only gedrag zonder selecteerbaarheid voor nieuwe entries; project-scoped post options per form met clear/disable op project change; en duplicate external quick-add UI met privacy-safe candidate rendering, existing-candidate selection en deliberate force-create.
- Voeg voor de approved latest findings gerichte regressietests toe voor: missing live_user snapshot/reuse uit backup identity metadata bij import/full restore met behoud van registraties, no-account-rights en auditable admin relink; role-safe duplicate candidate 409 payload zonder email/internal note voor normale users en met toegestane details voor admins; en denied hours-admin endpoints met append-only audit van actor/path/method/result zonder payloadlekkage.
- Voeg voor de latest four findings gerichte regressietests toe voor: controlled 422 op create/update bij invalid/missing live_user references en op import bij onvoldoende/ambigue metadata, historische conversie bij voldoende metadata, zonder 500 of undefined-variable path; historical duplicate candidates; edit-group picker parity; en default registratiedatum als Europe/Amsterdam-kalenderdatum.
- De onderstaande exact benoemde tests blijven de volledige historische/post-MVP catalogus. Voor MVP zijn de essentiële auth/privacy/data-integriteitsvarianten en representatieve rollback/no-write-tests vereist; tests die uitsluitend één van de negen deferred paths uitwerken zijn niet blokkerend.
- Backendtests voor essentiële flows tonen waar relevant aan dat validatie vóór de eerste domeinwrite plaatsvindt en dat rollbackgrenzen behouden blijven.

### Exacte gerichte regressietests voor deze reopening
1. Backend participant validation in `backend/tests/test_work_hours_api.py`:
   - `test_create_unknown_live_user_returns_controlled_422_without_writes`
   - `test_update_unknown_live_user_returns_controlled_422_without_writes`
   - `test_import_unknown_live_user_returns_controlled_422_without_writes`
   - `test_import_missing_live_user_with_and_without_identity_metadata_has_no_undefined_path`
   - Parametrized `test_patch_rejects_each_invalid_participant_identity_without_partial_write` met exact: onbekende kind, geen identity-ID, meerdere identity-IDs, onbekende ID, inactieve live user, inactieve external, archived external, soft-deleted external en nieuw geselecteerde historical identity.
   - `test_patch_retains_existing_historical_participant_as_display_only`
   - `test_patch_participant_integrity_error_returns_422_and_rolls_back_every_write`, waarbij een flush-time `IntegrityError` wordt geforceerd en groep, participants, `row_version` en mutatie-audit vóór/na gelijk blijven.
2. Backend picker metadata/API in `backend/tests/test_work_hours_api.py`:
   - `test_person_picker_returns_all_eligible_active_users_and_external_people`, met actor + twee andere actieve users + twee actieve externals.
   - `test_person_picker_excludes_inactive_historical_and_deleted_from_selectable_options`, terwijl een al gekoppelde historische deelnemer via displaymetadata zichtbaar blijft.
   - `test_manipulated_participant_submit_cannot_select_display_only_identity` verwacht 422 en geen writes.
3. Frontend picker in de bestaande urenmodule-testfile:
   - `shows all eligible active users and external people in create and edit pickers`.
   - `keeps inactive and historical participants display-only and not selectable`.
   - `does not fall back to current-user-only options`, met een fixture waarin de actor niet de eerste of enige eligible user is.
4. Backend audit API in de bestaande hours admin/audit-testfile:
   - Parametrized `test_admin_audit_filters_actor_action_result_method_path_and_time_range` voor elk afzonderlijk filter.
   - `test_admin_audit_combined_filters_return_only_matching_actual_request_metadata`.
   - `test_non_admin_cannot_query_hours_audit` verwacht 403 en geen auditpayload.
5. Frontend admin audit UI in de bestaande admin-audit-testfile:
   - `filters audit by actor action result method path and inclusive time range` en verifieert de verstuurde queryparameters.
   - `renders actor Amsterdam time action actual method path and result for every row`.
   - `does not expose hours audit controls or rows to non-admin users`.
6. Backend import conflict contract in de bestaande work-hours import-testfile:
   - Parametrized `test_import_preview_semantic_conflict_returns_structured_409_without_writes` voor projectnaam, `(project, post)`, external normalized name en external normalized email, telkens met afwijkende IDs.
   - `test_import_preview_conflict_counts_match_candidates_and_exact_contract_keys`.
   - `test_import_preview_without_semantic_conflicts_does_not_return_409`.
   - Parametrized `test_import_commit_semantic_conflict_returns_same_409_contract_without_writes` voor dezelfde vier conflictsoorten die na preview ontstaan.
   - `test_import_commit_integrity_race_returns_structured_409_and_rolls_back_all_module_writes`.
   - `test_conflict_free_preview_bound_commit_still_succeeds`.

### Historische/post-MVP testcatalogus voor adversarial hardening
De in deze en volgende adversarial catalogi genoemde tests blijven traceerbare gewenste dekking. Voor zover een test uitsluitend één van de negen geaccepteerde deferred paths bewijst, is die niet langer onderdeel van de MVP-completion gate. Tests voor auth, privacy, data-integriteit, rollback/no-partial-write en de canonical gates blijven wel MVP-verplicht.
1. Backup/import/full restore in de bestaande work-hours import-testfile:
   - `test_backup_full_restore_roundtrip_preserves_all_domain_fields_and_stable_ids`
   - `test_backup_roundtrip_preserves_deleted_group_and_participant_state_actors_timestamps_and_versions`
   - `test_backup_roundtrip_preserves_removed_participants_without_reactivating_them`
   - `test_full_restore_replaces_only_hours_module_rows_and_preserves_append_only_audit`
   - `test_merge_does_not_silently_skip_or_reactivate_removed_participants`
   - Parametrized `test_missing_user_snapshot_metadata_conversion_contract` voor sufficient, insufficient, ambiguous en inconsistent metadata.
   - `test_historical_identity_relink_is_admin_only_versioned_and_fully_audited`
2. Complete import preflight en rollback in de bestaande work-hours import-testfile:
   - Parametrized `test_import_preflight_rejects_every_invalid_envelope_before_domain_writes` voor dangling refs, project/post mismatch, actor/relink refs, identity cardinality, duplicate participant, durations `0`, `0.25`, `24.5`, future Amsterdam date, unknown record type en incoherent deletion state.
   - Parametrized `test_import_preflight_accepts_duration_boundaries_and_current_amsterdam_date` voor `0.5` en `24`.
   - `test_import_preflight_reports_all_errors_with_stable_record_locations_and_no_silent_skips`
   - Parametrized `test_failed_import_rolls_back_domain_and_mutation_audit_but_persists_one_safe_failure_record` voor validation, mutation-audit, flush en commit failure.
   - `test_failed_import_audit_does_not_leak_request_body_source_or_partial_snapshots`
3. DB constraints en participant uniqueness in model/service tests:
   - Parametrized `test_portable_work_hours_checks_reject_invalid_duration_identity_cardinality_and_active_participant_duplicate` op SQLite en, wanneer de CI-service beschikbaar is, PostgreSQL.
   - `test_duplicate_participant_payload_is_rejected_without_writes`
   - `test_restore_and_relink_cannot_create_duplicate_active_participant`
   - `test_concurrent_participant_insert_allows_exactly_one_active_identity_per_group`
   - `test_soft_deleted_duplicate_participant_history_remains_preserved`
4. Role-safe meta/masterdata in `backend/tests/test_work_hours_api.py`:
   - `test_hours_meta_contains_only_active_selectable_options_and_minimal_historical_display_data`
   - `test_non_admin_deleted_history_and_relink_endpoints_return_403_without_metadata_leak`
   - Parametrized `test_create_patch_import_enforce_same_active_project_post_selectability_contract` voor inactive, archived, soft-deleted en wrong-project variants.
   - `test_unchanged_historical_masterdata_reference_is_display_only_but_cannot_be_reselected`
5. Row-version concurrency in `backend/tests/test_work_hours_api.py` en masterdata tests:
   - Parametrized `test_mutations_require_expected_row_version_and_use_compare_and_update` voor update, soft delete, restore, relink en masterdata update.
   - `test_stale_expected_row_version_returns_409_without_domain_or_audit_write`
   - `test_concurrent_updates_allow_one_winner_and_increment_version_once`
6. Audit SQL en atomiciteit in de hours audit-testfile:
   - `test_audit_filters_sort_count_and_page_in_sql_without_duplicates_or_omissions`
   - `test_audit_amsterdam_inclusive_range_is_correct_across_dst_boundary`
   - Parametrized `test_mutation_and_full_before_after_audit_commit_atomically` voor update, participant add/remove, delete, restore, relink en importmutation.
   - `test_audit_persistence_failure_rolls_back_domain_and_row_version`
7. Streaming/import resource limits in import/API tests:
   - `test_import_stream_accepts_exact_byte_limit_and_rejects_limit_plus_one_before_parse`
   - `test_import_stream_limit_cannot_be_bypassed_by_missing_or_false_content_length`
   - Parametrized `test_import_postparse_depth_and_node_limits_reject_before_preview_or_writes` met exact-at-limit en over-limit fixtures.
8. SQL totals in repository/API tests:
   - `test_totals_use_sql_aggregation_over_same_filtered_deduplicated_base_query`
   - `test_totals_match_list_and_csv_with_participant_filters_and_deleted_rows`
   - `test_totals_endpoint_does_not_materialize_all_matching_orm_rows`
9. Frontend urenmodule-tests:
   - `renders role-safe selectable meta and hides deleted/history datasets from non-admins`
   - `renders mobile cards without viewport overflow at 320px and 200 percent zoom`
   - `supports accessible names linked errors keyboard flow modal trap escape and focus return`
   - `exposes chart titles categories and exact values through a semantic table or list`
   - `does not encode chart meaning by color alone and hides decorative chart elements`
    - `shows stale row version conflict without applying optimistic stale state`

### Exacte adversarial regressietests voor latest findings
1. CSV authorization en canonical filters in `backend/tests/test_work_hours_api.py`:
   - Parametrized `test_csv_deleted_flags_require_admin_before_query_or_serialization` voor `include_deleted=true`, `deleted_only=true` en `deleted_only=true&include_deleted=false`; assert 403, lege CSV-body/no deleted metadata en dat exportrepository/serializer niet is aangeroepen.
   - `test_regular_user_csv_without_deleted_flags_exports_only_active_matches`
   - `test_admin_deleted_only_csv_contains_only_deleted_canonical_matches`
   - Parametrized `test_list_totals_and_csv_share_canonical_filter_and_sort_contract` voor elk filter, combinaties, querytrim, elke sort key/direction en een participantfilter met deduplicatie; assert CSV = alle gefilterde matches, niet alleen listpage.
   - Parametrized `test_canonical_query_contract_rejects_unknown_duplicate_and_invalid_values` voor onbekende param, conflicterend gedupliceerde param, sort key en sort direction; verwacht 422 zonder query-uitvoering.
2. Role-safe schemas in `backend/tests/test_work_hours_api.py`:
   - `test_non_admin_meta_schema_recursively_excludes_email_internal_identity_provenance_deletion_and_actor_fields`
   - `test_non_admin_group_list_and_detail_schemas_recursively_exclude_email_internal_identity_provenance_deletion_and_actor_fields`
   - Parametrized `test_non_admin_error_and_empty_group_responses_use_public_schema_without_leakage` voor empty, 409 en 422.
   - `test_admin_history_uses_separate_schema_and_non_admin_gets_403_without_items_or_total`
3. Import preflight/constraint mapping in de bestaande work-hours import-testfile:
   - Parametrized `test_import_preflight_validates_every_actor_reference_and_state_coherence_before_writes` voor create/update/archive/delete/link actor, nullability violation, dangling source user/batch, group/participant parent, project/post parent, incomplete relink tuple, active-child/deleted-parent en iedere incoherente status tuple.
   - `test_import_preflight_collects_all_cross_record_errors_with_stable_json_locations_before_any_write`
   - Parametrized `test_late_named_integrity_error_maps_to_constraint_specific_409_or_422_and_rolls_back` voor iedere module unique/FK/check constraint; assert exact status/code, geen raw DB-detail en domein/mutatie-audit vóór/na gelijk.
   - `test_unknown_late_database_error_is_sanitized_500_and_rolls_back_all_domain_and_mutation_audit`
4. Provenance en merge-equivalentie in de bestaande work-hours import-testfile:
   - `test_backup_roundtrip_preserves_referenced_source_batches_and_explicit_null_manual_provenance`
   - Parametrized `test_backup_roundtrip_preserves_nullable_source_user_id_and_missing_user_source_key_boundary` voor existing, null en missing User.
   - `test_import_rejects_dangling_source_batch_or_unconvertible_source_user_before_writes`
   - Parametrized `test_merge_same_stable_id_is_noop_only_when_every_contract_field_is_equivalent` over alle entitytypes.
   - Parametrized `test_merge_stable_id_field_difference_returns_localized_409_without_silent_overwrite` voor null, actor, timestamp, version, status, snapshot, relation, order, source batch en deleted child.
5. Audit en artifactatomiciteit in import/audit tests:
   - Parametrized `test_preview_backup_and_download_write_one_sanitized_audit_for_each_result` voor preview success/failure, backup success/failure en download success/denied/not-found.
   - `test_backup_artifact_is_not_available_when_metadata_or_audit_persistence_fails`
   - Parametrized `test_parent_and_all_participant_child_snapshots_audit_atomically` voor update, delete, restore, import en external merge.
   - `test_child_snapshot_audit_failure_rolls_back_parent_children_versions_and_status`
6. External merge en force-create in API/service tests:
   - `test_external_merge_retargets_reference_but_keeps_all_participant_display_snapshots_byte_identical`
   - `test_external_merge_audit_contains_complete_child_before_after_with_immutable_display_snapshots`
   - `test_external_merge_rejects_source_target_participant_collision_without_silent_dedupe`
   - `test_force_create_allows_confirmed_advisory_name_match_without_equal_email`
   - Parametrized `test_force_create_cannot_bypass_hard_identity_or_normalized_email_uniqueness` voor false/true en flush-race; verwacht 409, één row, geen successaudit.
   - `test_force_create_requires_boolean_and_never_bypasses_authorization_or_validation`
7. Archived/history paging, restore en state transitions in API/repository tests:
   - Parametrized `test_admin_archived_masterdata_and_history_pages_are_sql_paged_counted_and_stably_sorted` voor project, post, external person en historical identity bij page sizes 25/50/100.
   - `test_non_admin_archived_masterdata_history_returns_403_without_items_or_total`
   - Parametrized `test_restore_validates_version_uniqueness_state_and_parent_before_atomic_write` voor valid, stale, semantic conflict, incoherent state en unavailable parent.
   - Parametrized `test_project_post_status_transition_matrix_accepts_only_coherent_states` voor active, archived, deleted-from-active, deleted-from-archived en alle halfgevulde/conflicterende tuples.
   - `test_restore_from_active_becomes_active_and_restore_from_archived_remains_archived`
   - `test_project_archive_or_delete_removes_child_selectability_without_cascade_restore`
   - Parametrized `test_post_and_group_writes_reject_unavailable_or_wrong_parent_project` voor create, update, import en restore.
8. Routecompatibiliteit in de bestaande frontend routingtest:
   - `preserves direct urenverantwoording compatibility route with query and hash`
   - `does not loop redirect or intercept urenverantwoording api requests`
   - `renders the same module on canonical and compatibility navigation without placeholder or 404`
9. Modal/a11y in de bestaande urenmodule frontendtest, met fake timers alleen waar nodig en bij voorkeur `userEvent` + `axe`/DOM-asserties:
   - Parametrized `traps focus and makes background inert in every hours modal` voor create, edit, delete, import/preview, restore, merge en force-create confirmation.
   - Parametrized `escape_closes_only_topmost_dismissible_modal_without_mutation_and_returns_focus` voor dezelfde modals, inclusief verdwenen trigger en logisch opvolgend control.
   - `does not close committing modal on escape and nested confirmation_returns_to_parent_modal`
   - `associates_each_field_error_and_moves_focus_to_first_invalid_field`
   - `announces_api_error_assertively_and_async_success_politely_once`
   - `retains_field_errors_until_that_field_is_validly_revalidated`
10. Adversarial suite gate:
    - Draai voor MVP eerst de gerichte essentiële auth/privacy/data-integriteits- en rollbacktests. Een gecombineerde test mag voor MVP representatieve dekking leveren; één-op-één uitsplitsing van uitsluitend de negen deferred paths blijft post-MVP.
    - Draai daarna exact de canonical commands uit deze spec. PostgreSQL-runtime/constraintbewijs blijft een afzonderlijke environment-follow-up wanneer geen service beschikbaar is en wordt nooit als PASS geteld; het blokkeert de lokale MVP-closeout niet.

### Exacte negatieve/adversarial regressietests voor latest ten code findings
1. SQLite connection enforcement in de engine-/migratietests:
   - `test_every_new_sqlite_connection_enables_foreign_keys_pragma`, opent minimaal twee gelijktijdig afzonderlijke DBAPI-connections en daarna een nieuwe pooled connection; iedere assert exact `PRAGMA foreign_keys == 1`.
   - `test_sqlite_foreign_key_pragma_rejects_direct_orphan_insert_and_rolls_back`
   - `test_alembic_sqlite_connection_has_foreign_keys_enabled`
   - `test_postgresql_engine_initialization_does_not_execute_sqlite_pragma`, met mocked dialect/connection; echte PostgreSQL-uitvoering blijft de afzonderlijke environment-follow-up.
2. Importpreflight in de bestaande work-hours import-testfile:
   - Parametrized `test_import_preflight_validates_all_project_post_external_historical_and_actor_references_before_writes` voor project, post, external person, historical identity, source user/batch en create/update/archive/delete/link actor.
   - Parametrized `test_import_preflight_rejects_state_timestamp_and_version_incoherence_before_writes` voor actor-zonder-timestamp, timestamp-zonder-actor, update-before-create, archive/delete/link-before-create, non-positive version, active+deleted/archived en halfgevulde status/deletion/link tuples.
   - Parametrized `test_import_preflight_requires_at_least_one_active_participant_per_active_group` voor nul participants, alleen soft-deleted participants, participant onder verkeerde group en geldige deleted-group history; preview en bound commit geven dezelfde locaties/codes en no-write assertions.
   - `test_import_preflight_collects_all_latest_reference_coherence_and_empty_group_errors_in_one_response`
3. Historical identity provenance/conversion in import/modeltests:
   - `test_historical_identity_backup_roundtrip_preserves_all_create_update_delete_link_actor_provenance`
   - Parametrized `test_missing_user_reuse_prefers_exact_source_key_then_unique_normalized_email` voor source-key+different-emailcandidate, no-source-key+unique-email en beide exact; assert gekozen stable identity deterministisch.
   - Parametrized `test_missing_user_reuse_rejects_conflicting_source_key_ambiguous_email_and_name_only_fallback_without_writes`
   - `test_missing_user_conversion_preserves_participant_display_snapshots_byte_for_byte_in_export_restore_and_audit`
4. Audit ordering/completeness in audit/service tests:
   - Parametrized `test_complete_audit_after_snapshot_is_captured_only_after_domain_flush` voor create, update, participant add/remove, delete, restore, external merge en import; instrumenteer flush/serializer-callorder en definitieve IDs/versions.
   - Parametrized `test_complete_audit_contains_full_child_before_after_not_only_changed_children` voor dezelfde aggregateflows, inclusief unchanged en soft-deleted children.
   - Parametrized `test_domain_after_serialization_audit_flush_and_commit_failures_roll_back_complete_aggregate_and_success_audit` voor iedere genoemde failurefase.
5. Import authorization/body-read ordering in API tests:
   - Parametrized `test_non_admin_import_endpoints_deny_and_audit_before_reading_request_body` voor preview, commit en full restore, met een receive-sentinel die bij iedere read faalt.
   - Parametrized `test_non_admin_malformed_or_oversized_import_still_returns_403_without_parser_artifact_or_batch_calls`
   - `test_import_denial_audit_contains_actual_actor_method_path_decision_and_no_body_metadata`
   - `test_admin_import_request_reaches_existing_stream_size_and_parser_validation`
6. CSV/UI state independence in API/frontendtests:
   - Parametrized `test_csv_export_is_independent_of_deleted_management_filters_page_and_visibility_state` voor closed/open/filtered/paged state; assert dezelfde canonical request en byte-equivalente CSV.
   - `test_csv_export_sends_deleted_flags_only_when_admin_explicitly_selects_deleted_export`
   - `test_csv_export_never_inherits_list_or_deleted_management_pagination`
7. Audit frontendpaging in de bestaande admin-audit-testfile:
   - Parametrized `audit UI requests and renders server pages at page sizes 25 50 and 100`.
   - `audit UI preserves filters across paging and resets page on filter or page size change`.
   - `audit UI disables previous and next at first last and empty page boundaries`.
   - `audit UI stable paging renders 126 ids without duplicates or omissions`.
8. External-person update in API/service tests:
   - Parametrized `test_external_update_hard_email_uniqueness_and_flush_race_return_409_without_partial_write` voor preflightconflict en late race.
   - Parametrized `test_external_profile_patch_rejects_status_fields_and_incoherent_deletion_tuples` voor ieder statusveld en iedere halfgevulde/tegenstrijdige tuple.
   - Parametrized `test_external_explicit_status_actions_produce_only_coherent_active_inactive_or_deleted_state` voor deactivate, activate, soft-delete, restore, activate-while-deleted en uniqueness-conflicting restore.
   - `test_external_update_requires_current_row_version_increments_once_and_has_atomic_full_audit`
   - `test_external_update_has_no_force_create_bypass_and_name_only_similarity_remains_advisory`
9. Duplicate quick-add frontend/backend boundary:
   - Parametrized `force create is rendered only for advisory name conflict and never for hard email identity or mixed conflict` voor advisory-name, hard-email, hard-identity en mixed response.
   - `hard duplicate UI never sends force_create even after candidate interaction`.
   - `manipulated hard duplicate force_create request returns 409 without row or success audit`.
10. Datumformattering in de urenmodule frontendtest:
   - Parametrized `renders every overview expanded and card date as dd-mm-jjjj` voor desktop, tablet, mobile en summary/total cards met `2026-01-02` → `02-01-2026`.
   - `renders Amsterdam calendar date around UTC midnight and DST without ISO or US date leakage`.
   - `visible timestamps start with dd-mm-jjjj while native inputs retain technical values`.
11. Gate:
    - Iedere uitgevoerde essentiële negatieve testcase vergelijkt relevante domain-, child-, version- en successauditstate vóór/na; statuscode-only assertions zijn onvoldoende.
    - Draai de essentiële subset gericht vóór de canonical commands. Eén-op-één varianten die uitsluitend de negen deferred paths betreffen zijn post-MVP. Ontbrekende PostgreSQL/browserinfrastructuur wordt uitsluitend onder Follow-ups/evidence als `NOT RUN` vastgelegd en niet vermengd met lokale testclaims.

### Backendtests
- Datavalidatie: datum, duur, project/post-relatie, exact-één identity-constraint, soft delete semantics.
- Groepsgedrag: éénpersoonssave, groepssave, duurwijziging, participant add/remove, delete/restore.
- Autorisatie: User mag muteren; masterdata/audit/import is admin-only; directe endpointcalls worden geweigerd.
- Masterdata: project/post create/edit/archive/restore; hard delete blokkades.
- Personen: quick-add, duplicate warning, merge, deactiveersemantiek, historische snapshot en relink.
- Export/import: exacte CSV-kolommen, filters, Excel-compatibiliteit, preview conflict reject, automatic backup, full restore scope, en behoud van registraties die verwijzen naar archived/soft-deleted external people.
- Audit: actor, target, before/after, counts, history snapshots.
- Regresie: `test_about_returns_read_only_payload` blijft groen met de juiste changelog title/current title mapping.
- Integrity remediation: preview/commit source_hash-batch binding, pre-import backup availability gate, participant-filter pagination dedupe/grouping vóór pagination, sort-key whitelist/person-type sort, deleted-items invalidation na restore.
- Final-review remediation: participant pre-write validation, semantic uniqueness conflict rejection met 409/no partial DB error, CSV sort_key enum rejection, backend restore authorization, en UTC→Europe/Amsterdam CSV timestamp conversion.
- Approved latest findings: import/full restore missing live_user snapshot creation/reuse from backup metadata with preserved registrations and no account-rights grant; admin relink auditability; role-safe 409 payloads; and append-only denied-hours audit without sensitive payload leakage.
- Latest approved review remediation: volledige create/update/import participant 422-matrix, atomische PATCH-validation inclusief geforceerde `IntegrityError`, complete picker eligibility, auditfilters plus feitelijke requestmetadata, en identieke structured semantic-conflict 409-contracten voor preview/commit met no-write assertions.

### Frontendtests
- Default page size 25; sort keys en sort order.
- Filters combinabel over overview, totalen en export.
- Compacte groep-rij met uitklappen van deelnemers.
- Groep edit, participant add/remove, deleted-items restore en import/merge flows.
- Mobiele/tablet responsiviteit.
- Modals met focus trap/return/ESC.
- Horizontale staafdiagrammen met semantische alternatieven.
- Admin states, denied states en Dutch copy.
- Testmock-coverage voor `listWorkHoursMeta` op de nieuwe route/pagina.
- Form state coverage voor project-wijziging die postopties herberekent, invalide postselecties cleared/disabled, en submit-blokkade afdwingt.
- Duplicate external quick-add coverage voor privacy-safe kandidaten, bestaande-kandidaatselectie en deliberate force-create.
- `VergaderbordenPage.test.tsx` toolbar-focus regressie moet gericht groen zijn voordat de full suite draait.
- `VergaderbordenPage.test.tsx` toolbar blur/unmount gedrag moet expliciet regressievrij zijn voordat de full suite en canonical checks als afgerond gelden.
- Integrity remediation front-end coverage voor preview/commit binding feedback, pre-import backup availability state, sort-key validation messaging, pagination stability cues en deleted-items refresh after restore.
- Final-review frontend coverage voor admin-only restore visibility/enabled state, deleted-items refresh after restore, en CSV export contract messaging waar de UI het sort- of timestampgedrag toont.
- TypeScript typing coverage voor de twee `sort_key`-sites: compile-time union typing plus een gerichte test als die nodig is om de contractgrens vast te zetten.
- Approved latest findings frontend coverage voor role-safe duplicate candidate rendering: normale users zien geen email/internal note in de 409-candidate UI, admins zien alleen de toegestane details, en de UI blijft bruikbaar bij import/full restore flows met missing live_user snapshots.
- Latest four findings frontend/backend coverage voor controlled 422 live_user validation, historical duplicate candidate guidance, edit-group picker parity en Amsterdam-calendar default date.
- Latest approved review remediation: create/edit pickerfixtures bewijzen selectie van andere actieve users en actieve externals plus display-only historie; admin-auditfixtures bewijzen alle filters, queryparameters en zichtbare actor/time/action/method/path/result details, inclusief non-admin negatieve dekking.
- Smalle closure-remediation: de bestaande `VergaderbordenPage.test.tsx`-regressie gebruikt echte Tab en Shift+Tab voor **Nieuwe update** en **Update bewerken**, assert focus binnen/buiten de editor-shell en bewijst behoud van toolbarbediening en bestaande accessibility-semantiek.

### Canonical commands
- `cd backend && pytest`
- `cd backend && alembic upgrade head`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- Backend-variant voor deze remediation: `cd backend && source .venv/bin/activate && STORAGE_ROOT=$(mktemp -d) pytest`
- Backend-variant voor deze remediation: `cd backend && source .venv/bin/activate && STORAGE_ROOT=$(mktemp -d) alembic upgrade head`

### Verplichte commands voor de smalle closure-remediation
1. Gericht toolbarfocus:
   - `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`
2. Gericht SQLite connection-/FK-gedrag:
   - `cd backend && tmp=$(mktemp -d) && export DATABASE_URL="sqlite:///$tmp/targeted.db" && export STORAGE_ROOT="$tmp/storage" && mkdir -p "$STORAGE_ROOT" && .venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'every_new_sqlite_connection_enables_foreign_keys_pragma or sqlite_foreign_key_pragma_rejects_direct_orphan_insert_and_rolls_back or alembic_sqlite_connection_has_foreign_keys_enabled or postgresql_engine_initialization_does_not_execute_sqlite_pragma'`
3. Schone Alembic+SQLite-FK-proof in één shell; het Python-subprocess moet de twee exports erven:

   ```bash
   cd backend
   tmp=$(mktemp -d)
   export DATABASE_URL="sqlite:///$tmp/work-hours.db"
   export STORAGE_ROOT="$tmp/storage"
   mkdir -p "$STORAGE_ROOT"
   test ! -e "$tmp/work-hours.db"
   .venv/bin/alembic upgrade head
   .venv/bin/python - <<'PY'
   from sqlalchemy import text
   from sqlalchemy.exc import IntegrityError
   from app.core.db import engine

   first = engine.connect()
   second = engine.connect()
   try:
       assert first.scalar(text("PRAGMA foreign_keys")) == 1
       assert second.scalar(text("PRAGMA foreign_keys")) == 1
   finally:
       first.close()
       second.close()

   with engine.connect() as connection:
       before = connection.scalar(text("SELECT count(*) FROM work_posts"))
       connection.commit()
       try:
           with connection.begin():
               connection.execute(text("INSERT INTO work_posts (id, created_at, updated_at, project_id, name, description, is_active, is_archived, row_version) VALUES ('closure-orphan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'missing-project', 'Orphan', '', 1, 0, 1)"))
       except IntegrityError:
           pass
       else:
           raise AssertionError("SQLite accepteerde een orphan-FK-row")
       assert connection.scalar(text("SELECT count(*) FROM work_posts")) == before

   with engine.connect() as after:
       assert after.scalar(text("PRAGMA foreign_keys")) == 1
   print("Alembic + SQLite FK proof: PASS")
   PY
   ```
4. Volledige gates na de gerichte checks:
   - `cd frontend && npm test -- --run`
   - `cd frontend && npm run build`
   - `cd backend && tmp=$(mktemp -d) && export DATABASE_URL="sqlite:///$tmp/full.db" && export STORAGE_ROOT="$tmp/storage" && mkdir -p "$STORAGE_ROOT" && .venv/bin/python -m pytest`
- Iedere commandoutput wordt nieuw vastgelegd met exitstatus en aantallen. Geen eerdere run, gedeeltelijke Alembicrun of proofsubprocess zonder beide exports geldt als bewijs voor criteria 121–124.

## Risk + rollback plan
### Risks
- Queryverschillen kunnen overview, export en import-preview uit sync brengen.
- Onvolledige snapshots kunnen historisch traceren bemoeilijken.
- Te soepele import kan stille overschrijvingen veroorzaken.
- Onvoldoende toegankelijke grafiek- en modalimplementatie kan UX/a11y schaden.
- Een gerichte changelog-title fix kan onverwacht read-only payload-gedrag of bestaande about-payload-regressies onthullen als de regressie te breed wordt gecorrigeerd.
- Een incomplete testmock kan nieuwe route/page coverage verhullen; daarom is full-suite verificatie verplicht.
- De nog open scope rond groepsbewerking, deleted-items, import/restore en permissies kan anders gedeeltelijk blijven en later regressies veroorzaken.
- Deze reopened remediation moet strikt gescheiden blijven van unrelated audio/GenAI worktree changes; rollback moet alleen de urenmodule-spec beïnvloeden.
- De latest review findings moeten als afzonderlijke, smalle fixes blijven behandelbaar; rollback per finding mag geen collateral impact op de overige urenmodule-scope hebben.
- Een participant-validatie die pas op database-flush faalt kan zonder transactionele afbakening partial writes of misleidende audit opleveren; daarom zijn rollback-asserties verplicht.
- Preview en commit kunnen uiteenlopen door concurrency; beide moeten dezelfde semantic-conflictdetector en hetzelfde 409-contract gebruiken en late integriteitsraces gecontroleerd vertalen.
- Een picker die alleen de current user of gecachte subsets toont kan geldige deelnemers uitsluiten; create en edit moeten dezelfde volledige server-side eligibilitybron gebruiken.
- Auditfilters die client-side worden toegepast kunnen onvolledige pagina's of misleidende resultaten geven; filtering en paging blijven server-side.
- Een backup die deletionmetadata of removed participants weglaat is niet herstelbaar; roundtripvergelijking moet daarom het volledige genormaliseerde domein omvatten.
- Losse transacties voor domein en audit kunnen traceability breken; alleen de expliciet afgescheiden failed-batch/failure-audit-transactie vormt een uitzondering na rollback.
- Portable uniqueness met soft-deleted participants kan per database verschillen; ontwerp en tests moeten dezelfde actieve-uniekheidssemantiek op SQLite en PostgreSQL behouden.
- Byte-, depth- en nodelimieten die pas na onbeperkt bufferen worden gecontroleerd beschermen niet tegen resource exhaustion.
- Hergebruik van adminschemas voor gewone Users kan via geneste success- of errorpayloads alsnog email, actors, deletionstate of interne references lekken; public schemas moeten daarom allowlist-based en recursief getest zijn.
- `force_create` kan bij een onduidelijke duplicategrens botsen met DB-uniekheid; de harde email/stable-identitygrens en advisory name-onlygrens moeten in service, constraintmapping en UI identiek zijn.
- Source-batchprovenance kan lokale paden of broninhoud lekken; backup exporteert alleen de benoemde niet-gevoelige subset en maakt null provenance expliciet.
- Een merge die childreferences bijwerkt maar display snapshots herschrijft vernietigt historische bewijswaarde; child snapshots zijn immutable en audit/rollbacktests zijn verplicht.
- Afzonderlijke list/export parsers kunnen filters, deleted authorization of sortering laten divergeren; één canonical schema en basisquery is de rollbackveilige grens.
- Handmatige focus trapping zonder werkelijk inert background kan screenreader/keyboardinteractie laten ontsnappen; native dialog of aantoonbaar equivalente inert fallback is vereist.
- SQLite-FK-handhaving op slechts één engine- of checkoutpad kan een schijnveilig schema opleveren; de connect-hook en meervoudige-connectiontests vormen daarom één rollbackunit.
- Autorisatie die na FastAPI bodybinding draait kan ongeautoriseerde uploads toch bufferen of parsen; dependencyvolgorde en een receive-sentinel moeten aantonen dat denial vóór iedere read gebeurt.
- Historical-identityfallback op naam of ongedefinieerde matchvolgorde kan identities verkeerd samenvoegen; source key en daarna unieke normalized email zijn de enige toegestane deterministic reusekeys.
- Een audit-`after` vóór flush kan tijdelijke IDs/versions of een incomplete childcollectie vastleggen; flush, volledige serialisatie en auditcommit moeten atomisch en in die volgorde blijven.
- UI-statelek tussen deleted management en export kan ongemerkt deleted data exporteren; exportparameters worden uitsluitend uit het canonical exportform/querycontract opgebouwd.
- Generic PATCH-statusvelden of een update-force-bypass kunnen external-person state en uniqueness uiteen laten lopen; profielupdate en expliciete statusacties blijven gescheiden.
- Een toolbarfix die controls uit de Tab-volgorde haalt, focus kunstmatig terugduwt of ARIA/rollen wijzigt kan de regressietest maskeren maar breekt de goedgekeurde accessibility-semantiek; zulke oplossingen zijn expliciet niet toegestaan.
- Een focus-handler kan bij `relatedTarget=null`, unmount of snelle Tab/Shift+Tab-overgangen voortijdig sluiten; create en edit moeten daarom dezelfde volledige shellgrens en echte keyboardtests delen.
- Environmentvariabelen die alleen vóór Alembic als commandprefix staan, worden niet automatisch door een volgend proofsubprocess geërfd; de closure-proof is alleen geldig met voorafgaande shell-exports van zowel `DATABASE_URL` als `STORAGE_ROOT`.

### Rollback
- Alles blijft module-gebonden; rollback betekent de nieuwe urenroutes, views, services en migraties terugdraaien.
- Gebruik forward/rollback Alembic-migraties.
- Audit blijft append-only en hoeft niet te worden verwijderd.
- Bij ernstige regressie kan de route tijdelijk read-only gemaakt worden als noodmaatregel.
- Rollback voor deze remediation gebeurt per klein wijzigingsset: revert alleen de regressiefix, mock-aanpassing of scope-uitbreiding die aantoonbaar de fout introduceerde.
- Deze increment heeft wél modulegebonden schemahardening: duration-check en actieve participant-identity-uniekheid. Rollback moet daarom model en Alembic-definitie samen terugzetten; laat bestaande append-only auditdata ongemoeid en activeer nooit tijdelijk een service/schema-combinatie die verschillende uniquenessregels gebruikt.
- Voor adversarial hardening is rollback per logisch onderdeel toegestaan, maar een rollback mag nooit een gedeeltelijk nieuw backupformaat of incompatibele schema/validatorcombinatie actief laten. Gebruik zo nodig een forward fix en houd eerder gemaakte backups leesbaar.
- Voor deze latest remediation worden schema/privacygrens, importvalidator+constraintmapping, provenanceformaat, statusmachine, merge/uniqueness en modal primitives elk als één intern consistente rollbackunit behandeld. Rol nooit alleen een DB-constraint, response schema of backupreader terug zonder de bijbehorende service/writer/tests; behoud `/urenverantwoording` gedurende iedere rollback.
- Voor criteria 111–120 zijn SQLite connectioninitialisatie, importpreflight, historical reuse/export, auditflush/serialisatie, importauth-volgorde, canonical exportstate, auditpaging, external update/status, duplicate UI en datumformatter afzonderlijke kleine rollbackunits. Rol bij een fout alleen de betreffende unit terug, maar laat nooit een writer zonder bijpassende validator/constraint/test of een UI-bypass zonder serverguard actief.
- Werkelijke schemarealiteit: historical identities hebben in de nog niet uitgebrachte urenmodulemigratie nu ook `created_by_user_id` en `updated_by_user_id` met User-FK's. Een rollback van provenance moet model, Pydantic backupcontract en Alembic-definitie samen terugzetten; een database met deze kolommen mag niet met een oudere writer worden gemengd zonder expliciete forward/downgrade-stap.
- Rollback van de smalle closure-remediation revert uitsluitend de toolbarfocuswijziging en de bijbehorende gerichte testaanpassing als die de bestaande semantiek niet kan behouden. De FK-proof wijzigt alleen tijdelijke data en vereist geen productiedata-rollback; verwijder de tijdelijke directory na bewijs. Urenmodulecode, migraties en unrelated worktreewijzigingen blijven onaangeroerd.

## Notes / links
- Relevante context:
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/styles.css`
  - `backend/app/models/entities.py`
  - `backend/app/services/audit_service.py`
  - `backend/app/api/deps.py`
  - `backend/app/api/admin.py`
  - `backend/alembic/versions/`
  - Unrelated worktree changes voor audio/GenAI zijn expliciet buiten scope van deze remediation.
- Assumpties:
  - Deze urenmodule-spec is de actieve change, omdat haar actuele blocker- en follow-upsecties exact zowel de Vergaderborden toolbar-Tab-failure als de onvolledige Alembic+SQLite-FK-proof benoemen; de oudere aparte toolbarfocus-spec blijft ongewijzigd.
  - “Zonder changing intended accessibility semantics” betekent dat de bestaande toegankelijke namen, rollen, DOM-/Tab-volgorde, focusbare controls, keyboardacties en focus-returncontracten normatief blijven; alleen de defecte focusgrens/timing mag worden gerepareerd.
  - De schone FK-proof draait lokaal tegen een nieuwe tijdelijke SQLite-database en schrijfbare tijdelijke storage; de tijdelijke directory bevat geen productiedata en mag na verificatie worden verwijderd.
  - De bestaande authroute blijft leidend voor CSRF-gedrag.
  - De module gebruikt de bestaande User/Admin-splitsing; geen nieuwe RBAC-laag.
  - Historische snapshots blijven snapshots, ook na relink.
  - Backend dependency drift die alleen optreedt onder system Python geldt hier als environment-only; canonical backend verificatie loopt via de repository `.venv`.
  - De door de gebruiker genoemde “latest four” worden gegroepeerd als: (1) participant identity-validatie inclusief PATCH-atomiciteit, (2) create/edit picker, (3) admin audit UI en (4) import semantic-conflictcontract.
  - Participant-gerelateerde vorm-/referencefouten gebruiken 422; uniqueness/concurrencyconflicten gebruiken 409 waar de request semantisch geldig maar conflicterend is; semantische importconflicten gebruiken 409 volgens het hierboven vastgelegde contract.
  - Request-path filtering is een server-side substringmatch op de feitelijk opgeslagen request path; method, actor, action en result gebruiken exacte matches en `from`/`to` zijn inclusief.
  - “Voldoende snapshotmetadata” betekent minimaal een niet-lege snapshotnaam plus een eenduidige stabiele bronidentifier en/of genormaliseerde snapshot-email; de combinatie mag niet naar meerdere historische/live identities wijzen en mag intern niet conflicteren.
  - Exacte JSON byte/depth/node-limietwaarden blijven configureerbaar en moeten vóór implementatie in de voorbeeldconfig/documentatie worden vastgelegd; de acceptance tests gebruiken de ingestelde waarden en beide grenszijden.
  - PostgreSQL-specifieke constrainttests mogen conditioneel op een beschikbare CI-service draaien; dezelfde service- en SQLite-contracttests zijn altijd verplicht.
  - `id` van de opgevraagde group en een opaque/resource selection key zijn functioneel noodzakelijke identifiers in het public schema; onder “interne IDs” vallen identity-FK's, actor-ID's, importbatch/provenance-ID's en overige opslagdetails die niet nodig zijn voor de handeling.
  - De force-creategrens is: gelijk genormaliseerd non-empty email of dezelfde stable identity is hard/non-bypassable; uitsluitend een name-only candidate zonder gelijke non-empty email is advisory en bewust forceerbaar. Dit concretiseert de eerder goedgekeurde deliberate force-create zonder DB-uniekheid te omzeilen.
  - Source batches worden als niet-gevoelige provenance-subset in backup v2 opgenomen. Handmatige records gebruiken expliciet null provenance. Bij een werkelijk ontbrekende User is `source_user_id` de nullable live-FK-grens en blijft de oorspronkelijke stable bron-ID in `source_key`/provenance behouden conform de al goedgekeurde historical conversion.
  - Een compatibility redirect van `/urenverantwoording` naar `/wervelnieuws/urenverantwoording` is toegestaan als querystring/hash behouden blijven; de backend APIprefix blijft `/urenverantwoording` en wordt niet hernoemd.
  - Export gebruikt dezelfde selectie en sortering als list/totals, maar niet listpagination: alle matching rows worden geëxporteerd.
  - “Iedere SQLite-connection” betekent iedere door de repository gedeelde runtime-, test- of Alembic-engine geopende DBAPI-connection; externe handmatig buiten deze factories geopende `sqlite3`-connections vallen niet onder applicatiegarantie, maar worden uitsluitend in tests gebruikt om servicevalidatie bewust te omzeilen.
  - Historical reuse vergelijkt eerst exact `source_key` en alleen bij afwezigheid van zo'n kandidaat exact één canonical normalized non-empty snapshot-email; displaynaam alleen is nooit een identitykey. Conflicterende metadata wordt niet stil geharmoniseerd.
  - Historical actorprovenance omvat expliciet `created_by_user_id`, `updated_by_user_id`, `deleted_by_user_id` en `linked_by_user_id` met de bijbehorende create/update/delete/link timestamps voor zover het statuscontract die gebeurtenis kent; nullable afwezigheid wordt als expliciete null geëxporteerd.
  - External-person name-only similarity blijft advisory en niet uniek; `force_create` blijft uitsluitend een create/quick-addbevestiging en is geen update- of statustransitieparameter.
  - De `dd-mm-jjjj`-regel betreft zichtbare urenmodule-overview/cardtekst. API-serialisatie en native datuminputwaarden blijven ISO-technisch om bestaande contracten niet te breken.
  - PostgreSQL-integriteitsuitvoering en echte-browserbewijs blijven afzonderlijke environment-follow-ups; zij worden niet stil afgeleid uit SQLite- of DOM-tests.
  - Product-owneracceptatie van 2026-08-04 geldt uitsluitend voor de exact negen punten in de geaccepteerde post-MVP-sectie. “Niet essentieel voor MVP” betekent niet verwijderd of afgewezen: de punten blijven traceerbare technische schuld, maar tellen niet mee als MVP-completion gate.
  - Voor deferred punt 5 betekent “create-form participant removal” uitsluitend extra convenience tijdens een nog niet opgeslagen create-flow; minimaal één geldige deelnemer en participant add/remove bij bestaande groepsbewerking blijven MVP.
  - Voor deferred punt 2 blijft conflictveiligheid normatief; alleen het exacte previewtransportcontract (structured 200 versus 409) wordt uitgesteld.

## Current status
Completed (MVP) — finale onafhankelijke review is **APPROVED FOR MVP**. De product owner heeft exact negen niet-essentiële reviewpunten als geaccepteerde post-MVP technische schuld aangemerkt; deze blokkeren de MVP-closeout niet. De essentiële auth/privacy/data-integriteits- en rollbackgrenzen en alle lokale canonieke gates zijn bevestigd. PostgreSQL-runtime/FK- en echte-browserchecks zijn afzonderlijke, niet-blokkerende environment-follow-ups. Geen commit of push.

## What changed
- **Finale MVP-closeout (2026-08-04)**: de herziene MVP-scope is afgesloten na product-owneracceptatie van de exact negen post-MVP follow-ups en onafhankelijke eindreview **APPROVED FOR MVP**. De lokale canonieke backend- en frontendsuites, productiebuild, schone Alembic-migratie t/m `20260730_0026`, SQLite-FK-proof en diff-check zijn groen. Deze finalisatie wijzigt uitsluitend deze actieve change spec; er zijn geen app-, test-, migratie-, dependency-, configuratie- of overige documentatiebestanden gewijzigd.
- **Spec-only MVP scopebesluit (2026-08-04)**: exact negen laatst beoordeelde punten zijn met product-owneracceptatie verplaatst naar de duidelijk gelabelde post-MVP/non-blocking technische-schuldsectie. Hun oudere criteria en testcatalogus blijven zichtbaar als historie, maar zijn expliciet uit de MVP-completion gates gehaald. Essentiële auth/privacy/data-integriteit, rollback/no-partial-write en de canonieke full test/build/migratie/SQLite-FK-gates zijn niet afgezwakt. Er zijn voor dit besluit geen app-, test-, migratie-, dependency- of configbestanden gewijzigd en er wordt geen implementatie of nieuw testresultaat geclaimd.
- **Narrow closure-remediation afgerond (2026-08-04)**: create en edit gebruiken dezelfde volledige editor-shellfocusgrens; bij een ontbrekende `relatedTarget` controleert de blurhandler na de focusovergang `document.activeElement`, zodat snelle textarea→toolbar-overgangen de toolbar niet voortijdig sluiten en echte focus buiten de shell hem wel sluit. Rollen, accessible names, DOM-/Tab-volgorde, focusbaarheid, keyboardacties en focus-return zijn niet gewijzigd.
- De gerichte Vergaderborden-regressietest wacht eerst de bestaande modal-initial-focus af en doorloopt daarna met echte `userEvent.tab()` en `Shift+Tab` voor zowel **Nieuwe update** als **Update bewerken**: initieel verborgen, focus binnen de shell, heen/terug tussen textarea en alle bestaande toolbarcontrols en vertrek aan beide shellgrenzen. De bestaande null-`relatedTarget`-regressiedekking blijft behouden.
- De schone Alembic+SQLite-FK-proof gebruikte één shell met vooraf geëxporteerde schrijfbare `DATABASE_URL` en `STORAGE_ROOT`; er is geen backend-, migratie-, model-, dependency- of configuratiecode gewijzigd voor deze closure.
- **Spec-only narrow reopening (2026-08-04)**: scope, aanpak, stappen, criteria 121–124, exacte gerichte/volledige verificatiecommands en rollbackgrenzen toegevoegd voor de terugkerende Vergaderborden toolbar-Tab-focusregressie en een schone Alembic+SQLite-FK-proof met geëxporteerde `DATABASE_URL` en `STORAGE_ROOT`. Er zijn geen app-, test-, dependency-, migratie- of configwijzigingen en geen nieuwe implementatieclaims gedaan.
- Alle onderstaande implementatiebullets beschrijven de toestand van eerdere increments en zijn geen claim dat de smalle closure-remediation al is uitgevoerd.
- **Latest-ten implementatie (2026-08-04)**: een gedeelde SQLAlchemy-connecthook zet SQLite `foreign_keys=ON` voor runtime-, test- en Alembic-engines en slaat niet-SQLite DBAPI-connections over; gerichte tests openen meerdere connections en bewijzen orphan-FK-rollback.
- Import preview en bound commit gebruiken dezelfde mode-aware preflight voor envelope- en targetreferences, actor/timestamp/version/statuscoherentie, parentage, participant-ID/cardinaliteit/uniqueness en minimaal één actieve participant per actieve groep. Full restore mag niet ten onrechte op te vervangen targetmasterdata leunen.
- Historical identities bevatten nu create/update actorprovenance in model, migratie, schema, backup, restore en equivalentievergelijking. Missing-userreconciliation kiest exact source key en daarna hoogstens één normalized-emailmatch, weigert conflict/ambiguïteit/name-only en behoudt participant display snapshots ongewijzigd.
- Group create/update/delete/restore, relink, external merge/update/status en import nemen volledige `after`-state na domeinflush, flushen de audit vóór commit en rollen bij fouten atomisch terug. Group-audits bevatten de volledige childcollectie met definitieve IDs/FKs/versions/status/snapshots.
- Import preview/commit autoriseren een niet-admin en schrijven precies één veilige denial-audit vóór `_stream_import_envelope`; receive-sentineltests bewijzen dat de body niet wordt gelezen.
- CSV export gebruikt alleen `sharedFilters` van het urenoverzicht en erft geen deleted/history visibility, filters of paging. Deleted export blijft uitsluitend via expliciete backendflags beschikbaar.
- De audit-UI heeft serverpaging, total/paginagrenzen en page sizes 25/50/100; filters en page-size resetten page 1 en pagingrequests behouden alle filters.
- External-person profiel-PATCH weigert statusvelden, vereist row version en handhaaft normalized-email uniqueness inclusief late `IntegrityError`; activate/deactivate/soft-delete/restore zijn expliciete coherente acties. De quick-add-UI toont force-create alleen voor de advisory conflictcode.
- Zichtbare urenoverzicht-, mobile-card- en deleted-listdatums gebruiken een vaste Amsterdam-aware `dd-mm-jjjj` formatter; native input/API-values blijven technisch ISO.
- De About-changelog bevat iteration 95 met een gebruikersgerichte regel voor deze hardening.
- **Spec-only reopening (2026-08-04)**: exact approach, acceptancecriteria, negatieve/adversarial tests, risico's, rollbackunits en aannames toegevoegd voor SQLite `foreign_keys=ON`; volledige importpreflight; historical actorprovenance en deterministic reuse; post-flush full-child audit; importauth vóór body-read; CSV/deleted-UI-onafhankelijkheid; audit-UI-paging; external update uniqueness/status; advisory-only force-create; en `dd-mm-jjjj` in overview/cards. Er zijn geen applicatiebestanden gewijzigd en er wordt geen implementatie- of PASS-claim gemaakt.
- **Historische implementatieregistratie hieronder**: de resterende bullets in deze sectie beschrijven eerdere increments en zijn geen bewijs voor criteria 111–120.
- **Geïmplementeerde latest remediation (2026-08-04)**: deleted CSV-flags worden vóór query/serialisatie admin-only gemaakt en `deleted_only` canoniek genormaliseerd; list/export weigeren onbekende, conflicterend dubbele en ongeldige queryparameters.
- Public meta- en groupresponses gebruiken afzonderlijke allowlistschemas; identity-FK's, e-mail, gebruikersnaam, notes, actor-, deletion- en provenancevelden blijven uit non-adminresponses. Admin masterdata/history heeft afzonderlijke, beschermde schemas en SQL-paging/filter/sortering.
- Backup v2 exporteert gerefereerde source batches en nullable source-userprovenance; merge vergelijkt alle contractvelden per stabiel ID en accepteert alleen volledige equivalentie als no-op. Importpreflight valideert actors, source batches/users, parents, identitycardinaliteit, statuscoherentie, selectability, tijden/versies en references vóór domeinwrites; late bekende constraints krijgen 409/422 en onbekende databasefouten een gesaniteerde 500.
- Preview, backupcreatie en backupdownload schrijven gesaniteerde result-audits. Artifactpublicatie en mutation audits delen de relevante transactie; groupmutaties/import/external merge auditen volledige parent/child snapshots en rollen bij auditfailure terug.
- External merge behoudt bestaande display snapshots byte-identiek en weigert source/target-collisions per groep. `force_create` heet expliciet zo, accepteert alleen boolean, passeert uitsluitend name-only advies en nooit genormaliseerde e-mailuniekheid.
- Project/post-statusacties ondersteunen coherente archive/delete/restore/unarchive-semantiek met parentchecks en portable DB-checks; admin history/masterdata ververst via eigen querykeys. De UI biedt canonical datum/persoonstypefilters en gepagineerde historycontrols.
- `/urenverantwoording` redirect éénmaal naar de canonical frontendroute met behoud van query/hash; `/api/urenverantwoording/*` wordt niet geraakt.
- De gedeelde modalprimitive gebruikt portals, inert+`aria-hidden` fallback, unieke labels, initial focus, topmost focus trap/ESC, committing guard en focus return. Create-errors zijn Nederlands, veldgekoppeld, gericht en assertive aangekondigd; successstatus is polite. Delete/restore/merge/force/importflows gebruiken dezelfde primitive.
- De About-changelog heeft een gebruikersgerichte iteration-94-regel gekregen.
- **Huidige spec-only update (2026-08-04)**: exacte approach, acceptance criteria, adversarial testnamen, risico's, rollbackgrenzen en aannames toegevoegd voor deleted CSV-adminchecks; role-safe public schemas; complete importpreflight/late constraintmapping; provenance/source batches/`source_user_id`/stable-ID merge; atomische audit en immutable merge snapshots; force-create/uniqueness; archived history/restore/status-parentcoherentie; routecompatibiliteit; canonical filters; en modal/errora11y.
- **Geen implementatieclaim voor huidige reopening**: onderstaande bullets en Verification evidence beschrijven uitsluitend de historische toestand van de vorige increment en moeten opnieuw worden gevalideerd nadat criteria 96–110 zijn geïmplementeerd.
- Backupformaat v2 bewaart volledige urenmodule-state: stabiele group/participant-ID's, actieve en verwijderde child-state, actors, timestamps, snapshots, volgorde, relaties en `row_version`; full restore vervangt alleen moduledata en behoudt audit/overige applicatiedata. V1-import blijft leesbaar als legacy-compatibiliteit; v2 valideert UUID's strikt.
- Missing live users worden alleen bij voldoende eenduidige snapshotmetadata naar een historische identiteit geconverteerd; admin history/relink is role-safe, versioned en auditeerbaar zonder User-account of rechtenoverdracht.
- Meta bevat alleen actieve/selecteerbare projects, posts, users en externe personen. Deleted/history/relink-data heeft een afzonderlijke admin-only API/UI en denied calls geven geen metadata/counts terug.
- Import gebruikt stream-bytebegrenzing vóór parse, iteratieve depth/node-limieten en één volledige preflight voor records, references, actor/deletion state, project-postrelaties, datum/duur, identiteit en uniqueness. Commitrollback bewaart uitsluitend één gesaniteerde failed batch en één failure-audit.
- SQLite/PostgreSQL-portable modelconstraints dekken duur `1..48`, exact-één identity en actieve participant-uniekheid; servicevalidatie en transactionele IntegrityError-vertaling vullen cross-rowregels aan.
- Auditfilters, totale count, deterministische sortering en paging draaien in SQL; Amsterdam-inputgrenzen worden naar UTC vertaald en output wordt als Amsterdam-tijd gerenderd. Domeinmutaties en volledige before/after-audits delen een transactie.
- Muterende group/masterdata/history-endpoints vereisen `expected_row_version` en gebruiken compare-and-update; stale/missing writes geven 409 zonder domein- of mutatie-auditwrite.
- Totalen gebruiken SQL-aggregatie over dezelfde gededupliceerde filterbasis als list/export en materialiseren niet alle matches in applicatiegeheugen.
- De uren-UI heeft role-safe history, stale-writefeedback, mobiele cards, semantische chartwaarden, decoratieve `aria-hidden` chartdelen en toegankelijke create/edit/delete/import-modals met initial focus, trap, ESC en focus return.
- Gerichte roundtrip-, rollback-, resource-limit-, DB-integriteits-, SQL-audit/totals-, authorization-, concurrency- en a11yregressietests zijn toegevoegd/aangepast. De About-changelog bevat een gebruikersgerichte hardeningregel.
- Unrelated audio/GenAI-worktreebestanden zijn niet aangepast voor deze increment; er is niet gecommit of gepusht.

## How to verify
- Bevestig dat uitsluitend de negen punten in **Accepted post-MVP follow-up / niet-blokkerende technische schuld** als `DEFERRED — product-owner accepted 2026-08-04` gelden; alle overige essentiële grenzen blijven MVP-gates.
- Backend volledig: `cd backend && STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest` — verwacht `226 passed`.
- Frontend volledig: `cd frontend && npm test -- --run` — verwacht `5 files passed`, `167 tests passed`.
- Frontend typecheck/productiebouw: `cd frontend && npm run build` — verwacht geslaagde TypeScript- en Vite-build; uitsluitend de bekende niet-blokkerende chunkwaarschuwing is toegestaan.
- Schone migratie en SQLite-FK-proof: voer Alembic tegen een niet-bestaande tijdelijke SQLite-database uit met in dezelfde shell geëxporteerde `DATABASE_URL` en schrijfbare `STORAGE_ROOT`; verwacht revisie `20260730_0026`, `PRAGMA foreign_keys=1` op nieuwe connections en rollback van een directe orphan-insert.
- Diff-check: `git diff --check` — verwacht geen whitespace-fouten en uitsluitend deze actieve spec als finalisatiewijziging.

## Verification evidence
- PASS — finale onafhankelijke review: **APPROVED FOR MVP**. De negen product-ownergeaccepteerde post-MVP-punten zijn als niet-blokkerend beoordeeld; PostgreSQL-runtime/FK en echte-browserbewijs blijven expliciet als afzonderlijke environment-follow-ups geregistreerd.
- PASS — diff-check: `git diff --check` → geen whitespace-fouten; de finale wijziging betreft uitsluitend deze actieve change spec.
- PASS — gerichte toolbarfocus: `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` → `1 file passed`, `56 tests passed` in `11.66s`; de aangescherpte create/edit-test gebruikt echte Tab en Shift+Tab, behoudt focus binnen de shell en verifieert beide uitgangen.
- PASS — gerichte SQLite connection-/FK-set met vooraf geëxporteerde tijdelijke `DATABASE_URL` en schrijfbare `STORAGE_ROOT`: `.venv/bin/python -m pytest tests/test_work_hours_api.py -q -k 'every_new_sqlite_connection_enables_foreign_keys_pragma or sqlite_foreign_key_pragma_rejects_direct_orphan_insert_and_rolls_back or alembic_sqlite_connection_has_foreign_keys_enabled or postgresql_engine_initialization_does_not_execute_sqlite_pragma'` → `4 passed, 76 deselected, 1 warning` in `0.56s`.
- PASS — schone Alembic+SQLite-FK-shellproof: niet-bestaande `$tmp/work-hours.db`, daarna vooraf `export DATABASE_URL=...` en `export STORAGE_ROOT=...` in dezelfde shell; Alembic migreerde alle revisies t/m `20260730_0026`, twee gelijktijdige nieuwe app-engineconnections rapporteerden `PRAGMA foreign_keys=1`, de directe orphan-`work_posts`-insert gaf `IntegrityError` en liet de count gelijk, en een daarna geopende connection rapporteerde opnieuw `1`; output `Alembic + SQLite FK proof: PASS`, exit 0.
- PASS — volledige frontend: `npm test -- --run` → `5 files passed`, `167 tests passed` in `14.04s`.
- PASS — frontend typecheck/productiebouw: `npm run build` → TypeScript en Vite geslaagd (`96 modules`, build `1.57s`); alleen de bestaande niet-blokkerende chunkwaarschuwing (`514.29 kB`, >500 kB).
- PASS — volledige backend via repository `.venv` met vooraf geëxporteerde tijdelijke SQLite-DB en schrijfbare storage: `.venv/bin/python -m pytest` → `226 passed, 851 warnings` in `132.60s`.
- SCOPE — geen backend-, migratie-, model-, dependency- of configbestand is voor deze smalle closure aangepast; unrelated bestaande worktreewijzigingen zijn behouden. Er is niet gecommit of gepusht.
- HISTORICAL LATEST-TEN EVIDENCE FROM HERE: onderstaande resultaten verklaren de aanleiding voor deze reopening, maar gelden niet als bewijs voor criteria 121–124.
- PASS — gericht backend: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q` → `80 passed, 452 warnings` in `43.31s`.
- PASS — gericht frontend urenmodule: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `1 file passed`, `28 tests passed`.
- PASS — volledige backend: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest` → `226 passed, 851 warnings` in `130.70s`.
- FAIL — volledige frontend: `npm test -- --run` → `5 files`, `166 passed`, `1 failed`; failure is `VergaderbordenPage.test.tsx > houdt de update-toolbar zichtbaar tijdens Tab-navigatie ... en verbergt die zodra focus de shell verlaat`. Dit bestand/gedrag is unrelated en is conform scope niet aangepast.
- PASS — frontend typecheck/productiebouw: `npm run build` → TypeScript en Vite geslaagd; bestaande niet-blokkerende chunkwaarschuwing (`514.29 kB`, >500 kB).
- PARTIAL — verse SQLite-migratiecommand: Alembic voerde alle revisies t/m `20260730_0026` uit. De daarna aan dezelfde shellchain toegevoegde losse PRAGMA-proofsubprocess faalde vóór DB-connect op `PermissionError: /data/uploads`, omdat voor die subprocess per ongeluk geen `STORAGE_ROOT` was doorgegeven; de afzonderlijke multi-connection/Alembic/FK/orphan-tests in de groene gerichte backendset leveren wel lokale SQLite-proof. De gecombineerde command wordt niet als volledig PASS gemarkeerd.
- PASS (gerichte nieuwe negatieve dekking) — meerdere/pooled SQLite-connections, orphan FK rollback en non-SQLite no-PRAGMA; non-admin import receive-sentinel voor preview/commit; external update email/status/versiongrenzen; coherent activate/deactivate/delete; post-flush complete group/children audit; deterministic source-key/email reuse plus conflict/ambiguïteit/name-only rejection; historical actorprovenance roundtrip; CSV/deleted-UI-onafhankelijkheid; audit page sizes/paging; hard/mixed force-create-afwezigheid; en Nederlandse overview/carddatums.
- NOT RUN — PostgreSQL-runtime/FK-variant: geen PostgreSQL-service/database-URL beschikbaar.
- NOT RUN — echte-browserbewijs voor paging/force-create/datumweergave; DOM/componenttests zijn uitgevoerd.
- HISTORICAL ONLY FROM HERE — alle onderstaande resultaten horen bij eerdere increments en leveren geen bewijs voor criteria 111–120.
- HISTORICAL PARTIAL EVIDENCE GATE: implementatie en haalbare canonical checks voor de vorige increment waren groen, maar niet iedere exact benoemde testcase uit regels 681–737 bestond als afzonderlijke testvariant. Daarom was er geen volledige criteria-96–110 completionclaim.
- PASS — gericht backend: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q` → `68 passed, 435 warnings` in `43.65s`.
- PASS — gericht frontend routing+urenmodule: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx src/app/App.test.tsx` → `2 files passed`, `99 tests passed`.
- PASS — volledig backend na finale wijzigingen: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest` → `214 passed, 834 warnings` in `123.29s`.
- PASS — volledig frontend na finale wijzigingen: `npm test -- --run` → `5 files passed`, `161 tests passed`.
- PASS — frontend typecheck/productiebouw: `npm run build` → TypeScript en Vite geslaagd; alleen bestaande niet-blokkerende chunk-sizewaarschuwing (`512.90 kB`, >500 kB).
- PASS — migratie vanaf verse tijdelijke SQLite-database: `tmp=$(mktemp -d) && DATABASE_URL="sqlite:///$tmp/work-hours.db" STORAGE_ROOT="$tmp/storage" .venv/bin/alembic upgrade head` → revisies t/m `20260730_0026`, exit 0.
- NOT RUN — PostgreSQL-constraintvariant: geen PostgreSQL CI-service/database-URL beschikbaar in deze workspace.
- NOT RUN — echte-browsercheck op 320 CSS px en 200% zoom; component-, focus-, inert-, field-error- en responsive DOM/CSS-tests zijn wel groen.
- HISTORICAL ONLY — onderstaande resultaten horen bij de voorafgaande adversarial increment en sluiten de huidige reopening niet af.
- PASS — gericht backend: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest tests/test_work_hours_api.py -q` → `51 passed, 352 warnings` in `32.16s`.
- PASS — gericht frontend: `npm test -- --run src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx` → `19 passed`.
- PASS — volledig backend: `STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest` → `197 passed, 751 warnings` in `115.43s`. Een eerste run met 120s tooltimeout werd afgebroken nabij het einde; dezelfde suite is daarna met 240s timeout volledig groen afgerond.
- PASS — volledig frontend: `npm test -- --run` → `5 files passed`, `155 tests passed`.
- PASS — frontend typecheck/productiebouw: `npm run build` → TypeScript en Vite build geslaagd; alleen de bestaande niet-blokkerende chunk-sizewaarschuwing (`>500 kB`).
- PASS — migratie vanaf aantoonbaar lege tijdelijke SQLite-database: `DATABASE_URL=sqlite:////tmp/opencode/<fresh>.db STORAGE_ROOT=/tmp/opencode/<fresh-storage> .venv/bin/alembic upgrade head` → alle revisies `20260311_0001` t/m `20260730_0026` uitgevoerd, exit 0. Een eerste echte-empty-DB-run ontdekte verkeerd geplaatste constraints in de nog niet gecommitte migratie; die plaatsing is gecorrigeerd en bovenstaande volledige rerun is groen.
- NOT RUN — PostgreSQL-constraintvariant: in deze workspace is geen PostgreSQL CI-service/database-URL beschikbaar; de conditionele specvariant blijft open.
- NOT RUN — echte-browsercheck op 320 CSS px en 200% zoom: component/a11ytests en responsive CSS zijn groen, maar deze runtime heeft geen browser/visuele testvoorziening gebruikt.
- PARTIAL — de adversarial contracts zijn in 51 gerichte backendtests en 19 gerichte frontendtests gedekt, inclusief nieuwe roundtrip/restore-state, DB-check, row-version, stream/depth, SQL-audit/totals en modal/chart-tests. Niet iedere in het plan opgesomde testnaam bestaat echter één-op-één als afzonderlijke testfunctie (onder meer echte parallelle transactierace, geforceerde audit-persistencefailure en de volledige parametrische preflightmatrix zijn deels via gecombineerde tests/implementatie afgedekt). Daarom wordt geen volledige evidence-gateclaim gedaan.
- BLOCKED (niet-canoniek) — gerichte Ruff-call kon niet starten omdat de repository-venv geen `ruff` module bevat (`No module named ruff`). Backend/full tests, frontend tests/build en migratie zijn wel uitgevoerd.

## Follow-ups
### Geaccepteerde post-MVP productscope / technische schuld
- Werk na MVP de exact negen punten uit **Accepted post-MVP follow-up / niet-blokkerende technische schuld (product-ownerbesluit 2026-08-04)** af. De historische criteria en exact benoemde testcatalogi in deze spec vormen daarvoor de traceerbare backlog; zij blokkeren de huidige MVP-closeout niet.

### Afzonderlijke environment-follow-ups
- Draai PostgreSQL-runtime/FK/constraintverificatie tegen een echte beschikbare PostgreSQL-service en leg de output afzonderlijk vast als `PASS`, `FAIL` of `NOT RUN`; leid dit bewijs niet af uit SQLite.
- Voer echte-browserchecks uit voor 320 CSS px/200% zoom, focus/inert/overflow, auditpaging, force-createzichtbaarheid en datumweergave; houd dit bewijs afzonderlijk van DOM/componenttests. Deze ontbrekende infrastructuurbewijzen blokkeren de lokale MVP-closeout niet en mogen niet als uitgevoerd worden voorgesteld.

### Overig
- Installeer/standardiseer Ruff alleen via een afzonderlijk goedgekeurde toolingchange als lint een canonieke repositorycheck wordt; deze change wijzigt dependencies niet.
- Unrelated audio/GenAI-worktreewijzigingen blijven uitgesloten.

---
Status: Completed (MVP)
Owner: Product owner / OPSX
Date: 2026-08-04
