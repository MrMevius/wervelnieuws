# Title

Production Docker Compose resource- en lifecycleoptimalisatie

## Context

De productie-stack gebruikt Docker Compose met drie langlopende runtime-services (`backend`, `frontend` en `worker`) en een Alembic-service (`migrate`). De huidige Compose-configuratie koppelt `backend` via `depends_on` aan `migrate`; hierdoor kan een gewone runtime-start onbedoeld de one-shot migratie starten. Dit is tijdens het loginherstel op 2026-08-12 daadwerkelijk gebeurd en heeft buiten de bedoelde herstelactie een bestaande revisiedrift toegepast.

De discovery-uitkomst is bindend voor deze change: behoud de afzonderlijke backend-, frontend- en worker-runtime-services; maak `migrate` een expliciete one-shot stap in de releaserunbook en geen runtime-dependency. Stel daarnaast eerst een reproduceerbare productie-baseline voor CPU-, geheugen-, containerstatus/restarts en Docker-loggroei vast. Voeg alleen resource- of logbeheer toe wanneer die baseline een concrete noodzaak en veilige waarde onderbouwt. Actualiseer de operationele documentatie voor de gewijzigde lifecycle.

## Goals / Non-goals

### Goals

- Behoud drie afzonderlijke, langlopende runtime-services: `backend`, `frontend` en `worker`.
- Ontkoppel `migrate` volledig van de runtime-startketen, zodat runtime start/stop/restart geen schemawijziging uitvoert.
- Definieer en registreer een veilige metrics- en logbaseline vóór enige resource- of loglimiet wordt gekozen.
- Voeg uitsluitend baseline-gerechtvaardigd resource- en/of Docker-logbeheer toe, met waarden, motivatie en verwachte impact vastgelegd.
- Documenteer afzonderlijke, veilige procedures voor release/migratie, runtime lifecycle, observatie en rollback.

### Non-goals

- Geen samenvoeging, verwijdering of herontwerp van backend-, frontend- of worker-runtime-services.
- Geen applicatiecode-, database-schema-, Alembic-revisie-, reverse-proxy-, DNS-, TLS- of secretwijziging.
- Geen automatische migratie bij `docker compose up`, `start`, `restart` of herstel van runtime-services.
- Geen invoering van resource limits, logrotatie, externe metrics-stack, monitoringdienst, alerts of dashboards zonder baseline-evidence.
- Geen performance-SLO's, capaciteitsuitbreiding, Kubernetes-migratie of wijziging van de SQLite-architectuur.

## Proposed approach

1. Inventariseer de huidige effectieve Compose-configuratie, releaseprocedure en de gerelateerde incident-evidence. Leg vast welke `depends_on`-relaties de migratie starten en welke Docker/host-metrics zonder nieuwe observability-stack beschikbaar zijn.
2. Pas de Compose-lifecycle aan: `backend`, `frontend` en `worker` blijven de enige langlopende services met de bestaande restart-policy; `migrate` blijft beschikbaar als expliciete, niet-herstartende one-shot opdracht, maar is geen dependency van runtime-services.
3. Verzamel in een representatief productievenster een gesaniteerde baseline per runtime-container: CPU%, geheugengebruik/limiet, status/restart count, uptime, openstaande onverwachte exits en Docker-json-loggrootte/groeisnelheid. Registreer tijdvenster, workloadcontext, commando's en waarden in deze spec of een door de runbook aangewezen operationeel bewijsdocument zonder secrets.
4. Beoordeel de baseline tegen expliciete beslisregels. Alleen wanneer een service herhaaldelijk aantoonbaar resourceconcurrentie, geheugendruk of onbeheersbare loggroei veroorzaakt, voeg de kleinst passende Compose-instelling toe (bijvoorbeeld een ondersteunde resourcegrens/reservering of Docker log-driveroptie). Leg de reden, waarde, compatibiliteit, verwachte degradatie en rollback vast. Als de baseline geen noodzaak aantoont, documenteer de bewuste keuze om geen limiet/rotatie toe te voegen.
5. Werk README en/of een gerichte operator-runbook bij met gescheiden commands voor (a) build/release en expliciete migratie, (b) runtime starten/stoppen/restarten zonder migratie, (c) observatie/baseline, en (d) rollback. De migratieprocedure vereist bestaande database-/storagebackup en stopt writers volgens de bestaande releaseprocedure.

## Implementation steps (ordered)

