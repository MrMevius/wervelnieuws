from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import (
    ChannelPublicationState,
    ContentVersion,
    PublicationRecord,
    PublicationSchedule,
    RetryJob,
    Topic,
    User,
)
from app.models.enums import RetryStatus, WorkflowState
from app.repositories.topic_repository import ContentVersionRepository, TopicRepository
from app.schemas.versioning import (
    ChannelStatusResponse,
    ContentVersionResponse,
    ManualEditRequest,
    RetryJobResponse,
    ScheduleRequest,
)
from app.services.audit_service import AuditService
from app.services.generation_service import GenerationService

router = APIRouter(prefix="/content", tags=["content"])


@router.post("/{topic_id}/generate")
def generate(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    version_id = GenerationService(db).generate_for_topic(topic)
    AuditService(db).log(
        "content.generated", topic_id=topic_id, actor_user_id=current.id
    )
    return {"version_id": version_id}


@router.get("/{topic_id}/versions", response_model=list[ContentVersionResponse])
def list_versions(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current
    return ContentVersionRepository(db).list_for_topic(topic_id)


@router.post("/{topic_id}/manual-edit", response_model=ContentVersionResponse)
def manual_edit(
    topic_id: str,
    payload: ManualEditRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    versions = ContentVersionRepository(db)
    latest = versions.latest_for_topic(topic_id)
    next_num = (latest.version_number + 1) if latest else 1
    created = versions.create(
        topic_id=topic_id,
        version_number=next_num,
        title=payload.title,
        slug=payload.slug,
        article_body=payload.article_body,
        summary=payload.summary,
        source_trace_json="[]",
        generated_image_id=latest.generated_image_id if latest else None,
        is_current=True,
        is_published=False,
    )
    topic.workflow_state = WorkflowState.review
    db.add(topic)
    db.commit()
    AuditService(db).log(
        "content.manual_edited", topic_id=topic_id, actor_user_id=current.id
    )
    return created


@router.post("/{topic_id}/rollback/{version_id}")
def rollback(
    topic_id: str,
    version_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    del current
    versions = ContentVersionRepository(db)
    target = versions.get(version_id)
    if not target or target.topic_id != topic_id:
        raise HTTPException(status_code=404, detail="Version not found")
    for row in versions.list_for_topic(topic_id):
        row.is_current = row.id == target.id
        db.add(row)
    db.commit()
    return {"status": "ok", "current_version_id": target.id}


@router.post("/{topic_id}/approve")
def approve(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic.workflow_state = WorkflowState.approved
    db.add(topic)
    db.commit()
    AuditService(db).log(
        "content.approved", topic_id=topic_id, actor_user_id=current.id
    )
    return {"status": "approved"}


@router.post("/{topic_id}/reject")
def reject(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic.workflow_state = WorkflowState.rejected
    db.add(topic)
    db.commit()
    AuditService(db).log(
        "content.rejected", topic_id=topic_id, actor_user_id=current.id
    )
    return {"status": "rejected"}


@router.post("/{topic_id}/schedule")
def schedule(
    topic_id: str,
    payload: ScheduleRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    latest = ContentVersionRepository(db).latest_for_topic(topic_id)
    if not latest:
        raise HTTPException(status_code=400, detail="No content version available")
    schedule = PublicationSchedule(
        topic_id=topic_id,
        content_version_id=latest.id,
        scheduled_for=payload.publish_at,
        status=WorkflowState.scheduled,
    )
    db.add(schedule)
    topic.workflow_state = WorkflowState.scheduled
    db.add(topic)
    db.commit()
    AuditService(db).log(
        "content.scheduled", topic_id=topic_id, actor_user_id=current.id
    )
    return {"schedule_id": schedule.id}


@router.get("/{topic_id}/channel-status", response_model=list[ChannelStatusResponse])
def channel_status(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChannelStatusResponse]:
    del current
    record = (
        db.query(PublicationRecord)
        .filter(PublicationRecord.topic_id == topic_id)
        .order_by(desc(PublicationRecord.created_at))
        .first()
    )
    if not record:
        return []
    states = (
        db.query(ChannelPublicationState)
        .filter(ChannelPublicationState.publication_record_id == record.id)
        .all()
    )
    return [
        ChannelStatusResponse(
            channel=s.channel.value,
            state=s.state.value,
            external_id=s.external_id,
            error_message=s.error_message,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in states
    ]


@router.get("/{topic_id}/current", response_model=ContentVersionResponse)
def current_version(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContentVersion:
    del current
    version = (
        db.query(ContentVersion)
        .filter(ContentVersion.topic_id == topic_id)
        .filter(ContentVersion.is_current.is_(True))
        .order_by(desc(ContentVersion.version_number))
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="No current version")
    return version


@router.get("/retry-jobs", response_model=list[RetryJobResponse])
def list_retry_jobs(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RetryJob]:
    del current
    return db.query(RetryJob).order_by(desc(RetryJob.created_at)).all()


@router.post("/retry-jobs/{job_id}/requeue")
def requeue_retry_job(
    job_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    job = db.get(RetryJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Retry job not found")
    job.status = RetryStatus.queued
    job.attempt = 0
    db.add(job)
    db.commit()
    AuditService(db).log(
        "retry.requeued", topic_id=job.topic_id, actor_user_id=current.id
    )
    return {"status": "queued"}
