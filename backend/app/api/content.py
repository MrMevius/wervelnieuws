import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import desc
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.db import get_db
from app.models.entities import (
    AuditEvent,
    ContentChannelVariant,
    ChannelPublicationState,
    ContentVersion,
    GeneratedImage,
    PublicationRecord,
    PublicationSchedule,
    RetryJob,
    Topic,
    User,
)
from app.models.enums import (
    ChannelName,
    ContentApprovalState,
    RetryStatus,
    WorkflowState,
)
from app.repositories.topic_repository import ContentVersionRepository, TopicRepository
from app.schemas.versioning import (
    ActivityFeedItemResponse,
    ChannelStatusResponse,
    ContentChannelVariantResponse,
    ContentVersionResponse,
    CurrentScheduleResponse,
    ManualEditRequest,
    RegenerateRequest,
    RetryJobResponse,
    SchedulerOverviewResponse,
    SchedulerRecentRunResponse,
    SchedulerRetryJobResponse,
    SchedulerUpcomingRunResponse,
    ScheduleRequest,
    VariantUpdateRequest,
)
from app.services.audit_service import AuditService
from app.services.generation_service import GenerationService, slugify

router = APIRouter(prefix="/content", tags=["content"])

SCHEDULER_RECENT_LIMIT = 25
SCHEDULER_UPCOMING_LIMIT = 25
SCHEDULER_RETRY_LIMIT = 25
ACTIVITY_FEED_LIMIT_MAX = 200

MIGRATION_REQUIRED_DETAIL = (
    "Database mist schema voor kanaalvarianten. "
    "Voer eerst migraties uit met 'docker compose run --rm migrate' "
    "en start backend en worker opnieuw."
)


def _parse_channel(channel: str) -> ChannelName:
    try:
        return ChannelName(channel)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Channel not found") from exc


def _serialize_variant(variant: ContentChannelVariant) -> ContentChannelVariantResponse:
    payload = ContentChannelVariantResponse.model_validate(variant)
    payload.generated_image_path = (
        variant.generated_image.image_path if variant.generated_image else None
    )
    return payload


def _is_missing_channel_variants_table(error: DBAPIError) -> bool:
    message = str(getattr(error, "orig", error)).lower()
    has_table_name = "content_channel_variants" in message
    has_missing_table = "no such table" in message or "does not exist" in message
    return has_table_name and has_missing_table


def _raise_if_missing_variants_schema(error: DBAPIError) -> None:
    if _is_missing_channel_variants_table(error):
        raise HTTPException(
            status_code=503, detail=MIGRATION_REQUIRED_DETAIL
        ) from error


def _ensure_channel_variants(
    db: Session, topic: Topic, version: ContentVersion
) -> list[ContentChannelVariant]:
    existing = (
        db.query(ContentChannelVariant)
        .filter(ContentChannelVariant.content_version_id == version.id)
        .all()
    )
    if existing:
        return existing

    for channel in topic.target_channels:
        db.add(
            ContentChannelVariant(
                content_version_id=version.id,
                topic_id=topic.id,
                channel=channel,
                title=version.title,
                article_body=version.article_body,
                summary=version.summary,
                generated_image_id=version.generated_image_id,
                approval_state=ContentApprovalState.pending,
            )
        )
    db.commit()
    return (
        db.query(ContentChannelVariant)
        .filter(ContentChannelVariant.content_version_id == version.id)
        .all()
    )


