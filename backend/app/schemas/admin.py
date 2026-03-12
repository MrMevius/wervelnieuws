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
