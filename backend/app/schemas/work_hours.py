from datetime import date, datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


PAGE_SIZES = [25, 50, 100]


class WorkProjectResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    is_active: bool
    is_archived: bool
    archived_at: datetime | None = None
    archived_by_user_id: str | None = None
    created_at: datetime | None = None
    created_by_user_id: str | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None
    deleted_at: datetime | None = None
    deleted_by_user_id: str | None = None
    row_version: int = 1

    model_config = ConfigDict(from_attributes=True)


class WorkPostResponse(BaseModel):
    id: str
    project_id: str | None = None
    name: str
    description: str
    is_active: bool
    is_archived: bool
    archived_at: datetime | None = None
    archived_by_user_id: str | None = None
    created_at: datetime | None = None
    created_by_user_id: str | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None
    deleted_at: datetime | None = None
    deleted_by_user_id: str | None = None
    row_version: int = 1

    model_config = ConfigDict(from_attributes=True)


class WorkExternalPersonResponse(BaseModel):
    id: str
    display_name: str
    email: str | None = None
    note: str
    is_active: bool
    deleted_at: datetime | None = None
    created_at: datetime | None = None
    created_by_user_id: str | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None
    deleted_by_user_id: str | None = None
    row_version: int = 1

    model_config = ConfigDict(from_attributes=True)


class WorkExternalPersonUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=255)
    note: str | None = None
    expected_row_version: int | None = Field(default=None, ge=1)
    model_config = ConfigDict(extra="forbid")

    @field_validator("display_name", "note", mode="before")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Voer tekst in.")
        return value.strip()

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("E-mail moet tekst zijn.")
        normalized = value.strip()
        return normalized or None


class WorkExternalPersonMergeRequest(BaseModel):
    target_id: str
    note: str | None = None
    expected_source_row_version: int | None = Field(default=None, ge=1)
    expected_target_row_version: int | None = Field(default=None, ge=1)
    model_config = ConfigDict(extra="forbid")

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Voer tekst in.")
        normalized = value.strip()
        return normalized or None


class WorkHistoricalIdentityResponse(BaseModel):
    id: str
    source_key: str
    snapshot_name: str
    snapshot_email: str | None = None
    snapshot_display_label: str
    linked_user_id: str | None = None
    linked_at: datetime | None = None
    is_active: bool
    source_user_id: str | None = None
    linked_by_user_id: str | None = None
    created_at: datetime | None = None
    created_by_user_id: str | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None
    deleted_at: datetime | None = None
    deleted_by_user_id: str | None = None
    row_version: int = 1

    model_config = ConfigDict(from_attributes=True)


class WorkHistoricalIdentityRelinkRequest(BaseModel):
    linked_user_id: str
    expected_row_version: int | None = Field(default=None, ge=1)

    model_config = ConfigDict(extra="forbid")


class WorkEligibleUserResponse(BaseModel):
    id: str
    display_name: str
    display_type: Literal["live_user"] = "live_user"
    selectable: bool = True

    model_config = ConfigDict(from_attributes=True)


class WorkHourParticipantBase(BaseModel):
    participant_kind: str = Field(pattern="^(live_user|external_person|historical_identity)$")
    user_id: str | None = None
    external_person_id: str | None = None
    historical_identity_id: str | None = None
    display_name_snapshot: str = Field(min_length=1, max_length=160)
    display_email_snapshot: str | None = Field(default=None, max_length=255)
    display_type_snapshot: str = Field(min_length=1, max_length=80)
    sort_order: int = Field(default=0, ge=0)

    @field_validator("display_name_snapshot", "display_type_snapshot", mode="before")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Voer tekst in.")
        return value.strip()

    @field_validator("display_email_snapshot", mode="before")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("E-mail moet tekst zijn.")
        normalized = value.strip()
        return normalized or None


class WorkHourParticipantCreateRequest(WorkHourParticipantBase):
    model_config = ConfigDict(extra="forbid")


class WorkHourParticipantUpdateRequest(BaseModel):
    id: str | None = None
    participant_kind: str | None = Field(default=None, pattern="^(live_user|external_person|historical_identity)$")
    user_id: str | None = None
    external_person_id: str | None = None
    historical_identity_id: str | None = None
    display_name_snapshot: str | None = Field(default=None, min_length=1, max_length=160)
    display_email_snapshot: str | None = Field(default=None, max_length=255)
    display_type_snapshot: str | None = Field(default=None, min_length=1, max_length=80)
    sort_order: int = Field(default=0, ge=0)
    created_at: datetime | None = None
    created_by_user_id: str | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None
    deleted_at: datetime | None = None
    deleted_by_user_id: str | None = None
    row_version: int | None = None
    model_config = ConfigDict(extra="forbid")


class WorkHourParticipantResponse(BaseModel):
    id: str
    display_name_snapshot: str
    display_type_snapshot: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class WorkHourAdminParticipantResponse(WorkHourParticipantResponse):
    participant_kind: str
    user_id: str | None = None
    external_person_id: str | None = None
    historical_identity_id: str | None = None
    display_email_snapshot: str | None = None
    created_at: datetime | None = None
    created_by_user_id: str | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None
    deleted_at: datetime | None = None
    deleted_by_user_id: str | None = None
    row_version: int = 1


