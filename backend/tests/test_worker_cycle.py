from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.models.entities import (
    ContentVersion,
    Project,
    PublicationSchedule,
    RetryJob,
    Topic,
)
from app.models.enums import RetryStatus, WorkflowState
from app.workflows.publishing_workflow import PublishingWorkflow
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


def _mock_publishers(workflow: PublishingWorkflow) -> None:
    workflow.website.publish = lambda payload: "website-1"  # type: ignore[assignment]
    workflow.facebook.publish = lambda message: "facebook-1"  # type: ignore[assignment]
    workflow.mailgun.publish_newsletter = lambda subject, html: "mailgun-1"  # type: ignore[assignment]
    workflow.telegram.send = lambda message: None  # type: ignore[assignment]


def test_worker_cycle_resolves_publish_retry_job(monkeypatch):
    db = _session()
    project = Project(name="Windpark de Boldijk", is_active=True)
    db.add(project)
    db.flush()
    topic = Topic(
        title="T",
        subject="S",
        theme="Th",
        project_id=project.id,
        editorial_notes="",
        workflow_state=WorkflowState.error,
    )
    db.add(topic)
    db.flush()

    version = ContentVersion(
        topic_id=topic.id,
        version_number=1,
        title="Titel",
        slug="titel",
        article_body="Artikel",
        summary="Samenvatting",
        source_trace_json="[]",
        generated_image_id=None,
        is_current=True,
        is_published=False,
    )
    db.add(version)
    db.flush()

    schedule = PublicationSchedule(
        topic_id=topic.id,
        content_version_id=version.id,
        scheduled_for=datetime.now(UTC) - timedelta(minutes=1),
        status=WorkflowState.error,
    )
    db.add(schedule)
    db.flush()

    retry_job = RetryJob(
        topic_id=topic.id,
        flow_name="publish_schedule",
        error_type="RuntimeError",
        error_message="failed once",
        attempt=0,
        max_attempts=5,
        status=RetryStatus.queued,
        next_run_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    db.add(retry_job)
    db.commit()

    def workflow_factory(session: Session) -> PublishingWorkflow:
        workflow = PublishingWorkflow(session)
        _mock_publishers(workflow)
        return workflow

    monkeypatch.setattr(
        "app.workflows.worker_cycle.PublishingWorkflow",
        workflow_factory,
    )

    run_worker_cycle(db)

    refreshed = db.get(RetryJob, retry_job.id)
    assert refreshed is not None
    assert refreshed.status == RetryStatus.resolved
