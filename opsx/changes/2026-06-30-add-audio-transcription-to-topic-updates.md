# Title

Audio-transcriptie voor topicbronnen

## Context

Topicbronnen ondersteunen een lokale `audio/webm`-upload die de worker via OpenAI transcribeert. Het origineel blijft bewaard en een gekoppelde, read-only tekstbron wordt pas als geslaagd beschouwd nadat die bron is geïndexeerd.

De gebruiker heeft een expliciete uitbreiding goedgekeurd: een audio-upload is pas geldig na **server-side streaming-validatie** vóór elke duurzame opslag, database-write of queue-job. De browsergerapporteerde duur blijft uitsluitend een UX-hint en is geen autoritatieve beveiligings- of toelatingscontrole. De server accepteert maximaal **250.000.000 bytes (250 MB)**, schrijft de requeststream alleen naar een unieke geïsoleerde tijdelijke directory en inspecteert dat tijdelijke bestand met `ffprobe` uit de FFmpeg-runtime. De inspectie moet een WebM-container, minimaal één Opus-audiotrack en een eindige, strikt positieve gemeten duur van maximaal 10.800 seconden (180 minuten) aantonen.

Deze expliciet goedgekeurde uitbreiding vervangt uitsluitend de eerdere scopegrenzen die deployment en de About-changelog uitsloten. Alle overige hieronder vastgelegde audio-, migratie-, isolatie- en providerbeslissingen blijven behouden.

Deze change voegt de nieuwe migratie `20260630_0024` toe aan de **in `HEAD` vastgelegde lineaire graph**. De graph voor de audio-patch is:

```text
20260616_0023
  -> 20260630_0024 (nieuw: audio)
  -> 20260729_0025 (bestaand en ongewijzigd in HEAD)
  -> 20260730_0026
  -> 20260809_0027
  -> 20260810_0028 (huidige HEAD-revisie)
```

De primaire worktree bevat een niet-audio wijziging aan `0025` en niet-getrackte externe revisies `0029`/`0030`. Die bestanden horen niet bij deze change en worden niet gewijzigd of meegenomen in audioverificatie. De migratieregressie bouwt daarom een wegwerpgraph uit de getrackte migratieblobs van `HEAD` plus uitsluitend de nieuwe `0024`.

## Goals / Non-goals

### Goals

- Accepteer uitsluitend topicaudio met een `.webm`-bestandsnaam én toegestane WebM-MIME (`audio/webm` of `audio/webm;codecs=opus`) die vervolgens als geldige WebM/Opus-media wordt gemeten, bewaar het origineel en plan transcriptie asynchroon in.
- Gebruik OpenAI met configureerbaar transcriptiemodel en standaardtaal `nl`; ontbrekende configuratie en lege provideroutput moeten expliciet falen.
- Markeer audio alleen `completed` als de gekoppelde transcriptbron daadwerkelijk `indexed` is.
- Bewaar upload- en transcriptbestanden onder unieke veilige opslagnamen, terwijl de oorspronkelijke/display-bestandsnaam in het model en de API behouden blijft.
- Ondersteun failure, behoud van het origineel en handmatige retry.
- Valideer elke audio-upload server-side, streaming en vóór durable source/queue: maximaal 250.000.000 bytes, WebM-container, Opus-track en een door `ffprobe` gemeten eindige positieve duur van hoogstens 180 minuten.
- Maak de FFmpeg/`ffprobe`-runtimeafhankelijkheid en de benodigde Docker-, Compose/runtime- en deploymentconfiguratie expliciet en reproduceerbaar.
- Voeg echte, minimale mediafixtures toe voor de geaccepteerde WebM/Opus- en afgewezen media-eigenschappen, zonder externe media of provider in tests.
- Voeg als nieuwe audio-specifieke iteratie **100** een eindgebruikersvriendelijk About-changelogitem toe boven de huidige HEAD-iteratie 97; behoud alle bestaande HEAD-changelogcontent ongewijzigd.
- Bewijs `0024` up/down/re-up en voortzetting over de ongewijzigde lineaire HEAD-keten tot `0028` in disposable SQLite.

### Non-goals / scope boundaries