1. Lees de actuele `docker-compose.yml`, README, relevante Dockerfiles en de afgeronde specs voor restart policies, release/schemaherstel en login-runtimeherstel. Leg de actuele servicegraaf en documentatiegaten vast.
2. Draai read-only `docker compose config` en inspecteer de effectieve services, `depends_on`, restart policies, mounts en eventuele bestaande log/resource-instellingen. Controleer welke Compose-versie en deploymodus productie gebruikt, zodat alleen ondersteunde opties worden toegepast.
3. Definieer de baselineprocedure en het representatieve meetvenster (minimaal 24 uur normaal gebruik óf een expliciet onderbouwd alternatief met een geplande herbeoordelingsdatum). Verzamel per runtime-service CPU, geheugen, status, restart count en Docker-loggrootte/-groei; redigeer hostpaden, secrets en gebruikersgegevens.
4. Documenteer baseline-uitkomst en beslisrecord: per voorgestelde resource- of logmaatregel de gemeten aanleiding, gekozen of afgewezen instelling, drempel/waarde, verwachte impact, compatibiliteit en rollback. Stop zonder Compose-tuning als de baseline geen maatregel rechtvaardigt.
5. Wijzig de Compose-servicegraaf: verwijder `migrate` uit alle runtime-`depends_on`-relaties; behoud `migrate` met `alembic upgrade head` als expliciet uit te voeren one-shot releaseactie; behoud afzonderlijke backend/frontend/worker services en `restart: unless-stopped` voor deze drie runtime-services.
6. Voeg uitsluitend de in stap 4 gerechtvaardigde resource- en/of loginstellingen toe. Gebruik geen niet-ondersteunde Swarm-only instellingen voor een reguliere `docker compose`-deployment zonder aantoonbare ondersteuning in de gebruikte Compose-versie.
7. Actualiseer operationele documentatie met canonieke, niet-interactieve waar mogelijk commands voor: preflight/configvalidatie; backup en writer-stop; expliciete `migrate`-releaseactie; runtime lifecycle zonder migratie; status/metrics/logobservatie; en rollback naar de voorafgaande Compose-configuratie en releaseartifact. Benoem expliciet dat runtime lifecycle-commands geen migraties mogen starten.
8. Valideer de gerenderde Compose-configuratie en voer een gecontroleerde staging- of geautoriseerde productieproef uit: run `migrate` alleen als expliciete release-stap, start daarna uitsluitend runtime-services, en bevestig dat geen migratiecontainer automatisch is aangemaakt of uitgevoerd.
9. Controleer runtimegezondheid, publiek frontend-/backendbereik en worker-proces na de lifecycle-proef. Controleer de gekozen resource/loginstellingen op effectieve toepassing en op afwezigheid van onverwachte exits, OOM-events of logfouten.
10. Actualiseer deze spec met gewijzigde bestanden, baseline-evidence, gekozen/afgewezen maatregelen, exacte commando-uitkomsten, resterende risico's en status.

## Acceptance criteria

1. `docker compose config` toont `backend`, `frontend` en `worker` als afzonderlijke langlopende runtime-services, elk met `restart: unless-stopped`.
2. `migrate` behoudt de opdracht `alembic upgrade head`, heeft geen restart policy die one-shotgedrag ondermijnt, en komt niet voor in `depends_on` van `backend`, `frontend` of `worker` in de effectieve Compose-configuratie.
3. De runbook bevat een expliciete migratie/releaseopdracht die vóór runtime-start handmatig wordt uitgevoerd, plus afzonderlijke runtime start/stop/restart-opdrachten die `migrate` niet starten.
4. Vóór enige nieuwe resource- of loginstelling is een gesaniteerde baseline vastgelegd met: meetvenster en workloadcontext; CPU en geheugen per runtime-service; status/uptime/restart count; Docker-loggrootte en groeisnelheid; meetcommando's; en beoordeling tegen vastgelegde beslisregels.
5. Iedere toegevoegde resourcegrens, reservering, log-driveroptie of logrotatie-instelling heeft in de spec een meetbare baseline-aanleiding, gemotiveerde waarde, bevestigde Compose-compatibiliteit, verwachte gedragsimpact en rollbackstap. Als geen instelling is gerechtvaardigd, legt de spec die expliciete no-change-beslissing vast.
6. `docker compose config` en `docker compose config --images` slagen na de wijziging; de effectieve configuratie bevat geen onbedoelde service-, mount-, secret- of imagewijzigingen buiten deze scope.
7. Een gecontroleerde lifecycle-smokecheck toont `backend`, `frontend` en `worker` als actief/gezond volgens hun beschikbare statusindicatoren; frontend en backend reageren op de bestaande publieke/health-smokechecks; worker draait zonder onverwachte exit.
8. Tijdens de lifecycle-smokecheck is `migrate` niet automatisch gestart of uitgevoerd. Alleen de expliciet gedocumenteerde releaseopdracht mag de migratiecontainer uitvoeren.
9. De operationele documentatie bevat afzonderlijke, reproduceerbare secties voor release/migratie, runtime lifecycle, metrics/logobservatie en rollback, inclusief waarschuwing dat onnodige schemawijzigingen niet via runtime-commands mogen plaatsvinden.

