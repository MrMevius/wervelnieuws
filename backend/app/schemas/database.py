from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import DocumentStatus


class ProjectResponse(BaseModel):
    id: str
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class UpdateProjectRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class DatabaseDocumentResponse(BaseModel):
    id: str
    filename: str
    doc_type: str
    status: DocumentStatus
    extraction_error: str
    size_bytes: int
    project_id: str
    project_name: str
    uploaded_by_user_id: str
    uploaded_by_username: str
    created_at: datetime
