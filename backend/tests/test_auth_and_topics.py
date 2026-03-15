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


def test_topic_theme_options_and_templates_are_available(client):
    headers = _login(client)

    themes = client.get("/api/topics/themes", headers=headers)
    assert themes.status_code == 200
    assert any(item["name"] == "Planning" for item in themes.json())

    templates = client.get("/api/topics/schedule-templates", headers=headers)
    assert templates.status_code == 200
    assert len(templates.json()) >= 3


def test_topic_creation_rejects_inactive_theme(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)

    create_theme = client.post(
        "/api/admin/themes",
        headers=headers,
        json={"name": "Tijdelijk thema"},
    )
    assert create_theme.status_code == 200
    theme = create_theme.json()

    disable_theme = client.patch(
        f"/api/admin/themes/{theme['id']}",
        headers=headers,
        json={"is_active": False},
    )
    assert disable_theme.status_code == 200

    create_topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Onderwerp",
            "subject": "Onderwerp",
            "theme": "Tijdelijk thema",
            "project_id": project_id,
            "editorial_notes": "",
            "planning_at": None,
            "target_channels": ["website"],
        },
    )
    assert create_topic.status_code == 400
    assert create_topic.json()["detail"] == "Theme is not active"


def test_activity_feed_is_available_for_authenticated_user(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)

    create = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Log test onderwerp",
            "subject": "Log test onderwerp",
            "theme": "Planning",
            "project_id": project_id,
            "editorial_notes": "",
            "planning_at": None,
            "target_channels": ["website"],
        },
    )
    assert create.status_code == 200

    activity = client.get("/api/content/activity", headers=headers)
    assert activity.status_code == 200
    payload = activity.json()
    assert isinstance(payload, list)
    assert any(item["event_type"] == "topic.created" for item in payload)
    assert all("details_json" in item for item in payload)


def test_activity_feed_supports_event_topic_and_period_filters(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)

    create = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Filterbaar onderwerp",
            "subject": "Filterbaar onderwerp",
            "theme": "Planning",
            "project_id": project_id,
            "editorial_notes": "",
            "planning_at": None,
            "target_channels": ["website"],
        },
    )
    assert create.status_code == 200
    topic_id = create.json()["id"]

    update = client.patch(
        f"/api/topics/{topic_id}",
        headers=headers,
        json={"subject": "Filterbaar onderwerp aangepast"},
    )
    assert update.status_code == 200

    filtered = client.get(
        "/api/content/activity",
        headers=headers,
        params={
            "event_type": "topic.updated",
            "topic": "aangepast",
            "period": "all",
            "limit": 20,
        },
    )
    assert filtered.status_code == 200
    items = filtered.json()
    assert len(items) >= 1
    assert all(item["event_type"] == "topic.updated" for item in items)
    assert all(
        (item.get("topic_subject") or "").lower().find("aangepast") >= 0
        for item in items
    )

    invalid_period = client.get(
        "/api/content/activity",
        headers=headers,
        params={"period": "2d"},
    )
    assert invalid_period.status_code == 400
    assert "Invalid period" in invalid_period.json()["detail"]
