import pytest

from app.core.settings import Settings, parse_allowed_origins, validate_runtime_security


def test_parse_allowed_origins_splits_and_trims() -> None:
    origins = parse_allowed_origins(" http://localhost:5173, https://example.org ")
    assert origins == ["http://localhost:5173", "https://example.org"]


def test_parse_allowed_origins_defaults_to_wildcard_on_empty() -> None:
    assert parse_allowed_origins("") == ["*"]


def test_validate_runtime_security_allows_non_production_defaults() -> None:
    settings = Settings(env="development", secret_key="change-me", allowed_origins="*")
    validate_runtime_security(settings)


def test_validate_runtime_security_rejects_unsafe_secret_in_production() -> None:
    settings = Settings(
        env="production",
        secret_key="change-me",
        allowed_origins="https://app.example.org",
    )
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_runtime_security(settings)


def test_validate_runtime_security_rejects_wildcard_origins_in_production() -> None:
    settings = Settings(
        env="production", secret_key="very-strong-secret", allowed_origins="*"
    )
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        validate_runtime_security(settings)
