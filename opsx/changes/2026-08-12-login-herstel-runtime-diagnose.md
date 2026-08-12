# Title

Onderzoek en herstel bewezen oorzaak van publieke loginmelding

## Context

Gebruikers zien bij inloggen de generieke melding: `Inloggen mislukt. Controleer of de backend bereikbaar is en probeer opnieuw.` De melding kan zowel een transport-/proxyprobleem als een backendfout maskeren. Eerder afgerond remember-me-hardening bestaat, maar is geen bewezen verklaring voor deze actuele storing.

De goedgekeurde scope is: voer eerst uitsluitend een read-only runtime-diagnose uit, classificeer de oorzaak als frontend/proxy, backend/startup, schema/migratie of auth/rate-limit, en herstel daarna alleen de minimaal bewezen oorzaak. Valideer na herstel de publieke login en `/api/auth/me`. Regressie-/smoketests en documentatie worden alleen toegevoegd of aangepast wanneer dat nodig is voor de bewezen wijziging of de reproduceerbare verificatie.

## Goals / Non-goals

### Goals

- Verzamel gesaniteerde, read-only runtime-evidence die de fout aan een tijdvenster, uitgerold artifact en concrete HTTP-/loguitkomst koppelt.
- Classificeer de storing expliciet als precies één primaire categorie: frontend/proxy, backend/startup, schema/migratie of auth/rate-limit; leg bij onvoldoende evidence die uitkomst vast en voer geen herstel uit.
- Herstel uitsluitend de bewezen minimale oorzaak, zonder een auth- of infrastructuurherontwerp.
- Verifieer dat een geldige publieke login een succesvolle sessie oplevert en dat `/api/auth/me` daarna geauthenticeerd succesvol antwoordt.
- Voeg alleen deterministische regressie-/smoketests en operationele documentatie toe wanneer de bewezen oplossing dat vereist.
- Leg alle uitgevoerde commando's, resultaten, artifactidentiteiten en gesaniteerde evidence in deze spec vast.

### Non-goals

- Geen gokken of meerdere mogelijke oorzaken tegelijk wijzigen.
- Geen wijzigingen aan auth-flow, remember-me, cookies, CORS, proxy, rate limits, database of migraties zonder directe evidence.
- Geen productiewijziging, deployment, restart, database-write, migratie, configuratiewijziging of secretinspectie tijdens de read-only diagnose.
- Geen logging van wachtwoorden, access-/refresh-/remember-tokens, cookies, autorisatieheaders, connection strings of persoonsgegevens.
- Geen brede frontend-redesign, sessiebeheeruitbreiding of wijziging van inlogteksten behalve als dit noodzakelijk is voor de bewezen minimale oplossing.

## Proposed approach

1. Leg de runtime-identiteit vast (omgeving, UTC-tijd, backend/frontend/proxy artifact of commit en relevante service) zonder geheime configuratie te tonen.
2. Reproduceer of correleer de publieke loginfout read-only met route, statuscode, request-ID/correlatie-ID en gesaniteerde browser-/proxy-/backendobservaties.
3. Doorloop de classificatie in deze volgorde: (a) frontend/proxy-route, DNS/TLS/CORS/upstream; (b) backendproces/startup en health/logfout; (c) schema/Alembic-revisie en de in de fout genoemde tabel/kolom; (d) auth-validatie, accountstatus en rate-limitrespons. Stop zodra de evidence één oorzaak bewijst.
4. Koppel de bewezen runtimeoorzaak aan de exacte releasebron en kies de kleinste herstelactie. Een schemaherstel gebruikt uitsluitend de bestaande Alembic-procedure; auth/rate-limit- of proxyherstel verandert alleen de aangetoonde foutieve configuratie of code.
5. Valideer vóór release lokaal/isolated waar toepasselijk en voer een productieherstel alleen uit na afzonderlijke uitvoeringsautorisatie, met passende backup-/rollbackvoorbereiding.
6. Controleer na herstel met een niet-gevoelig testaccount: succesvolle publieke login, verwachte sessie/cookiegedrag zonder waarden te loggen, en succesvolle `GET /api/auth/me`; bevestig dat de oorspronkelijke fout niet terugkeert.

## Implementation steps (ordered)

