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
