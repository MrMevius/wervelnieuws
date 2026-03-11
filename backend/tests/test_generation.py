def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_generation_creates_version(client):
    headers = _login(client)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Onderhoud turbines",
            "subject": "Onderhoud",
            "theme": "Techniek",
            "editorial_notes": "Feiten uit bron",
            "planning_at": None,
        },
    ).json()

    gen = client.post(f"/api/content/{topic['id']}/generate", headers=headers)
    assert gen.status_code == 200

    versions = client.get(f"/api/content/{topic['id']}/versions", headers=headers)
    assert versions.status_code == 200
    assert len(versions.json()) == 1
