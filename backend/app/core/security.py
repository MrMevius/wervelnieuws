from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets

from jose import jwt
from passlib.context import CryptContext

from app.core.settings import get_settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def password_fingerprint(password_hash: str) -> str:
    """Bind signed sessions to a password without exposing its stored hash."""
    return hmac.new(
        get_settings().secret_key.encode("utf-8"),
        f"access-password:{password_hash}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_access_token(subject: str, password_hash: str) -> str:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {"sub": subject, "exp": expires, "pwd": password_fingerprint(password_hash)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_remember_token() -> str:
    return secrets.token_urlsafe(64)


def hash_remember_token(token: str) -> str:
    settings = get_settings()
    return hmac.new(
        settings.secret_key.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
