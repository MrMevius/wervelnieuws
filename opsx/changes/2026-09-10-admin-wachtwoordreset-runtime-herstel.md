# Title

Bewezen runtimeherstel voor defecte admin-wachtwoordreset

## Context

De admin-reset via `PATCH /api/admin/users/{user_id}/password` werd in de onderzochte runtime vóór het endpoint geblokkeerd. Read-only correlatie bewees dat `HttpSecurityMiddleware` cookie-geauthenticeerde writes met de publieke browser-origin als `403` weigerde doordat de runtime `ALLOWED_ORIGINS=*` geen concrete vertrouwde origin opleverde. Het endpoint en de SQLite-write werden niet bereikt. De frontend gaf voor deze categorie aanvankelijk alleen generieke feedback.

Een review van de eerste frontendrepair vond daarnaast een onafhankelijke Admin-crash op actuele `origin/main`: `GenAIModelOptions` werd als volledig getypeerd aangenomen, terwijl een oudere of gedeeltelijk uitgerolde response één of meer optielijsten kan missen. De onvoorwaardelijke `.includes`/`.map` op zo'n ontbrekende lijst breekt de volledige Admin-render. De review vond ook dat de echte FastAPI-`422`-body geen tekst `422` bevatte, omdat de API-client alleen de responsebody in `Error.message` bewaarde, en dat de veilige originmelding door de tekstheuristiek als succes werd gestyled.

## Goals / Non-goals

### Goals

- Behoud de bewezen veilige, actiegerichte origin-`403`-feedback zonder ruwe servertekst.
- Toon voor een echte FastAPI-`422` resetrespons veilige, bruikbare wachtwoordvalidatiefeedback.
- Classificeer de security-blocked feedback visueel als fout.
- Voorkom dat ontbrekende, gedeeltelijke of legacy GenAI-modelopties de Admin-pagina laten crashen; normaliseer alle drie optielijsten defensief.
- Dek deze reviewfindings deterministisch af en herverifieer frontend en relevante backendcontracten.

### Non-goals

- Geen wijziging van endpointcontract, wachtwoordpolicy, auth-/originbeleid of externe runtimeconfiguratie.
- Geen database-, data-, configuratie- of migratiewijziging.
- Geen self-service/e-mail/token-reset en geen brede foutafhandelings- of UI-refactor.
- Geen wijziging aan `data.failed-...`.

## Proposed approach

1. Normaliseer ieder ontvangen GenAI-modeloptieveld afzonderlijk naar een veilige, unieke lijst strings en val terug op een lege lijst.
2. Behoud responsebodycompatibiliteit in de API-client, maar voeg de HTTP-status aan het foutobject toe.
3. Classificeer reset-`422` op status en origin-`403` op status plus de exact bekende veilige foutcategorie; toon uitsluitend vaste Nederlandse feedback.
4. Neem de geblokkeerde securitymelding op in de bestaande foutstijlclassificatie.
5. Voeg Admin-rendertests met ontbrekende/legacy opties en resettests met representatieve FastAPI-/securityresponses toe.

## Implementation steps (ordered)

1. Start een schone worktree en fixbranch vanaf actuele `origin/main`; porteer deze spec zonder de dirty safety-worktree of `data.failed-...` te wijzigen.
2. Inspecteer Admin-modelopties, API-fouttransport, resetfeedback, styling en gekoppelde tests.
3. Implementeer de defensieve modeloptienormalisatie en statusbehoud.
4. Implementeer vaste veilige `422`- en origin-`403`-feedback plus foutstyling.
5. Voeg de gegroepeerde regressietests toe.
6. Draai gerichte tests, complete frontendtest, frontendbuild, relevante backendchecks en diffcontrole.
7. Werk status en evidence bij; commit en push niet vóór verificatie en herreview.

## Acceptance criteria

