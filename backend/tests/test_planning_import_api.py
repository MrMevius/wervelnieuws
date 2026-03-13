def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_import_topics_csv_creates_rows_and_reports_errors(client):
    headers = _login(client)
    content = (
        "onderwerp,thema,geplande_datum,opmerkingen,website,facebook,nieuwsbrief\n"
        "Werk aan kabeltracé,Planning,2026-03-20 09:00,Neutraal houden,ja,nee,1\n"
        "Te kort,X,2026-03-20 10:00,Opmerking,nee,nee,nee\n"
    ).encode("utf-8")

    response = client.post(
        "/api/topics/import-csv",
        headers=headers,
        files={"file": ("planning.csv", content, "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert body["failed"] == 1
    assert len(body["errors"]) == 1
    assert body["errors"][0]["line"] == 3

    listing = client.get("/api/topics", headers=headers)
    assert listing.status_code == 200
    data = listing.json()
    assert len(data) == 1
    assert data[0]["subject"] == "Werk aan kabeltracé"
    assert data[0]["target_channels"] == ["website", "newsletter"]


def test_delete_topic_removes_planning_rule(client):
    headers = _login(client)
    created = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Netkabel update",
            "subject": "Werkzaamheden kabeltracé",
            "theme": "Planning",
            "editorial_notes": "Gebruik neutrale toon",
            "planning_at": None,
            "target_channels": ["website"],
        },
    )
    assert created.status_code == 200
    topic_id = created.json()["id"]

    deleted = client.delete(f"/api/topics/{topic_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"

    listing = client.get("/api/topics", headers=headers)
    assert listing.status_code == 200
    assert listing.json() == []
