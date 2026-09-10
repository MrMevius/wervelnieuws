import pytest

from app.core.settings import get_settings


def _sign_in(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin12345"})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.parametrize("headers", [
    {"Origin": "https://untrusted.example"},
    {"Origin": "null"},
    {"Origin": "https://testserver.attacker.example"},
    {"Referer": "https://untrusted.example/page"},
    {"Sec-Fetch-Site": "cross-site"},
])
def test_cookie_authenticated_write_rejects_untrusted_origin(client, headers):
    _sign_in(client)
    response = client.patch("/api/auth/me", headers=headers, json={"full_name": "Unwanted change"})
    assert response.status_code == 403
    assert client.get("/api/auth/me").json()["full_name"] is None


def test_login_rejects_cross_site_origin_without_a_session(client):
    response = client.post("/api/auth/login", headers={"Origin": "https://untrusted.example"}, json={
        "username": "admin", "password": "admin12345",
    })
    assert response.status_code == 403
    assert not response.cookies


@pytest.mark.parametrize("origin", ["https://testserver", "https://app.example.org"])
def test_cookie_authenticated_write_accepts_trusted_origin(client, monkeypatch, origin):
    monkeypatch.setattr(get_settings(), "allowed_origins", "https://app.example.org")
    _sign_in(client)
    assert client.patch("/api/auth/me", headers={"Origin": origin}, json={"full_name": "Changed"}).status_code == 200


def test_production_does_not_trust_host_header_as_origin(client, monkeypatch):
    _sign_in(client)
    monkeypatch.setattr(get_settings(), "env", "production")
    monkeypatch.setattr(get_settings(), "allowed_origins", "https://app.example.org")
    response = client.patch("/api/auth/me", headers={"Origin": "https://testserver"}, json={"full_name": "Changed"})
    assert response.status_code == 403


def test_explicit_bearer_client_does_not_require_cookie_csrf_protection(client):
    token = _sign_in(client)
    client.cookies.clear()
    response = client.patch("/api/auth/me", headers={"Authorization": f"Bearer {token}"}, json={"full_name": "API client"})
    assert response.status_code == 200


def test_private_responses_cannot_be_cached_or_mime_sniffed(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    _sign_in(client)
    response = client.get("/api/auth/me")
    assert response.headers["cache-control"] == "no-store"
