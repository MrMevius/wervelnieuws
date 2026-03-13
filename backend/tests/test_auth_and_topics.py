def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _default_project_id(client, headers):
    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    return projects.json()[0]["id"]


def test_topic_creation_and_listing(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)

    create = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Netkabel update",
            "subject": "Werkzaamheden kabeltracé",
            "theme": "Planning",
            "project_id": project_id,
            "editorial_notes": "Gebruik neutrale toon",
            "planning_at": None,
            "target_channels": ["website", "newsletter"],
        },
    )
    assert create.status_code == 200
    assert create.json()["target_channels"] == ["website", "newsletter"]

    listing = client.get("/api/topics", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["target_channels"] == ["website", "newsletter"]
    assert listing.json()[0]["project_id"] == project_id
