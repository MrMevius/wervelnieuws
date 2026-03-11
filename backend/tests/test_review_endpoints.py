def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_review_support_endpoints(client):
    headers = _login(client)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Planning update",
            "subject": "Planning",
            "theme": "Werkfase",
            "editorial_notes": "",
            "planning_at": None,
        },
    ).json()

    notes = client.get(f"/api/topics/{topic['id']}/notes", headers=headers)
    docs = client.get(f"/api/topics/{topic['id']}/documents", headers=headers)
    channels = client.get(f"/api/content/{topic['id']}/channel-status", headers=headers)
    audit = client.get(f"/api/topics/{topic['id']}/audit-events", headers=headers)
    retries = client.get("/api/content/retry-jobs", headers=headers)

    assert notes.status_code == 200
    assert docs.status_code == 200
    assert channels.status_code == 200
    assert audit.status_code == 200
    assert retries.status_code == 200