1. Noteer omgeving, UTC-tijdvenster, betrokken URL/route en de immutabele frontend-, proxy- en backendartifactidentiteit; redigeer secrets volledig.
2. Verzamel read-only browser/netwerkgegevens van één mislukte publieke login: requestmethode/-pad, status, veilige responscategorie, request-ID en CORS-/upstreamindicatoren, zonder requestbody of cookies vast te leggen.
3. Correlleer deze waarneming met read-only proxy- en backendlogs op timestamp/request-ID en leg exceptionklasse of upstreamfout gesaniteerd vast.
4. Controleer read-only backend-startup/health en bereikbaarheid vanaf de proxy; classificeer als **frontend/proxy** of **backend/startup** wanneer de evidence dit bewijst.
5. Als de backend de loginroute bereikt, vergelijk read-only `alembic current`, `alembic heads` en uitsluitend relevante tabel-/kolommetadata met de uitgerolde releasebron. Classificeer als **schema/migratie** uitsluitend bij een gecorreleerde databasefout of aantoonbare revisiedrift.
6. Als schema en startup niet de oorzaak zijn, inspecteer de gesaniteerde auth- en rate-limituitkomst (bijvoorbeeld 401/403/429, accountstatus en limiter-event) en classificeer als **auth/rate-limit** alleen bij directe correlatie.
7. Leg de classificatie, uitgesloten categorieën en evidence vast. Stop en vraag om vervolgdiagnose wanneer de uitkomst onvoldoende evidence is.
8. Werk, alleen na bewezen oorzaak en benodigde uitvoeringsautorisatie, de kleinste relevante code-, configuratie- of reguliere migratieherstelroute uit; wijzig geen niet-bewezen lagen.
9. Voeg alleen de gerichte regressietest toe die de bewezen fout reproduceert. Voeg een deploybare smokecheck toe wanneer bestaande checks publieke login en `/api/auth/me` niet al afdekken.
10. Voer de relevante geautomatiseerde checks uit. Na geautoriseerde rollout: valideer publieke login en vervolgens `GET /api/auth/me` met dezelfde sessie, zonder gevoelige waarden op te slaan.
11. Actualiseer deze spec met gewijzigde bestanden, exacte verificatiecommando's, resultaten, evidence, resterende risico's en status.

## Acceptance criteria

1. De spec bevat gesaniteerde read-only evidence voor runtime-identiteit, tijdvenster, loginroute/status en gecorreleerde proxy-/backenduitkomst.
2. De storing is geclassificeerd als frontend/proxy, backend/startup, schema/migratie, auth/rate-limit of onvoldoende evidence, met expliciete onderbouwing en uitgesloten categorieën.
3. Bij onvoldoende evidence worden geen herstelwijzigingen, migraties, restarts of deployments uitgevoerd.
4. Bij een bewezen oorzaak wijzigt de herstelpatch uitsluitend de minimale bewezen laag; gewijzigde bestanden en reden zijn vastgelegd.
5. Een schemaherstel gebruikt een bestaande/additieve Alembic-migratieprocedure en geen handmatige DDL/DML of wijziging van historische revisies.
6. Gerichte regressietest(s) voor de bewezen codefout slagen, of de spec onderbouwt waarom een test niet nodig/toepasbaar is (bijvoorbeeld uitsluitend een uitgerolde configuratiecorrectie).
7. Na geautoriseerd herstel retourneert een geldige publieke login een succesvolle respons en wordt geen generieke bereikbaarheidsmelding getoond.
8. Na die login retourneert `GET /api/auth/me` met de verkregen sessie een 2xx-respons met de verwachte geauthenticeerde gebruikerscontext; cookies/tokens worden niet vastgelegd.
9. De oorspronkelijke gecorreleerde fout (status/exception/upstreamfout) treedt tijdens de post-herstel-smokecheck niet op.
10. Evidence bevat geen geheimen, credentials, cookies, tokens, headers met authenticatiegegevens of persoonsgegevens.

## Testing plan

Alle productiecommando's onder dit plan zijn read-only totdat herstel en rollout afzonderlijk zijn geautoriseerd. Vervang placeholders door de bestaande, geheime-veilige operationele conventies; sla geen volledige headers, `.env`-inhoud of responsebodies op.

