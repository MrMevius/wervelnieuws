def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
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
    assert payload["theme_preference"] == "system"


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
