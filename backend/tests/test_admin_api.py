from io import BytesIO


PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05"
    b"\xfe\x02\xfeA\xe2!\xbc\x00\x00\x00\x00IEND\xaeB`\x82"
)
JPEG_MINIMAL = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00\x01\x00\x01\x00\x00\xff\xd9"


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


def test_admin_users_expose_and_fetch_stored_avatar(client):
    editor_headers = _login_as(client, "editor", "editor12345")
    upload = client.post(
        "/api/auth/me/avatar",
        headers=editor_headers,
        files={"file": ("avatar.png", BytesIO(PNG_1X1), "image/png")},
    )
    assert upload.status_code == 200

    admin_headers = _login_as(client, "admin", "admin12345")
    users_response = client.get("/api/admin/users", headers=admin_headers)

    assert users_response.status_code == 200
    editor = next(user for user in users_response.json() if user["username"] == "editor")
    assert editor["has_avatar"] is True

    image = client.get(f"/api/admin/users/{editor['id']}/avatar", headers=admin_headers)
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")


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


def test_admin_can_update_user_profile_and_avatar(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    editor = next(user for user in users_response.json() if user["username"] == "editor")

    update = client.patch(
        f"/api/admin/users/{editor['id']}",
        headers=admin_headers,
        json={"full_name": "Nieuwe Editor", "email": "NIEUW@example.com"},
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated["full_name"] == "Nieuwe Editor"
    assert updated["email"] == "nieuw@example.com"
    assert updated["is_admin"] is False

    upload = client.post(
        f"/api/admin/users/{editor['id']}/avatar",
        headers=admin_headers,
        files={"file": ("avatar.png", BytesIO(PNG_1X1), "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["has_avatar"] is True


def test_admin_user_profile_rejects_invalid_or_duplicate_email_and_avatar(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    editor = next(user for user in users if user["username"] == "editor")
    admin_user = next(user for user in users if user["username"] == "admin")
    admin_email = "admin-duplicate@example.com"
    set_admin_email = client.patch(
        f"/api/admin/users/{admin_user['id']}",
        headers=admin_headers,
        json={"email": admin_email},
    )
    assert set_admin_email.status_code == 200

    invalid_email = client.patch(
        f"/api/admin/users/{editor['id']}",
        headers=admin_headers,
        json={"email": "geen-email"},
    )
    assert invalid_email.status_code == 422

    duplicate_email = client.patch(
        f"/api/admin/users/{editor['id']}",
        headers=admin_headers,
        json={"email": admin_email},
    )
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["detail"] == "Email already in use"

    invalid_avatar = client.post(
        f"/api/admin/users/{editor['id']}/avatar",
        headers=admin_headers,
        files={"file": ("avatar.txt", BytesIO(b"not-png"), "text/plain")},
    )
    assert invalid_avatar.status_code == 400
    assert invalid_avatar.json()["detail"] == "Avatar must be a PNG, JPEG, GIF or WebP image"


def test_admin_avatar_upload_rejects_empty_and_spoofed_content(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    editor = next(user for user in users_response.json() if user["username"] == "editor")

    empty_avatar = client.post(
        f"/api/admin/users/{editor['id']}/avatar",
        headers=admin_headers,
        files={"file": ("avatar.png", BytesIO(b""), "image/png")},
    )
    assert empty_avatar.status_code == 400
    assert empty_avatar.json()["detail"] == "Empty upload is not allowed"

    spoofed_avatar = client.post(
        f"/api/admin/users/{editor['id']}/avatar",
        headers=admin_headers,
        files={"file": ("avatar.png", BytesIO(b"not-really-a-png"), "image/png")},
    )
    assert spoofed_avatar.status_code == 400
    assert spoofed_avatar.json()["detail"] == "Avatar content does not match the selected image type"

    jpeg_avatar = client.post(
        f"/api/admin/users/{editor['id']}/avatar",
        headers=admin_headers,
        files={"file": ("avatar.jpg", BytesIO(JPEG_MINIMAL), "image/jpeg")},
    )
    assert jpeg_avatar.status_code == 200
    assert jpeg_avatar.json()["has_avatar"] is True


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


def test_admin_cannot_demote_or_disable_self_even_with_other_admin(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    users_response = client.get("/api/admin/users", headers=admin_headers)
    assert users_response.status_code == 200
    users = users_response.json()
    admin_user = next(user for user in users if user["username"] == "admin")
    editor = next(user for user in users if user["username"] == "editor")

    promote = client.patch(
        f"/api/admin/users/{editor['id']}",
        headers=admin_headers,
        json={"is_admin": True},
    )
    assert promote.status_code == 200

    demote_self = client.patch(
        f"/api/admin/users/{admin_user['id']}",
        headers=admin_headers,
        json={"is_admin": False},
    )
    assert demote_self.status_code == 400
    assert demote_self.json()["detail"] == "Admin users cannot remove their own admin rights"

    disable_self_via_profile = client.patch(
        f"/api/admin/users/{admin_user['id']}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert disable_self_via_profile.status_code == 400
    assert disable_self_via_profile.json()["detail"] == "Admin users cannot disable their own account"

    disable_self = client.patch(
        f"/api/admin/users/{admin_user['id']}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert disable_self.status_code == 400
    assert disable_self.json()["detail"] == "Admin users cannot disable their own account"

    update_own_profile = client.patch(
        f"/api/admin/users/{admin_user['id']}",
        headers=admin_headers,
        json={"full_name": "Admin Zelf", "email": "admin-zelf@example.com"},
    )
    assert update_own_profile.status_code == 200
    assert update_own_profile.json()["full_name"] == "Admin Zelf"
    assert update_own_profile.json()["email"] == "admin-zelf@example.com"


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


def test_admin_can_update_whisper_settings(client):
    admin_headers = _login_as(client, "admin", "admin12345")

    initial = client.get("/api/admin/genai-config", headers=admin_headers)
    assert initial.status_code == 200
    assert initial.json()["whisper_language"] == "nl"
    assert initial.json()["whisper_model"] == "whisper-1"

    updated = client.patch(
        "/api/admin/genai-config",
        headers=admin_headers,
        json={"whisper_language": "nl", "whisper_model": "gpt-4o-mini-transcribe"},
    )
    assert updated.status_code == 200
    assert updated.json()["whisper_language"] == "nl"
    assert updated.json()["whisper_model"] == "gpt-4o-mini-transcribe"


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
