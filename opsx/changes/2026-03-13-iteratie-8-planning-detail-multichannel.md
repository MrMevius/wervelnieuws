## Title
Iteratie 8 - Planning detail multichannel redactie

## Context
De huidige planning detailpagina is nog een dummy-opzet met placeholders voor review en wijzigingen. De backend genereert momenteel een enkele contentversie per topic, zonder kanaalspecifieke varianten voor website, Facebook en nieuwsbrief.

## Goals / Non-goals
### Goals
- Per geselecteerd doelmedium een eigen artikel en eigen illustratie opslaan en beheren.
- Een echte redactie-detailpagina met efficiiente ruimtebenutting op desktop en mobiel.
- WYSIWYG-bewerking per doelmedium voor artikel en samenvatting.
- Vrij invulbare GenAI-opmerkingen opslaan op topicniveau en meenemen bij generatie.
- Opnieuw genereren van kanaalcontent via een duidelijke actieknop.
- Goedkeuren/afkeuren per medium met topic-approval alleen als alle actieve media akkoord zijn.

### Non-goals
- Geen herontwerp van globale navigatie of hoofdstructuur van de applicatie.
- Geen wijziging aan bestaande publicatiekanalen of externe integratiecontracten.
- Geen geavanceerde rich text functies buiten basisopmaak in deze iteratie.

## Proposed approach
1. Voeg een nieuw datamodel toe voor kanaalspecifieke varianten gekoppeld aan een contentversie.
2. Breid generatie uit zodat per geselecteerd medium afzonderlijke tekst en illustratie worden gemaakt.
3. Voeg API-endpoints toe voor varianten lezen, bewerken, approve/reject en opnieuw genereren.
4. Vervang de dummy detailpagina door een multichannel redactie-opzet met eenvoudige WYSIWYG editor.
5. Borg dat topic-approval alleen lukt als alle actieve media zijn goedgekeurd.

## Implementation steps (ordered)
1. Nieuwe enum + entity voor kanaalvariant en reviewstatus toevoegen in backend model.
2. Alembic migratie toevoegen voor kanaalvarianten.
3. GenerationService uitbreiden met per-kanaal generatie en regenerate-flow.
4. Nieuwe schemas en API-routes voor variantbeheer toevoegen.
5. Topic approval-flow valideren op kanaal-goedkeuring.
6. Frontend API client uitbreiden met variant calls.
7. Planning detail UI vervangen door echte werkpagina met 3 mediapanelen en WYSIWYG.
8. Tests backend/frontend toevoegen en bestaande dummy-verwachtingen vervangen.
9. About changelog updaten met iteratie 08-entry.

## Acceptance criteria
- Voor elk geselecteerd doelmedium bestaat een eigen artikel en illustratievariant.
- Planning detail toont medium-specifieke redactiepaneels in een efficiiente layout.
- Per medium kunnen artikel en samenvatting in WYSIWYG aangepast en opgeslagen worden.
- Een vrij invulbaar opmerkingenveld stuurt GenAI-generatie en wordt bewaard op topicniveau.
- Een knop om artikelen opnieuw te genereren is aanwezig en functioneel.
- Goedkeuren/afkeuren gebeurt per medium; topic-approval faalt zolang niet alle actieve media goedgekeurd zijn.

## Testing plan
- Gerichte backend tests voor generatievarianten en review-endpoints.
- Regressietests op bestaande generation/review/publication flows.
- Frontend tests voor planning detail interacties (edit/save/regenerate/approve).
- Frontend build uitvoeren om type- en bundelvalidatie te checken.

## Risk + rollback plan
- Risico: regressie in bestaande topic-versieflow.
  - Mitigatie: backward-compatible bestaande contentversie bewaren en extra variantlaag toevoegen.
- Risico: UI-complexiteit op detailpagina.
  - Mitigatie: basis-WYSIWYG met beperkte toolbar en duidelijke feedback.
- Rollback: migratie downgraden en nieuwe variantroutes/consumptie verwijderen; bestaande topic-flow blijft intact.

## Notes / links
- Gerelateerde vorige iteraties:
  - opsx/changes/2026-03-12-iteratie-7-ai-indexering-rag.md
  - opsx/changes/2026-03-13-iteratie-7-planning-import.md

## Current status
Completed

## What changed
- Backend datamodel uitgebreid met `ContentApprovalState` en `ContentChannelVariant` inclusief relatie op `ContentVersion`.
- Alembic migratie toegevoegd: `backend/alembic/versions/20260313_0010_content_channel_variants.py`.
- Generatieflow uitgebreid naar kanaalspecifieke output in `GenerationService`:
  - per geselecteerd kanaal eigen tekstprompt,
  - per kanaal eigen illustratiebestand,
  - opslag als `ContentChannelVariant` records,
  - bestaande `ContentVersion` blijft backward-compatible als container.