1. Admin rendert met een lege, gedeeltelijke en legacy GenAI-modeloptionsresponse.
2. `text_models`, `image_models` en `transcription_models` worden onafhankelijk defensief genormaliseerd; de actuele configuratiewaarde blijft als selectoptie beschikbaar.
3. Een representatieve FastAPI-`422` voor `new_password` resulteert in veilige bruikbare feedback zonder serverdetail of ingezonden waarde.
4. Exact de bekende origin/security-`403` behoudt veilige actiegerichte feedback zonder ruwe backendtekst en wordt visueel als fout getoond.
5. Bestaande succesvolle reset en admin-only/backend-securitycontracten blijven slagen.
6. Er zijn geen database-, configuratie-, migratie- of datawijzigingen.

## Testing plan

- `npm test -- --run src/app/App.test.tsx -t "GenAI model options|FastAPI 422|origin security|change another user password"`
- `npm test -- --run src/app/App.test.tsx`
- `npm test -- --run`
- `npm run build`
- `<tijdelijke-venv>/bin/python -m pytest tests/test_admin_api.py tests/test_http_security.py -q`
- `git diff --check`

## Risk + rollback plan

- **Te brede foutclassificatie:** originfeedback vereist de concrete bekende servercategorie; `422` gebruikt de bewaarde HTTP-status. Andere fouten houden de generieke fallback.
- **Verbergen van actuele modelwaarden:** de bestaande selectfallback blijft behouden wanneer een geconfigureerd model niet in de genormaliseerde opties staat.
- **Compatibiliteit API-fouten:** de bestaande responsebody blijft `Error.message`; alleen een numerieke `status` wordt toegevoegd.
- **Rollback:** revert de vier frontendcode-/testbestanden; er is geen data-, schema- of configrollback nodig.

## Notes / links

- Oorspronkelijke change: `opsx/changes/2026-03-12-iteratie-6-admin-wachtwoord-reset.md`.
- Runtime-evidence (2026-09-10 14:28–14:31 UTC): vier gecorreleerde resetpogingen gaven proxy en backend `403`; de 42-byte body correspondeerde met `{"detail":"Request origin is not allowed"}`. Geen traceback, endpoint-write, `SQLAlchemyError` of SQLite-fout trad op.
- Actieve runtimeartifact bij diagnose: Git `ddb8a89247cc9a2eef2b507eb492317efecc74bd`; dit was toen ook `origin/main`.
- Deze repairworktree is gestart vanaf de bij aanvang actuele `origin/main` commit `ddb8a89`.

## Current status

IN_SCOPE_REPAIR implemented and verified; runtimeconfiguratie en de reset/login-smokecheck zijn operationeel bevestigd. De change blijft open: de Admin-zwarteschermfix staat nog op de pending fixbranch/PR en moet eerst via de reguliere release worden uitgerold en daarna in productie worden gesmokecheckt. Er is niet gecommit of gepusht.

## What changed

- `frontend/src/app/shell/AppShell.tsx`: alle modeloptielijsten worden defensief genormaliseerd; resetfeedback gebruikt HTTP-status en veilige categorie; security-blocked feedback krijgt foutstyling.
- `frontend/src/lib/api/client.ts`: niet-succesvolle JSON-requests bewaren naast de bestaande bodymessage nu de HTTP-status op het foutobject.
- `frontend/src/app/App.test.tsx`: regressies voor ontbrekende/legacy modelopties, Admin-render, representatieve FastAPI-`422`, veilige origin-`403`, foutstyling en bestaande happy path.
- `frontend/src/lib/api/client.test.ts`: bevestigt met een representatieve `Response(status=422)` dat de resetclient status en FastAPI-body doorgeeft aan veilige UI-classificatie.
- Geen backend-, database-, configuratie-, migratie- of datawijziging.
- Incidentele verificatiereparatie: asynchrone GenAI-formasserties wachten nu op de velden en de bestaande feedbackclassificatie behandelt ook de veilige minimumlengtemelding als fout. Repair rounds used: 1.
- Alleen de spec is in deze operationele IN_SCOPE_REPAIR bijgewerkt; er is geen productcode gewijzigd.

## How to verify

Voer de commando's uit het Testing plan uit vanuit respectievelijk `frontend/`, `backend/` en de worktreeroot.

## Verification evidence

