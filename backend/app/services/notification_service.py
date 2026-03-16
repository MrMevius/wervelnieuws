import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.integrations.n8n_client import N8NWebhookClient
from app.models.entities import NotificationEvent, RetryJob, Topic
from app.models.enums import RetryStatus


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.client = N8NWebhookClient()

    def record(
        self,
        *,
        event_type: str,
        status: str,
        message: str,
        topic_id: str | None,
        topic_subject: str | None = None,
        details: dict | None = None,
        dedupe_key: str,
    ) -> NotificationEvent:
        existing = (
            self.db.query(NotificationEvent)
            .filter(NotificationEvent.dedupe_key == dedupe_key)
            .first()
        )
        if existing:
            return existing

        success = status == "success"
        payload = {
            "event_id": "",
            "event_type": event_type,
            "status": status,
            "timestamp": datetime.now(UTC).isoformat(),
            "topic_id": topic_id,
            "topic_subject": topic_subject,
            "message": message,
            "details": details or {},
            "severity": "info" if success else "error",
        }
        event = NotificationEvent(
            topic_id=topic_id,
            channel="n8n",
            event_type=event_type,
            status=status,
            message=message,
            success=success,
            payload_json=json.dumps(payload),
            dedupe_key=dedupe_key,
            delivery_attempts=0,
            delivered_at=None,
            last_error="",
        )
        self.db.add(event)
        self.db.commit()

        payload["event_id"] = event.id
        event.payload_json = json.dumps(payload)
        self.db.add(event)
        self.db.commit()

        self.deliver_or_queue(event.id)
        return event

    def deliver_or_queue(self, notification_id: str) -> bool:
        event = self.db.get(NotificationEvent, notification_id)
        if not event:
            return False

        delivered = self._deliver_event(event)
        if delivered:
            return True

        flow_name = f"notification_delivery:{event.id}"
        existing_job = (
            self.db.query(RetryJob)
            .filter(RetryJob.flow_name == flow_name)
            .filter(RetryJob.status.in_([RetryStatus.queued, RetryStatus.in_progress]))
            .first()
        )
        if existing_job:
            return False

        topic_id = event.topic_id or self._fallback_topic_id()
        if not topic_id:
            return False

        self.db.add(
            RetryJob(
                topic_id=topic_id,
                flow_name=flow_name,
                error_type="DeliveryPending",
                error_message=event.last_error or "n8n delivery failed",
                attempt=0,
                max_attempts=5,
                status=RetryStatus.queued,
                next_run_at=datetime.now(UTC),
            )
        )
        self.db.commit()
        return False

    def _deliver_event(self, event: NotificationEvent) -> bool:
        if event.delivered_at is not None:
            return True

        event.delivery_attempts += 1
        try:
            payload = json.loads(event.payload_json or "{}")
        except json.JSONDecodeError:
            payload = {
                "event_id": event.id,
                "event_type": event.event_type,
                "status": event.status,
                "timestamp": event.created_at.isoformat(),
                "topic_id": event.topic_id,
                "message": event.message,
                "details": {},
                "severity": "info" if event.success else "error",
            }
        try:
            self.client.send(payload)
        except Exception as exc:
            event.last_error = str(exc)
            self.db.add(event)
            self.db.commit()
            return False

        event.delivered_at = datetime.now(UTC)
        event.last_error = ""
        self.db.add(event)
        self.db.commit()
        return True

    def _fallback_topic_id(self) -> str | None:
        row = self.db.query(Topic.id).order_by(Topic.created_at.asc()).first()
        if not row:
            return None
        return row[0]
