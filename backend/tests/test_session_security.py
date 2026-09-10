from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.db import get_db
from app.core.settings import get_settings
from app.models.entities import RememberSession, User


@contextmanager
def session_db(client):
    generator = client.app.dependency_overrides[get_db]()
    try:
        yield next(generator)
    finally:
        generator.close()


def login(client, username="editor", remember=True):
    response = client.post("/api/auth/login", json={
        "username": username, "password": f"{username}12345", "remember_me": remember,
    })
    assert response.status_code == 200
    credentials = {
        "bearer": {"Authorization": f"Bearer {response.json()['access_token']}"},
        "cookie": {"Cookie": f"wervel_session={client.cookies.get('wervel_session')}"},
        "remember": {"Cookie": f"wervel_remember={client.cookies.get('wervel_remember')}"},
    }
    client.cookies.clear()
    return credentials


@pytest.mark.parametrize("credential", ["bearer", "cookie", "remember"])
def test_disabled_account_cannot_reuse_existing_session(client, credential):
    credentials = login(client)
    with session_db(client) as db:
        user = db.scalar(select(User).where(User.username == "editor"))
        user.is_active = False
        db.commit()
    assert client.get("/api/auth/me", headers=credentials[credential]).status_code == 401


def test_remember_session_expires_server_side_even_if_cookie_is_replayed(client):
    credentials = login(client)
    with session_db(client) as db:
        session = db.scalar(select(RememberSession))
        session.created_at = datetime.now(UTC) - timedelta(days=get_settings().remember_cookie_max_age_days, seconds=1)
        session.last_used_at = datetime.now(UTC)
        db.commit()
    assert client.get("/api/auth/me", headers=credentials["remember"]).status_code == 401


@pytest.mark.parametrize("credential", ["bearer", "cookie", "remember"])
@pytest.mark.parametrize("reset_by_admin", [False, True])
def test_password_change_revokes_previous_credentials(client, credential, reset_by_admin):
    credentials = login(client)
    with session_db(client) as db:
        user_id = db.scalar(select(User.id).where(User.username == "editor"))
    if reset_by_admin:
        admin = login(client, username="admin")
        response = client.patch(f"/api/admin/users/{user_id}/password", headers=admin["bearer"], json={"new_password": "changed-password-123"})
    else:
        response = client.patch("/api/auth/me/password", headers=credentials["cookie"], json={
            "current_password": "editor12345", "new_password": "changed-password-123",
        })
        # Changing your own password keeps this browser signed in with a new cookie.
        assert client.get("/api/auth/me").status_code == 200
    assert response.status_code == 200
    client.cookies.clear()
    assert client.get("/api/auth/me", headers=credentials[credential]).status_code == 401
    assert client.post("/api/auth/login", json={"username": "editor", "password": "changed-password-123"}).status_code == 200


@pytest.mark.parametrize("remember_new_login", [False, True])
def test_switching_accounts_revokes_old_remember_cookie(client, remember_new_login):
    credentials = login(client)
    response = client.post("/api/auth/login", headers=credentials["remember"], json={
        "username": "admin", "password": "admin12345", "remember_me": remember_new_login,
    })
    assert response.status_code == 200
    assert client.get("/api/auth/me").json()["username"] == "admin"
    client.cookies.clear()
    assert client.get("/api/auth/me", headers=credentials["remember"]).status_code == 401


def test_validation_error_does_not_echo_password_input(client):
    password = "secret-value-" * 20
    response = client.post("/api/auth/login", json={"username": "admin", "password": password})
    assert response.status_code == 422
    assert password not in response.text
    assert all("input" not in error and "ctx" not in error for error in response.json()["detail"])
