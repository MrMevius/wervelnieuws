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


def test_admin_can_create_and_update_project(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    create = client.post(
        "/api/admin/projects",
        headers=admin_headers,
        json={"name": "Project Noord"},
    )
    assert create.status_code == 200
    created = create.json()
    assert created["name"] == "Project Noord"
    assert created["is_active"] is True

    update = client.patch(
        f"/api/admin/projects/{created['id']}",
        headers=admin_headers,
        json={"name": "Project Noord A", "is_active": False},
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated["name"] == "Project Noord A"
    assert updated["is_active"] is False


def test_admin_project_endpoints_require_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    list_response = client.get("/api/admin/projects", headers=editor_headers)
    assert list_response.status_code == 403
    assert list_response.json()["detail"] == "Admin access required"

    create_response = client.post(
        "/api/admin/projects",
        headers=editor_headers,
        json={"name": "Ongeoorloofd"},
    )
    assert create_response.status_code == 403
    assert create_response.json()["detail"] == "Admin access required"


def test_admin_can_get_and_update_genai_config(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    initial = client.get("/api/admin/genai-config", headers=admin_headers)
    assert initial.status_code == 200
    initial_payload = initial.json()
    assert "system_prompt" in initial_payload
    assert "website_prompt" in initial_payload
    assert "openai_api_key" not in initial_payload
    assert initial_payload["has_api_key"] in {True, False}

    update = client.patch(
        "/api/admin/genai-config",
        headers=admin_headers,
        json={
            "websearch_enabled": True,
            "websearch_max_results": 4,
            "website_prompt": "Websiteprompt iteratie 9",
            "openai_api_key": "test-secret-key",
        },
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated["websearch_enabled"] is True
    assert updated["websearch_max_results"] == 4
    assert updated["website_prompt"] == "Websiteprompt iteratie 9"
    assert updated["has_api_key"] is True
    assert "openai_api_key" not in updated

    follow_up = client.get("/api/admin/genai-config", headers=admin_headers)
    assert follow_up.status_code == 200
    follow_up_payload = follow_up.json()
    assert follow_up_payload["websearch_enabled"] is True
    assert follow_up_payload["websearch_max_results"] == 4
    assert follow_up_payload["has_api_key"] is True


def test_genai_config_endpoints_require_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    get_response = client.get("/api/admin/genai-config", headers=editor_headers)
    assert get_response.status_code == 403
    assert get_response.json()["detail"] == "Admin access required"

    patch_response = client.patch(
        "/api/admin/genai-config",
        headers=editor_headers,
        json={"websearch_enabled": True},
    )
    assert patch_response.status_code == 403
    assert patch_response.json()["detail"] == "Admin access required"


def test_admin_can_get_genai_model_options(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    response = client.get("/api/admin/genai-model-options", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert "text_models" in payload
    assert "image_models" in payload
    assert "gpt-4.1-mini" in payload["text_models"]
    assert "gpt-image-1" in payload["image_models"]


def test_genai_model_options_endpoint_requires_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    response = client.get("/api/admin/genai-model-options", headers=editor_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


def test_admin_can_get_and_update_ui_settings(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    initial = client.get("/api/admin/ui-settings", headers=admin_headers)
    assert initial.status_code == 200
    assert "wind_theme_enabled" in initial.json()

    updated = client.patch(
        "/api/admin/ui-settings",
        headers=admin_headers,
        json={"wind_theme_enabled": False},
    )
    assert updated.status_code == 200
    assert updated.json()["wind_theme_enabled"] is False

    follow_up = client.get("/api/admin/ui-settings", headers=admin_headers)
    assert follow_up.status_code == 200
    assert follow_up.json()["wind_theme_enabled"] is False


def test_admin_ui_settings_endpoints_require_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    get_response = client.get("/api/admin/ui-settings", headers=editor_headers)
    assert get_response.status_code == 403
    assert get_response.json()["detail"] == "Admin access required"

    patch_response = client.patch(
        "/api/admin/ui-settings",
        headers=editor_headers,
        json={"wind_theme_enabled": False},
    )
    assert patch_response.status_code == 403
    assert patch_response.json()["detail"] == "Admin access required"


def test_admin_can_manage_themes(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    listing = client.get("/api/admin/themes", headers=admin_headers)
    assert listing.status_code == 200
    assert any(item["name"] == "Planning" for item in listing.json())

    create = client.post(
        "/api/admin/themes",
        headers=admin_headers,
        json={"name": "Communicatie"},
    )
    assert create.status_code == 200
    created = create.json()
    assert created["name"] == "Communicatie"
    assert created["is_active"] is True

    rename = client.patch(
        f"/api/admin/themes/{created['id']}",
        headers=admin_headers,
        json={"name": "Communicatie extern", "is_active": False},
    )
    assert rename.status_code == 200
    updated = rename.json()
    assert updated["name"] == "Communicatie extern"
    assert updated["is_active"] is False


def test_admin_theme_endpoints_require_admin_role(client):
    editor_headers = _login_as(client, "editor", "editor12345")

    response = client.get("/api/admin/themes", headers=editor_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


def test_admin_can_view_schedule_templates_and_activity(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    templates = client.get("/api/admin/schedule-templates", headers=admin_headers)
    assert templates.status_code == 200
    assert len(templates.json()) >= 3

    activity = client.get("/api/admin/activity", headers=admin_headers)
    assert activity.status_code == 200
    payload = activity.json()
    assert isinstance(payload, list)
    if payload:
        assert "topic_subject" in payload[0]
