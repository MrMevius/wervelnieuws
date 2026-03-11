from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DocumentStatus, WorkflowState


class TopicCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    subject: str = Field(min_length=3, max_length=255)
    theme: str = Field(min_length=2, max_length=255)
    editorial_notes: str = ""
    planning_at: datetime | None = None


class TopicUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    theme: str | None = None
    editorial_notes: str | None = None
    planning_at: datetime | None = None
    workflow_state: WorkflowState | None = None
    is_archived: bool | None = None


class TopicResponse(BaseModel):
    id: str
    title: str
    subject: str
    theme: str
    editorial_notes: str
    planning_at: datetime | None
    workflow_state: WorkflowState
    is_archived: bool

    model_config = ConfigDict(from_attributes=True)


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