class WorkHourGroupBase(BaseModel):
    work_date: date
    project_id: str
    post_id: str
    description: str = ""
    duration_half_hours: int = Field(ge=1, le=48)
    participants: list[WorkHourParticipantCreateRequest] = Field(default_factory=list)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Beschrijving moet tekst zijn.")
        return value.strip()


class WorkHourGroupCreateRequest(WorkHourGroupBase):
    model_config = ConfigDict(extra="forbid")


class WorkHourGroupUpdateRequest(BaseModel):
    work_date: date | None = None
    project_id: str | None = None
    post_id: str | None = None
    description: str | None = None
    duration_half_hours: int | None = Field(default=None, ge=1, le=48)
    participants: list[WorkHourParticipantUpdateRequest] | None = None
    expected_row_version: int | None = Field(default=None, ge=1)
    model_config = ConfigDict(extra="forbid")


class WorkHourGroupResponse(BaseModel):
    id: str
    work_date: date
    project_id: str
    project_name: str
    post_id: str
    post_name: str
    description: str
    duration_half_hours: int
    duration_hours: float
    person_count: int
    person_hours: float
    row_version: int
    created_at: datetime
    updated_at: datetime
    participants: list[WorkHourParticipantResponse]

    model_config = ConfigDict(from_attributes=True)


class WorkHourAdminGroupResponse(WorkHourGroupResponse):
    created_by_user_id: str | None = None
    updated_by_user_id: str | None = None
    deleted_at: datetime | None = None
    deleted_by_user_id: str | None = None
    participants: list[WorkHourAdminParticipantResponse]


class WorkHourTotalsResponse(BaseModel):
    total_groups: int
    total_people: int
    total_duration_hours: float
    total_person_hours: float


class WorkHourListResponse(BaseModel):
    items: list[WorkHourGroupResponse]
    total: int
    page: int
    page_size: int
    sort_key: str
    sort_direction: str
    page_sizes: list[int] = Field(default_factory=lambda: [25, 50, 100])
    totals: WorkHourTotalsResponse


class WorkHourAdminListResponse(WorkHourListResponse):
    items: list[WorkHourAdminGroupResponse]


class WorkHourMetaResponse(BaseModel):
    projects: list["WorkProjectOptionResponse"]
    posts: list["WorkPostOptionResponse"]
    external_people: list["WorkExternalPersonOptionResponse"]
    historical_identities: list["WorkHistoricalDisplayResponse"]
    eligible_users: list[WorkEligibleUserResponse]
    filter_projects: list["WorkProjectOptionResponse"] = Field(default_factory=list)
    filter_posts: list["WorkPostOptionResponse"] = Field(default_factory=list)
    filter_participants: list[str] = Field(default_factory=list)
    filter_dates: list[date] = Field(default_factory=list)
    is_admin: bool


class WorkExternalPersonOptionResponse(BaseModel):
    id: str
    display_name: str
    display_type: Literal["external_person"] = "external_person"
    selectable: bool = True


class WorkProjectOptionResponse(BaseModel):
    id: str
    display_name: str
    display_type: Literal["project"] = "project"
    selectable: bool = True


class WorkPostOptionResponse(BaseModel):
    id: str
    display_name: str
    display_type: Literal["post"] = "post"
    selectable: bool = True


class WorkHistoricalDisplayResponse(BaseModel):
    id: str
    display_name: str
    display_type: Literal["historical_identity"] = "historical_identity"
    selectable: bool = False


class WorkProjectCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    model_config = ConfigDict(extra="forbid")

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Voer tekst in.")
        return value.strip()


class WorkProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    expected_row_version: int | None = Field(default=None, ge=1)
    model_config = ConfigDict(extra="forbid")


class WorkPostCreateRequest(BaseModel):
    project_id: str | None = None
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    model_config = ConfigDict(extra="forbid")

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Voer tekst in.")
        return value.strip()


class WorkPostUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    expected_row_version: int | None = Field(default=None, ge=1)
    model_config = ConfigDict(extra="forbid")


class WorkExternalPersonCreateRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=255)
    note: str = ""
    force_create: bool = False
    model_config = ConfigDict(extra="forbid")

    @field_validator("display_name", "note", mode="before")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Voer tekst in.")
        return value.strip()

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("E-mail moet tekst zijn.")
        normalized = value.strip()
        return normalized or None


class WorkAdminHistoryItemResponse(BaseModel):
    kind: Literal["post", "external_person", "historical_identity"]
    id: str
    display_name: str
    row_version: int
    is_active: bool
    is_archived: bool | None = None
    deleted_at: datetime | None = None
    project_id: str | None = None
    linked_user_id: str | None = None


class WorkAdminHistoryListResponse(BaseModel):
    items: list[WorkAdminHistoryItemResponse]
    total: int
    page: int
    page_size: int


class WorkAdminMasterdataResponse(BaseModel):
    projects: list[WorkProjectResponse]
    posts: list[WorkPostResponse]
    external_people: list[WorkExternalPersonResponse]


class WorkAuditEventResponse(BaseModel):
    id: str
    event_type: str
    actor_user_id: str | None
    details_json: str
    created_at: datetime
    actor_display_name: str
    action: str
    result: str
    request_method: str
    request_path: str
    project_name: str | None = None
    post_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkAuditListResponse(BaseModel):
    items: list[WorkAuditEventResponse]
    total: int
    page: int
    page_size: int
    page_sizes: list[int] = Field(default_factory=lambda: [25, 50, 100])
