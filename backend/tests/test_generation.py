import json
from io import BytesIO


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
    assert "source_trace" in versions.json()[0]
    assert isinstance(versions.json()[0]["source_trace"], list)


def test_generation_combines_topic_and_database_sources(client):
    headers = _login(client)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Onderhoud turbine A",
            "subject": "Onderhoud",
            "theme": "Techniek",
            "editorial_notes": "Gebruik alleen bronnen",
            "planning_at": None,
        },
    ).json()

    topic_doc = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        files={
            "file": (
                "topic-bron.txt",
                BytesIO(b"Onderhoud van turbine A staat gepland op woensdag."),
                "text/plain",
            )
        },
    )
    assert topic_doc.status_code == 200

    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    project_id = projects.json()[0]["id"]

    db_doc = client.post(
        "/api/database/documents",
        headers=headers,
        data={"project_id": project_id},
        files={
            "file": (
                "database-bron.txt",
                BytesIO(
                    b"Onderhoud gebeurt met extra veiligheidsinspectie bij windpark."
                ),
                "text/plain",
            )
        },
    )
    assert db_doc.status_code == 200
    assert db_doc.json()["status"] == "indexed"

    gen = client.post(f"/api/content/{topic['id']}/generate", headers=headers)
    assert gen.status_code == 200

    versions = client.get(f"/api/content/{topic['id']}/versions", headers=headers)
    assert versions.status_code == 200
    assert len(versions.json()) == 1
    version = versions.json()[0]
    trace = json.loads(version["source_trace_json"])
    typed_trace = version["source_trace"]
    sources = {item.get("source") for item in trace}
    assert "topic" in sources
    assert "database" in sources
    assert all("source_type" in item for item in trace)
    assert all("document_name" in item for item in trace)
    assert all("chunk_index" in item for item in trace)
    assert len(typed_trace) == len(trace)
    assert all("source_type" in item for item in typed_trace)
