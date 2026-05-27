from pydantic import BaseModel, Field, field_validator


class AdminUserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    email: str | None
    is_admin: bool
    is_active: bool


class UpdateAdminUserRequest(BaseModel):
    is_admin: bool
    full_name: str | None = None
    email: str | None = None
    is_active: bool | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_optional_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class UpdateAdminUserPasswordRequest(BaseModel):
    new_password: str = Field(min_length=4, max_length=128)


class UpdateAdminUserActiveRequest(BaseModel):
    is_active: bool


class CreateAdminUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=4, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip()


class AdminThemeResponse(BaseModel):
    id: str
    name: str
    is_active: bool


class CreateAdminThemeRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class UpdateAdminThemeRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def normalize_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class AdminScheduleTemplateResponse(BaseModel):
    id: str
    label: str
    subject_template: str
    theme: str
    editorial_notes: str
    planning_time: str


class AdminActivityResponse(BaseModel):
    id: str
    event_type: str
    topic_id: str | None
    topic_subject: str | None
    actor_user_id: str | None
    actor_username: str
    created_at: str


class AdminUiSettingsResponse(BaseModel):
    wind_theme_enabled: bool


class UpdateAdminUiSettingsRequest(BaseModel):
    wind_theme_enabled: bool
