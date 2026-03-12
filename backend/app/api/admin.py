from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.db import get_db
from app.core.security import hash_password
from app.models.entities import User
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    AdminUserResponse,
    CreateAdminUserRequest,
    UpdateAdminUserActiveRequest,
    UpdateAdminUserPasswordRequest,
    UpdateAdminUserRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=AdminUserResponse)
def create_user(
    payload: CreateAdminUserRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    del current
    user_repo = UserRepository(db)
    existing = user_repo.get_by_username(payload.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    created = user_repo.create(
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    return AdminUserResponse(
        id=created.id,
        username=created.username,
        full_name=created.full_name,
        email=created.email,
        is_admin=created.is_admin,
        is_active=created.is_active,
    )


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    del current
    users = UserRepository(db).list_users()
    return [
        AdminUserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_admin=user.is_admin,
            is_active=user.is_active,
        )
        for user in users
    ]


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user_admin_status(
    user_id: str,
    payload: UpdateAdminUserRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    del current
    user_repo = UserRepository(db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.is_admin and not payload.is_admin and user_repo.count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove admin rights from the last admin user",
        )

    updated = user_repo.update_admin_status(user, is_admin=payload.is_admin)
    return AdminUserResponse(
        id=updated.id,
        username=updated.username,
        full_name=updated.full_name,
        email=updated.email,
        is_admin=updated.is_admin,
        is_active=updated.is_active,
    )


@router.patch("/users/{user_id}/active", response_model=AdminUserResponse)
def update_user_active_status(
    user_id: str,
    payload: UpdateAdminUserActiveRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    user_repo = UserRepository(db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_admin and not payload.is_active and user_repo.count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable the last admin user",
        )

    updated = user_repo.update_active_status(user, is_active=payload.is_active)
    return AdminUserResponse(
        id=updated.id,
        username=updated.username,
        full_name=updated.full_name,
        email=updated.email,
        is_admin=updated.is_admin,
        is_active=updated.is_active,
    )


@router.patch("/users/{user_id}/password")
def update_user_password(
    user_id: str,
    payload: UpdateAdminUserPasswordRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    del current
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    UserRepository(db).update_password(user, hash_password(payload.new_password))
    return {"status": "ok"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user_repo = UserRepository(db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_admin and user_repo.count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last admin user",
        )
    if current.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin users cannot delete themselves",
        )

    user_repo.delete_user(user)
    return {"status": "ok"}