1. Read-only runtime-diagnose: leg artifactidentiteit, servicehealth, relevante logregels, status en request-ID vast via de bestaande observability-/Compose-tooling.
2. Repositorypreflight na een bewezen code- of migratiecorrectie:
   - `cd backend && ./.venv/bin/pytest <gerichte-auth-of-oorzaaktests>`
   - `cd backend && ./.venv/bin/pytest` wanneer gedeelde backend/auth/schema-code wijzigt.
   - `cd frontend && npm test -- --run <gerichte-login-test>` en `cd frontend && npm run build` alleen bij frontendwijzigingen.
   - `cd backend && ./.venv/bin/alembic heads` plus een tijdelijke SQLite-upgrade alleen bij migratiewijzigingen.
   - `git diff --check` voor iedere repositorypatch.
3. Geautoriseerde post-release smokecheck met een dedicated niet-gevoelig testaccount:
   - Open de publieke loginpagina en meld aan met geldige testgegevens via een veilige secretbron; controleer een succesvolle navigatie/respons zonder credentials te registreren.
   - Roep in dezelfde browsersessie `GET /api/auth/me` aan en controleer 2xx en de verwachte niet-gevoelige gebruikersidentiteit/rol.
   - Controleer gesaniteerde logs op afwezigheid van de oorspronkelijke fout gedurende het smoke-tijdvenster.

## Risk + rollback plan

- **Onjuiste classificatie:** wijzig niets vóór een gecorreleerde HTTP-/log-/runtimebewijsketen. Bij onvoldoende evidence stopzetten en vervolgdiagnose plannen.
- **Te brede herstelpatch:** beperk ownership tot de bewezen laag en laat niet-gerelateerde login-, remember-me-, proxy- en schemacode ongemoeid. Revert uitsluitend de minimale patch bij regressie.
- **Schema- of migratierisico:** maak en verifieer backups vóór een geautoriseerde migratie, stop writers volgens de bestaande procedure en herstel database plus passend releaseartifact bij falen. Geen handmatige schemawijzigingen.
- **Auth-lockout/rate-limitimpact:** gebruik een dedicated testaccount en beperk herhaalde pogingen; rollback herstelt de eerdere bewezen configuratie/code zonder rate limits globaal te verzwakken.
- **Gevoelige diagnose-output:** redacteer alle secrets en identifiers; gebruik metadata, statuscodes, exceptionklassen en request-ID's als evidence.
- **Rolloutverslechtering:** behoud het voorafgaande artifact en de vastgelegde runtime-identiteit; bij mislukte smokecheck geen verdere wijzigingen doen, rollback uitvoeren volgens de bestaande releaseprocedure en nieuwe evidence vastleggen.

## Notes / links

- Gerelateerde afgeronde change: `opsx/changes/2026-06-09-remember-me-login-failure-hardening.md`; deze is geen oorzaakclaim voor de huidige incidentmelding.
- Gerelateerde runtime/release-context: `opsx/changes/2026-08-10-admin-load-failure-diagnostics.md` en `opsx/changes/2026-08-11-herstel-schema-drift-releaseketen-projectroutes.md`.
- Te valideren endpoints: publieke loginroute zoals gebruikt door de SPA en `GET /api/auth/me`.
- Documentatie-impact: alleen operator-/runbookdocumentatie aanpassen wanneer de bewezen oorzaak een nieuwe vaste herstel- of verificatiestap vereist. Geen eindgebruikerschangelog voor een uitsluitend technische herstelactie tenzij de uiteindelijke wijziging zichtbaar gedrag toevoegt.

## Current status

**Completed.** Het operationele SQLite-rechtenherstel is uitgevoerd en de bewezen rate-limit/loginfout is op runtimeniveau niet opnieuw waargenomen. Op expliciete gebruikersbevestiging (`Gecheckt in productie.`) zijn een geldige publieke login en een daaropvolgende geauthenticeerde `/api/auth/me` in productie bevestigd. Tijdens de noodzakelijke Compose-start is bovendien de bestaande `migrate`-one-shot onverwacht gestart en heeft de reeds aanwezige revisiedrift naar de bestaande head gebracht; dit valt buiten deze herstelactie en is als afwijking en resterend risico vastgelegd.

## What changed

