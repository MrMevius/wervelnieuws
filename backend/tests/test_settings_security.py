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
        env="production", secret_key="test-only-secret-with-at-least-32-characters", allowed_origins="*"
    )
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        validate_runtime_security(settings)


def test_validate_runtime_security_rejects_insecure_cookie_in_production() -> None:
    settings = Settings(
        env="production",
        secret_key="test-only-secret-with-at-least-32-characters",
        allowed_origins="https://app.example.org",
        auth_cookie_secure=False,
    )
    with pytest.raises(RuntimeError, match="AUTH_COOKIE_SECURE"):
        validate_runtime_security(settings)


@pytest.mark.parametrize("env", ["production", "prod", " PRODUCTION "])
def test_short_production_secret_is_rejected(env):
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_runtime_security(Settings(env=env, secret_key="not-long-enough"))


@pytest.mark.parametrize("origin", ["http://app.example.org", "https://app.example.org/api", "https://user:pass@app.example.org", "null"])
def test_production_requires_explicit_https_origins(origin):
    settings = Settings(env="production", secret_key="test-only-secret-with-at-least-32-characters", allowed_origins=origin, auth_cookie_secure=True)
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        validate_runtime_security(settings)


def test_valid_production_security_settings_are_accepted():
    validate_runtime_security(Settings(env="production", secret_key="test-only-secret-with-at-least-32-characters", allowed_origins="https://app.example.org", auth_cookie_secure=True))


@pytest.mark.parametrize("setting", ["auth_cookie_ttl_days", "remember_cookie_max_age_days", "access_token_expire_minutes"])
def test_session_ttl_must_be_positive(setting):
    with pytest.raises(ValueError):
        Settings(**{setting: 0})
