import re

from pydantic import BaseModel, Field, field_validator


class AdminUserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    email: str | None
    is_admin: bool
    is_active: bool
    has_avatar: bool = False


class UpdateAdminUserRequest(BaseModel):
    is_admin: bool | None = None
    full_name: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_optional_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_optional_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        lowered = normalized.lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", lowered):
            raise ValueError("Invalid email format")
        return lowered


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