- Geen wijziging aan `20260729_0025_board_card_lifecycle.py` of andere bestaande migraties.
- Geen opname van de niet-getrackte externe migraties `0029`/`0030` en geen merge-revisie of merge-test.
- Geen wijziging aan bestaande HEAD-changelogcontent of visibilitygedrag. De dirty iteraties 98/99 zijn externe, uitgesloten worktreewijzigingen. Alleen het hieronder exact gespecificeerde nieuwe audio-item voor iteratie 100 is toegestaan in `backend/app/api/meta.py` en de bijbehorende About-test.
- Geen nieuw audioformaat, transcriptbewerking, automatische retry, production deploymentuitvoering, commit of push.
- Geen vertrouwen op MIME, bestandsnaam, `Content-Length` of clientduur als bewijs van geldigheid; zij mogen alleen als vroege hint of UX dienen en vervangen de serverstream- en probecontroles niet.
- Geen permanente quarantine, objectstorage, transcodering of acceptatie van video zonder Opus-audiotrack.
- Geen echte OpenAI-call in tests.

## Proposed approach

1. Voeg `0024` toe met parent `0023`; valideer de patch als overlay op de getrackte `HEAD`, waarin het bestaande ongewijzigde `0025` al naar `0024` verwijst.
2. Sla elk bronbestand fysiek op met een unieke prefix en houd de opgeschoonde originele naam als displaynaam.
3. Sla elk transcript fysiek op onder het unieke audio-document-ID en houd `<originele-stem>.transcript.txt` als displaynaam.
4. Laat de OpenAI-adapter zonder clientconfiguratie een duidelijke runtimefout geven; tests monkeypatchen transcriptie expliciet.
5. Verwerp transcripties zonder bruikbare tekst en controleer na ingestion dat de transcriptbron `indexed` is voordat audio `completed` wordt.
6. Stream de upload naar een per-request gemaakte directory onder een configureerbare tijdelijke root die niet onder `STORAGE_ROOT` valt. Tel feitelijk gelezen bytes; stop en verwijder direct zodra de limiet van 250.000.000 bytes wordt overschreden, ook zonder of met onjuiste `Content-Length`.
7. Roep na een volledig geschreven tijdelijke upload `ffprobe` zonder shell op en parse uitsluitend de gestructureerde uitvoer. Eis `format_name` met `webm`, minimaal één audio-stream met `codec_name=opus`, en een numerieke `duration` waarvoor `math.isfinite(duration)` en `0 < duration <= 10800` gelden. Elke ontbrekende executable, timeout, niet-nul-exit, parsefout of ontbrekend/ongeldig probeveld is een afwijzing en leidt tot cleanup.
8. Verplaats/kopieer uitsluitend een volledig gevalideerd tijdelijk bestand atomair naar de bestaande unieke durable audio-opslag; maak pas daarna in één consistente flow document/audio-record en queue-job aan. Elke fout vóór die durable stap laat geen source, bestand of job achter; fouten tijdens de durable stap rollen de aangemaakte artefacten terug en ruimen de tijdelijke directory op.
9. Test migratie, upload, verwerking, indexeringsfailure, lege output, gelijke bestandsnamen, failure, retry, streaming/probe-afwijzingen, runtimeafhankelijkheid en de nieuwe About-entry met tijdelijke SQLite/storage.

## Implementation steps (ordered)

