from pydantic import BaseModel, Field


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
