from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContentVersionResponse(BaseModel):
    id: str
    topic_id: str
    version_number: int
    title: str
    slug: str
    article_body: str
    summary: str
    source_trace_json: str
    generated_image_id: str | None
    is_current: bool
    is_published: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ManualEditRequest(BaseModel):
    title: str
    slug: str
    article_body: str
    summary: str


class ScheduleRequest(BaseModel):
    publish_at: datetime


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