1. Controleer spec, volledige worktree-diff, HEAD-migratieblobs, audioimplementatie, tests en opslagconventies.
2. Vervang de mergegerichte migratietest door een audio-only disposable HEAD-overlaytest.
3. Herstel OpenAI-configuratiefailure, lege-outputvalidatie en koppeling tussen indexeringsresultaat en audiostatus.
4. Introduceer unieke fysieke namen voor topicuploads en transcriptbestanden met behoud van displaynamen.
5. Inventariseer het bestaande uploadpad, Dockerfiles, `docker-compose.yml`, runtime/deploydocumentatie en bestaande limietconfiguratie. Leg één serverconstante/configuratiecontract vast: `MAX_TOPIC_AUDIO_UPLOAD_BYTES=250000000`, een tijdelijke audio-root buiten `STORAGE_ROOT`, een expliciet `FFPROBE_BIN` (standaard `ffprobe`) en een probe-timeout. Voeg waar nodig voorbeeldconfiguratie, volume-/schrijfrechten en deploymentpreflight toe; de limiet mag niet via clientinput of deploymentconfiguratie worden verhoogd.
6. Installeer de projectpassende FFmpeg-runtimedependency in elk image/proces dat server-side topicaudio valideert, inclusief het canonical backend/runtime-image. Gebruik het bestaande distro-pakketmechanisme, cache-opruiming en non-root schrijfbare tijdelijke directory; documenteer de minimale productievereiste `ffprobe -version` zonder secrets.
7. Implementeer de streaming-temp/probe/atomische-promotieflow met begrensde subprocessaanroep, geen shell en gegarandeerde cleanup in `finally`/foutpaden. Behoud de huidige clientduur uitsluitend als hint in de UI/API waar die al bestaat.
8. Voeg kleine, legale en deterministische binary fixtures toe: een geldige WebM met Opus, een WebM zonder Opus en een niet-WebM-bestand. Genereer of verifieer ze met vastgelegde FFmpeg-commando's; documenteer bestandsnamen, verwachte probe-eigenschappen en maximale fixturegrootte. Gebruik mocks alleen voor procesfouten/timeouts, niet als vervanging voor de succesvolle echte probe.
9. Voeg regressies toe voor alle repair findings, bytegrens (precies limiet en limiet + 1 tijdens streaming), ontbrekende/misleidende `Content-Length`, container/codec/duur/probefailure en cleanup; voer gerichte migratie-/audio-/OpenAI-tests inclusief mock-only transcriptie-E2E uit.
10. Voeg boven de huidige HEAD-iteratie 97 exact dit nieuwe item toe, zonder bestaande HEAD-changelogcontent te wijzigen:

    ```python
    {
        "iteration": "100",
        "date": "2026-08-11",
        "title": "Topicbronnen ondersteunen nu veilige audio-transcriptie",
        "highlights": [
            "Je kunt een geldige WebM-audio-opname als topicbron toevoegen; de opname wordt daarna veilig verwerkt tot een doorzoekbare tekstbron.",
            "Bestanden die niet aan de audiocontroles voldoen, worden direct afgewezen zodat alleen bruikbare opnames verdergaan.",
        ],
    }
    ```

    Dit volgt de geldende conventie: iteratielabel, opleverdatum, korte duidelijke titel en 2–4 niet-technische highlights over wat de gebruiker merkt.
11. Voer de affected backend suite, About-test, Docker/build/probe-preflight en daarna de canonieke repositoryverificatie uit; noteer exacte resultaten zonder externe hunks als audio-evidence te claimen.

## Acceptance criteria

