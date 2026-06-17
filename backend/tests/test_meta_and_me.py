import re
import time
from io import BytesIO

from jose import jwt
from sqlalchemy import text

from app.core.security import hash_remember_token
from app.models.entities import RememberSession


PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc`\x00\x02\x00\x00\x05\x00\x01"
    b"\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _test_db(client):
    override = next(iter(client.app.dependency_overrides.values()))  # type: ignore[attr-defined]
    generator = override()
    db = next(generator)
    try:
        yield db
    finally:
        generator.close()


def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _login_as(client, username: str, password: str):
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auth_me_returns_current_user(client):
    headers = _login(client)

    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "admin"
    assert payload["id"]
    assert payload["full_name"] is None
    assert payload["email"] is None
    assert payload["is_admin"] is True
    assert payload["theme_preference"] == "system"
    assert payload["has_avatar"] is False


def test_login_sets_http_only_cookie_with_expected_ttl(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert response.status_code == 200
    set_cookie = response.headers.get("set-cookie", "")
    assert "wervel_session=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Max-Age=2592000" in set_cookie


def test_remembered_login_sets_secure_cookie_and_stores_only_hash(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )

    assert response.status_code == 200
    set_cookies = response.headers.get_list("set-cookie")
    remember_cookie = next(cookie for cookie in set_cookies if cookie.startswith("wervel_remember="))
    assert "HttpOnly" in remember_cookie
    assert "Secure" in remember_cookie
    assert "SameSite=lax" in remember_cookie
    remember_token = client.cookies.get("wervel_remember")
    assert remember_token is not None
    assert len(remember_token) >= 64

    db_generator = _test_db(client)
    db = next(db_generator)
    try:
        sessions = db.query(RememberSession).all()
        assert len(sessions) == 1
        assert sessions[0].token_hash == hash_remember_token(remember_token)
        assert sessions[0].token_hash != remember_token
        assert sessions[0].revoked_at is None
    finally:
        db_generator.close()


def test_remembered_login_persistence_failure_falls_back_to_normal_session(
    client, caplog, monkeypatch
):
    sensitive_remember_token = "SENSITIVE_REMEMBER_TOKEN_SHOULD_NOT_APPEAR_IN_LOGS"
    monkeypatch.setattr(
        "app.api.auth.create_remember_token", lambda: sensitive_remember_token
    )

    db_generator = _test_db(client)
    db = next(db_generator)
    try:
        db.execute(text("DROP TABLE remember_sessions"))
        db.commit()
    finally:
        db_generator.close()

    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    set_cookies = response.headers.get_list("set-cookie")
    assert any(cookie.startswith("wervel_session=") for cookie in set_cookies)
    assert not any(cookie.startswith("wervel_remember=") for cookie in set_cookies)
    assert client.cookies.get("wervel_remember") is None

    log_output = "\n".join(record.getMessage() for record in caplog.records)
    assert "Remember-session persistence failed during login" in log_output
    assert "migration 20260609_0022" in log_output
    assert "remember_sessions" in log_output
    assert sensitive_remember_token not in caplog.text
    assert hash_remember_token(sensitive_remember_token) not in caplog.text
    assert "admin12345" not in caplog.text


def test_login_token_expiry_aligns_with_cookie_ttl_by_default(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert response.status_code == 200

    token = response.json()["access_token"]
    claims = jwt.get_unverified_claims(token)

    set_cookie = response.headers.get("set-cookie", "")
    match = re.search(r"Max-Age=(\d+)", set_cookie)
    assert match is not None
    cookie_ttl_seconds = int(match.group(1))

    token_ttl_seconds = int(claims["exp"] - time.time())
    assert cookie_ttl_seconds - 120 <= token_ttl_seconds <= cookie_ttl_seconds + 120


def test_auth_me_accepts_cookie_without_bearer_header(client):
    login = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert login.status_code == 200

    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_auth_me_accepts_remember_cookie_without_access_cookie(client):
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )
    assert login.status_code == 200
    remember_token = client.cookies.get("wervel_remember")
    assert remember_token
    client.cookies.clear()

    response = client.get(
        "/api/auth/me", headers={"Cookie": f"wervel_remember={remember_token}"}
    )

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_protected_endpoint_accepts_remember_cookie(client):
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )
    assert login.status_code == 200
    remember_token = client.cookies.get("wervel_remember")
    client.cookies.clear()

    response = client.get(
        "/api/meta/about", headers={"Cookie": f"wervel_remember={remember_token}"}
    )

    assert response.status_code == 200
    assert response.json()["changelog"]


def test_auth_me_keeps_bearer_fallback_when_cookie_missing(client):
    login = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    client.cookies.clear()

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_auth_me_prefers_explicit_bearer_when_cookie_also_present(client):
    admin_login = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert admin_login.status_code == 200

    editor_login = client.post(
        "/api/auth/login", json={"username": "editor", "password": "editor12345"}
    )
    assert editor_login.status_code == 200
    editor_token = editor_login.json()["access_token"]

    response = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {editor_token}"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "editor"
    assert response.json()["is_admin"] is False


def test_logout_clears_cookie_and_auth_me_becomes_unauthenticated(client):
    login = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert login.status_code == 200

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert logout.json()["status"] == "ok"
    set_cookie = logout.headers.get("set-cookie", "")
    assert "wervel_session=" in set_cookie
    assert "Max-Age=0" in set_cookie

    me = client.get("/api/auth/me")
    assert me.status_code == 401


def test_logout_revokes_current_remember_session_and_rejects_replay(client):
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )
    assert login.status_code == 200
    remember_token = client.cookies.get("wervel_remember")

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    set_cookies = logout.headers.get_list("set-cookie")
    assert any(cookie.startswith("wervel_remember=") and "Max-Age=0" in cookie for cookie in set_cookies)

    client.cookies.clear()
    replay = client.get(
        "/api/auth/me", headers={"Cookie": f"wervel_remember={remember_token}"}
    )
    assert replay.status_code == 401

    db_generator = _test_db(client)
    db = next(db_generator)
    try:
        session = db.query(RememberSession).filter_by(token_hash=hash_remember_token(remember_token)).one()
        assert session.revoked_at is not None
    finally:
        db_generator.close()


def test_logout_keeps_second_device_remember_session_active(client):
    first = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )
    assert first.status_code == 200
    first_token = client.cookies.get("wervel_remember")
    client.cookies.clear()

    second = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin12345", "remember_me": True},
    )
    assert second.status_code == 200
    second_token = client.cookies.get("wervel_remember")
    assert first_token != second_token

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200

    client.cookies.clear()
    still_active = client.get(
        "/api/auth/me", headers={"Cookie": f"wervel_remember={first_token}"}
    )
    assert still_active.status_code == 200
    assert still_active.json()["username"] == "admin"

    revoked = client.get(
        "/api/auth/me", headers={"Cookie": f"wervel_remember={second_token}"}
    )
    assert revoked.status_code == 401


def test_auth_me_for_non_admin_returns_is_admin_false(client):
    headers = _login_as(client, "editor", "editor12345")

    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "editor"
    assert payload["is_admin"] is False


def test_auth_me_can_be_updated(client):
    headers = _login(client)

    response = client.patch(
        "/api/auth/me",
        headers=headers,
        json={
            "full_name": "Beheerder Test",
            "email": "admin@example.com",
            "theme_preference": "dark",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["full_name"] == "Beheerder Test"
    assert payload["email"] == "admin@example.com"
    assert payload["theme_preference"] == "dark"
    assert payload["has_avatar"] is False


def test_auth_me_rejects_invalid_email(client):
    headers = _login(client)

    response = client.patch(
        "/api/auth/me",
        headers=headers,
        json={"email": "geen-email", "theme_preference": "light"},
    )
    assert response.status_code == 422


def test_auth_me_rejects_duplicate_email(client):
    headers = _login(client)

    response = client.patch(
        "/api/auth/me",
        headers=headers,
        json={"email": "editor@example.com", "theme_preference": "light"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Email already in use"


def test_about_returns_read_only_payload(client):
    headers = _login(client)

    response = client.get("/api/meta/about", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["developed_by"] == "Energiek Daarle"
    assert payload["description"]
    assert payload["disclaimer"]
    assert len(payload["changelog"]) >= 1
    assert payload["changelog"][0]["title"] == "Bijlagen direct toevoegen bij nieuwe vergaderbord-kaarten"


def test_meta_ui_settings_returns_global_wind_theme_state(client):
    headers = _login(client)

    response = client.get("/api/meta/ui-settings", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert "wind_theme_enabled" in payload
    assert payload["wind_theme_enabled"] in {True, False}


def test_auth_me_can_change_password(client):
    headers = _login(client)

    response = client.patch(
        "/api/auth/me/password",
        headers=headers,
        json={
            "current_password": "admin12345",
            "new_password": "nieuw1234",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    relogin = client.post(
        "/api/auth/login", json={"username": "admin", "password": "nieuw1234"}
    )
    assert relogin.status_code == 200


def test_auth_me_rejects_wrong_current_password(client):
    headers = _login(client)

    response = client.patch(
        "/api/auth/me/password",
        headers=headers,
        json={
            "current_password": "fout1234",
            "new_password": "nieuw1234",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_auth_me_avatar_upload_and_fetch(client):
    headers = _login(client)

    upload = client.post(
        "/api/auth/me/avatar",
        headers=headers,
        files={"file": ("avatar.png", BytesIO(PNG_1X1), "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["has_avatar"] is True

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["has_avatar"] is True

    image = client.get("/api/auth/me/avatar", headers=headers)
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")


def test_auth_me_avatar_upload_rejects_non_png(client):
    headers = _login(client)

    upload = client.post(
        "/api/auth/me/avatar",
        headers=headers,
        files={"file": ("avatar.txt", BytesIO(b"not-an-image"), "text/plain")},
    )
    assert upload.status_code == 400
    assert upload.json()["detail"] == "Avatar must be a PNG image"


def test_auth_me_avatar_fetch_without_avatar_returns_404(client):
    headers = _login(client)

    image = client.get("/api/auth/me/avatar", headers=headers)
    assert image.status_code == 404
    assert image.json()["detail"] == "Avatar not found"
