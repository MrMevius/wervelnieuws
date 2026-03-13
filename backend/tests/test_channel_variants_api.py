def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_channel_variants_flow_and_topic_approval_guard(client):
    headers = _login(client)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Kanaaltest",
            "subject": "Kanaaltest",
            "theme": "Planning",
            "editorial_notes": "Gebruik lokale context",
            "planning_at": None,
            "target_channels": ["website", "facebook"],
        },
    ).json()

    generated = client.post(f"/api/content/{topic['id']}/generate", headers=headers)
    assert generated.status_code == 200

    variants = client.get(
        f"/api/content/{topic['id']}/variants/current", headers=headers
    )
    assert variants.status_code == 200
    channels = {item["channel"] for item in variants.json()}
    assert channels == {"website", "facebook"}

    updated = client.patch(
        f"/api/content/{topic['id']}/variants/website",
        headers=headers,
        json={
            "title": "Website titel",
            "article_body": "<p>Website artikel</p>",
            "summary": "<p>Website samenvatting</p>",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["approval_state"] == "pending"

    approve_website = client.post(
        f"/api/content/{topic['id']}/variants/website/approve", headers=headers
    )
    assert approve_website.status_code == 200
    assert approve_website.json()["approval_state"] == "approved"

    approve_topic_early = client.post(
        f"/api/content/{topic['id']}/approve", headers=headers
    )
    assert approve_topic_early.status_code == 400
    assert "Not all channels approved" in approve_topic_early.json()["detail"]

    approve_facebook = client.post(
        f"/api/content/{topic['id']}/variants/facebook/approve", headers=headers
    )
    assert approve_facebook.status_code == 200

    approve_topic = client.post(f"/api/content/{topic['id']}/approve", headers=headers)
    assert approve_topic.status_code == 200
    assert approve_topic.json()["status"] == "approved"


def test_regenerate_with_selected_channels(client):
    headers = _login(client)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Regenerate",
            "subject": "Regenerate",
            "theme": "Planning",
            "editorial_notes": "",
            "planning_at": None,
            "target_channels": ["website", "facebook", "newsletter"],
        },
    ).json()

    first = client.post(f"/api/content/{topic['id']}/generate", headers=headers)
    assert first.status_code == 200

    regen = client.post(
        f"/api/content/{topic['id']}/regenerate",
        headers=headers,
        json={"channels": ["website", "newsletter"]},
    )
    assert regen.status_code == 200

    variants = client.get(
        f"/api/content/{topic['id']}/variants/current", headers=headers
    )
    assert variants.status_code == 200
    channels = {item["channel"] for item in variants.json()}
    assert channels == {"website", "newsletter"}
