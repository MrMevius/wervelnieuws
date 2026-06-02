from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ChannelName, DocumentStatus, WorkflowState

EDITABLE_TITLE_MAX_LENGTH = 80


class TopicCreate(BaseModel):
    title: str = Field(min_length=3, max_length=EDITABLE_TITLE_MAX_LENGTH)
    subject: str = Field(min_length=3, max_length=EDITABLE_TITLE_MAX_LENGTH)
    theme: str = Field(min_length=2, max_length=255)
    project_id: str = Field(min_length=1)
    editorial_notes: str = ""
    planning_at: datetime | None = None
    target_channels: list[ChannelName] = Field(
        default_factory=lambda: [
            ChannelName.website,
            ChannelName.facebook,
            ChannelName.newsletter,
        ],
        min_length=1,
    )


class TopicUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=EDITABLE_TITLE_MAX_LENGTH)
    subject: str | None = Field(default=None, max_length=EDITABLE_TITLE_MAX_LENGTH)
    theme: str | None = None
    project_id: str | None = None
    editorial_notes: str | None = None
    planning_at: datetime | None = None
    workflow_state: WorkflowState | None = None
    is_archived: bool | None = None
    target_channels: list[ChannelName] | None = Field(default=None, min_length=1)


class TopicResponse(BaseModel):
    id: str
    title: str
    subject: str
    theme: str
    project_id: str
    project_name: str
    editorial_notes: str
    planning_at: datetime | None
    workflow_state: WorkflowState
    is_archived: bool
    target_channels: list[ChannelName]

    model_config = ConfigDict(from_attributes=True)


class TopicThemeOptionResponse(BaseModel):
    id: str
    name: str


class TopicScheduleTemplateResponse(BaseModel):
    id: str
    label: str
    subject_template: str
    theme: str
    editorial_notes: str
    planning_time: str


class NoteCreate(BaseModel):
    note: str = Field(min_length=1)


class NoteResponse(BaseModel):
    id: str
    note: str

    model_config = ConfigDict(from_attributes=True)


class AuditEventResponse(BaseModel):
    id: str
    topic_id: str | None
    actor_user_id: str | None
    event_type: str
    details_json: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: str
    filename: str
    doc_type: str
    status: DocumentStatus
    extraction_error: str

    model_config = ConfigDict(from_attributes=True)
