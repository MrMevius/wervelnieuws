from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.rate_limit import rate_limit
from app.core.settings import get_settings
from app.core.security import hash_password, verify_password
from app.models.entities import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    TokenResponse,
    UpdateCurrentUserRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit)])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token = AuthService(db).login(payload.username, payload.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=CurrentUserResponse)
def me(current: User = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current.id,
        username=current.username,
        full_name=current.full_name,
        email=current.email,
        theme_preference=current.theme_preference,
        has_avatar=bool(current.avatar_path),
    )


@router.patch("/me", response_model=CurrentUserResponse)
def update_me(
    payload: UpdateCurrentUserRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> CurrentUserResponse:
    user_repo = UserRepository(db)
    if payload.email:
        user_with_email = user_repo.get_by_email(payload.email)
        if user_with_email and user_with_email.id != current.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )

    updated = user_repo.update_current_user(
        current,
        full_name=payload.full_name,
        email=payload.email,
        theme_preference=payload.theme_preference or current.theme_preference,
    )
    return CurrentUserResponse(
        id=updated.id,
        username=updated.username,
        full_name=updated.full_name,
        email=updated.email,
        theme_preference=updated.theme_preference,
        has_avatar=bool(updated.avatar_path),
    )


@router.post("/me/avatar", response_model=CurrentUserResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> CurrentUserResponse:
    settings = get_settings()
    content = await file.read(settings.avatar_max_bytes + 1)
    if len(content) > settings.avatar_max_bytes:
        raise HTTPException(status_code=400, detail="Avatar file too large")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty upload is not allowed")
    if file.content_type != "image/png":
        raise HTTPException(
            status_code=400,
            detail="Avatar must be a PNG image",
        )

    avatars_dir = settings.storage_root / settings.uploads_dir / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    avatar_path = avatars_dir / f"{current.id}.png"
    avatar_path.write_bytes(content)

    current.avatar_path = str(avatar_path)
    db.add(current)
    db.commit()
    db.refresh(current)

    return CurrentUserResponse(
        id=current.id,
        username=current.username,
        full_name=current.full_name,
        email=current.email,
        theme_preference=current.theme_preference,
        has_avatar=True,
    )


@router.get("/me/avatar")
def get_my_avatar(current: User = Depends(get_current_user)) -> FileResponse:
    if not current.avatar_path:
        raise HTTPException(status_code=404, detail="Avatar not found")
    avatar = Path(current.avatar_path)
    if not avatar.exists() or not avatar.is_file():
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(path=avatar, media_type="image/png")


@router.patch("/me/password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict[str, str]:
    if not verify_password(payload.current_password, current.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user_repo = UserRepository(db)
    user_repo.update_password(current, hash_password(payload.new_password))
    return {"status": "ok"}