1. De audio-only migratieregressie gebruikt getrackte `HEAD`-migraties plus nieuwe `0024`, sluit worktree-`0025` en externe `0029`/`0030` uit en bewijst de lineaire graph `0023 -> 0024 -> 0025 -> ... -> 0028`.
2. Disposable SQLite kan upgraden `0023 -> 0024`, downgraden `0024 -> 0023`, opnieuw upgraden naar `0024` en doorgaan naar de enige HEAD-revisie `0028`, met schema- en revisieasserties.
3. Geen in-scope diff wijzigt `0025`, `0029`, `0030` of bestaande HEAD-changelogitems. Dirty iteraties 98/99 zijn externe, uitgesloten worktreewijzigingen. `meta.py` en `test_meta_and_me.py` mogen uitsluitend wijzigen voor het exact gespecificeerde iteratie-100-item en een test die uitsluitend de exacte iteratie-100-payload controleert.
4. Een upload met `.webm`-bestandsnaam, toegestane WebM-MIME en een geldige fixture met WebM-container, Opus-track, gemeten duur `> 0` en `<= 10800` seconden retourneert `queued` zonder provider-call. Elke kruiscombinatie waarin bestandsnaam of MIME niet is toegestaan wordt vóór durable opslag afgewezen. De server heeft bij een toegestane kandidaat maximaal 250.000.000 bytes uit de stream gelezen, promoot pas na geslaagde probe naar durable storage en verwijdert de request-tempdirectory.
5. Uploads van 250.000.001 bytes worden tijdens streaming afgewezen en alle bytes boven de grens worden niet duurzaam geschreven; dit geldt ook bij ontbrekende, te kleine of misleidende `Content-Length`. Precies 250.000.000 bytes mag de bytecontrole passeren en wordt vervolgens alleen op de overige validatieregels beoordeeld.
6. Een bestandsnaam of MIME die WebM suggereert maar waarvan `ffprobe` geen WebM-container, geen Opus-audiotrack, geen numerieke/eindige duur, duur `<= 0` of duur `> 10800` rapporteert, wordt afgewezen. Clientduur kan deze uitkomst nooit veranderen.
7. Bij een ontbrekende `ffprobe`, timeout, niet-nul-exit of onparsebare probe-uitvoer faalt de upload gesloten en blijven geen durable document/audio-record, storagebestand of queue-job achter. De geïsoleerde tijdelijke directory is ook na elke afwijzing of exception verwijderd.
8. Canonical backend/runtime-images bevatten de benodigde FFmpeg/`ffprobe`-dependency; `ffprobe -version` slaagt in de runtimecontext. Configuratie/documentatie benoemt de vaste 250 MB-limiet, tijdelijke root buiten durable storage, executable/timeout, benodigde schrijfrechten en deploymentpreflight zonder secrets.
9. De repository bevat minimale echte fixtures voor geldig WebM/Opus, WebM-zonder-Opus en niet-WebM. Tests gebruiken de geldige fixture voor een echte `ffprobe`-succesroute en bewijzen de specifieke afwijzingen; procesfout en timeout zijn deterministisch gemockt.
10. Ontbrekende OpenAI-configuratie faalt duidelijk en levert nooit een gefabriceerd `[MOCK]`-transcript; alle succesvolle testtranscripties gebruiken expliciete mocks.
11. Lege of whitespace-only provideroutput zet audio op `failed` en maakt geen transcriptbron.
12. Een transcriptie wordt alleen `completed` wanneer haar gekoppelde transcriptbron `indexed` is; ingestion/indexeringsfailure houdt audio op `failed` met een bruikbare fout.
13. Twee uploads met dezelfde displaynaam en hun transcripties hebben verschillende fysieke paden, behouden beide inhoud en behouden dezelfde bedoelde displaynamen.
14. Providerfailure behoudt het originele gevalideerde audiobestand; handmatige retry kan daarna precies één gekoppelde transcriptbron succesvol indexeren.
15. `_default_about()` bevat exact het gespecificeerde iteratie-100-item boven de huidige HEAD-iteratie 97. Bestaande HEAD-changelogcontent blijft ongewijzigd; dirty iteraties 98/99 zijn externe, uitgesloten worktreewijzigingen. De geïsoleerde About-test controleert uitsluitend de exacte iteratie-100-payload.
16. Gerichte migratie-, audio-, OpenAI-, About-, Docker/probe- en mock-only E2E-tests zijn groen; bredere/canonieke reruns zijn uitgevoerd of expliciet als nog nodig gerapporteerd.

## Testing plan

Vanuit `backend/`, uitsluitend met tijdelijke testdatabase en storage:

```bash
STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest \
  tests/test_audio_migration_revision.py \
  tests/test_topic_audio_transcription.py \
  tests/test_openai_client.py \
  tests/test_meta_and_me.py -k 'about' -q

STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_topic_audio_transcription.py -q
STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest -q
```

De audio-test gebruikt per run een afzonderlijke `STORAGE_ROOT` én tijdelijke audio-root; hij controleert na elk succes- en foutpad dat beide tijdelijke roots leeg zijn waar vereist. Draai de echte probe-route niet over met een global `ffprobe`-mock.

Runtime/deployment-preflight (pas paden/servicenamen alleen aan als de geïnspecteerde repositoryconventie dat vereist):

```bash
docker compose build backend worker
docker compose run --rm --no-deps backend sh -lc 'ffprobe -version'
docker compose run --rm --no-deps backend sh -lc 'test -w "${TOPIC_AUDIO_TMP_ROOT:-/tmp/wervelnieuws-topic-audio}"'
```

