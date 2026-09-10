from io import BytesIO

import pytest
from sqlalchemy import select, text

from app.core.db import get_db
from app.models.entities import DocumentChunk, KnowledgeChunk, KnowledgeDocument, TopicSourceDocument
from app.services.ingestion_service import IngestionService

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
            "theme": "Omgeving",
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
    assert response.json()["status"] == "indexed"


def test_upload_rejects_empty_document(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Lege bron",
            "subject": "Controle",
            "theme": "Planning",
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


@pytest.mark.parametrize("kind", ["topic", "knowledge"])
def test_failed_reindex_rolls_back_partial_chunks_and_preserves_original_index(client, monkeypatch, kind):
    headers = _login(client)
    project_id = _default_project_id(client, headers)
    if kind == "topic":
        topic = client.post("/api/topics", headers=headers, json={
            "title": "Testbron", "subject": "Meetwaarden", "theme": "Omgeving", "project_id": project_id,
        }).json()
        endpoint, data = f"/api/topics/{topic['id']}/documents", {}
        model, chunk_model, fts_table = TopicSourceDocument, DocumentChunk, "document_chunks_fts"
        method = "ingest_document"
    else:
        endpoint, data = "/api/database/documents", {"project_id": project_id}
        model, chunk_model, fts_table = KnowledgeDocument, KnowledgeChunk, "knowledge_chunks_fts"
        method = "ingest_knowledge_document"
    uploaded = client.post(endpoint, headers=headers, data=data, files={"file": ("bron.txt", b"Originele betrouwbare broninhoud", "text/plain")})
    assert uploaded.status_code == 200
    generator = client.app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        document = db.get(model, uploaded.json()["id"])
        original_chunks = [(row.id, row.text) for row in db.scalars(select(chunk_model))]
        original_fts = db.execute(text(f"SELECT chunk_id, text FROM {fts_table}")).all()
        service = IngestionService(db)
        monkeypatch.setattr(service, "_chunk_text", lambda _: ["Nieuwe eerste brok", "Nieuwe tweede brok"])
        original_execute = db.execute
        inserts = 0

        def fail_second_insert(statement, *args, **kwargs):
            nonlocal inserts
            if f"INSERT INTO {fts_table}" in str(statement):
                inserts += 1
                if inserts == 2:
                    raise RuntimeError("Index tijdelijk onbeschikbaar")
            return original_execute(statement, *args, **kwargs)

        monkeypatch.setattr(db, "execute", fail_second_insert)
        getattr(service, method)(document)
        assert inserts == 2
        assert document.status.value == "failed"
        assert [(row.id, row.text) for row in db.scalars(select(chunk_model))] == original_chunks
        assert db.execute(text(f"SELECT chunk_id, text FROM {fts_table}")).all() == original_fts
        assert db.execute(text("SELECT 1")).scalar_one() == 1
    finally:
        generator.close()
