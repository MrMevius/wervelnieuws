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