Controleer de Dockerfile(s), Compose en deploymentdocumentatie ook statisch op de FFmpeg-installatie, de vaste limiet van `250000000`, de tijdelijke root buiten `STORAGE_ROOT`, de executable/timeout en de vereiste volume-/directoryrechten. Gebruik geen productiecontainer, productie-opslag of echte OpenAI-call.

Repositorychecks:

```bash
git diff --check
cd frontend && npm test -- --run
cd frontend && npm run build
```

Controleer afsluitend `git status --short`, de audio-allowlist en de diff van beschermde/externe bestanden.

## Risk + rollback plan

- **Verkeerde migratiegraph:** de regressie reconstrueert de getrackte HEAD-graph en voegt alleen `0024` toe. Stop als `0025` in HEAD niet naar `0024` verwijst of meer dan één HEAD ontstaat.
- **Bestandsverlies door naamcollision:** unieke fysieke namen voorkomen overschrijven; regressies bewijzen behoud van beide bestanden en transcripties.
- **Vals succes na indexeringsfailure:** audiostatus volgt expliciet de transcriptstatus na ingestion.
- **Onbedoelde providercall:** ontbrekende configuratie faalt; tests monkeypatchen de adapter.
- **Uitputting van disk of geheugen via uploads:** de bytecounter begrenst de stream op 250.000.000 bytes zonder volledige requestbuffer; tijdelijke opslag is geïsoleerd en wordt op elk pad verwijderd. Stel de tijdelijke directory op een volume met voldoende ruimte en restrictive permissions in.
- **Vervalste metadata of malafide media:** MIME, naam en clientduur zijn niet autoritatief. `ffprobe` valideert container, codec en gemeten eindige duur; subprocess zonder shell, timeout en fail-closed gedrag verkleinen parser-/hangrisico. Houd FFmpeg via de reguliere image-updates bijgewerkt.
- **FFmpeg ontbreekt of containerrechten blokkeren tijdelijke opslag:** build- en runtime-preflight controleren `ffprobe -version` en schrijfrechten vóór deployment. Bij failure geen audio-uploadrelease; herstel image/config/volume, niet door validatie te omzeilen.
- **Cleanup- of gedeeltelijke-promotiefout:** gebruik per request een unieke tempdirectory, `finally`-cleanup en compensating cleanup voor elke mislukte durable write. Tests inventariseren durable storage, database, queue en tempdirectories na ieder foutpad.
- **Onjuiste changelogmutatie:** voeg slechts het exact gespecificeerde iteratie-100-item boven HEAD-iteratie 97 toe en test uitsluitend die exacte payload. Rollback verwijdert alleen het nieuwe item, niet bestaande HEAD-changeloginhoud.
- **Rollback:** revert uitsluitend de audio-code, nieuwe `0024`, audio-tests en deze spec. Wijzig geen bestaande migratiegeschiedenis; maak vóór een toegepaste database-rollback een back-up en gebruik de geteste downgrade naar `0023` alleen waar operationeel toegestaan.

## Notes / links

- Nieuwe migratie: `backend/alembic/versions/20260630_0024_audio_topic_transcription.py`
- Audio-only migratieregressie: `backend/tests/test_audio_migration_revision.py`
- Audioflow: `backend/app/services/topic_source_service.py`, `backend/app/services/transcription_service.py`
- Provideradapter: `backend/app/integrations/openai_client.py`
- Validatie: bestaand topicuploadpad plus een kleine afzonderlijke validator/service; gebruik `subprocess` met argumentlijst voor `FFPROBE_BIN` en gestructureerde JSON-uitvoer.
- Runtime/deployment: `backend/Dockerfile`, eventuele validator-uitvoerende worker-image, `docker-compose.yml`, `.env.example`/deploymentdocumentatie en bestaande configuratieschemas.
- Fixtures: `backend/tests/fixtures/audio/` met generatie-/validatie-instructie naast de fixtures; binary fixtures blijven klein, legaal te distribueren en deterministisch.
- About: `backend/app/api/meta.py`, `backend/tests/test_meta_and_me.py` en de bestaande frontend-About-test/route. Iteratie 98 is beschermd tegen inhoudswijziging; iteratie 100 is de enige nieuwe changelog-entry in scope.
- Beschermd en extern: worktree-`0025`, niet-getrackte `0029`/`0030` en alle niet-genoemde bestaande changelogitems.
- Geen commit, push of deployment is geautoriseerd of uitgevoerd.

