from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.settings import get_settings
from app.core.security import hash_remember_token
from app.models.entities import RememberSession, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _decode_user_id(token: str) -> str:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    return user_id


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> User:
    settings = get_settings()
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    # Explicit bearer credentials take precedence when both are present.
    # This preserves API client/test intent while keeping cookie auth as
    # primary browser session mechanism when no bearer header is supplied.
    if token:
        user_id = _decode_user_id(token)
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
            )
        return user

    if cookie_token:
        try:
            user_id = _decode_user_id(cookie_token)
            user = db.get(User, user_id)
            if user:
                return user
        except HTTPException:
            pass

    remember_token = request.cookies.get(settings.remember_cookie_name)
    if remember_token:
        session = (
            db.query(RememberSession)
            .filter(RememberSession.token_hash == hash_remember_token(remember_token))
            .first()
        )
        if session and session.revoked_at is None:
            user = db.get(User, session.user_id)
            if user and user.is_active:
                session.last_used_at = datetime.now(UTC)
                db.add(session)
                db.commit()
                return user

    if not token and not cookie_token and not remember_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_admin(current: User = Depends(get_current_user)) -> User:
    if not current.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current
