# n8n Notifications

Wervelnieuws stuurt notificatie-events naar n8n via een webhook.

## Doel

- Succes- en foutmeldingen van generatie en publicatie centraal verwerken.
- Telegram-berichten afhandelen in n8n in plaats van direct vanuit de backendflow.
- Duplicaten voorkomen met een dedupe-key op eventniveau.

## Configuratie

Zet in `.env`:

```env
N8N_WEBHOOK_URL=https://n8n.mrmevius.nl/webhook/<jouw-webhook-id>
N8N_WEBHOOK_TIMEOUT_SECONDS=10
```

Herstart daarna backend en worker:

```bash
docker compose up -d --force-recreate backend worker
```

## Payloadvorm

De backend verstuurt JSON met deze velden:

- `event_id`
- `event_type` (`content.generation` of `content.publication`)
- `status` (`success` of `error`)
- `timestamp`
- `topic_id`
- `topic_subject`
- `message`
- `details` (extra context, zoals `version_id`, `schedule_id`, foutdetails)
- `severity` (`info` of `error`)

Voorbeeld:

```json
{
  "event_id": "4e2a3986-15a3-4f36-bd9e-05e8361f3744",
  "event_type": "content.generation",
  "status": "success",
  "timestamp": "2026-03-16T09:46:09.36Z",
  "topic_id": "b8c5...",
  "topic_subject": "Windpark update",
  "message": "Generatie geslaagd",
  "details": {
    "version_id": "2f17..."
  },
  "severity": "info"
}
```

## Operationeel gedrag

- Events worden eerst opgeslagen in `notification_events`.
- Bij succesvolle webhook-call wordt `delivered_at` gezet.
- Bij fout wordt `last_error` bijgewerkt en een retryjob ingepland.
- Worker verwerkt retries via flownaam `notification_delivery:<notification_id>`.

## Handige checks

- Backend health: `curl http://localhost:8001/health`
- Laatste Alembic revision: `docker compose run --rm backend sh -lc "alembic current"`
- Notificatie feed: `GET /api/content/notifications`