## Current status

Completed — de final-review rescue repairs zijn na gerichte, volledige, Docker-runtime- en geïsoleerde staged-treeverificatie gereed voor final review. Geen commit, push of deployment is uitgevoerd.

## What changed

- Verving de foutieve sibling/mergebenadering door de werkelijke audio-only HEAD-overlaygraph.
- Verving de merge-regressie door een disposable up/down/re-up- en continuatietest tot HEAD-revisie `0028`.
- Laat ontbrekende OpenAI-configuratie en lege transcriptoutput expliciet falen.
- Koppelde `completed` aan succesvolle transcriptindexering.
- Maakte fysieke upload- en transcriptnamen uniek met behoud van displaynamen.
- Voegde regressies toe voor indexeringsfailure, lege output, naamcollisions en de bestaande mock-only upload/failure/retry-E2E.
- Sloot externe dirty iteraties 98/99 en hun meta-werk uit van de audioverificatie.
- Borgde in de final-reviewrepair dat topicaudio alleen als audio geldt wanneer zowel de bestandsnaam op `.webm` eindigt als de MIME een toegestane WebM-MIME is; de frontendpicker en audiodetectie bieden geen OGG meer aan.
- Implementeerde streaming naar een unieke request-tempdirectory met een harde grens van exact 250.000.000 bytes, zonder vertrouwen op `Content-Length` of clientduur.
- Valideert met begrensde `ffprobe`-JSON-inspectie WebM-container, Opus-audiostream en eindige positieve gemeten duur tot 10.800 seconden; proces- en metadatafouten falen gesloten.
- Promoveert pas na validatie via een durable stagingbestand en atomische rename; temp-, staging- en final-bestanden worden op probe- of databasefailure verwijderd en er ontstaat dan geen queued document.
- Voegde FFmpeg uitsluitend toe aan de backend test/runtime-image, plus configureerbare geïsoleerde temp-root, executable/timeout, preflightdocumentatie en drie kleine synthetische fixtures.
- Voegde iteratie 100 exact boven de huidige HEAD-iteratie 97 toe; de gerichte About-test controleert uitsluitend de exacte iteratie-100-payload.

## How to verify

Voer de commando's onder **Testing plan** uit. De migratietest vereist een Git-worktree omdat hij bewust de getrackte `HEAD`-blobs gebruikt om externe worktree-migraties uit te sluiten. Verifieer aanvullend uitsluitend de exacte iteratie-100-payload boven HEAD-iteratie 97, plus een echte `ffprobe`-run op de geldige fixture in de backend-runtimeimage. Iteraties 98/99 zijn externe dirty worktreewijzigingen en vallen buiten deze verificatie.

## Verification evidence

### Fresh pre-repair confirmation (2026-08-11)

- Worktreegraphinspectie toonde ten onrechte een mergehead `0030`, veroorzaakt door een gewijzigde `0025` en niet-getrackte externe `0029`/`0030`; `git show HEAD:backend/alembic/versions/20260729_0025_board_card_lifecycle.py` bevestigde dat de ongewijzigde HEAD-versie `down_revision = "20260630_0024"` heeft.
- De bestaande mergegerichte test plus audio/OpenAI-tests waren groen (`16 passed`), maar testten daardoor de verkeerde worktreegraph en legden de vier runtime-/opslagfouten niet bloot.
- Directe code-inspectie bevestigde: ingestionfouten werden intern op de transcriptbron vastgelegd maar audio werd daarna toch `completed`; lege transcripties werden geaccepteerd; ontbrekende OpenAI-configuratie fabriceerde `[MOCK]`-tekst; upload- en transcriptpaden gebruikten collisiongevoelige displaynamen.

### Rescue evidence (2026-08-11)

