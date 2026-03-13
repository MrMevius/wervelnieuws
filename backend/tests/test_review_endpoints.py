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
    schedule_current_empty = client.get(
        f"/api/content/{topic['id']}/schedule/current", headers=headers
    )

    assert notes.status_code == 200
    assert docs.status_code == 200
    assert channels.status_code == 200
    assert audit.status_code == 200
    assert retries.status_code == 200
    assert schedule_current_empty.status_code == 404


def test_current_schedule_endpoint_returns_latest_schedule(client):
    headers = _login(client)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Planning update",
            "subject": "Planning",
            "theme": "Werkfase",
            "editorial_notes": "",
            "planning_at": "2026-03-20T09:00:00Z",
        },
    ).json()

    generated = client.post(f"/api/content/{topic['id']}/generate", headers=headers)
    assert generated.status_code == 200

    planned = client.post(
        f"/api/content/{topic['id']}/schedule",
        headers=headers,
        json={"publish_at": "2026-03-21T07:30:00Z"},
    )
    assert planned.status_code == 200

    current = client.get(
        f"/api/content/{topic['id']}/schedule/current", headers=headers
    )
    assert current.status_code == 200
    payload = current.json()
    assert payload["topic_id"] == topic["id"]
    assert payload["status"] == "scheduled"
    assert payload["scheduled_for"].startswith("2026-03-21T07:30:00")
