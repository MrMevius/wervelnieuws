def _login_as(client, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_users_requires_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    response = client.get("/api/admin/users", headers=editor_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


def test_admin_password_change_requires_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    users_response = client.get(
        "/api/admin/users", headers=_login_as(client, "admin", "admin12345")
    )
    assert users_response.status_code == 200
    users = users_response.json()
    target = next(user for user in users if user["username"] == "editor")

    response = client.patch(
        f"/api/admin/users/{target['id']}/password",
        headers=editor_headers,
        json={"new_password": "nieuw5678"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


def test_admin_can_toggle_user_admin_rights(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    editor = next(user for user in users if user["username"] == "editor")
    assert editor["is_admin"] is False

    promote = client.patch(
        f"/api/admin/users/{editor['id']}",
        headers=admin_headers,
        json={"is_admin": True},
    )
    assert promote.status_code == 200
    assert promote.json()["is_admin"] is True

    demote = client.patch(
        f"/api/admin/users/{editor['id']}",
        headers=admin_headers,
        json={"is_admin": False},
    )
    assert demote.status_code == 200
    assert demote.json()["is_admin"] is False


def test_admin_cannot_demote_last_admin(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    admin_user = next(user for user in users if user["username"] == "admin")

    demote = client.patch(
        f"/api/admin/users/{admin_user['id']}",
        headers=admin_headers,
        json={"is_admin": False},
    )

    assert demote.status_code == 400
    assert (
        demote.json()["detail"] == "Cannot remove admin rights from the last admin user"
    )


def test_admin_can_change_user_password(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    editor = next(user for user in users if user["username"] == "editor")

    change = client.patch(
        f"/api/admin/users/{editor['id']}/password",
        headers=admin_headers,
        json={"new_password": "nieuw5678"},
    )
    assert change.status_code == 200
    assert change.json()["status"] == "ok"

    old_login = client.post(
        "/api/auth/login", json={"username": "editor", "password": "editor12345"}
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login", json={"username": "editor", "password": "nieuw5678"}
    )
    assert new_login.status_code == 200


def test_admin_password_change_rejects_short_password(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    editor = next(user for user in users if user["username"] == "editor")

    change = client.patch(
        f"/api/admin/users/{editor['id']}/password",
        headers=admin_headers,
        json={"new_password": "abc"},
    )

    assert change.status_code == 422


def test_admin_can_disable_and_enable_user(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    editor = next(user for user in users if user["username"] == "editor")
    assert editor["is_active"] is True

    disable = client.patch(
        f"/api/admin/users/{editor['id']}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert disable.status_code == 200
    assert disable.json()["is_active"] is False

    blocked_login = client.post(
        "/api/auth/login", json={"username": "editor", "password": "editor12345"}
    )
    assert blocked_login.status_code == 401

    enable = client.patch(
        f"/api/admin/users/{editor['id']}/active",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert enable.status_code == 200
    assert enable.json()["is_active"] is True


def test_admin_cannot_disable_last_admin(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    admin_user = next(user for user in users if user["username"] == "admin")

    disable = client.patch(
        f"/api/admin/users/{admin_user['id']}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert disable.status_code == 400
    assert disable.json()["detail"] == "Cannot disable the last admin user"


def test_admin_can_delete_user(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    editor = next(user for user in users if user["username"] == "editor")

    remove = client.delete(f"/api/admin/users/{editor['id']}", headers=admin_headers)
    assert remove.status_code == 200
    assert remove.json()["status"] == "ok"

    users_after = client.get("/api/admin/users", headers=admin_headers)
    assert users_after.status_code == 200
    assert all(user["id"] != editor["id"] for user in users_after.json())


def test_admin_cannot_delete_last_admin_or_self(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    admin_user = next(user for user in users if user["username"] == "admin")

    remove_last_admin = client.delete(
        f"/api/admin/users/{admin_user['id']}", headers=admin_headers
    )
    assert remove_last_admin.status_code == 400
    assert remove_last_admin.json()["detail"] == "Cannot delete the last admin user"

    editor_user = next(user for user in users if user["username"] == "editor")
    promote = client.patch(
        f"/api/admin/users/{editor_user['id']}",
        headers=admin_headers,
        json={"is_admin": True},
    )
    assert promote.status_code == 200

    remove_self = client.delete(
        f"/api/admin/users/{admin_user['id']}", headers=admin_headers
    )
    assert remove_self.status_code == 400
    assert remove_self.json()["detail"] == "Admin users cannot delete themselves"


def test_admin_active_and_delete_require_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")
    admin_headers = _login_as(client, "admin", "admin12345")
    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    target = next(user for user in users if user["username"] == "editor")

    disable = client.patch(
        f"/api/admin/users/{target['id']}/active",
        headers=editor_headers,
        json={"is_active": False},
    )
    assert disable.status_code == 403
    assert disable.json()["detail"] == "Admin access required"

    remove = client.delete(f"/api/admin/users/{target['id']}", headers=editor_headers)
    assert remove.status_code == 403
    assert remove.json()["detail"] == "Admin access required"


def test_admin_can_create_user(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    response = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": "redacteur", "password": "redacteur123"},
    )
    assert response.status_code == 200
    created = response.json()
    assert created["username"] == "redacteur"
    assert created["is_admin"] is False
    assert created["is_active"] is True

    login = client.post(
        "/api/auth/login",
        json={"username": "redacteur", "password": "redacteur123"},
    )
    assert login.status_code == 200


def test_admin_create_user_rejects_duplicate_username(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    response = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": "editor", "password": "nieuw9876"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Username already exists"


def test_admin_create_user_requires_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    response = client.post(
        "/api/admin/users",
        headers=editor_headers,
        json={"username": "nieuw", "password": "nieuw1234"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
