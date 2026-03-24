from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


MIN_DATABASE_UPLOAD_BYTES = 100 * 1024 * 1024


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Wervelnieuws API"
    env: str = "development"
    secret_key: str = Field(default="change-me", min_length=8)
    access_token_expire_minutes: int = 60 * 12

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    allowed_origins: str = "*"

    database_url: str = "sqlite:///./data/app.db"

    storage_root: Path = Path("/data")
    uploads_dir: str = "uploads"
    generated_dir: str = "generated"
    exports_dir: str = "exports"

    openai_api_key: str = ""
    openai_model_text: str = "gpt-4.1-mini"
    openai_model_image: str = "gpt-image-1"

    website_publish_url: str = ""
    website_publish_token: str = ""

    facebook_page_id: str = ""
    facebook_access_token: str = ""

    mailgun_api_key: str = ""
    mailgun_domain: str = ""
    mailgun_list_address: str = ""

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    n8n_webhook_url: str = ""
    n8n_reject_webhook_url: str = ""
    n8n_webhook_timeout_seconds: int = 10

    scheduler_poll_seconds: int = 30
    worker_lease_seconds: int = 90
    max_retry_attempts: int = 5
    upload_max_bytes: int = MIN_DATABASE_UPLOAD_BYTES
    avatar_max_bytes: int = 5 * 1024 * 1024
    rate_limit_window_seconds: int = 60
    rate_limit_max_requests: int = 120

    @field_validator("upload_max_bytes", mode="before")
    @classmethod
    def ensure_upload_limit(cls, value: int | str) -> int:
        parsed = int(value)
        if parsed < MIN_DATABASE_UPLOAD_BYTES:
            return MIN_DATABASE_UPLOAD_BYTES
        return parsed


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    (settings.storage_root / settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    (settings.storage_root / settings.generated_dir).mkdir(parents=True, exist_ok=True)
    (settings.storage_root / settings.exports_dir).mkdir(parents=True, exist_ok=True)
    return settings


def parse_allowed_origins(raw: str) -> list[str]:
    values = [item.strip() for item in raw.split(",") if item.strip()]
    if not values:
        return ["*"]
    return values


def validate_runtime_security(settings: Settings) -> None:
    env = settings.env.lower().strip()
    if env != "production":
        return

    insecure_secret_values = {"", "change-me", "change-this-secret-key"}
    if settings.secret_key.strip() in insecure_secret_values:
        raise RuntimeError(
            "Unsafe SECRET_KEY for production. Set a strong, unique SECRET_KEY."
        )

    origins = parse_allowed_origins(settings.allowed_origins)
    if "*" in origins:
        raise RuntimeError(
            "Unsafe ALLOWED_ORIGINS for production. Use explicit origins only."
        )
