from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.rate_limit import rate_limit
from app.models.entities import User
from app.schemas.auth import CurrentUserResponse, LoginRequest, TokenResponse
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
    return CurrentUserResponse(id=current.id, username=current.username)
