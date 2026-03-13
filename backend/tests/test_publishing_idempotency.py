from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.models.entities import (
    ChannelPublicationState,
    ContentVersion,
    Project,
    PublicationRecord,
    PublicationSchedule,
    RetryJob,
    Topic,
)
from app.models.enums import (
    ChannelName,
    ChannelPublishState,
    RetryStatus,
    WorkflowState,
)
from app.services.retry_service import RetryService
from app.workflows.publishing_workflow import PublishingWorkflow


def _session(database_url: str = "sqlite:///:memory:") -> Session:
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
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


def test_publish_due_claims_once_and_avoids_duplicates():
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
        workflow_state=WorkflowState.scheduled,
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
        status=WorkflowState.scheduled,
    )
    db.add(schedule)
    db.commit()

    workflow = PublishingWorkflow(db)
    _mock_publishers(workflow)

    first = workflow.publish_due()
    second = workflow.publish_due()

    assert first == 1
    assert second == 0
    assert db.query(PublicationRecord).count() == 1


def test_retry_flow_executes_publish_and_resolves_job():
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
    job = RetryJob(
        topic_id=topic.id,
        flow_name="publish_schedule",
        error_type="RuntimeError",
        error_message="previous failure",
        attempt=0,
        max_attempts=5,
        status=RetryStatus.queued,
        next_run_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    db.add(job)
    db.commit()

    workflow = PublishingWorkflow(db)
    _mock_publishers(workflow)
    retry = RetryService(db)

    due = retry.due_jobs()
    assert len(due) == 1
    retry.mark_in_progress(due[0])
    assert workflow.retry_publish_for_topic(topic.id) is True
    retry.mark_resolved(due[0])

    refreshed = db.get(RetryJob, due[0].id)
    assert refreshed is not None
    assert refreshed.status == RetryStatus.resolved


def test_dual_worker_claim_only_one_succeeds(tmp_path):
    db_file = tmp_path / "claim-test.db"
    db_url = f"sqlite:///{db_file}"

    setup = _session(db_url)
    project = Project(name="Windpark de Boldijk", is_active=True)
    setup.add(project)
    setup.flush()
    topic = Topic(
        title="T",
        subject="S",
        theme="Th",
        project_id=project.id,
        editorial_notes="",
        workflow_state=WorkflowState.scheduled,
    )
    setup.add(topic)
    setup.flush()
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
    setup.add(version)
    setup.flush()
    schedule = PublicationSchedule(
        topic_id=topic.id,
        content_version_id=version.id,
        scheduled_for=datetime.now(UTC) - timedelta(minutes=1),
        status=WorkflowState.scheduled,
    )
    setup.add(schedule)
    setup.commit()

    worker_a_db = _session(db_url)
    worker_b_db = _session(db_url)
    worker_a = PublishingWorkflow(worker_a_db)
    worker_b = PublishingWorkflow(worker_b_db)

    claim_a = worker_a._claim_schedule(schedule.id)
    claim_b = worker_b._claim_schedule(schedule.id)

    assert {claim_a, claim_b} == {True, False}


def test_publish_respects_topic_target_channels():
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
        workflow_state=WorkflowState.scheduled,
        target_channels_json='["website"]',
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
        status=WorkflowState.scheduled,
    )
    db.add(schedule)
    db.commit()

    workflow = PublishingWorkflow(db)
    website_calls = {"count": 0}
    facebook_calls = {"count": 0}
    newsletter_calls = {"count": 0}

    def _website_publish(payload):
        del payload
        website_calls["count"] += 1
        return "website-1"

    def _facebook_publish(message):
        del message
        facebook_calls["count"] += 1
        return "facebook-1"

    def _newsletter_publish(subject, html):
        del subject, html
        newsletter_calls["count"] += 1
        return "mailgun-1"

    workflow.website.publish = _website_publish  # type: ignore[assignment]
    workflow.facebook.publish = _facebook_publish  # type: ignore[assignment]
    workflow.mailgun.publish_newsletter = _newsletter_publish  # type: ignore[assignment]
    workflow.telegram.send = lambda message: None  # type: ignore[assignment]

    published = workflow.publish_due()
    assert published == 1
    assert website_calls["count"] == 1
    assert facebook_calls["count"] == 0
    assert newsletter_calls["count"] == 0

    record = db.query(PublicationRecord).first()
    assert record is not None
    states = (
        db.query(ChannelPublicationState)
        .filter(ChannelPublicationState.publication_record_id == record.id)
        .all()
    )
    by_channel = {state.channel: state for state in states}
    assert by_channel[ChannelName.website].state == ChannelPublishState.published
    assert by_channel[ChannelName.facebook].state == ChannelPublishState.skipped
    assert by_channel[ChannelName.newsletter].state == ChannelPublishState.skipped
