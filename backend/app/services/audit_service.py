from sqlalchemy.orm import Session

from app.models.entities import AuditEvent


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        event_type: str,
        topic_id: str | None = None,
        actor_user_id: str | None = None,
        details_json: str = "{}",
    ) -> None:
        event = AuditEvent(
            event_type=event_type,
            topic_id=topic_id,
            actor_user_id=actor_user_id,
            details_json=details_json,
        )
        self.db.add(event)
        self.db.commit()
