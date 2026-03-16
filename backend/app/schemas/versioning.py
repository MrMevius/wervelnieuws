import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceTraceHitResponse(BaseModel):
    source: str
    source_type: str
    chunk_id: str
    chunk_index: str
    text: str
    document_id: str
    document_name: str
    topic_id: str
    project_id: str
    project_name: str


class ContentVersionResponse(BaseModel):
    id: str
    topic_id: str
    version_number: int
    title: str
    slug: str
    article_body: str
    summary: str
    source_trace_json: str
    source_trace: list[SourceTraceHitResponse] = Field(default_factory=list)
    generated_image_id: str | None
    is_current: bool
    is_published: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_source_trace(self) -> "ContentVersionResponse":
        if self.source_trace:
            return self
        try:
            parsed = json.loads(self.source_trace_json or "[]")
            if isinstance(parsed, list):
                self.source_trace = [
                    SourceTraceHitResponse.model_validate(item) for item in parsed
                ]
        except (json.JSONDecodeError, TypeError, ValueError):
            self.source_trace = []
        return self


class ContentChannelVariantResponse(BaseModel):
    id: str
    content_version_id: str
    topic_id: str
    channel: str
    title: str
    article_body: str
    summary: str
    generated_image_id: str | None
    generated_image_path: str | None = None
    approval_state: str
    approved_by_user_id: str | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VariantUpdateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    article_body: str = Field(min_length=1)
    summary: str = Field(min_length=1)


class RegenerateRequest(BaseModel):
    channels: list[str] = Field(default_factory=list)


class ManualEditRequest(BaseModel):
    title: str
    slug: str
    article_body: str
    summary: str


class ScheduleRequest(BaseModel):
    publish_at: datetime


class CurrentScheduleResponse(BaseModel):
    schedule_id: str
    topic_id: str
    content_version_id: str
    scheduled_for: datetime
    status: str
    created_at: datetime
    updated_at: datetime


class ChannelStatusResponse(BaseModel):
    channel: str
    state: str
    external_id: str
    error_message: str
    created_at: datetime
    updated_at: datetime


class RetryJobResponse(BaseModel):
    id: str
    topic_id: str
    flow_name: str
    error_type: str
    error_message: str
    attempt: int
    max_attempts: int
    status: str
    next_run_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SchedulerRecentRunResponse(BaseModel):
    schedule_id: str
    topic_id: str
    topic_subject: str
    content_version_id: str
    scheduled_for: datetime
    status: str
    updated_at: datetime


class SchedulerUpcomingRunResponse(BaseModel):
    schedule_id: str
    topic_id: str
    topic_subject: str
    content_version_id: str
    scheduled_for: datetime
    status: str


class SchedulerRetryJobResponse(BaseModel):
    id: str
    topic_id: str
    topic_subject: str
    flow_name: str
    status: str
    attempt: int
    max_attempts: int
    next_run_at: datetime
    error_type: str
    error_message: str


class SchedulerOverviewResponse(BaseModel):
    generated_at: datetime
    recent_runs: list[SchedulerRecentRunResponse]
    upcoming_runs: list[SchedulerUpcomingRunResponse]
    retry_jobs: list[SchedulerRetryJobResponse]


class ActivityFeedItemResponse(BaseModel):
    id: str
    event_type: str
    topic_id: str | None
    topic_subject: str | None
    actor_user_id: str | None
    actor_username: str
    details_json: str
    created_at: datetime


class NotificationFeedItemResponse(BaseModel):
    id: str
    event_type: str
    status: str
    topic_id: str | None
    topic_subject: str | None
    message: str
    payload_json: str
    delivery_attempts: int
    delivered_at: datetime | None
    last_error: str
    created_at: datetime
