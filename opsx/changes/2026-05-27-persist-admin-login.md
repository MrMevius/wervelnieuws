# Title
Persist admin login across refresh and browser reopen

## Context
De huidige admin-authenticatie houdt de sessie niet betrouwbaar vast na een browser-refresh of na het opnieuw openen van de browser. Dit veroorzaakt frictie voor beheerders en verhoogt de kans op workflow-onderbrekingen tijdens dagelijkse contenttaken.

De goedgekeurde wijziging uit discovery vraagt om een persistente sessie-opzet met een 30-dagen HttpOnly-cookie, behoud van bearer-compatibiliteit als fallback, frontend session bootstrap via `/auth/me`, expliciete logout die cookie opruimt, verwijdering van localStorage-tokengebruik, plus test- en documentatie-updates.

## Goals / Non-goals
### Goals
- Implementeer een persistente admin-sessie met een 30-dagen HttpOnly-cookie, zodat ingelogde admins na refresh en browser-heropenen ingelogd blijven binnen de TTL.
- Ondersteun bearer-auth fallback voor compatibiliteit met bestaande clients/flows waar tokenheader nog gebruikt wordt.
- Laat frontend-auth status initialiseren via een expliciete bootstrap-call naar `/auth/me`.
- Zorg dat logout de server-side sessie beëindigt en de auth-cookie wist op de client.
- Verwijder localStorage-tokenafhankelijkheid uit de frontend-authflow.
- Dek het gedrag af met backend- en frontend-tests.
- Werk docs/changelog bij met een eindgebruikersgerichte toelichting.

### Non-goals
- Geen redesign van het volledige auth-model (bijv. geen OAuth/OIDC introductie).
- Geen wijziging van rollen/permissies of gebruikersbeheerlogica.
- Geen sessie-deling tussen verschillende domeinen buiten huidige deploymentcontext.
- Geen uitbreiding naar “remember me” varianten met meerdere TTL-profielen in deze change.
- Geen token-revocation of DB-gebaseerde sessie-blacklist; logout wist in deze change alleen de browser-cookie bij stateless JWT.

## Proposed approach
1. Breid backend-auth uit met cookie-gebaseerde sessie-uitgifte op login, met `HttpOnly`, geschikte `SameSite`-instelling en 30-dagen vervaltijd.
2. Behoud bestaande bearer-tokenvalidatiepad als fallback in authenticatiedependency/middleware, met deze prioriteitsregel: een expliciete `Authorization: Bearer ...` header gaat vóór cookie-identiteit wanneer beide aanwezig zijn; zonder bearer blijft cookie-auth primair voor browser-sessies.
3. Introduceer/gebruik `/auth/me` als canonical endpoint voor sessievalidatie en user bootstrap in de frontend.
4. Pas frontend-auth provider/store aan zodat initiële sessiestatus uitsluitend via `/auth/me` wordt bepaald (niet via localStorage-token).
5. Pas logoutflow aan zodat backend cookie ongeldig maakt (expire/delete) en frontend auth-state direct reset.
6. Update tests voor login persistence, `/auth/me` bootstrap, bearer fallback, logout cookie clear, en afwezigheid van localStorage-tokengebruik.
7. Werk relevante docs en website About/changelog entry bij volgens repo Definition of Done.

## Implementation steps (ordered)
1. Inventariseer huidige backend login/logout/auth dependencies en huidige frontend tokenopslag/bootstrappad.
2. Definieer sessie-cookie contract (naam, TTL=30 dagen, security flags, path/domain waar nodig) en leg dit vast in backend config.
3. Implementeer backend login response-uitbreiding zodat cookie wordt gezet naast eventuele bestaande responsevelden.
4. Werk auth-resolutie bij conform prioriteitscontract: expliciete bearer-header eerst (voor API-clients/tests), anders geldige cookie-sessie (browser), en behoud fallback zonder contractbreuk.
5. Implementeer/valideer `/auth/me` gedrag voor geauthenticeerde en ongeauthenticeerde requests.
6. Implementeer backend logout zodat cookie wordt gewist en eventuele server-side sessiestatus wordt beëindigd.
7. Verwijder localStorage-token read/write in frontend en vervang door bootstrap op app-start via `/auth/me`.
8. Zorg dat frontend API-client requests cookie-credentials correct meesturen binnen deploymentcontext.
9. Werk login/logout UX states af (loading, authenticated, unauthenticated, failure) met minimale regressierisico’s.
10. Voeg/actualiseer backend tests voor cookie issuance, cookie-auth, bearer fallback, `/auth/me`, en logout cleanup.
11. Voeg/actualiseer frontend tests voor bootstrapgedrag na refresh/reopen-simulatie en afwezigheid van localStorage-tokenpad.
12. Werk docs/changelog bij met functionele beschrijving en operator-impact.
13. Documenteer verificatie-uitkomsten in deze spec en update statusvelden.