## Testing plan

1. Statische Compose-preflight:
   - `docker compose config`
   - `docker compose config --images`
   - Inspecteer de gerenderde `depends_on`, `restart`, `command`, resource- en logging-secties voor alle vier services.
2. Baseline, read-only gedurende het gekozen venster:
   - `docker compose ps`
   - `docker stats --no-stream <backend-container> <frontend-container> <worker-container>` op vaste intervallen; registreer alleen geaggregeerde, niet-gevoelige waarden.
   - `docker inspect` voor status, starttijd, restart count, effectieve resource/logconfiguratie en logpad zonder omgevingsvariabelen of mount-hostpaden te publiceren.
   - Host-/Docker-loggrootte en groei meten via de bestaande operatorbevoegde procedure; geen loginhoud met secrets of persoonsgegevens opnemen.
3. Repository- en documentatievalidatie:
   - `git diff --check`
   - Controleer dat alle in README/runbook genoemde Compose-commands overeenkomen met de effectieve Compose-configuratie.
4. Gecontroleerde release/lifecycleproef in staging of na afzonderlijke productie-uitvoeringsautorisatie:
   - Maak eerst de bestaande database- en storagebackup en stop writers volgens de release-runbook.
   - Voer uitsluitend de gedocumenteerde expliciete migratieopdracht uit; bevestig succesvolle one-shot exit.
   - Start daarna de drie runtime-services met de gedocumenteerde runtime-opdracht en controleer via `docker compose ps` en containerinspectie dat `migrate` niet automatisch start.
   - Verifieer de bestaande frontend- en backend-smokechecks, de worker-runtime en de effectieve resource/logconfiguratie.
5. Bij wijzigingen aan Dockerfiles, Compose-gedrag of gedeelde runtimeconfiguratie daarnaast: `docker compose build backend frontend worker`. Draai bestaande gerichte backend/frontend tests alleen wanneer de implementatie die code of buildinputs wijzigt.

## Risk + rollback plan

- **Onbedoelde schemawijziging:** een Compose-dependency of te brede `up`-opdracht kan `migrate` starten. Verwijder de dependency, gebruik service-expliciete runtimecommands en controleer vóór/na de proef de migratiecontainerstatus. Bij onverwachte migratie: stop verdere rollout, volg de bestaande database-/artifact-herstelprocedure en voer geen downgrade of handmatige historische migratie uit.
- **Te strakke resourcegrenzen:** CPU- of geheugenlimieten kunnen backend, frontend of scheduler throttlen/OOM-killen. Voeg geen waarden toe zonder baseline; begin met de kleinste onderbouwde wijziging, observeer exits/OOM en revert de betreffende Compose-instelling bij regressie.
- **Logrotatieverlies of incompatibiliteit:** agressieve rotatie kan diagnose-evidence verwijderen of door de gebruikte Docker/Compose-configuratie niet werken. Behoud voldoende retentie volgens baseline en operatorbehoefte; valideer de effectieve loggingconfiguratie; revert uitsluitend de loggingoptie als logtoegang of gedrag verslechtert.
- **SQLite-/writer-risico tijdens release:** migraties naast actieve writers kunnen lock- of datarisico geven. Maak geverifieerde backup, stop backend en worker volgens de runbook vóór de expliciete migratie en start pas daarna runtime-services.
- **Beschikbaarheidsimpact van lifecycleproef:** herstarts veroorzaken kortstondige onderbreking. Plan het venster, behoud de vorige Compose-configuratie en immutable releaseartifact, en rollback met de gedocumenteerde runtime-opdracht als smokechecks falen.
- **Gevoelige operationele evidence:** Compose- en inspectie-output kan secret- of padinformatie bevatten. Gebruik gerichte velden, redigeer secrets/credentials/tokens/headers/persoonsgegevens en sla geen volledige `.env` of volledige containerinspectie op.

## Notes / links