- Schone isolatie: `/tmp/opencode` bestond vóór creatie; worktree `/tmp/opencode/wervelnieuws-admin-wachtwoordreset-repair`, branch `fix/admin-wachtwoordreset-review-repair`, basis/tracking `origin/main` op `ddb8a89`. De dirty safety-worktree en `data.failed-2026-09-08_19-22-16/` zijn niet gewijzigd.
- `npm ci` — geslaagd: 179 packages geïnstalleerd. Npm rapporteerde 12 bestaande dependency-auditbevindingen; lockfile en dependencies zijn niet gewijzigd.
- Eerste gerichte run `npm test -- --run src/app/App.test.tsx -t "GenAI model options|FastAPI 422|origin security|change another user password"` — 2 geslaagd, 3 gefaald. Root causes: twee testasserties liepen vóór asynchrone GenAI-forminitialisatie; de veilige `422`-melding miste de bestaande visuele foutheuristiek. Eén gegroepeerde in-scope repair corrigeerde beide oorzaken.
- Herhaalde gerichte run met hetzelfde commando — geslaagd: 5 tests, 90 overgeslagen.
- `npm test -- --run src/lib/api/client.test.ts` — geslaagd: 1 test.
- `npm test -- --run src/app/App.test.tsx` — geslaagd: 95 tests.
- Finale `npm test -- --run` — geslaagd: 11 testfiles, 229 tests.
- Finale `npm run build` — geslaagd; TypeScript en Vite voltooid. Alleen de bestaande waarschuwing voor een chunk groter dan 500 kB.
- Backendtestomgeving geïsoleerd opgebouwd in `/tmp/opencode/wervelnieuws-admin-reset-backend-venv`; `uv` en systeem-`pytest` ontbraken en `venv` had geen `ensurepip`, waarna bestaand `/tmp/opencode/get-pip.py` uitsluitend in deze tijdelijke venv is gebruikt. Gegenereerde lokale egg-info is uit de worktree verwijderd.
- `"/tmp/opencode/wervelnieuws-admin-reset-backend-venv/bin/python" -m pytest tests/test_admin_api.py tests/test_http_security.py -q` — geslaagd: 43 tests; alleen bestaande dependency/deprecationwaarschuwingen.
- Diff-herreview: productiepatch beperkt zich tot defensieve normalisatie, foutstatusmetadata en veilige feedbackclassificatie; gekoppelde happy path, fallbackmodelopties, origintekstredactie, visuele foutstatus en backend admin/security zijn gedekt. Geen scope-, contract-, database-, config- of migratie-uitbreiding gevonden.
- `git diff --check` en expliciete checks voor ongetrackte nieuwe bestanden — geslaagd zonder whitespacefouten.
- Operationeel bewijs van de gebruiker: `ALLOWED_ORIGINS=https://windwilly.nl` is in de persistente serverconfig ingesteld.
- Operationeel bewijs van de gebruiker: de bestaande `wervelnieuws`-backend is met de juiste Docker Compose-projectnaam herstart en de effectieve environment in de container is gecontroleerd; `ALLOWED_ORIGINS=https://windwilly.nl` was aanwezig.
- Operationeel bewijs van de gebruiker: na de herstart zijn admin-wachtwoordreset en daaropvolgende login succesvol bevestigd. Daarmee is de oorspronkelijke runtimeblokkade door de ontbrekende concrete browser-origin opgeheven.
- Resterende releaseblocker: de Admin-zwarteschermfix kan nog niet in productie staan, omdat de frontendcode nog via de pending fixbranch/PR en reguliere release moet worden uitgerold. De change wordt pas afgesloten nadat die rollout en een productie-smokecheck van de Admin-pagina zijn voltooid.
- Rollbackverschil voor de operationele runtimewijziging: herstel zo nodig de vorige persistente `ALLOWED_ORIGINS`-waarde en herstart dezelfde Compose-backend; de productcode-repair zelf introduceert geen config- of datarollback.

---
Status: IN_SCOPE_REPAIR runtime evidence recorded; open pending frontend release and production smokecheck
Owner: —
Date: 2026-09-10