## Acceptance criteria
1. Na succesvolle login ontvangt de client een HttpOnly sessie-cookie met vervaltijd van ~30 dagen (conform ingestelde TTL).
2. Een admin die de pagina refresht blijft ingelogd zonder opnieuw credentials in te voeren, mits sessiecookie geldig is.
3. Een admin die de browser sluit en later heropent blijft ingelogd zolang de sessiecookie nog niet verlopen is.
4. Frontend bepaalt auth-status bij app-start via `/auth/me` en niet via localStorage-token.
5. Frontend schrijft of leest geen auth bearer-token meer uit localStorage in de primaire loginflow.
6. Logout wist de auth-cookie en reset sessiestatus in de browser, waarna `/auth/me` unauthenticated teruggeeft.
7. Bearer token-auth werkt nog als fallback voor compatibiliteit (bij afwezige cookie).
8. Indien zowel cookie als bearer aanwezig zijn, gebruikt de backend de expliciete bearer-identiteit (geen onbedoelde cookie-override van API-client/test-identiteit).
9. Relevante backend- en frontend-tests die dit gedrag dekken slagen.
10. Docs/changelog bevatten een eindgebruikersvriendelijke entry over persistente login.
11. In productie weigert runtime-validatie een onveilige auth-cookieconfiguratie (`AUTH_COOKIE_SECURE=false`).

## Testing plan
- Backend unit/integratietests voor:
  - login endpoint zet correcte cookie-attributen en TTL,
  - auth dependency accepteert geldige cookie,
  - bearer fallback blijft functioneren,
  - bij cookie + bearer tegelijk krijgt bearer-identiteit voorrang,
  - `/auth/me` retourneert correcte user bij geldige sessie en 401/unauthenticated zonder geldige sessie,
  - logout wist/expiret cookie en invalideert sessie.
- Frontend tests voor:
  - app bootstrap via `/auth/me` (ingelogd en niet-ingelogd scenario),
  - persistent login na refresh-simulatie,
  - logout reset auth-state,
  - geen localStorage-tokenpad meer gebruikt.
- Relevante projectcommands (te bevestigen op bestaande scripts):
  - backend gerichte pytest command(s) voor auth-modules,
  - frontend gerichte testcommand(s) voor auth provider/login flow,
  - frontend build/typecheck command.

## Risk + rollback plan
### Risks
- Cookie security/config mismatch (SameSite/Secure/domain/path) kan login persistence breken in productiecontext.
- Prioritering tussen cookie en bearer kan onverwachte auth-gedragingen geven voor bestaande clients.
- Verwijderen van localStorage-tokenlogica kan regressies veroorzaken in legacy frontend codepaden.
- Stateless JWT betekent dat logout zonder blacklist/revocation geen reeds uitgegeven token cryptografisch intrekt.

### Mitigations
- Definieer cookie-attributen expliciet per omgeving en verifieer met gerichte integratietests.
- Houd bearer fallback onaangetast en test beide auth-paden afzonderlijk.
- Refactor auth-flow centraal (één provider/store) en dek kritieke states af met frontend tests.
- Maak beperking expliciet in spec/docs en borg dat productie minimaal `AUTH_COOKIE_SECURE=true` afdwingt.

### Rollback
- Revert naar vorige token-only authflow in backend/frontend indien kritieke sessieproblemen optreden.
- Zet tijdelijk localStorage-tokenpad terug als compatibiliteitsbrug totdat cookie-issues zijn opgelost.
- Revert docs/changelog entry indien wijziging niet wordt uitgerold.

## Notes / links
- Bron: goedgekeurde Draft Change Spec Outline uit discovery voor “Persist admin login across refresh and browser reopen”.
- Scopekern: 30-dagen HttpOnly-cookie sessie, bearer fallback, `/auth/me` bootstrap, logout cookie clear, geen localStorage-token, tests en docs/changelog updates.

## Current status
Completed (finalized 2026-05-27)

