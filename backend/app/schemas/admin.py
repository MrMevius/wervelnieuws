from pydantic import BaseModel


class AdminUserResponse(BaseModel):
    id: str
    username: str
    full_name: str | None
    email: str | None
    is_admin: bool
    is_active: bool


class UpdateAdminUserRequest(BaseModel):
    is_admin: bool
