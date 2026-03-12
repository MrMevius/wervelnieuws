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


def test_admin_can_delete_database_document(client):
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
                "te-verwijderen.txt",
                BytesIO(b"inhoud"),
                "text/plain",
            )
        },
    )
    assert upload.status_code == 200
    document_id = upload.json()["id"]

    delete_response = client.delete(
        f"/api/database/documents/{document_id}", headers=headers
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "ok"

    listing = client.get("/api/database/documents", headers=headers)
    assert listing.status_code == 200
    assert listing.json() == []


def test_non_admin_cannot_delete_database_document(client):
    admin_headers = _login_as(client, "admin", "admin12345")
    projects = client.get("/api/database/projects", headers=admin_headers)
    assert projects.status_code == 200
    project_id = projects.json()[0]["id"]

    upload = client.post(
        "/api/database/documents",
        headers=admin_headers,
        data={"project_id": project_id},
        files={
            "file": (
                "niet-verwijderbaar.txt",
                BytesIO(b"inhoud"),
                "text/plain",
            )
        },
    )
    assert upload.status_code == 200
    document_id = upload.json()["id"]

    editor_headers = _login_as(client, "editor", "editor12345")
    delete_response = client.delete(
        f"/api/database/documents/{document_id}", headers=editor_headers
    )
    assert delete_response.status_code == 403
    assert delete_response.json()["detail"] == "Admin access required"


def test_bulk_move_and_copy_documents(client):
    headers = _login_as(client, "admin", "admin12345")
    create_project = client.post(
        "/api/admin/projects", headers=headers, json={"name": "Project Zuid"}
    )
    assert create_project.status_code == 200
    target_project_id = create_project.json()["id"]

    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    source_project_id = projects.json()[0]["id"]

    upload = client.post(
        "/api/database/documents",
        headers=headers,
        data={"project_id": source_project_id},
        files={"file": ("bulk.txt", BytesIO(b"inhoud"), "text/plain")},
    )
    assert upload.status_code == 200
    source_document_id = upload.json()["id"]

    move_response = client.post(
        "/api/database/documents/bulk/move",
        headers=headers,
        json={
            "document_ids": [source_document_id],
            "target_project_id": target_project_id,
        },
    )
    assert move_response.status_code == 200
    assert move_response.json()["affected"] == 1

    moved_listing = client.get(
        f"/api/database/documents?project_id={target_project_id}", headers=headers
    )
    assert moved_listing.status_code == 200
    assert len(moved_listing.json()) == 1
    assert moved_listing.json()[0]["filename"] == "bulk.txt"

    copy_response = client.post(
        "/api/database/documents/bulk/copy",
        headers=headers,
        json={
            "document_ids": [source_document_id],
            "target_project_id": source_project_id,
        },
    )
    assert copy_response.status_code == 200
    assert copy_response.json()["affected"] == 1

    source_listing = client.get(
        f"/api/database/documents?project_id={source_project_id}", headers=headers
    )
    assert source_listing.status_code == 200
    assert len(source_listing.json()) == 1
    assert source_listing.json()[0]["filename"] == "bulk.txt"


def test_bulk_delete_requires_admin(client):
    admin_headers = _login_as(client, "admin", "admin12345")
    projects = client.get("/api/database/projects", headers=admin_headers)
    assert projects.status_code == 200
    project_id = projects.json()[0]["id"]

    upload = client.post(
        "/api/database/documents",
        headers=admin_headers,
        data={"project_id": project_id},
        files={"file": ("bulk-del.txt", BytesIO(b"inhoud"), "text/plain")},
    )
    assert upload.status_code == 200
    document_id = upload.json()["id"]

    editor_headers = _login_as(client, "editor", "editor12345")
    forbidden = client.post(
        "/api/database/documents/bulk/delete",
        headers=editor_headers,
        json={"document_ids": [document_id]},
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "Admin access required"

    allowed = client.post(
        "/api/database/documents/bulk/delete",
        headers=admin_headers,
        json={"document_ids": [document_id]},
    )
    assert allowed.status_code == 200
    assert allowed.json()["affected"] == 1