## What changed
- Shipped a persistent admin-login flow: admins stay signed in across page refreshes and browser restarts while the 30-day session remains valid.
- JWT expiry-defaults zijn aligned met cookie-TTL: `access_token_expire_minutes` is nu optioneel en valt standaard terug op `auth_cookie_ttl_days` (30 dagen), zodat persistent login niet meer na 12 uur verloopt.
- Backwards compatibility behouden: bestaande omgevingen die `ACCESS_TOKEN_EXPIRE_MINUTES` expliciet instellen blijven die waarde gebruiken.
- Backend test toegevoegd die valideert dat token `exp` en cookie `Max-Age` bij login op elkaar aansluiten binnen kleine tolerantiemarge.
- Backend auth uitgebreid met HttpOnly sessiecookie op login (`wervel_session`) met 30 dagen TTL, plus cookie-config in settings.
- Backend auth-resolutie aangepast naar cookie-eerst en bearer-fallback daarna, zonder contractbreuk voor bestaande bearer-clients.
- Backend auth-resolutie aangescherpt voor regressieherstel: bij gelijktijdige cookie + bearer gebruikt de dependency nu expliciet de bearer-identiteit; zonder bearer blijft cookie-auth primair.
- Nieuw backend endpoint `POST /auth/logout` toegevoegd dat auth-cookie wist.
- Frontend API-client gebruikt nu `credentials: include` en heeft expliciete `logout()` call naar backend.
- Frontend auth-flow bootstrapt sessie via `/auth/me` op app-start (zonder localStorage-tokenpad) en invalideert `current-user` na login.
- Frontend logout reset direct client-authstate en roept backend-cookie-clear aan.
- Backend tests toegevoegd voor login-cookie, cookie-auth, bearer-fallback en logout-cookie-clear.
- Backend test toegevoegd voor precedence-regel wanneer cookie en bearer tegelijk aanwezig zijn (bearer wint).
- Frontend tests bijgewerkt voor `/auth/me` bootstrap en compatibele login-sequentie.
- About/changelog uitgebreid met eindgebruikersentry over persistente login (iteratie 42).
- `.env.example` gebruikt niet langer een 12-uurs override voor `ACCESS_TOKEN_EXPIRE_MINUTES`; gedocumenteerde defaults vallen nu terug op 30-dagen TTL-alignment.
- Productie-hardening uitgebreid: `validate_runtime_security()` faalt nu expliciet als `AUTH_COOKIE_SECURE=false` in productie.
- Backend security-test toegevoegd voor bovenstaande productie-hardening van auth-cookie.
- Upload-XHR voor database-documenten zet nu `xhr.withCredentials = true`, zodat cookie-auth ook werkt in cross-origin dev/LAN-contexten.
- Spec verduidelijkt logout-beperking bij stateless JWT: cookie wordt gewist, maar er is geen token-revocation/blacklist in scope.
- Docs/changelog-impact is compleet: de About/changelog-entry voor iteratie 42 beschrijft in eindgebruikerstaal dat admins ingelogd blijven, dat sessies veilig worden gecontroleerd bij app-start, en dat logout de sessie opruimt.

## How to verify
1. Voer backend auth-tests uit:
    - `cd backend && ./.venv/bin/pytest tests/test_settings_security.py tests/test_meta_and_me.py`
    - `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py`
    - `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py tests/test_admin_api.py tests/test_boards_api.py tests/test_database_api.py`
    - `cd backend && ./.venv/bin/pytest`
2. Voer frontend app/auth-tests uit:
    - `cd frontend && npm test -- --run src/app/App.test.tsx`
    - `cd frontend && npm run build`
3. Handmatige smoke-check:
    - Login als admin.
    - Refresh pagina: sessie blijft actief.
    - Sluit browser volledig en open opnieuw: sessie blijft actief (binnen TTL).
    - Logout: sessie eindigt, herladen toont unauthenticated state.

## Verification evidence
- ✅ `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py` → **18 passed** (incl. nieuwe JWT/cookie TTL-alignment test).
- ✅ `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py` → **16 passed**.
- ✅ `cd backend && ./.venv/bin/pytest tests/test_meta_and_me.py tests/test_admin_api.py tests/test_boards_api.py tests/test_database_api.py` → **62 passed**.
- ✅ `cd frontend && npm test -- --run src/app/App.test.tsx` → **48 passed**.
- ✅ `cd backend && ./.venv/bin/pytest tests/test_settings_security.py tests/test_meta_and_me.py` → **24 passed**.
- ✅ `cd frontend && npm run build` → **tsc + vite build geslaagd**.
- ✅ Latest full pass: `cd backend && ./.venv/bin/pytest` → **106 passed**.
- ✅ Latest full pass: `cd frontend && npm test -- --run src/app/App.test.tsx` → **48 passed**.
- ✅ Latest full pass: `cd frontend && npm run build` → **passed**.
- ℹ️ Eerste backend-run met systeem-`pytest` faalde door ontbrekende `fastapi` buiten venv; herhaald in `backend/.venv` en geslaagd.

## Follow-ups
- Operators met een bestaande `ACCESS_TOKEN_EXPIRE_MINUTES=720` override moeten die instelling verwijderen of aanpassen als zij de nieuwe 30-dagen default willen gebruiken.
- Optioneel: ruim bestaande deprecation warnings op buiten deze change.

---
Status: completed
Owner: n.v.t.
Date: 2026-05-27