- Compose-conventie: `docker-compose.yml` in de repositoryroot; change specs staan onder `opsx/changes/`.
- Gerelateerde afgeronde change: `opsx/changes/2026-05-22-docker-restart-policies.md` introduceerde `restart: unless-stopped` voor backend/frontend/worker; deze change behoudt dat besluit.
- Gerelateerde incident-evidence: `opsx/changes/2026-08-12-login-herstel-runtime-diagnose.md`, met de vastgelegde afwijking dat een bestaande `migrate`-dependency bij een runtime-start onverwacht migraties uitvoerde.
- Bestaande releasevereisten staan in `README.md`, sectie **Release-readiness checklist**; deze change maakt de procedure operationeel ondubbelzinnig zonder de releasearchitectuur te herontwerpen.
- Aanname: de productieomgeving gebruikt reguliere Docker Compose (geen Docker Swarm). Daarom worden `deploy`-only resourceopties niet als afdwingbare runtime-limiet beschouwd zonder versie-specifieke bevestiging.
- Aanname: een representatief meetvenster is toegankelijk met bestaande Docker/host-operatorrechten; als 24 uur niet haalbaar is, documenteert de implementatie een korter onderbouwd venster en een concrete herbeoordelingsdatum.

## Current status

Partial — repository implementation verified; operational verification pending. De repositoryconfiguratie, release-/lifecycle-runbook en gebruikersgerichte changelog zijn bijgewerkt en de gerichte statische-, build-, test- en lokale smokechecks zijn geslaagd. Final review bevestigde dat de in-scope lifecycle-reparatie correct en scopebehoudend is. Een volledige frontend-build is niet als bewijs opgenomen door een bekende, niet-gerelateerde frontend-verificatieblocker; die blokkeert de repositorywijziging niet. Deze change is niet Completed: de gecontroleerde release/lifecycleproef met dynamisch bewijs dat `migrate` niet automatisch start, en de gesaniteerde 24-uurs productiebaseline, vereisen nog afzonderlijke staging- of productie-uitvoeringsautorisatie. Productie-orchestratie en de 24-uursbaseline zijn niet uitgevoerd.

## What changed

- `docker-compose.yml`: de `backend`-afhankelijkheid van `migrate` is verwijderd. `backend`, `frontend` en `worker` blijven afzonderlijke langlopende services met `restart: unless-stopped`; `migrate` behoudt uitsluitend `alembic upgrade head` en heeft geen restart policy.
- `README.md`: Quick start en operationele verwijzing maken de expliciete migratiestap en service-expliciete runtime-start duidelijk.
- `docs/docker-compose-operations.md`: nieuw operator-runbook voor preflight, backup/writer-stop, expliciete one-shot migratie, runtime lifecycle zonder migratie, baseline-observatie en rollback.
- `backend/app/api/meta.py` en `frontend/src/app/App.test.tsx`: About/changelog iteratie 102 toegevoegd, met bijbehorende gesorteerde frontendverwachting.
- Baseline-/beslisrecord: bij lokaal beschikbaar runtimebewijs (2026-08-12T11:02Z–11:24Z; normale lokale idle/lichte ontwikkelworkload) was CPU `0.00–0.09%`, geheugen backend `112.8 MiB`, frontend `5.988 MiB`, worker `85.01–87.06 MiB`, alle drie running met restart count `0`. Docker Compose v5.4.0 draait de bestaande containers met Docker `local` logging en daemonopties `max-size=20m`, `max-file=5`. Logpaden waren niet beschikbaar via deze rootless Docker-context en er is geen 24-uurs groeimeting uitgevoerd. Deze korte, niet-representatieve baseline onderbouwt geen veilige CPU-/geheugenlimiet, reservering of Compose-logoverride; daarom is bewust geen resource- of logginginstelling toegevoegd. Herbeoordeling: verzamel vóór **2026-09-12** een gesaniteerde 24-uurs productiebaseline volgens het nieuwe runbook, inclusief loggrootte/-groei, voordat zulke waarden worden overwogen.

## How to verify

- Statische Compose-preflight: `docker compose config`, `docker compose config --images` en de gerichte JSON-asserties uit **Verification evidence**.
- Gerichte regressiechecks: `cd backend && ./.venv/bin/pytest -q tests/test_meta_and_me.py -k about`; `cd frontend && npm test -- --run src/app/App.test.tsx`.
- Build en lokale smoke: `docker compose build backend frontend worker`; daarna `curl --fail --silent --show-error http://localhost:8001/health` en `curl --fail --silent --show-error http://localhost:5173/`.
- Voor rollout onder afzonderlijke autorisatie: volg volledig `docs/docker-compose-operations.md`; maak een geverifieerde database- en storagebackup, stop backend/worker, voer uitsluitend `docker compose run --rm --no-deps migrate` uit en start daarna uitsluitend `docker compose up -d --no-deps backend frontend worker`. Leg vóór en na de runtime-start UTC-timestamp, `migrate`-container-ID, start-/finish-timestamps en exitcode vast, of bewaar Docker events voor het volledige commandovenster; een historische exited container is geen bewijs van niet-uitvoering.

