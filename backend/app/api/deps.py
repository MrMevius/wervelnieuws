from datetime import UTC, datetime, timedelta
import hmac

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.settings import get_settings
from app.core.security import hash_remember_token, password_fingerprint
from app.models.entities import RememberSession, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _user_from_token(token: str, db: Session) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=["HS256"],
            options={"require_exp": True, "require_sub": True},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    user = db.get(User, user_id)
    fingerprint = payload.get("pwd")
    if (
        not user
        or not user.is_active
        or not isinstance(fingerprint, str)
        or not hmac.compare_digest(fingerprint, password_fingerprint(user.password_hash))
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


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
        return _user_from_token(token, db)

    if cookie_token:
        try:
            return _user_from_token(cookie_token, db)
        except HTTPException:
            pass

    remember_token = request.cookies.get(settings.remember_cookie_name)
    if remember_token:
        session = (
            db.query(RememberSession)
            .filter(RememberSession.token_hash == hash_remember_token(remember_token))
            .first()
        )
        now = datetime.now(UTC)
        # SQLite returns naive datetimes even for timezone-aware columns.
        if (
            session
            and session.revoked_at is None
            and _as_utc(session.created_at) + timedelta(days=settings.remember_cookie_max_age_days) > now
        ):
            user = db.get(User, session.user_id)
            if user and user.is_active:
                last_used_at = _as_utc(session.last_used_at)
                # Avoid a SQLite write on every authenticated GET/image request.
                if now - last_used_at >= timedelta(minutes=5):
                    session.last_used_at = now
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
