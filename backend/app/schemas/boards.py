from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import BoardColumn

BOARD_CARD_TITLE_MAX_LENGTH = 80


class BoardProjectCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    invited_user_ids: list[str] = Field(default_factory=list)


class BoardProjectSummaryResponse(BaseModel):
    id: str
    name: str
    description: str
    invited_user_ids: list[str]
    card_count: int
    last_activity_at: datetime | None


class BoardAccessUserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    is_admin: bool
    is_active: bool
    has_avatar: bool = False


class BoardRightsUserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    email: str | None
    is_admin: bool
    is_active: bool
    has_avatar: bool = False


class BoardProjectRightsResponse(BaseModel):
    id: str
    name: str
    description: str
    invited_user_ids: list[str]
    card_count: int
    last_activity_at: datetime | None


class BoardRightsOverviewResponse(BaseModel):
    users: list[BoardRightsUserResponse]
    projects: list[BoardProjectRightsResponse]


class BoardProjectRightsUpdateRequest(BaseModel):
    invited_user_ids: list[str] = Field(default_factory=list)


class BoardCardCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=BOARD_CARD_TITLE_MAX_LENGTH)
    description: str = ""
    column: BoardColumn = BoardColumn.todo
    assignment_user_ids: list[str] = Field(default_factory=list)


class BoardCardMoveRequest(BaseModel):
    column: BoardColumn
    position: int = Field(ge=0)


class BoardCardTitleUpdateRequest(BaseModel):
    title: str = Field(max_length=BOARD_CARD_TITLE_MAX_LENGTH)
    model_config = ConfigDict(extra="forbid")

    @field_validator("title", mode="before")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Vul een kaarttitel in.")
        normalized = value.strip()
        if not normalized:
            raise ValueError("Vul een kaarttitel in.")
        return normalized


class BoardCardDescriptionUpdateRequest(BaseModel):
    description: str = Field(max_length=5000)
    model_config = ConfigDict(extra="forbid")

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Beschrijving moet tekst zijn.")
        return value.strip()


class CardUpdateCreateRequest(BaseModel):
    message: str = Field(min_length=1)


class CardAssignmentResponse(BaseModel):
    id: str
    user_id: str
    username: str
    user_display_name: str
    has_avatar: bool = False


class CardUpdateResponse(BaseModel):
    id: str
    author_user_id: str
    author_username: str
    author_display_name: str
    message: str
    image_url: str | None = None
    edited_from_update_id: str | None = None
    created_at: datetime


class RecordingResponse(BaseModel):
    id: str
    uploaded_by_user_id: str | None = None
    uploaded_by_username: str | None = None
    uploaded_by_display_name: str | None = None
    filename: str
    file_path: str
    duration: int | None
    recorded_at: datetime
    transcription_status: str
    transcription_text: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    download_url: str


class BoardAttachmentResponse(BaseModel):
    id: str
    uploaded_by_user_id: str
    uploaded_by_username: str | None = None
    uploaded_by_display_name: str | None = None
    filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    download_url: str


class BoardCardResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    column: BoardColumn
    position: int
    is_archived: bool = False
    assignments: list[CardAssignmentResponse]
    updates_count: int
    recordings_count: int
    attachments_count: int


class ProjectBoardResponse(BaseModel):
    project_id: str
    project_name: str
    invited_user_ids: list[str]
    access_users: list[BoardAccessUserResponse]
    cards: list[BoardCardResponse]
    archived_cards: list[BoardCardResponse] = Field(default_factory=list)
    is_read_only: bool = False


class BoardRecycleBinCardResponse(BaseModel):
    id: str
    project_id: str
    project_name: str
    title: str
    description: str
    column: BoardColumn
    position: int
    is_archived: bool = False
    deleted_at: datetime
    deleted_by_user_id: str | None
    deleted_by_username: str | None = None
    deleted_by_display_name: str | None = None
    assignments: list[CardAssignmentResponse]
    updates_count: int
    recordings_count: int
    attachments_count: int


class CardDetailResponse(BaseModel):
    card: BoardCardResponse
    updates: list[CardUpdateResponse]
    recordings: list[RecordingResponse]
    attachments: list[BoardAttachmentResponse]

    model_config = ConfigDict(from_attributes=True)