## Verification evidence

- **Geslaagd — Compose preflight (2026-08-12T11:24:15Z):** `docker compose config`; `docker compose config --images`; en een JSON-assertiescript met `backend/.venv/bin/python` slaagden. De asserties bevestigden aparte `backend`/`frontend`/`worker`-services met `restart: unless-stopped`, geen `migrate` in runtime-`depends_on`, `migrate.command == ["alembic", "upgrade", "head"]`, geen `migrate.restart` en geen nieuwe `logging`-secties. Compose rapporteert v5.4.0.
- **Geslaagd — gerichte About-regressie:** `cd backend && ./.venv/bin/pytest -q tests/test_meta_and_me.py -k about` → `1 passed, 24 deselected` (alleen bestaande deprecation warnings).
- **Geslaagd — frontend changelogverwachting:** `cd frontend && npm test -- --run src/app/App.test.tsx` → `1` testbestand, `88 passed`.
- **Geslaagd — Docker build:** `docker compose build backend frontend worker` → backend-, frontend- en worker-images gebouwd zonder fout.
- **Geslaagd — lokale bestaande runtime-smoke (repository-local, geen lifecycleproef):** `curl --fail --silent --show-error http://localhost:8001/health` → `{"status":"ok"}`; `curl --fail --silent --show-error http://localhost:5173/` → exit 0. `docker compose ps --all` toonde backend, frontend en worker running; de bestaande historische `migrate`-container stond `Exited (0)`. Er is geen runtime-service gerecreëerd en er is geen vóór/na container-ID-/timestamp- of Docker-eventbewijs vastgelegd; deze waarneming bewijst daarom niet dat een nieuwe runtime-start `migrate` niet uitvoert.
- **Geslaagd — werkboomcontrole:** `git diff --check` → exit 0. Bestaande, niet-gerelateerde werkboomwijzigingen (Dockerfiles, release-isolatiebestanden en andere specs) zijn niet gewijzigd door deze change.
- **Pending — gecontroleerde orchestration verification:** er is geen migratie uitgevoerd, geen writer gestopt en geen runtime-service gerecreëerd, zodat geen schema- of beschikbaarheidsactie buiten deze repositoryimplementatie plaatsvond. Onder afzonderlijke staging-/productie-uitvoeringsautorisatie moeten de runbookcommands worden uitgevoerd, inclusief vóór/na `migrate`-container-ID-/timestamp- of Docker-eventbewijs voor de volledige runtime-start. Pas daarmee kunnen acceptatiecriteria 7 en 8 worden bevestigd.
- **Pending — productiebaseline:** vóór **2026-09-12** moet een gesaniteerde, representatieve 24-uurs productiebaseline worden vastgelegd, inclusief CPU/geheugen, status/uptime/restarts en Docker-loggrootte/-groei per runtime-service. Pas daarna kunnen acceptatiecriteria 4 en 5 definitief worden bevestigd; tot dan blijft de no-change-beslissing voor resource- en logginginstellingen voorlopig.
- **Reviewresultaat:** final review vond geen resterende in-scope repository- of documentatiefout in de Compose-servicegraaf, expliciete migratieprocedure of runtime lifecycle-commands. De ontbrekende frontend-buildverificatie betreft een bestaande, niet-gerelateerde frontend-test/build-blocker en is buiten deze change gelaten.
- **Operationele follow-ups:** autoriseer en voer vóór **2026-09-12** de gecontroleerde staging-/productie-lifecycleproef uit met vóór/na `migrate`-container-ID-, timestamp- of Docker-eventbewijs; verzamel in hetzelfde operationele traject de gesaniteerde 24-uurs productiebaseline inclusief loggrootte/-groei. Herbeoordeel daarna de no-change-beslissing vóór eventuele resource- of loggingtuning. Voer geen productie-orchestratie of migratie uit als onderdeel van deze repository-finalisatie.

---
Status: Partial — repository implementation and review passed; controlled lifecycle proof, 24-hour production baseline, and unrelated frontend verification blocker remain follow-ups
Owner: —
Date: 2026-08-12
