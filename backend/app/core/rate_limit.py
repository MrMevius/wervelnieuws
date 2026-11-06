from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.settings import get_settings
from app.models.entities import RateLimitEvent

LOGIN_FAILURE_PREFIX = "login-failure:"
LOGIN_ROUTE_PATH = "/api/auth/login"


def _actor_key(request: Request) -> str:
    client_host = request.client.host if request.client else "unknown"
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return f"ip:{client_host}"

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return f"ip:{client_host}"

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return f"ip:{client_host}"

    subject = str(payload.get("sub") or "").strip()
    if not subject:
        return f"ip:{client_host}"
    return f"user:{subject}"


def rate_limit(request: Request, db: Session = Depends(get_db)) -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    window_start = now - timedelta(seconds=settings.rate_limit_window_seconds)
    actor_key = _actor_key(request)
    rate_key = f"{request.url.path}:{actor_key}"

    db.execute(
        delete(RateLimitEvent).where(
            RateLimitEvent.created_at < window_start,
            RateLimitEvent.rate_key.not_like(f"{LOGIN_FAILURE_PREFIX}%"),
        )
    )

    count_stmt = select(func.count()).where(
        RateLimitEvent.rate_key == rate_key,
        RateLimitEvent.created_at >= window_start,
    )
    current_count = int(db.scalar(count_stmt) or 0)
    if current_count >= settings.rate_limit_max_requests:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )

    db.add(
        RateLimitEvent(
            rate_key=rate_key,
            actor_key=actor_key,
            route_path=request.url.path,
            created_at=now,
        )
    )
    db.commit()


# Failed logins are counted per username rather than per client address: behind
# the frontend proxy every request shares the proxy's address, so an
# address-based limit would lock out all users at once.
def _login_failure_key(username: str) -> str:
    return f"{LOGIN_FAILURE_PREFIX}user:{username.strip().lower()[:200]}"


def _login_failure_window_start() -> datetime:
    return datetime.now(UTC) - timedelta(seconds=get_settings().login_failure_window_seconds)


def ensure_login_not_locked(db: Session, username: str) -> None:
    window_start = _login_failure_window_start()
    db.execute(
        delete(RateLimitEvent).where(
            RateLimitEvent.rate_key.like(f"{LOGIN_FAILURE_PREFIX}%"),
            RateLimitEvent.created_at < window_start,
        )
    )
    failures = int(
        db.scalar(
            select(func.count()).where(
                RateLimitEvent.rate_key == _login_failure_key(username),
                RateLimitEvent.created_at >= window_start,
            )
        )
        or 0
    )
    db.commit()
    if failures >= get_settings().login_failure_max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts",
            headers={"Retry-After": str(get_settings().login_failure_window_seconds)},
        )


def record_login_failure(db: Session, username: str) -> None:
    db.add(
        RateLimitEvent(
            rate_key=_login_failure_key(username),
            actor_key="login",
            route_path=LOGIN_ROUTE_PATH,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()


def clear_login_failures(db: Session, username: str) -> None:
    db.execute(delete(RateLimitEvent).where(RateLimitEvent.rate_key == _login_failure_key(username)))
    db.commit()
