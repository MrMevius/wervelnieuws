# Title
Iteratie 16 - WindWilly ChatGPT-achtige subpagina (placeholder)

## Context
In `ITERATIONS.md` staat Iteratie #16 als wens: een placeholder voor de WindWilly-subpagina die qua voorkant lijkt op ChatGPT en inhoudelijk is toegespitst op windinformatie. In de huidige app bestaat al een eenvoudige WindWilly-placeholder onder `/windwilly`, maar die heeft nog geen chat-achtige opbouw.

## Goals / Non-goals
### Goals
- De bestaande `/windwilly` pagina omzetten naar een visuele, chat-achtige placeholder.
- De content richten op windprojectinformatie (voorbeeldvragen en voorbeeldantwoorden).
- De route en bestaande suite-navigatie ongewijzigd laten.
- De wijziging regressieveilig maken met gerichte frontend-tests.
- About/changelog aanvullen met een eindgebruikersvriendelijke iteratie-entry.

### Non-goals
- Geen werkende AI-chatbackend of realtime berichtafhandeling.
- Geen nieuwe API-endpoints, databasewijzigingen of workerlogica.
- Geen redesign van andere modules (Trello, Urenverantwoording, Participatiemomenten, Wervelnieuws).

## Proposed approach
1. Vervang de inhoud van `WindWillyModulePlaceholder` in `frontend/src/app/shell/AppShell.tsx` met een chat-achtige placeholderlayout.
2. Voeg geïsoleerde CSS toe in `frontend/src/styles.css` met een eigen class-namespace voor de WindWilly-chatplaceholder.
3. Werk `frontend/src/app/App.test.tsx` bij zodat de test valideert op de nieuwe chatplaceholder-onderdelen.
4. Voeg een nieuwe changelog-entry toe in `backend/app/api/meta.py`.

## Implementation steps (ordered)
1. Nieuwe spec opstellen (dit document) en scope vastzetten.
2. WindWilly module-placeholder markup vervangen door chat-achtige placeholder UI.
3. Nieuwe stijlen toevoegen voor chatvenster, berichten, promptbalk en voorbeeldvragen.
4. Frontend tests aanpassen op nieuwe zichtbare teksten/elementen.
5. About/changelog uitbreiden met iteratie-entry.
6. Gerichte verificatie draaien en resultaten in deze spec vastleggen.

## Acceptance criteria
1. De route `/windwilly` blijft bestaan en opent een chat-achtige placeholderpagina.
2. De WindWilly-placeholder toont visueel herkenbare chatonderdelen (chatvenster, berichten, prompt/input-gebied) zonder backendfunctionaliteit.
3. De zichtbare voorbeeldinhoud is toegespitst op windinformatie (niet generiek).
4. Bestaande suite-navigatie en andere modulepagina’s blijven ongewijzigd functioneren.
5. Gerichte frontend-tests slagen met assertions op de nieuwe placeholderweergave.
6. About/changelog bevat een nieuwe eindgebruikersvriendelijke iteratie-entry voor deze wijziging.

## Testing plan
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `cd backend && pytest tests/test_meta_and_me.py`

## Risk + rollback plan
### Risico's
- Te sterke visuele overlap met bestaande componentstijlen kan ongewenste regressie geven.
- Tests kunnen breken door tekstwijzigingen in de placeholder.

### Rollback
- Revert van wijzigingen in:
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/styles.css`
  - `frontend/src/app/App.test.tsx`
  - `backend/app/api/meta.py`

## Notes / links
- Broneis: `ITERATIONS.md` Iteratie #16.
- Bestaande route-definitie: `frontend/src/app/routes/paths.ts` (`WINDWILLY_PATHS.module`).

## Current status
Completed (met gedocumenteerde lokale backend test-blocker)

## What changed
- `frontend/src/app/shell/AppShell.tsx`
  - `WindWillyModulePlaceholder` vervangen door een chat-achtige placeholderpagina.
  - Toegevoegd: header met duidelijke placeholder-status, voorbeeldvragen, voorbeeldgesprek en disabled promptbalk.
  - Inhoud is gericht op windprojectcontext (planning, bewonerscommunicatie, bronduiding).
- `frontend/src/styles.css`
  - Nieuwe stijlset toegevoegd voor de chatplaceholder (`windwilly-chat-*` en `chat-bubble-*`).
  - Chatlayout, sidebar, chatvenster, bubbels en inputbalk visueel uitgewerkt in WindWilly-themastijl.
  - Responsive gedrag toegevoegd voor small screens (chatlayout naar 1 kolom, inputbalk onder elkaar).
  - Feedback-finetune verwerkt: compactere spacing/padding op desktop en mobiel voor een rustiger, strakker chatbeeld.
  - Extra feedback-finetune verwerkt: typografie licht vergroot/verfijnd (kop, chattekst, voorbeeldvragen en inputtekst) voor betere leesbaarheid zonder layoutverbreding.
- `frontend/src/app/App.test.tsx`
  - Nieuwe regressietest toegevoegd die controleert dat navigatie naar `WindWilly` de nieuwe chatplaceholder toont.
  - De test valideert o.a. heading, placeholder-indicatie, windspecifieke voorbeeldinhoud en disabled input/button.
- `backend/app/api/meta.py`
  - Default About/changelog uitgebreid met iteratie `27` in eindgebruikersvriendelijke taal over de nieuwe WindWilly-chatplaceholder.

## How to verify
1. Frontend regressie:
   - `cd frontend && npm test -- --run`
2. Frontend build:
   - `cd frontend && npm run build`
3. Backend about/changelog test:
   - `cd backend && pytest tests/test_meta_and_me.py`
4. Handmatig:
   - Log in en klik op `WindWilly` in de topnavigatie.
   - Controleer dat de chat-achtige placeholder zichtbaar is met voorbeeldvragen en disabled prompt.

## Verification evidence
- ✅ `cd frontend && npm test -- --run`
  - Resultaat: geslaagd (`40 passed`).
- ✅ `cd frontend && npm run build`
  - Resultaat: geslaagd (TypeScript build + Vite productiebuild afgerond).
- ✅ Na visuele finetune (compactere layout):
  - `cd frontend && npm test -- --run` → geslaagd (`40 passed`).
  - `cd frontend && npm run build` → geslaagd.
- ✅ Na extra typografie-finetune:
  - `cd frontend && npm test -- --run` → geslaagd (`40 passed`).
  - `cd frontend && npm run build` → geslaagd.
- ⚠️ `cd backend && pytest tests/test_meta_and_me.py`
  - Resultaat: geblokkeerd met `ModuleNotFoundError: No module named 'fastapi'`.
  - Interpretatie: lokale backend testomgeving mist dependencies; changelogwijziging in `meta.py` is wel doorgevoerd.
