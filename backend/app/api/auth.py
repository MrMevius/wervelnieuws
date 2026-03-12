from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.rate_limit import rate_limit
from app.models.entities import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
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
    )