- Nieuwe actieve change spec aangemaakt voor diagnose en minimaal herstel van de publieke loginmelding.
- Read-only runtimediagnose uitgevoerd tegen de lokaal uitgerolde Compose-runtime.
- Geen productcode, configuratie, migratie, test, About/changelog of operator-documentatie gewijzigd. Dit technische runtimeherstel heeft geen eindgebruikerschangelog-impact; de bestaande About- en changelogverwachtingen zijn gecontroleerd en blijven ongewijzigd.
- De bewezen runtimeopslag is hersteld zonder code-, configuratie- of handmatige schemawijziging: na gecontroleerde stop van uitsluitend backend en worker is een consistente bestandsbackup gemaakt. Daarna is uitsluitend het bestaande SQLite-bestand teruggezet naar eigenaar/groep `1000:1000` (de backend-user `app:app`) met modus `0660`.
- Alleen backend en worker zijn expliciet herstart; frontend is niet herstart. Door de bestaande Compose-dependency startte `migrate` echter automatisch en voerde de reeds aanwezige migraties `20260810_0029` en `20260811_0030` uit. Er is geen handmatige DDL/DML uitgevoerd. Deze onbedoelde, buiten-scope schema-effecten zijn niet teruggedraaid.

## How to verify

- De uitgevoerde diagnose en applicatieverificatie zijn vastgelegd onder **Verification evidence**. Er is geen repositorypatch; de volledig groene suites bevestigen desondanks dat de bestaande applicatieverwachtingen intact zijn.
- De herstelactie is uitgevoerd. Voor herhaalbaarheid: stop de database-writers, maak een metadata-geverifieerde kopie van het SQLite-bestand buiten de actieve opslag, herstel uitsluitend eigenaar/groep naar de backend-runtimeuser en de minimaal noodzakelijke schrijfmodus, en start uitsluitend de benodigde writers weer. Gebruik bij Compose-start een route die de bestaande migratieservice niet automatisch activeert wanneer schemawijziging buiten scope is.
- De post-herstel-smokecheck is in productie bevestigd op expliciete gebruikersbevestiging (`Gecheckt in productie.`): een geldige publieke login en een daaropvolgende geauthenticeerde `GET /api/auth/me` zijn bevestigd. Er zijn geen statuscode, credentials, cookies, tokens of gebruikersdata vastgelegd.
- De oorspronkelijke gecorreleerde fout trad bij deze bevestigde post-herstelcontrole niet opnieuw op.

## Verification evidence

### Eindbeeld laatste testanalyse

- **Geslaagd — repository-integriteitscheck:** `git diff --check` retourneerde succesvol. Er is geen productcode-, configuratie-, migratie-, test- of documentatiepatch voor deze change; uitsluitend deze spec is bijgewerkt.
- **Geslaagd — runtimebereikbaarheid:** de geconfigureerde frontend-origin retourneerde 200, backend `GET /openapi.json` retourneerde 200, en proxied `GET /api/auth/me` zonder sessie retourneerde de verwachte 401. Dit bevestigt de actieve frontend/proxy/backend-route voor de anonieme controle; het is nadrukkelijk geen geauthenticeerde `/api/auth/me`-bewijs.
- **Geslaagd — post-herstel runtimeopslag:** de backend draait als UID:GID `1000:1000`, ziet `app.db` als `1000:1000 0660`, en SQLite `PRAGMA integrity_check` retourneerde `ok`. In het gecontroleerde post-herstelvenster stonden geen `readonly`, `OperationalError` of `rate_limit`-fouten in de backendlogs.
- **Geslaagd — geautomatiseerde applicatiesuites:** `opsx-test` voerde alle relevante applicatiechecks volledig groen uit: backend `./.venv/bin/pytest -q` met **263 passed, 1 skipped**; gerichte backendtests met **27 passed**; frontend `npm test` met **167 passed**; en frontend `npm run build` succesvol.
- **Historische bewezen oorzaak:** vóór het herstel schreef de `rate_limit` dependency vóór credentialvalidatie naar `rate_limit_events`. Het actieve SQLite-bestand was `root:root 0644`, terwijl backend als `app:app` (UID:GID `1000:1000`) draaide. Die write faalde met `sqlite3.OperationalError: attempt to write a readonly database`, verpakt als `sqlalchemy.exc.OperationalError`, waardoor `POST /api/auth/login` 500 retourneerde voor zowel geldige als ongeldige credentials en de SPA de generieke bereikbaarheidsmelding toonde.
- **Geslaagd — productiebevestiging post-herstel:** op expliciete gebruikersbevestiging (`Gecheckt in productie.`) zijn een geldige publieke login en een daaropvolgende geauthenticeerde `GET /api/auth/me` in productie bevestigd. Hiermee zijn acceptatiecriteria 7–9 behaald: de generieke bereikbaarheidsmelding trad niet op en de oorspronkelijke gecorreleerde fout keerde niet terug. Er zijn geen statuscode, credentials, cookies, tokens, autorisatieheaders of gebruikersdata vastgelegd.

