from io import BytesIO


def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _default_project_id(client, headers):
    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    return projects.json()[0]["id"]


def test_upload_txt_document_ingests(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Geluid meting",
            "subject": "Meetwaarden",
            "theme": "Milieu",
            "project_id": project_id,
            "editorial_notes": "",
            "planning_at": None,
        },
    ).json()

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        files={
            "file": (
                "bron.txt",
                BytesIO(b"Dit is een testbron voor het windpark."),
                "text/plain",
            )
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] in ["indexed", "failed"]


def test_upload_rejects_empty_document(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Lege bron",
            "subject": "Controle",
            "theme": "Validatie",
            "project_id": project_id,
            "editorial_notes": "",
            "planning_at": None,
        },
    ).json()

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        files={"file": ("bron.txt", BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 400
