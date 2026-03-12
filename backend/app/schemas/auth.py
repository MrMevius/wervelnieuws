import re

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ThemePreference


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=4, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CurrentUserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    email: str | None
    theme_preference: ThemePreference
    has_avatar: bool


class UpdateCurrentUserRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, max_length=255)
    theme_preference: ThemePreference | None = None

    @staticmethod
    def _normalize_optional(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized if normalized else None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        return cls._normalize_optional(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        normalized = cls._normalize_optional(value)
        if normalized is None:
            return None
        lowered = normalized.lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", lowered):
            raise ValueError("Invalid email format")
        return lowered


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=4, max_length=128)
    new_password: str = Field(min_length=4, max_length=128)