- `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_audio_migration_revision.py tests/test_topic_audio_transcription.py tests/test_openai_client.py -q` — **16 passed**, 45 warnings, 9.41s. Dit omvat de disposable audio-only HEAD-migratieroundtrip en de expliciet gemockte in-process E2E.
- `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_audio_migration_revision.py -q` — **1 passed**, 1 warning, 2.19s. De test bouwde alleen getrackte HEAD-migraties plus `0024`, verifieerde één head `0028`, `0025.down_revision == 0024`, up/down/re-up door `0024` en voortzetting naar `0028`.
- `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_topic_audio_transcription.py -q` — **13 passed**, 45 warnings, 8.32s. Dit omvat upload/queued, expliciete provider-mock, index/retrieval, lege output, indexeringsfailure, providerfailure/origineelbehoud, retry en dezelfde-displaynaamcollision voor audio en transcripties.
- Affected backend: `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_audio_migration_revision.py tests/test_topic_audio_transcription.py tests/test_openai_client.py tests/test_auth_and_topics.py tests/test_worker_cycle.py tests/test_admin_api.py -q` — **59 passed**, 152 warnings, 34.02s.
- Complete backend: `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest -q` — **244 passed**, 927 warnings, 139.30s. Alleen bestaande pytest-asyncio/passlib/python-jose-deprecationwaarschuwingen.
- Frontend canonical: `npm test -- --run` — **5 files, 167 tests passed**, 16.38s; `npm run build` — **passed**, met alleen de bestaande Vite chunk-sizewaarschuwing.
- `git diff --check` — **passed**. Een afsluitende statuscontrole bevestigde dat niets staged is en dat worktree-`0025`, externe `0029`/`0030`, `meta.py`, `test_meta_and_me.py` en overige niet-audiohunks dirty maar buiten de audio-repair gebleven zijn. Hun bestaande diffs zijn niet als audio-evidence gebruikt.

### Final-review WebM-only repair (2026-08-11)

- Root cause: frontend- en backenddetectie gebruikten OR-logica, waardoor een OGG-bestandsnaam met een vervalste `audio/webm`-MIME als topicaudio kon worden opgeslagen; daarnaast bood de picker OGG expliciet aan.
- Focused backend: `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_topic_audio_transcription.py -q` — **14 passed**, 50 warnings, 8.50s; bevat de regressie `.ogg` + `audio/webm` en controleert dat geen document, bestand of queued job achterblijft.
- Focused frontend: `npm test -- --run src/app/App.test.tsx` — **1 file, 88 tests passed**, 12.96s; de audioassertie vereist de WebM-only `accept`-waarde.
- Complete backend: `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest -q` — **245 passed**, 932 warnings, 148.99s.
- Complete frontend: `npm test -- --run` — **5 files, 167 tests passed**; `npm run build` — **passed**, met alleen de bestaande Vite chunk-sizewaarschuwing.
- Final `git diff --check` en statuscontrole: zie de afsluitende rescue-uitvoer; niets is staged of gecommit.

### Server-side media-validation expansion (2026-08-11)

- Fresh baseline focused backend vóór implementatie: `15 passed, 24 deselected`; dit bevestigde dat de bestaande tests de in-memory/clientduurroute nog accepteerden en de ontbrekende serverprobe niet afdekten.
- Focused backend na implementatie: `25 passed, 1 skipped, 25 deselected` voor audio-migratie, topicaudio, OpenAI en About; de skip is uitsluitend de host-integratietest omdat host-`ffprobe` ontbreekt.
- Echte containerintegratie met de drie fixtures: `1 passed`; valide WebM/Opus geaccepteerd, WebM/Vorbis en WAV afgewezen.
- Backend volledig: `253 passed, 1 skipped`, 923 bestaande deprecationwaarschuwingen, in 197.65s. Dezelfde host-`ffprobe`-skip is afzonderlijk groen bewezen in de backendcontainer.
- Frontend gericht: `src/app/App.test.tsx` — `88 passed`. Frontend volledig: `5 files, 167 passed`. Productiebouw: geslaagd; alleen de bestaande Vite chunk-sizewaarschuwing.
- `docker compose build backend` slaagde. Compose-runtimepreflight bewees `ffprobe`, schrijfbaarheid van de standaard temp-root en afwezigheid van `pytest` in runtime.
- `git diff --check` slaagde; niets is staged, gecommit, gepusht of gedeployed. Externe dirty hunks, migraties `0025`/`0029`/`0030` en iteraties 98/99 zijn uitgesloten van deze audio-evidence.

### Final-review SOL rescue repair (2026-08-11)

