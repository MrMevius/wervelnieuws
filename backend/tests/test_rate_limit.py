import time

from app.core.settings import get_settings


def test_login_rate_limit_returns_429_after_threshold(client):
    settings = get_settings()
    original_max = settings.rate_limit_max_requests
    original_window = settings.rate_limit_window_seconds
    settings.rate_limit_max_requests = 2
    settings.rate_limit_window_seconds = 60
    try:
        payload = {"username": "admin", "password": "admin12345"}
        first = client.post("/api/auth/login", json=payload)
        second = client.post("/api/auth/login", json=payload)
        third = client.post("/api/auth/login", json=payload)

        assert first.status_code == 200
        assert second.status_code == 200
        assert third.status_code == 429
        assert third.json()["detail"] == "Rate limit exceeded"
    finally:
        settings.rate_limit_max_requests = original_max
        settings.rate_limit_window_seconds = original_window


def test_login_rate_limit_resets_after_window(client):
    settings = get_settings()
    original_max = settings.rate_limit_max_requests
    original_window = settings.rate_limit_window_seconds
    settings.rate_limit_max_requests = 1
    settings.rate_limit_window_seconds = 1
    try:
        payload = {"username": "admin", "password": "admin12345"}
        first = client.post("/api/auth/login", json=payload)
        assert first.status_code == 200

        second = client.post("/api/auth/login", json=payload)
        assert second.status_code == 429

        time.sleep(1.1)
        third = client.post("/api/auth/login", json=payload)
        assert third.status_code == 200
    finally:
        settings.rate_limit_max_requests = original_max
        settings.rate_limit_window_seconds = original_window


def test_failed_logins_lock_only_that_username(client):
    settings = get_settings()
    original_max = settings.login_failure_max_attempts
    settings.login_failure_max_attempts = 3
    try:
        wrong = {"username": "admin", "password": "wrong-password"}
        for _ in range(3):
            assert client.post("/api/auth/login", json=wrong).status_code == 401

        locked = client.post("/api/auth/login", json={"username": "admin", "password": "admin12345"})
        assert locked.status_code == 429
        assert locked.json()["detail"] == "Too many failed login attempts"
        assert locked.headers["retry-after"] == str(settings.login_failure_window_seconds)

        # Usernames are matched case-insensitively, other usernames are unaffected.
        assert client.post("/api/auth/login", json={"username": "ADMIN", "password": "wrong-password"}).status_code == 429
        assert client.post("/api/auth/login", json={"username": "someone", "password": "wrong-password"}).status_code == 401
    finally:
        settings.login_failure_max_attempts = original_max


def test_successful_login_clears_failed_attempts(client):
    settings = get_settings()
    original_max = settings.login_failure_max_attempts
    settings.login_failure_max_attempts = 3
    try:
        wrong = {"username": "admin", "password": "wrong-password"}
        right = {"username": "admin", "password": "admin12345"}
        for _ in range(2):
            assert client.post("/api/auth/login", json=wrong).status_code == 401
        assert client.post("/api/auth/login", json=right).status_code == 200
        for _ in range(2):
            assert client.post("/api/auth/login", json=wrong).status_code == 401
        assert client.post("/api/auth/login", json=right).status_code == 200
    finally:
        settings.login_failure_max_attempts = original_max


def test_failed_login_lock_expires_after_window(client):
    settings = get_settings()
    original_max = settings.login_failure_max_attempts
    original_window = settings.login_failure_window_seconds
    settings.login_failure_max_attempts = 1
    settings.login_failure_window_seconds = 1
    try:
        assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"}).status_code == 401
        assert client.post("/api/auth/login", json={"username": "admin", "password": "admin12345"}).status_code == 429
        time.sleep(1.1)
        assert client.post("/api/auth/login", json={"username": "admin", "password": "admin12345"}).status_code == 200
    finally:
        settings.login_failure_max_attempts = original_max
        settings.login_failure_window_seconds = original_window
