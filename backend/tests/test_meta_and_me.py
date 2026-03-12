from io import BytesIO


PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc`\x00\x02\x00\x00\x05\x00\x01"
    b"\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


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
