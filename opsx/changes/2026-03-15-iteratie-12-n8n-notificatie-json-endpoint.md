## Title
Iteratie 12 - n8n JSON notificaties met dedupe en logpresentatie

## Context
Volgens `ITERATIONS.md` moet iteratie 12 een JSON endpoint opleveren waarop n8n kan aansluiten, met weergave van succes- en foutmeldingen, en notificatieafhandeling richting Telegram via n8n. De huidige backend stuurt Telegram-notificaties direct vanuit de publicatieflow en gebruikt `notification_events` nog niet actief in de workflow.

## Goals / Non-goals
### Goals
- Notificaties voor publicatie en generatie als JSON-events vastleggen in de bestaande `notification_events` tabel.
- Notificaties pushen naar n8n via webhook (zonder extra auth in v1).
- Dedupe afdwingen zodat hetzelfde event niet dubbel naar n8n wordt verstuurd.
- Foutieve n8n-delivery automatisch opnieuw proberen via worker/retry-mechanisme.
- Succes- en foutmeldingen zichtbaar maken in backend feed endpoint en frontend (Main + Log).
- Directe Telegram-calls uit de publicatieflow verwijderen; n8n wordt leidend voor admin-notificaties.

### Non-goals
- Geen uitbreiding naar import- of admin-acties in deze iteratie.
- Geen HMAC/bearer beveiliging toevoegen aan de n8n webhook in deze iteratie.
- Geen redesign van de volledige logpagina buiten benodigde notificatieweergave.

## Proposed approach
1. Datamodel van `notification_events` uitbreiden voor eventtype/status/payload/delivery/dedupe.
2. Notification service toevoegen voor uniforme eventcreatie, dedupe, delivery en retryjob-aanmaak.
3. Generatie- en publicatieflows koppelen aan de notification service voor success/error events.
4. Worker uitbreiden met retryflow voor notificatiedelivery.
5. Nieuw notificatie-feed endpoint toevoegen en frontend uitbreiden met meldingweergave op Main en Log.
6. Tests en About/changelog bijwerken.

## Implementation steps (ordered)
1. Voeg migratie en modelwijzigingen toe voor uitgebreide `notification_events`.
2. Implementeer `NotificationService` en n8n webhook client.
3. Koppel `content.generate` / `content.regenerate` aan success/error notificaties.
4. Koppel `PublishingWorkflow` aan success/error notificaties en verwijder directe Telegram-send.
5. Breid worker retryflow uit voor notificatiedelivery.
6. Voeg notificatie-feed endpoint toe met filters.
7. Breid frontend API-client, Main en Log uit voor notificaties.
8. Voeg backend/frontend tests toe en update About changelog.

## Acceptance criteria
- Publicatie- en generatieflows schrijven success/error notificaties weg in `notification_events`.
- De app pusht notificaties naar n8n als JSON payload.
- Eenzelfde notificatie-event wordt niet dubbel naar n8n verstuurd (dedupe actief).
- Bij mislukte n8n-delivery wordt retry gepland en later opnieuw geprobeerd door de worker.
- Main en Log tonen succes/foutmeldingen vanuit backend notificatiefeed.
- `cd backend && pytest -q` en `cd frontend && npm test -- --run` en `cd frontend && npm run build` slagen.

