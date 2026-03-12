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


def test_about_returns_read_only_payload(client):
    headers = _login(client)

    response = client.get("/api/meta/about", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["developed_by"] == "Energiek Daarle"
    assert payload["description"]
    assert payload["disclaimer"]
    assert len(payload["changelog"]) >= 1