@router.post("/{topic_id}/generate")
def generate(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    try:
        version_id = GenerationService(db).generate_for_topic(topic)
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    AuditService(db).log(
        "content.generated", topic_id=topic_id, actor_user_id=current.id
    )
    return {"version_id": version_id}


@router.post("/{topic_id}/regenerate")
def regenerate(
    topic_id: str,
    payload: RegenerateRequest | None = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    requested_channels: list[ChannelName] = []
    selected_payload = payload or RegenerateRequest()
    if selected_payload.channels:
        for channel in selected_payload.channels:
            parsed = _parse_channel(channel)
            if parsed in topic.target_channels and parsed not in requested_channels:
                requested_channels.append(parsed)
        if not requested_channels:
            raise HTTPException(
                status_code=400,
                detail="No valid channels selected for regeneration",
            )

    try:
        version_id = GenerationService(db).generate_for_topic(
            topic, requested_channels or None
        )
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    AuditService(db).log(
        "content.regenerated",
        topic_id=topic_id,
        actor_user_id=current.id,
        details_json=json.dumps(
            {
                "channels": [channel.value for channel in requested_channels]
                if requested_channels
                else [channel.value for channel in topic.target_channels]
            }
        ),
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

    latest = ContentVersionRepository(db).latest_for_topic(topic_id)
    if not latest:
        raise HTTPException(status_code=400, detail="No content version available")
    try:
        variants = _ensure_channel_variants(db, topic, latest)
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    required_channels = set(topic.target_channels)
    approved_channels = {
        variant.channel
        for variant in variants
        if variant.approval_state == ContentApprovalState.approved
    }
    missing = sorted(
        channel.value for channel in (required_channels - approved_channels)
    )
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Not all channels approved: {', '.join(missing)}",
        )

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


@router.get("/{topic_id}/schedule/current", response_model=CurrentScheduleResponse)
def current_schedule(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentScheduleResponse:
    del current
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    schedule = (
        db.query(PublicationSchedule)
        .filter(PublicationSchedule.topic_id == topic_id)
        .order_by(desc(PublicationSchedule.created_at))
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="No publication schedule")
    return CurrentScheduleResponse(
        schedule_id=schedule.id,
        topic_id=schedule.topic_id,
        content_version_id=schedule.content_version_id,
        scheduled_for=schedule.scheduled_for,
        status=schedule.status.value,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


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


@router.get("/activity", response_model=list[ActivityFeedItemResponse])
def list_activity_feed(
    event_type: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    period: str = Query(default="7d"),
    limit: int = Query(default=50, ge=1, le=ACTIVITY_FEED_LIMIT_MAX),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActivityFeedItemResponse]:
    del current
    normalized_period = period.strip().lower()
    period_days = {"24h": 1, "7d": 7, "30d": 30, "all": 0}
    if normalized_period not in period_days:
        raise HTTPException(
            status_code=400,
            detail="Invalid period. Use one of: 24h, 7d, 30d, all",
        )

    query = (
        db.query(AuditEvent, User.username, Topic.subject)
        .outerjoin(User, User.id == AuditEvent.actor_user_id)
        .outerjoin(Topic, Topic.id == AuditEvent.topic_id)
    )

    normalized_event_type = (event_type or "").strip()
    if normalized_event_type:
        query = query.filter(AuditEvent.event_type == normalized_event_type)

    normalized_topic = (topic or "").strip()
    if normalized_topic:
        query = query.filter(Topic.subject.ilike(f"%{normalized_topic}%"))

    if normalized_period != "all":
        since = datetime.now(UTC) - timedelta(days=period_days[normalized_period])
        query = query.filter(AuditEvent.created_at >= since)

    rows = query.order_by(desc(AuditEvent.created_at)).limit(limit).all()
    return [
        ActivityFeedItemResponse(
            id=event.id,
            event_type=event.event_type,
            topic_id=event.topic_id,
            topic_subject=subject,
            actor_user_id=event.actor_user_id,
            actor_username=username or "Systeem",
            details_json=event.details_json,
            created_at=event.created_at,
        )
        for event, username, subject in rows
    ]


@router.get("/scheduler/overview", response_model=SchedulerOverviewResponse)
def scheduler_overview(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SchedulerOverviewResponse:
    del current
    now = datetime.now(UTC)

    recent_rows = (
        db.query(PublicationSchedule, Topic.subject)
        .join(Topic, Topic.id == PublicationSchedule.topic_id)
        .order_by(desc(PublicationSchedule.updated_at))
        .limit(SCHEDULER_RECENT_LIMIT)
        .all()
    )
    upcoming_rows = (
        db.query(PublicationSchedule, Topic.subject)
        .join(Topic, Topic.id == PublicationSchedule.topic_id)
        .filter(PublicationSchedule.status == WorkflowState.scheduled)
        .filter(PublicationSchedule.scheduled_for >= now)
        .order_by(PublicationSchedule.scheduled_for.asc())
        .limit(SCHEDULER_UPCOMING_LIMIT)
        .all()
    )
    retry_rows = (
        db.query(RetryJob, Topic.subject)
        .join(Topic, Topic.id == RetryJob.topic_id)
        .order_by(desc(RetryJob.created_at))
        .limit(SCHEDULER_RETRY_LIMIT)
        .all()
    )

    return SchedulerOverviewResponse(
        generated_at=now,
        recent_runs=[
            SchedulerRecentRunResponse(
                schedule_id=schedule.id,
                topic_id=schedule.topic_id,
                topic_subject=subject,
                content_version_id=schedule.content_version_id,
                scheduled_for=schedule.scheduled_for,
                status=schedule.status.value,
                updated_at=schedule.updated_at,
            )
            for schedule, subject in recent_rows
        ],
        upcoming_runs=[
            SchedulerUpcomingRunResponse(
                schedule_id=schedule.id,
                topic_id=schedule.topic_id,
                topic_subject=subject,
                content_version_id=schedule.content_version_id,
                scheduled_for=schedule.scheduled_for,
                status=schedule.status.value,
            )
            for schedule, subject in upcoming_rows
        ],
        retry_jobs=[
            SchedulerRetryJobResponse(
                id=job.id,
                topic_id=job.topic_id,
                topic_subject=subject,
                flow_name=job.flow_name,
                status=job.status.value,
                attempt=job.attempt,
                max_attempts=job.max_attempts,
                next_run_at=job.next_run_at,
                error_type=job.error_type,
                error_message=job.error_message,
            )
            for job, subject in retry_rows
        ],
    )


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


@router.get(
    "/{topic_id}/variants/current", response_model=list[ContentChannelVariantResponse]
)
def list_current_variants(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContentChannelVariantResponse]:
    del current
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    latest = ContentVersionRepository(db).latest_for_topic(topic_id)
    if not latest:
        raise HTTPException(status_code=404, detail="No content version available")
    try:
        variants = _ensure_channel_variants(db, topic, latest)
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    by_order = {channel: index for index, channel in enumerate(topic.target_channels)}
    variants.sort(key=lambda row: by_order.get(row.channel, 999))
    return [_serialize_variant(variant) for variant in variants]


@router.patch(
    "/{topic_id}/variants/{channel}", response_model=ContentChannelVariantResponse
)
def update_current_variant(
    topic_id: str,
    channel: str,
    payload: VariantUpdateRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContentChannelVariantResponse:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    latest = ContentVersionRepository(db).latest_for_topic(topic_id)
    if not latest:
        raise HTTPException(status_code=404, detail="No content version available")
    parsed_channel = _parse_channel(channel)
    try:
        variants = _ensure_channel_variants(db, topic, latest)
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    target = next((item for item in variants if item.channel == parsed_channel), None)
    if not target:
        raise HTTPException(status_code=404, detail="Channel variant not found")

    target.title = payload.title
    target.article_body = payload.article_body
    target.summary = payload.summary
    target.approval_state = ContentApprovalState.pending
    target.approved_by_user_id = None
    target.approved_at = None
    db.add(target)

    if parsed_channel == ChannelName.website:
        latest.title = payload.title
        latest.slug = slugify(payload.title)
        latest.article_body = payload.article_body
        latest.summary = payload.summary
        db.add(latest)
    db.commit()
    AuditService(db).log(
        "content.variant.updated",
        topic_id=topic.id,
        actor_user_id=current.id,
        details_json=json.dumps({"channel": parsed_channel.value}),
    )
    return _serialize_variant(target)


@router.post(
    "/{topic_id}/variants/{channel}/approve",
    response_model=ContentChannelVariantResponse,
)
def approve_variant(
    topic_id: str,
    channel: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContentChannelVariantResponse:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    latest = ContentVersionRepository(db).latest_for_topic(topic_id)
    if not latest:
        raise HTTPException(status_code=404, detail="No content version available")
    parsed_channel = _parse_channel(channel)
    try:
        variants = _ensure_channel_variants(db, topic, latest)
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    target = next((item for item in variants if item.channel == parsed_channel), None)
    if not target:
        raise HTTPException(status_code=404, detail="Channel variant not found")

    target.approval_state = ContentApprovalState.approved
    target.approved_by_user_id = current.id
    target.approved_at = datetime.now(UTC)
    db.add(target)
    db.commit()
    AuditService(db).log(
        "content.variant.approved",
        topic_id=topic.id,
        actor_user_id=current.id,
        details_json=json.dumps({"channel": parsed_channel.value}),
    )
    return _serialize_variant(target)


@router.post(
    "/{topic_id}/variants/{channel}/reject",
    response_model=ContentChannelVariantResponse,
)
def reject_variant(
    topic_id: str,
    channel: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContentChannelVariantResponse:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    latest = ContentVersionRepository(db).latest_for_topic(topic_id)
    if not latest:
        raise HTTPException(status_code=404, detail="No content version available")
    parsed_channel = _parse_channel(channel)
    try:
        variants = _ensure_channel_variants(db, topic, latest)
    except DBAPIError as exc:
        _raise_if_missing_variants_schema(exc)
        raise
    target = next((item for item in variants if item.channel == parsed_channel), None)
    if not target:
        raise HTTPException(status_code=404, detail="Channel variant not found")

    target.approval_state = ContentApprovalState.rejected
    target.approved_by_user_id = current.id
    target.approved_at = datetime.now(UTC)
    db.add(target)
    db.commit()
    AuditService(db).log(
        "content.variant.rejected",
        topic_id=topic.id,
        actor_user_id=current.id,
        details_json=json.dumps({"channel": parsed_channel.value}),
    )
    return _serialize_variant(target)


@router.get("/images/{image_id}")
def read_generated_image(
    image_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    del current
    image = db.get(GeneratedImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Generated image not found")
    path = Path(image.image_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Generated image file not found")
    return FileResponse(path=path, media_type="image/png")