- Content API uitgebreid met:
  - `POST /api/content/{topic_id}/regenerate`
  - `GET /api/content/{topic_id}/variants/current`
  - `PATCH /api/content/{topic_id}/variants/{channel}`
  - `POST /api/content/{topic_id}/variants/{channel}/approve`
  - `POST /api/content/{topic_id}/variants/{channel}/reject`
  - `GET /api/content/images/{image_id}`
- Topic approval-guard toegevoegd: `/approve` faalt nu als niet alle actieve kanaalvarianten `approved` zijn.
- Frontend API client uitgebreid met variant-types en variant/regenerate calls.
- Planning detailpagina vervangen door echte multichannel werkpagina:
  - vrij invulbaar GenAI-opmerkingenveld met opslaan,
  - knop “Artikelen opnieuw genereren”,
  - 3 kanaalpanelen met WYSIWYG-editors (artikel + samenvatting),
  - per kanaal opslaan/akkoord/afwijzen,
  - topic-akkoordknop met guard op alle kanaalgoedkeuringen.
- Styling uitgebreid voor nieuwe detaillayout en WYSIWYG-componenten.
- Frontend tests bijgewerkt voor non-dummy detailpagina en nieuwe UI-elementen.
- Nieuwe backend tests toegevoegd in `backend/tests/test_channel_variants_api.py`.
- About changelog bijgewerkt met iteratie 08 in `backend/app/api/meta.py`.
- Feedbackronde toegevoegd:
  - generatiedatum en publicatiedatum bewerkbaar maken in detailpagina,
  - opmerkingenblok links naast planningsvoortgang plaatsen,
  - labeltekst "voor GenAI" verwijderen,
  - voortgangslabel bij aanwezige plandatum tonen als "gepland".
- Backend uitgebreid met `GET /api/content/{topic_id}/schedule/current` voor uitlezen van actuele publicatieplanning.
- Frontend detailpagina aangepast:
  - opmerkingenblok links naast planningvoortgang in een top-grid,
  - kop en aria labels aangepast naar "Opmerkingen",
  - invoervelden + opslagknoppen voor `Generatiedatum` en `Publicatiedatum`,
  - statuslabel in voortgang gebruikt nu context-aware `metaLabel` (inclusief "gepland").
- Frontend API client uitgebreid met `getCurrentSchedule`.
- Tests bijgewerkt voor nieuwe labels en schedule endpoint dekking.
- Bugfix: publicatiedatum plannen werkt nu ook wanneer nog geen actuele contentversie aanwezig is; frontend triggert dan eerst regeneratie en plant daarna de datum.
- Extra bugfix op feedback "Opslaan van publicatiedatum is mislukt":
  - publicatiedatum-opslag probeert nu eerst direct te plannen,
  - bij failure wordt automatisch een regeneratie gedaan en daarna nogmaals plannen,
  - foutmelding toont nu backend detailtekst indien beschikbaar.
- Extra regressietest toegevoegd in frontend voor retry-pad: eerste schedule-call faalt, daarna regenerate + tweede schedule-call succesvol.

## How to verify
- Backend (met dependencies aanwezig):
  - `cd backend && pytest tests/test_generation.py tests/test_review_endpoints.py tests/test_channel_variants_api.py -q`
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`
- Backend syntax-check (zonder runtime dependencies):
  - `cd backend && python3 -m compileall app tests`

## Verification evidence
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_generation.py tests/test_review_endpoints.py tests/test_channel_variants_api.py -q"` -> **geslaagd** (5 passed).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> **geslaagd** (52 passed).
- `docker compose run --rm migrate` -> **geslaagd** (alembic context gestart zonder fouten).
- `npm test -- --run` -> **geslaagd** (25 tests passed).
- `npm run build` -> **geslaagd**.
- `python3 -m compileall app tests` -> **geslaagd**.
- `npm test -- --run` (na feedback-aanpassingen) -> **geslaagd** (25 tests passed).
- `npm run build` (na feedback-aanpassingen) -> **geslaagd**.
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_review_endpoints.py tests/test_channel_variants_api.py -q"` -> **geslaagd** (3 passed).
- `npm test -- --run` (na bugfix publicatiedatum plannen) -> **geslaagd** (25 tests passed).
- `npm run build` (na bugfix publicatiedatum plannen) -> **geslaagd**.
- `npm test -- --run` (na retry/detail-bugfix publicatiedatum) -> **geslaagd** (25 tests passed).
- `npm run build` (na retry/detail-bugfix publicatiedatum) -> **geslaagd**.
- `npm test -- --run` (na toevoegen retry-regressietest) -> **geslaagd** (26 tests passed).
- `npm run build` (na toevoegen retry-regressietest) -> **geslaagd**.