- Fresh confirmation vóór edits: de exacte-limiettest accepteerde onterecht `application/octet-stream`, `_is_audio_candidate` gebruikte OR-logica en de runtime-image had geen `USER`; de bestaande About-test moest worden beperkt tot uitsluitend de exacte iteratie-100-payload, terwijl de README-audiotekst één diffhunk met externe release/migratietekst deelde.
- Backend kandidaat-/artefactregressies: `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_topic_audio_transcription.py tests/test_meta_and_me.py -k 'invalid_audio_upload or exact_byte_limit or about_returns' -q` — **8 passed**. De matrix dekt `.webm`/niet-`.webm` tegen beide toegestane MIME's en afgewezen MIME's; de exact-limietroute gebruikt `audio/webm;codecs=opus`; afwijzingen laten geen document, queue-, storage- of temp-artefact achter.
- Gerichte audio/About/OpenAI/migratiecheck: **30 passed, 1 skipped, 25 deselected**; de enige skip is host-`ffprobe`, afzonderlijk daadwerkelijk groen bewezen in Docker.
- Frontend gericht: `npm test -- --run src/app/App.test.tsx` — **88 passed**.
- Backend volledig: `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest -q` — **258 passed, 1 skipped**. Frontend volledig: **5 files, 167 passed**. Productiebouw: **passed**, uitsluitend bestaande Vite chunk-sizewaarschuwing.
- Canonieke images: `docker compose build backend frontend worker` — **passed**.
- Backend-runtime: Compose-image draait als `uid=1000(app) gid=1000(app)`, `/data` is schrijfbaar met de bestaande UID/GID-1000 bind mount, de standaard audio-temp-root is `app:app` mode `0700`, `pytest` ontbreekt in runtime en `ffprobe` rapporteerde voor de echte fixture `matroska,webm`, Opus en duur `0.108000`.
- Een eerste non-rootproef met UID/GID 10001 toonde terecht dat de bestaande UID/GID-1000 bind mount niet schrijfbaar was. De coherente mountrepair gebruikt daarom configureerbare `APP_UID`/`APP_GID` met deploymentcompatibele defaults `1000`; de herbouwde runtimepreflight slaagde inclusief `/data`.
- Tijdelijke-indexsimulatie tegen `HEAD` bevatte uitsluitend de review-isolatieslice `README.md`, `backend/Dockerfile`, iteratie 100 in `backend/app/api/meta.py`, de iteratie-100-only About-assertie en de al noodzakelijke audio-enumreparatie voor de inconsistente HEAD-import. `git diff --cached --check` slaagde en zoeken bevestigde afwezigheid van iteraties 98/99, visibility, `0029` en `0030`. De geïsoleerde About-test was **1 passed**; een geïsoleerd Docker-image was non-root, kon de bestaande bind mount schrijven en probeerde de echte fixture succesvol.
- De echte repository-index bleef leeg; `git diff --check` en `git diff --cached --check` slaagden. Externe dirty worktreehunks zijn behouden en niets is gecommit.

### Review-directed About evidence repair (2026-08-11)

- De changelogscope is gecorrigeerd naar de getrackte `HEAD`: iteratie 100 wordt boven de huidige HEAD-iteratie 97 ingevoegd. Alle bestaande HEAD-changelogcontent blijft ongewijzigd; dirty iteraties 98/99 zijn externe, uitgesloten worktreewijzigingen.
- De About-regressie controleert uitsluitend de exacte iteratie-100-payload en doet geen assertions over externe entries of relatieve volgorde.
- Tijdelijke-index-diffcheck: een index vanaf `HEAD` met uitsluitend de iteratie-100-meta- en About-testpatch bevatte alleen `backend/app/api/meta.py` en `backend/tests/test_meta_and_me.py`; `git diff --cached --check` slaagde.
- `STORAGE_ROOT="$(mktemp -d)" .venv/bin/python -m pytest tests/test_meta_and_me.py -k test_about_returns_read_only_payload -q` (vanuit `backend/`) — **1 passed, 24 deselected**, 2 bestaande deprecationwaarschuwingen, 0.61s. De test assert uitsluitend de exacte iteratie-100-payload.

---
Status: completed
Owner: n.v.t.
Date: 2026-08-11
