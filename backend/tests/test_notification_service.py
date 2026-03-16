from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.models.entities import Project, RetryJob, Topic
from app.models.enums import RetryStatus, WorkflowState
from app.services.notification_service import NotificationService
from app.workflows.worker_cycle import run_worker_cycle


def _session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(chunk_id, topic_id, text)"
            )
        )
        conn.commit()
    SessionLocal = sessionmaker(
        bind=engine, autocommit=False, autoflush=False, class_=Session
    )
    return SessionLocal()


def _topic(db: Session) -> Topic:
    project = Project(name="Windpark de Boldijk", is_active=True)
    db.add(project)
    db.flush()
    topic = Topic(
        title="Test",
        subject="Notificatie test",
        theme="Planning",
        project_id=project.id,
        editorial_notes="",
        workflow_state=WorkflowState.review,
    )
    db.add(topic)
    db.commit()
    return topic


def test_notification_service_deduplicates_same_event():
    db = _session()
    topic = _topic(db)
    service = NotificationService(db)

    first = service.record(
        event_type="content.generation",
        status="success",
        message="Generatie geslaagd",
        topic_id=topic.id,
        topic_subject=topic.subject,
        details={"version_id": "v1"},
        dedupe_key="dedupe-key-1",
    )
    second = service.record(
        event_type="content.generation",
        status="success",
        message="Generatie geslaagd",
        topic_id=topic.id,
        topic_subject=topic.subject,
        details={"version_id": "v1"},
        dedupe_key="dedupe-key-1",
    )

    assert first.id == second.id


def test_notification_retry_job_is_resolved_by_worker(monkeypatch):
    db = _session()
    topic = _topic(db)
    service = NotificationService(db)

    service.client.send = lambda payload: (_ for _ in ()).throw(
        RuntimeError("n8n down")
    )  # type: ignore[assignment]
    event = service.record(
        event_type="content.publication",
        status="error",
        message="Publicatie mislukt",
        topic_id=topic.id,
        topic_subject=topic.subject,
        details={"error_type": "RuntimeError"},
        dedupe_key="dedupe-key-2",
    )

    queued = (
        db.query(RetryJob)
        .filter(RetryJob.flow_name == f"notification_delivery:{event.id}")
        .first()
    )
    assert queued is not None
    assert queued.status == RetryStatus.queued

    monkeypatch.setattr(
        "app.integrations.n8n_client.N8NWebhookClient.send",
        lambda self, payload: None,
    )

    queued.next_run_at = datetime.now(UTC) - timedelta(minutes=1)
    db.add(queued)
    db.commit()

    run_worker_cycle(db)

    refreshed = db.get(RetryJob, queued.id)
    assert refreshed is not None
    assert refreshed.status == RetryStatus.resolved