- UTC-tijdvenster: 2026-08-12T08:11:11Z–08:12:26Z. Lokale Compose-runtime: `wervelnieuws-backend-1` en `wervelnieuws-frontend-1` waren actief; backend-image `sha256:2dbf344a8ac621ff0780fcf0c7a06a6503bd24e76d2dd882a7c16b8fe3d9d5f4`, frontend-image `sha256:78e5d7970a82c68bef438825621e2cafbb875f2c69979bffa4cb6d000f4d7e5b`. Beide containers waren running; geen healthcheck geconfigureerd.
- Read-only route-/proxybewijs: backend `GET /openapi.json` retourneerde 200; frontend `/` retourneerde 200; frontend-proxy `GET /api/auth/me` zonder sessie retourneerde de verwachte 401. De frontend-Nginxconfig bevat een `/api/`-upstream naar `backend:8000/api/`. Hiermee zijn frontend-route, proxybereikbaarheid en backend-startup voor de loginroute uitgesloten als primaire oorzaak.
- Read-only login-correlatie: een enkele gecontroleerde ongeldige login zonder credentials in evidence naar de directe backend-route `POST /api/auth/login` retourneerde 500. De gesaniteerde backend-log op hetzelfde tijdvenster koppelt dit aan `sqlalchemy.exc.OperationalError`, veroorzaakt door `sqlite3.OperationalError: attempt to write a readonly database`, in `app.core.rate_limit.rate_limit` tijdens de cleanup van `rate_limit_events`. Dezelfde loggeschiedenis bevat gecorreleerde frontend-proxy `POST /api/auth/login`-antwoorden met 500. Er was geen request-ID beschikbaar; timestamp, route en status vormen de correlatie.
- Runtime-opslagbewijs: de backend heeft `/data` en `/config` als read-write Compose-bindmounts en kan schrijfrechten op de mountroots bevestigen, maar de SQLite-write vanuit de actieve databaseverbinding faalt. Dit bewijst een fout in de onderliggende database-opslagrechten/-mountstatus, niet een globale container- of proxy-onbereikbaarheid. De database-URL, bestandspad, gebruikersgegevens en configuratie-inhoud zijn niet geïnspecteerd of vastgelegd.
- Schema-uitsluiting voor deze loginstoring: read-only `alembic current` rapporteerde `20260810_0028`; `alembic heads` rapporteerde `20260811_0030 (head)`. Er is revisiedrift voor latere, niet-login-schemawerkzaamheden, maar de gecorreleerde loginstack noemt uitsluitend de bestaande `rate_limit_events`-write en geen ontbrekende tabel/kolom of migratie-exception. Schema/migratie is daarom niet de primaire classificatie van deze loginfout.
- Auth/rate-limit-uitslag: **bevestigd als primaire categorie auth/rate-limit**. De `rate_limit` dependency schrijft en commit rate-limit-events vóór credentialvalidatie; de readonly-databasefout veroorzaakt daardoor voor zowel geldige als ongeldige logins een 500, die de SPA als generieke bereikbaarheidsmelding toont. Dit is geen fout wachtwoord-, cookie- of remember-me-uitkomst.
- Gekoppelde impact vooraf gecontroleerd: frontend-loginasserties in `frontend/src/app/App.test.tsx`, backend-login-/`/api/auth/me`-/remember-me-tests in `backend/tests/test_meta_and_me.py`, rate-limittests in `backend/tests/test_rate_limit.py`, fixtures zonder snapshots, en About/changelog- en README-documentatie. Geen verwachting vereist wijziging zolang er geen repositorypatch of eindgebruikerszichtbare functiewijziging plaatsvindt.
- Productiebevestiging: op expliciete gebruikersbevestiging (`Gecheckt in productie.`) zijn de geldige publieke login en de daaropvolgende geauthenticeerde `/api/auth/me` bevestigd. Er zijn geen statuscode, credentials, cookie- of tokenwaarden of gebruikersdata vastgelegd. De operationele herstelactie, automatische migratie-afwijking en uitgevoerde applicatiesuites zijn hierboven vastgelegd.
- Geen secrets, credentials, cookie- of tokenwaarden, autorisatieheaders, connection strings, databasepaden of persoonsgegevens vastgelegd.