## Testing plan
- `cd backend && pytest tests/test_worker_cycle.py tests/test_publishing_idempotency.py tests/test_auth_and_topics.py -q`
- `cd backend && pytest -q`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`

## Risk + rollback plan
- Risico: te agressieve dedupe kan legitieme nieuwe meldingen onderdrukken.
  - Mitigatie: dedupe-key zorgvuldig op eventtype + status + context construeren en testen.
- Risico: n8n downtime veroorzaakt oplopende retry-queue.
  - Mitigatie: backoff via bestaand retry-mechanisme en zichtbare foutmeldingen.
- Rollback:
  - notification-service koppelingen terugdraaien,
  - n8n-deliverypad uitschakelen,
  - frontend notificatieblokken verwijderen,
  - migratie terugdraaien indien nodig.

## Notes / links
- Bron: `ITERATIONS.md` Iteratie #12.
- Bestaande componenten: `notification_events`, `RetryJob`, `LogPage`, `Main`.

## Current status
Completed

## What changed
- Datamodel `notification_events` uitgebreid voor n8n-delivery en dedupe:
  - Nieuwe velden in model en migratie: `event_type`, `status`, `payload_json`, `dedupe_key`, `delivery_attempts`, `delivered_at`, `last_error`.
  - Unieke index op `dedupe_key` toegevoegd.
  - Migratiebestand toegevoegd: `backend/alembic/versions/20260315_0012_notification_events_n8n_delivery.py`.
- Nieuwe n8n-integratie en service toegevoegd:
  - `backend/app/integrations/n8n_client.py` met webhook POST naar `N8N_WEBHOOK_URL`.
  - `backend/app/services/notification_service.py` met eventregistratie, dedupe, delivery, en retryjob-aanmaak.
- Generatieflow gekoppeld aan notificaties:
  - `backend/app/api/content.py` schrijft success/error notificaties voor `generate` en `regenerate`.
- Publicatieflow gekoppeld aan notificaties:
  - `backend/app/workflows/publishing_workflow.py` schrijft success/error notificaties voor publicaties.
  - Directe `TelegramNotifier.send(...)` calls uit de publicatieflow verwijderd.
- Worker retryflow uitgebreid:
  - `backend/app/workflows/worker_cycle.py` ondersteunt nu `notification_delivery:<notification_id>` jobs.
- Nieuw notificatie-feed endpoint toegevoegd:
  - `GET /api/content/notifications` met filters op `event_type`, `status`, `topic`, `period`, `limit`.
  - Schema toegevoegd in `backend/app/schemas/versioning.py`.
- Frontend uitgebreid voor meldingen op Main en Log:
  - API-clienttypes en request toegevoegd in `frontend/src/lib/api/client.ts`.
  - `frontend/src/app/App.tsx` toont notificatieblok op Main en notificatietabel op Log met statusfilter.
  - Stijlen voor statuspills en filterlayout toegevoegd in `frontend/src/styles.css`.
- Tests uitgebreid en aangepast:
  - Nieuwe backendtests in `backend/tests/test_notification_service.py`.
  - Aanvullende endpointtest in `backend/tests/test_auth_and_topics.py`.
  - Bestaande workflowtests aangepast na verwijderen directe Telegram-mock.
  - Frontend tests bijgewerkt in `frontend/src/app/App.test.tsx`.
- About/changelog bijgewerkt:
  - `backend/app/api/meta.py` bevat nieuwe eindgebruikers-entry voor iteratie `17` over n8n-meldingen.
- Documentatie bijgewerkt:
  - Nieuwe operationele uitleg in `docs/n8n-notifications.md`.
  - README geactualiseerd voor n8n-notificatief low en endpoint-overzicht.

## How to verify
- `docker compose build backend`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_notification_service.py tests/test_worker_cycle.py tests/test_auth_and_topics.py -q"`
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `docker compose run --rm backend sh -lc 'python - <<"PY" ... NotificationService(db).record(...) ... PY'`

## Verification evidence
- `docker compose build backend` -> geslaagd (backend-image opnieuw opgebouwd met nieuwe code en migratie).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest tests/test_notification_service.py tests/test_worker_cycle.py tests/test_auth_and_topics.py -q"` -> geslaagd (`9 passed`).
- `docker compose run --rm backend sh -lc "pip install -e .[dev] && pytest -q"` -> geslaagd (`74 passed`).
- `cd frontend && npm test -- --run` -> geslaagd (`32 passed`).
- `cd frontend && npm run build` -> geslaagd (TypeScript + Vite productiebuild afgerond).
- Runtime activatie uitgevoerd:
  - `.env` bijgewerkt met `N8N_WEBHOOK_URL` en `N8N_WEBHOOK_TIMEOUT_SECONDS`.
  - `docker compose up -d --force-recreate backend worker` uitgevoerd.
  - Containerconfig gecontroleerd: backend leest nu `N8N_WEBHOOK_URL` correct.
  - Handmatige POST op `https://n8n.mrmevius.nl/webhook/a084bbe8-6df0-4cac-b8c0-6aa6a15c62d3` geeft nu `200 OK` met body `{"message":"Workflow was started"}`.
- App-flow smoke-test uitgevoerd via `NotificationService.record(...)` in backend container:
  - Event is aangemaakt in `notification_events`.
  - `delivered_at` gezet en `last_error` leeg.
  - Observatie: `delivery_attempts=1`, dus delivery liep direct succesvol.
