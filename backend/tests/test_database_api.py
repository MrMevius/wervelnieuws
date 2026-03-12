from io import BytesIO

from app.services.ingestion_service import IngestionService


def _login_as(client, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_database_projects_lists_default_project(client):
    headers = _login_as(client, "admin", "admin12345")

    response = client.get("/api/database/projects", headers=headers)
    assert response.status_code == 200
    names = [item["name"] for item in response.json()]
    assert "Windpark de Boldijk" in names


def test_database_upload_and_listing_include_project_uploader_and_time(client):
    headers = _login_as(client, "admin", "admin12345")
    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    project_id = projects.json()[0]["id"]

    upload = client.post(
        "/api/database/documents",
        headers=headers,
        data={"project_id": project_id},
        files={
            "file": (
                "wijkbericht.txt",
                BytesIO(b"Lokale update over werkzaamheden in de buurt."),
                "text/plain",
            )
        },
    )
    assert upload.status_code == 200
    created = upload.json()
    assert created["filename"] == "wijkbericht.txt"
    assert created["project_id"] == project_id
    assert created["project_name"]
    assert created["uploaded_by_username"] == "admin"
    assert created["created_at"]
    assert created["status"] == "indexed"
    assert created["extraction_error"] == ""

    listing = client.get("/api/database/documents", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    row = listing.json()[0]
    assert row["filename"] == "wijkbericht.txt"
    assert row["project_id"] == project_id
    assert row["uploaded_by_username"] == "admin"
    assert row["created_at"]
    assert row["status"] == "indexed"


def test_database_upload_requires_existing_project(client):
    headers = _login_as(client, "admin", "admin12345")

    response = client.post(
        "/api/database/documents",
        headers=headers,
        data={"project_id": "missing"},
        files={"file": ("bron.txt", BytesIO(b"inhoud"), "text/plain")},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_database_upload_marks_failed_when_extraction_crashes(client, monkeypatch):
    headers = _login_as(client, "admin", "admin12345")
    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    project_id = projects.json()[0]["id"]

    def fail_extract(self, path, doc_type):
        del self, path, doc_type
        raise RuntimeError("kapotte parser")

    monkeypatch.setattr(IngestionService, "_extract_text", fail_extract)

    upload = client.post(
        "/api/database/documents",
        headers=headers,
        data={"project_id": project_id},
        files={
            "file": (
                "foutbron.txt",
                BytesIO(b"tekst"),
                "text/plain",
            )
        },
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["status"] == "failed"
    assert "kapotte parser" in body["extraction_error"]