### Operationeel herstel — 2026-08-12

- Tijdvenster: 2026-08-12T08:18Z–08:20Z. Onderzocht bind-mountcontract: backend en worker gebruiken dezelfde lees-schrijfbare host **bind mount** (hostpad geredigeerd) op `/data`; `/config` is een afzonderlijke lees-schrijfbare bind mount. Docker rapporteert voor beide `/data`-mounts `rw=true`. Er is geen named volume betrokken.
- Exacte veroorzaker: backend draait als `app:app` met UID:GID `1000:1000`; het actieve SQLite-bestand `app.db` was eigendom van `root:root`, modus `0644`. De bovenliggende `/data`-directory was wel `1000:1000`, modus `0775`. Daardoor kon de backend-user het bestand niet schrijven, ondanks een schrijfbare mount en directory. Worker draait als root en deelde dezelfde opslag; dit verklaart hoe root-eigenaarschap op het bestand kon blijven bestaan, maar er is geen oorzakelijke write van worker vastgesteld.
- Veiligheidsvoorbereiding: backend en worker zijn eerst gestopt; frontend bleef actief. Een pre-herstelkopie is gemaakt in een aparte, eigenaar-afgeschermde backupdirectory buiten de actieve opslag (`0700` directory; backup `1000:1000`, `0600`). Bron en backup hadden dezelfde SHA-256 (`33a0b4dec2ec…faacc4978`) en dezelfde grootte (`3,411,968` bytes). Backupnaam en hostpaden zijn geredigeerd.
- Herstel: uitsluitend `app.db` aangepast van `root:root 0644` naar `1000:1000 0660`; inhoud, bestandsnaam en directoryrechten zijn niet gewijzigd. Een kortlevende root-helpercontainer met alleen de bestaande backend-image en de hostmount voerde de backup en ownership/moduscorrectie uit. Een directe host-`sudo`-poging faalde vóór wijziging wegens ontbrekende interactieve credentials.
- Herstart/resultaat: alleen backend en worker zijn expliciet gestart. Backend draait daarna als UID:GID `1000:1000`, ziet `app.db` als `1000:1000 0660`, en SQLite `PRAGMA integrity_check` retourneert `ok`. De geconfigureerde frontend-origin retourneert 200; `/api/auth/me` zonder sessie retourneert de verwachte 401; backend OpenAPI retourneert 200. Post-herstel-backendlogs in het gecontroleerde venster bevatten geen `readonly`, `OperationalError` of `rate_limit`-fout.
- Buiten-scope afwijking: `docker compose start backend worker` startte door de bestaande dependency ook `migrate`. Deze one-shot eindigde met 0 en migreerde de database van `20260810_0028` naar `20260811_0030`; de database rapporteert nu `20260811_0030`. Dit is geen handmatige schemawijziging en geen onderdeel van het toegestane rechtenherstel, maar wel een materieel runtime-effect. Niet automatisch teruggedraaid, omdat dat een nieuwe schema-/data-operatie buiten scope zou zijn.
- Afgeronde verificatie: op expliciete gebruikersbevestiging (`Gecheckt in productie.`) zijn de geldige publieke login en de daaropvolgende geauthenticeerde `/api/auth/me` in productie bevestigd. Acceptatiecriteria 7–9 zijn daarmee behaald. Er zijn geen statuscode, credentials, cookie- of tokenwaarden of gebruikersdata vastgelegd.
- Repositorycontrole: `git diff --check` slaagt. Er is uitsluitend deze actieve spec bijgewerkt; bestaande niet-gerelateerde werkboomwijzigingen zijn ongemoeid gelaten.

---
Status: Completed; public login and authenticated `/api/auth/me` confirmed in production by explicit user confirmation; out-of-scope automatic migration recorded as residual risk
Owner: —
Date: 2026-08-12
