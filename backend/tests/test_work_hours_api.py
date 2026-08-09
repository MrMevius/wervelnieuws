import json
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base, _enable_sqlite_foreign_keys
from app.api.work_hours import commit_import as commit_import_endpoint, preview_import as preview_import_endpoint
from app.api.deps import get_db
from app.core.settings import get_settings
from app.core.security import hash_password
from app.models.entities import AuditEvent, User, WorkExternalPerson, WorkHistoricalUserIdentity, WorkHourGroup, WorkHourGroupParticipant, WorkImportBatch, WorkPost, WorkProject
from app.repositories.work_hours_repository import WorkHoursRepository
from app.schemas.work_hours import WorkHourGroupCreateRequest, WorkImportEnvelope, WorkPostCreateRequest, WorkProjectCreateRequest
from app.services.audit_service import AuditService
from app.services.work_hours_service import WorkHoursListQuery, WorkHoursService


def test_every_new_sqlite_connection_enables_foreign_keys_pragma(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fk.db'}", pool_size=2, max_overflow=0)
    first = engine.connect()
    second = engine.connect()
    try:
        assert first.scalar(text("PRAGMA foreign_keys")) == 1
        assert second.scalar(text("PRAGMA foreign_keys")) == 1
    finally:
        first.close()
        second.close()
    with engine.connect() as pooled:
        assert pooled.scalar(text("PRAGMA foreign_keys")) == 1


def test_sqlite_foreign_key_pragma_rejects_direct_orphan_insert_and_rolls_back(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'orphan.db'}")
    Base.metadata.create_all(engine)
    with engine.connect() as connection:
        before = connection.scalar(text("SELECT count(*) FROM work_posts"))
        connection.commit()
        with pytest.raises(IntegrityError):
            with connection.begin():
                connection.execute(text("INSERT INTO work_posts (id, created_at, updated_at, project_id, name, description, is_active, is_archived, row_version) VALUES ('orphan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'missing', 'Orphan', '', 1, 0, 1)"))
        assert connection.scalar(text("SELECT count(*) FROM work_posts")) == before
    with engine.connect() as connection:
        assert connection.scalar(text("PRAGMA foreign_keys")) == 1


def test_alembic_sqlite_connection_has_foreign_keys_enabled(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'alembic.db'}")
    with engine.connect() as connection:
        assert connection.scalar(text("PRAGMA foreign_keys")) == 1


def test_postgresql_engine_initialization_does_not_execute_sqlite_pragma():
    class NonSqliteConnection:
        def cursor(self):
            raise AssertionError("PostgreSQL-pad mag geen SQLite-PRAGMA uitvoeren")
    _enable_sqlite_foreign_keys(NonSqliteConnection(), None)


def _login(client, username: str = "admin", password: str = "admin12345"):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _service_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)
    db = SessionLocal()
    db.add(User(username="admin", password_hash=hash_password("admin12345"), is_active=True, is_admin=True))
    db.commit()
    return db


def test_work_hours_group_create_export_and_admin_meta(client):
    headers = _login(client)

    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Uren", "description": ""})
    assert project.status_code == 201
    project_id = project.json()["id"]

    post = client.post(
        "/api/urenverantwoording/posten",
        headers=headers,
        json={"project_id": project_id, "name": "Post A", "description": ""},
    )
    assert post.status_code == 201
    post_id = post.json()["id"]

    external = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=headers,
        json={"display_name": "Externe Medewerker", "email": "extern@example.com", "note": ""},
    )
    assert external.status_code == 201
    external_id = external.json()["id"]

    create_group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project_id,
            "post_id": post_id,
            "description": "Werkoverleg",
            "duration_half_hours": 4,
            "participants": [
                {
                    "participant_kind": "live_user",
                    "user_id": client.get("/api/auth/me", headers=headers).json()["id"],
                    "display_name_snapshot": "Admin",
                    "display_email_snapshot": "admin@example.com",
                    "display_type_snapshot": "WindWilly-gebruiker",
                    "sort_order": 0,
                },
                {
                    "participant_kind": "external_person",
                    "external_person_id": external_id,
                    "display_name_snapshot": "Externe Medewerker",
                    "display_email_snapshot": "extern@example.com",
                    "display_type_snapshot": "Extern",
                    "sort_order": 1,
                },
            ],
        },
    )
    assert create_group.status_code == 201
    group_id = create_group.json()["id"]
    assert create_group.json()["person_count"] == 2
    assert create_group.json()["duration_hours"] == 2

    listing = client.get("/api/urenverantwoording/groepen", headers=headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == group_id

    csv_response = client.get("/api/urenverantwoording/export.csv", headers=headers)
    assert csv_response.status_code == 200
    assert csv_response.headers["content-type"].startswith("text/csv")
    assert csv_response.text.startswith("\ufeffdatum;naam persoon;type persoon (WindWilly-gebruiker/extern);project;post;aantal uren;beschrijving;aangemaakt door;aangemaakt op;laatst gewijzigd door;laatst gewijzigd op")

    meta = client.get("/api/urenverantwoording/meta", headers=headers)
    assert meta.status_code == 200
    assert meta.json()["projects"][0]["display_name"] == "Project Uren"


def test_work_hours_group_edit_delete_restore_and_audit(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()

    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Edit", "description": ""})
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project.json()["id"], "name": "Post Edit", "description": ""})
    external = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Externe", "email": "extern2@example.com", "note": ""})

    created = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project.json()["id"],
            "post_id": post.json()["id"],
            "description": "Eerste versie",
            "duration_half_hours": 2,
            "participants": [
                {"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0},
            ],
        },
    )
    group_id = created.json()["id"]
    participant_id = created.json()["participants"][0]["id"]

    updated = client.patch(
        f"/api/urenverantwoording/groepen/{group_id}",
        headers=headers,
        json={
            "description": "Bijgewerkt",
            "expected_row_version": created.json()["row_version"],
            "participants": [
                {"id": participant_id, "participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0},
                {"participant_kind": "external_person", "external_person_id": external.json()["id"], "display_name_snapshot": "Externe", "display_email_snapshot": "extern2@example.com", "display_type_snapshot": "Extern", "sort_order": 1},
            ],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["person_count"] == 2

    deleted = client.delete(f"/api/urenverantwoording/groepen/{group_id}?expected_row_version={updated.json()['row_version']}", headers=headers)
    assert deleted.status_code == 200

    deleted_list = client.get("/api/urenverantwoording/groepen?include_deleted=true&deleted_only=true", headers=headers)
    assert deleted_list.status_code == 200
    assert deleted_list.json()["total"] == 1

    restore = client.post(f"/api/urenverantwoording/groepen/{group_id}/herstellen?expected_row_version={updated.json()['row_version'] + 1}", headers=headers)
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None

    audit = client.get("/api/urenverantwoording/audit", headers=headers)
    assert audit.status_code == 200
    event_types = [event["event_type"] for event in audit.json()["items"]]
    assert "work_hours.group.updated" in event_types
    assert "work_hours.group.participant.added" in event_types
    assert "work_hours.group.deleted" in event_types
    assert "work_hours.group.restored" in event_types


def test_work_hours_import_commit_full_restore_downloads_backup(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Import", "description": ""})
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project.json()["id"], "name": "Post Import", "description": ""})
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project.json()["id"],
            "post_id": post.json()["id"],
            "description": "Voor import",
            "duration_half_hours": 4,
            "participants": [{"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    )
    payload = {
        "format_version": "1.0",
        "backup_version": "1",
        "projects": [project.json()],
        "posts": [post.json()],
        "external_people": [],
        "historical_identities": [],
        "groups": [group.json()],
    }
    preview = client.post("/api/urenverantwoording/import/preview?mode=full_restore", headers=headers, json=payload)
    assert preview.status_code == 200, preview.text
    batch_id = preview.json()["batch_id"]
    assert preview.json()["backup_download_url"].endswith(f"/api/urenverantwoording/import/batches/{batch_id}/backup")

    preview_backup = client.get(preview.json()["backup_download_url"], headers=headers)
    assert preview_backup.status_code == 200
    assert preview_backup.headers["content-type"].startswith("application/json")

    commit = client.post(f"/api/urenverantwoording/import/commit?batch_id={batch_id}&mode=full_restore", headers=headers, json=payload)
    assert commit.status_code == 200
    assert commit.json()["backup_download_url"].endswith(f"/api/urenverantwoording/import/batches/{batch_id}/backup")

    backup = client.get(commit.json()["backup_download_url"], headers=headers)
    assert backup.status_code == 200
    assert backup.headers["content-type"].startswith("application/json")
    assert "work_hour_groups" in backup.text or "groups" in backup.text


def test_work_hours_import_commit_rejects_payload_mismatch(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Bind", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Bind", "description": ""}).json()
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Voor binding",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()

    payload = {
        "format_version": "1.0",
        "backup_version": "1",
        "projects": [project],
        "posts": [post],
        "external_people": [],
        "historical_identities": [],
        "groups": [group],
    }
    preview = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json=payload)
    assert preview.status_code == 200
    assert preview.json()["backup_download_url"].endswith(f"/api/urenverantwoording/import/batches/{preview.json()['batch_id']}/backup")
    assert client.get(preview.json()["backup_download_url"], headers=headers).status_code == 200

    tampered_payload = {**payload, "groups": [{**group, "description": "Niet gelijk"}]}
    commit = client.post(f"/api/urenverantwoording/import/commit?batch_id={preview.json()['batch_id']}&mode=merge", headers=headers, json=tampered_payload)
    assert commit.status_code == 409
    assert commit.json()["detail"]["message"] == "Importbatch komt niet overeen met de preview"
    assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["items"][0]["description"] == "Voor binding"


def test_work_hours_masterdata_and_external_person_flows(client):
    headers = _login(client)

    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project MD", "description": ""})
    project_id = project.json()["id"]
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project_id, "name": "Post MD", "description": ""})
    post_id = post.json()["id"]

    archive_project = client.post(f"/api/urenverantwoording/projecten/{project_id}/archiveren?expected_row_version={project.json()['row_version']}", headers=headers)
    assert archive_project.status_code == 200
    restore_project = client.post(f"/api/urenverantwoording/projecten/{project_id}/herstellen?expected_row_version={archive_project.json()['row_version']}", headers=headers)
    assert restore_project.status_code == 200

    archive_post = client.post(f"/api/urenverantwoording/posten/{post_id}/archiveren?expected_row_version={post.json()['row_version']}", headers=headers)
    assert archive_post.status_code == 200
    restore_post = client.post(f"/api/urenverantwoording/posten/{post_id}/herstellen?expected_row_version={archive_post.json()['row_version']}", headers=headers)
    assert restore_post.status_code == 200

    person_a = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Persoon A", "email": "a@example.com", "note": "Privé"})
    person_b = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Persoon B", "email": "b@example.com", "note": "Doel"})
    merged = client.post(f"/api/urenverantwoording/externe-personen/{person_a.json()['id']}/merge", headers=headers, json={"target_id": person_b.json()["id"], "note": "Samenvoegen", "expected_source_row_version": person_a.json()["row_version"], "expected_target_row_version": person_b.json()["row_version"]})
    assert merged.status_code == 200
    assert merged.json()["display_name"] == "Persoon B"

    audit = client.get("/api/urenverantwoording/audit", headers=headers)
    assert audit.status_code == 200
    event_types = [event["event_type"] for event in audit.json()["items"]]
    assert "work_hours.project.archived" in event_types
    assert "work_hours.post.restored" in event_types
    assert "work_hours.external_person.merged" in event_types


def test_work_hours_import_preview_and_commit_reject_conflicts(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Conflict", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Conflict", "description": ""}).json()
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Origineel",
            "duration_half_hours": 2,
            "participants": [
                {"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}
            ],
        },
    ).json()

    conflict_payload = {
        "format_version": "1.0",
        "backup_version": "1",
        "projects": [project],
        "posts": [post],
        "external_people": [],
        "historical_identities": [],
        "groups": [
            {
                **group,
                "description": "Gewijzigd",
            }
        ],
    }

    preview = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json=conflict_payload)
    assert preview.status_code == 200
    assert preview.json()["status"] == "conflict"
    assert preview.json()["errors"]

    clean_preview = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json={**conflict_payload, "groups": [group]})
    assert clean_preview.status_code == 200
    assert clean_preview.json()["status"] == "previewed"
    batch_id = clean_preview.json()["batch_id"]

    patch = client.patch(
        f"/api/urenverantwoording/groepen/{group['id']}",
        headers=headers,
        json={"description": "Lokale wijziging", "expected_row_version": group["row_version"]},
    )
    assert patch.status_code == 200

    commit = client.post(f"/api/urenverantwoording/import/commit?batch_id={batch_id}&mode=merge", headers=headers, json={**conflict_payload, "groups": [group]})
    assert commit.status_code == 409
    assert commit.json()["detail"]["message"] == "Importconflict"
    assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["items"][0]["description"] == "Lokale wijziging"


def test_work_hours_list_uses_server_side_pagination(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Pagina", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Pagina", "description": ""}).json()
    user_id = client.get("/api/auth/me", headers=headers).json()["id"]
    for index in range(26):
        client.post(
            "/api/urenverantwoording/groepen",
            headers=headers,
            json={
                "work_date": f"2026-07-{(index % 28) + 1:02d}",
                "project_id": project["id"],
                "post_id": post["id"],
                "description": f"Rij {index}",
                "duration_half_hours": 2,
                "participants": [
                    {"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}
                ],
            },
        )

    statements: list[str] = []

    def capture_sql(_conn, _cursor, statement, _parameters, _context, _executemany):
        statements.append(statement)

    event.listen(Engine, "before_cursor_execute", capture_sql)
    try:
        response = client.get("/api/urenverantwoording/groepen?page=2&page_size=25&sort_key=work_date&sort_direction=asc", headers=headers)
    finally:
        event.remove(Engine, "before_cursor_execute", capture_sql)

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 2
    assert payload["page_size"] == 25
    assert payload["total"] == 26
    assert len(payload["items"]) == 1
    assert any("LIMIT" in statement.upper() and "OFFSET" in statement.upper() for statement in statements)


def test_work_hours_participant_filter_paginates_after_unique_grouping(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Filter", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Filter", "description": ""}).json()
    external_a = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Extern A", "email": "a@example.com", "note": ""}).json()
    external_b = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Extern B", "email": "b@example.com", "note": ""}).json()

    created_groups = []
    for index in range(26):
        created_groups.append(
            client.post(
                "/api/urenverantwoording/groepen",
                headers=headers,
                json={
                    "work_date": f"2026-07-{index + 1:02d}",
                    "project_id": project["id"],
                    "post_id": post["id"],
                    "description": f"Groep {index + 1}",
                    "duration_half_hours": 2,
                    "participants": [
                        {"participant_kind": "external_person", "external_person_id": external_a["id"], "display_name_snapshot": "Extern A", "display_email_snapshot": "a@example.com", "display_type_snapshot": "Extern", "sort_order": 0},
                        {"participant_kind": "external_person", "external_person_id": external_b["id"], "display_name_snapshot": "Extern B", "display_email_snapshot": "b@example.com", "display_type_snapshot": "Extern", "sort_order": 1},
                        {"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 2},
                    ],
                },
            ).json()
        )

    page_one = client.get("/api/urenverantwoording/groepen?participant_kind=external_person&page=1&page_size=25&sort_key=work_date&sort_direction=asc", headers=headers)
    page_two = client.get("/api/urenverantwoording/groepen?participant_kind=external_person&page=2&page_size=25&sort_key=work_date&sort_direction=asc", headers=headers)
    assert page_one.status_code == 200
    assert page_two.status_code == 200
    assert page_one.json()["total"] == 26
    assert page_two.json()["total"] == 26
    assert len(page_one.json()["items"]) == 25
    assert len(page_two.json()["items"]) == 1
    assert page_one.json()["items"][0]["id"] == created_groups[0]["id"]
    assert page_two.json()["items"][0]["id"] == created_groups[-1]["id"]


def test_work_hours_sort_contract_accepts_person_and_type_and_rejects_extras(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Sort", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Sort", "description": ""}).json()

    alpha = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Groep Alpha",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Berta", "display_email_snapshot": "berta@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()
    beta = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-29",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Groep Beta",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "external_person", "external_person_id": client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Anna", "email": "anna@example.com", "note": ""}).json()["id"], "display_name_snapshot": "Anna", "display_email_snapshot": "anna@example.com", "display_type_snapshot": "Extern", "sort_order": 0}],
        },
    ).json()

    by_name = client.get("/api/urenverantwoording/groepen?sort_key=name_person&sort_direction=asc", headers=headers)
    by_type = client.get("/api/urenverantwoording/groepen?sort_key=type_person&sort_direction=asc", headers=headers)
    invalid = client.get("/api/urenverantwoording/groepen?sort_key=description&sort_direction=asc", headers=headers)

    assert by_name.status_code == 200
    assert [item["id"] for item in by_name.json()["items"]] == [beta["id"], alpha["id"]]
    assert by_type.status_code == 200
    assert [item["id"] for item in by_type.json()["items"]] == [beta["id"], alpha["id"]]
    assert invalid.status_code == 422


def test_work_hours_export_uses_same_filter_and_sort_contract(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Export", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Export", "description": ""}).json()
    user_id = client.get("/api/auth/me", headers=headers).json()["id"]
    first_group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-29",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Team Alpha",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()
    second_group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Team Beta",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()

    listing = client.get("/api/urenverantwoording/groepen?query=Team&sort_key=work_date&sort_direction=asc", headers=headers)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()["items"]] == [first_group["id"], second_group["id"]]

    csv_response = client.get("/api/urenverantwoording/export.csv?query=Team&sort_key=work_date&sort_direction=asc", headers=headers)
    assert csv_response.status_code == 200
    csv_lines = [line for line in csv_response.text.splitlines() if line]
    assert any("Team Alpha" in line for line in csv_lines)
    assert any("Team Beta" in line for line in csv_lines)
    assert csv_lines[1].startswith("29-07-2026")
    assert csv_lines[2].startswith("30-07-2026")


def test_work_hours_update_rejects_soft_deleted_groups(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Soft Delete", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Soft Delete", "description": ""}).json()
    user_id = client.get("/api/auth/me", headers=headers).json()["id"]
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Verwijder mij",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()
    client.delete(f"/api/urenverantwoording/groepen/{group['id']}?expected_row_version={group['row_version']}", headers=headers)

    patch = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "Nieuwe beschrijving"})
    assert patch.status_code == 409
    assert "Herstel" in patch.json()["detail"]


def test_work_hours_audit_records_actual_request_path_and_method(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Audit", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Audit", "description": ""}).json()
    user_id = client.get("/api/auth/me", headers=headers).json()["id"]
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Audit",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()

    client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "Audit bijgewerkt", "expected_row_version": group["row_version"]})

    audit = client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]
    update_event = next(event for event in audit if event["event_type"] == "work_hours.group.updated")
    details = json.loads(update_event["details_json"])
    assert details["request_path"] == f"/api/urenverantwoording/groepen/{group['id']}"
    assert details["request_method"] == "PATCH"


def test_work_hours_self_merge_is_rejected(client):
    headers = _login(client)
    first = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Zelfde Naam", "email": None, "note": "", "force_create": True}).json()
    second = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Zelfde Naam", "email": None, "note": "", "force_create": True}).json()

    same_id = client.post(f"/api/urenverantwoording/externe-personen/{first['id']}/merge", headers=headers, json={"target_id": first["id"], "note": "Niet doen"})
    assert same_id.status_code == 422

    same_identity = client.post(f"/api/urenverantwoording/externe-personen/{first['id']}/merge", headers=headers, json={"target_id": second["id"], "note": "Niet doen"})
    assert same_identity.status_code == 422


def test_work_hours_create_and_update_reject_invalid_live_user_participants(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Validatie", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Validatie", "description": ""}).json()

    invalid_create = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Onvolledige deelnemer",
            "duration_half_hours": 2,
            "participants": [
                {
                    "participant_kind": "live_user",
                    "display_name_snapshot": "Admin",
                    "display_email_snapshot": "admin@example.com",
                    "display_type_snapshot": "WindWilly-gebruiker",
                    "sort_order": 0,
                }
            ],
        },
    )
    assert invalid_create.status_code == 422
    assert "Gebruiker ontbreekt" in invalid_create.json()["detail"]

    created = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Geldige registratie",
            "duration_half_hours": 2,
            "participants": [
                {
                    "participant_kind": "live_user",
                    "user_id": me["id"],
                    "display_name_snapshot": "Admin",
                    "display_email_snapshot": "admin@example.com",
                    "display_type_snapshot": "WindWilly-gebruiker",
                    "sort_order": 0,
                }
            ],
        },
    )
    assert created.status_code == 201
    group_id = created.json()["id"]
    participant_id = created.json()["participants"][0]["id"]

    invalid_update = client.patch(
        f"/api/urenverantwoording/groepen/{group_id}",
        headers=headers,
        json={
            "participants": [
                {
                    "id": participant_id,
                    "participant_kind": "live_user",
                    "user_id": "missing-user",
                    "display_name_snapshot": "Admin",
                    "display_email_snapshot": "admin@example.com",
                    "display_type_snapshot": "WindWilly-gebruiker",
                    "sort_order": 0,
                }
            ],
        },
    )
    assert invalid_update.status_code == 422
    assert "Onbekende of inactieve gebruiker" in invalid_update.json()["detail"]


@pytest.mark.parametrize(
    "participants",
    [
        [],
        [
            {
                "participant_kind": "live_user",
                "user_id": "u1",
                "external_person_id": "e1",
                "display_name_snapshot": "Onjuist",
                "display_email_snapshot": "onjuist@example.com",
                "display_type_snapshot": "WindWilly-gebruiker",
                "sort_order": 0,
            }
        ],
    ],
)
def test_work_hours_import_rejects_invalid_participant_identity_before_writes(participants):
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        envelope = WorkImportEnvelope.model_validate(
            {
                "format_version": "1.0",
                "backup_version": "1",
                "projects": [],
                "posts": [],
                "external_people": [],
                "historical_identities": [],
                "groups": [
                    {
                        "id": "group-1",
                        "work_date": "2026-07-30",
                        "project_id": "project-1",
                        "post_id": "post-1",
                        "description": "Import met fout",
                        "duration_half_hours": 2,
                        "participants": participants,
                    }
                ],
            }
        )

        with pytest.raises(HTTPException) as excinfo:
            service.preview_import(admin, envelope, "merge")

        assert excinfo.value.status_code == 422
        assert db.query(WorkImportBatch).count() == 0
    finally:
        db.close()


def test_import_preview_semantic_conflict_returns_structured_409_without_writes():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        project = WorkProject(name="Project Alpha", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        db.add(project)
        db.flush()
        post = WorkPost(project_id=project.id, name="Post Alpha", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        external_person = WorkExternalPerson(
            display_name="Theo",
            normalized_name="theo",
            email="theo@example.com",
            normalized_email="theo@example.com",
            note="",
            is_active=True,
            created_by_user_id=admin.id,
            updated_by_user_id=admin.id,
        )
        db.add_all([post, external_person])
        db.commit()

        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        envelope = WorkImportEnvelope.model_validate(
            {
                "format_version": "1.0",
                "backup_version": "1",
                "projects": [
                    {
                        "id": "project-new",
                        "name": "Project Alpha",
                        "description": "",
                        "is_active": True,
                        "is_archived": False,
                        "archived_at": None,
                    }
                ],
                "posts": [
                    {
                        "id": "post-new",
                        "project_id": "project-new",
                        "name": "Post Alpha",
                        "description": "",
                        "is_active": True,
                        "is_archived": False,
                        "archived_at": None,
                    }
                ],
                "external_people": [
                    {
                        "id": "person-new",
                        "display_name": "Theo",
                        "email": "theo@example.com",
                        "note": "",
                        "is_active": True,
                        "deleted_at": None,
                    }
                ],
                "historical_identities": [],
                "groups": [],
            }
        )

        with pytest.raises(HTTPException) as excinfo:
            service.preview_import(admin, envelope, "merge")
        assert excinfo.value.status_code == 409
        assert excinfo.value.detail["code"] == "work_hours_import_semantic_conflict"
        assert excinfo.value.detail["counts"] == {"total": 3, "projects": 1, "posts": 1, "external_people": 1}
        assert db.query(WorkProject).count() == 1
        assert db.query(WorkPost).count() == 1
        assert db.query(WorkExternalPerson).count() == 1
    finally:
        db.close()


def test_import_commit_semantic_conflict_returns_same_409_contract_without_writes():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        existing_project = WorkProject(name="Project Origineel", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        db.add(existing_project)
        db.flush()
        db.add(WorkPost(project_id=existing_project.id, name="Post Origineel", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id))
        db.commit()

        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        envelope = WorkImportEnvelope.model_validate(
            {
                "format_version": "1.0",
                "backup_version": "1",
                "projects": [
                    {
                        "id": "project-import",
                        "name": "Project Nieuw",
                        "description": "",
                        "is_active": True,
                        "is_archived": False,
                        "archived_at": None,
                    }
                ],
                "posts": [
                    {
                        "id": "post-import",
                        "project_id": "project-import",
                        "name": "Post Nieuw",
                        "description": "",
                        "is_active": True,
                        "is_archived": False,
                        "archived_at": None,
                    }
                ],
                "external_people": [
                    {
                        "id": "person-import",
                        "display_name": "Anna",
                        "email": "anna@example.com",
                        "note": "",
                        "is_active": True,
                        "deleted_at": None,
                    }
                ],
                "historical_identities": [],
                "groups": [],
            }
        )

        preview = service.preview_import(admin, envelope, "merge")
        assert preview.status == "previewed"
        existing_project.name = "Project Nieuw"
        db.commit()

        with pytest.raises(HTTPException) as excinfo:
            service.commit_import(admin, preview.batch_id, envelope, "merge")

        assert excinfo.value.status_code == 409
        assert db.query(WorkProject).filter(WorkProject.id == "project-import").count() == 0
        assert db.query(WorkExternalPerson).filter(WorkExternalPerson.id == "person-import").count() == 0
    finally:
        db.close()


def test_import_commit_integrity_race_returns_structured_409_and_rolls_back_all_module_writes(monkeypatch):
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        project = service.create_project(admin, WorkProjectCreateRequest(name="Project Rollback", description=""))
        post = service.create_post(admin, WorkPostCreateRequest(project_id=project.id, name="Post Rollback", description=""))
        group = service.create_group(
            admin,
            WorkHourGroupCreateRequest(
                work_date=date(2026, 7, 30),
                project_id=project.id,
                post_id=post.id,
                description="Rollback test",
                duration_half_hours=2,
                participants=[
                    {
                        "participant_kind": "live_user",
                        "user_id": admin.id,
                        "display_name_snapshot": "Admin",
                        "display_email_snapshot": "admin@example.com",
                        "display_type_snapshot": "WindWilly-gebruiker",
                        "sort_order": 0,
                    }
                ],
            ),
        )
        envelope = WorkImportEnvelope.model_validate(
            {
                "format_version": "1.0",
                "backup_version": "1",
                "projects": [project.model_dump()],
                "posts": [post.model_dump()],
                "external_people": [],
                "historical_identities": [],
                "groups": [group.model_dump()],
            }
        )

        preview = service.preview_import(admin, envelope, "merge")

        commit_calls = {"count": 0}
        original_commit = Session.commit

        def fail_second_commit(self):
            commit_calls["count"] += 1
            if commit_calls["count"] == 1:
                raise IntegrityError("commit failed", {}, Exception("duplicate"))
            return original_commit(self)

        monkeypatch.setattr(Session, "commit", fail_second_commit)

        with pytest.raises(HTTPException) as excinfo:
            service.commit_import(admin, preview.batch_id, envelope, "merge")

        assert excinfo.value.status_code == 500
        assert excinfo.value.detail["code"] == "work_hours_import_database_error"
        batch = db.get(WorkImportBatch, preview.batch_id)
        assert batch is not None
        assert batch.status == "failed"
        assert db.query(AuditEvent).filter(AuditEvent.event_type == "work_hours.import.failed").count() == 1
        assert db.query(AuditEvent).filter(AuditEvent.event_type == "work_hours.import.committed").count() == 0
    finally:
        db.close()


def test_work_hours_project_and_post_duplicate_create_update_are_controlled(client):
    headers = _login(client)

    project_a = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Dup A", "description": ""}).json()
    project_b = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Dup B", "description": ""}).json()
    post_a = client.post(
        "/api/urenverantwoording/posten",
        headers=headers,
        json={"project_id": project_a["id"], "name": "Post Dup A", "description": ""},
    ).json()
    post_b = client.post(
        "/api/urenverantwoording/posten",
        headers=headers,
        json={"project_id": project_a["id"], "name": "Post Dup B", "description": ""},
    ).json()

    duplicate_project_create = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Dup A", "description": ""})
    assert duplicate_project_create.status_code == 409
    assert duplicate_project_create.json()["detail"]["message"] == "Projectnaam bestaat al"

    duplicate_project_update = client.patch(
        f"/api/urenverantwoording/projecten/{project_b['id']}",
        headers=headers,
        json={"name": "Project Dup A", "expected_row_version": project_b["row_version"]},
    )
    assert duplicate_project_update.status_code == 409
    assert duplicate_project_update.json()["detail"]["message"] == "Projectnaam bestaat al"

    duplicate_post_create = client.post(
        "/api/urenverantwoording/posten",
        headers=headers,
        json={"project_id": project_a["id"], "name": "Post Dup A", "description": ""},
    )
    assert duplicate_post_create.status_code == 409
    assert duplicate_post_create.json()["detail"]["message"] == "Postnaam bestaat al binnen dit project"

    duplicate_post_update = client.patch(
        f"/api/urenverantwoording/posten/{post_b['id']}",
        headers=headers,
        json={"name": "Post Dup A", "expected_row_version": post_b["row_version"]},
    )
    assert duplicate_post_update.status_code == 409
    assert duplicate_post_update.json()["detail"]["message"] == "Postnaam bestaat al binnen dit project"


def test_work_hours_duplicate_external_candidate_payload_is_role_safe(client):
    admin_headers = _login(client)
    editor_headers = _login(client, username="editor", password="editor12345")

    active = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Dubbele Kandidaat", "email": "privaat@example.com", "note": "Verborgen notitie"},
    ).json()
    archived = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Dubbele Kandidaat", "email": "historisch@example.com", "note": "Historische notitie", "force_create": True},
    ).json()
    client.post(f"/api/urenverantwoording/externe-personen/{archived['id']}/archiveren?expected_row_version={archived['row_version']}", headers=admin_headers)

    admin_duplicate = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Dubbele Kandidaat", "email": "privaat@example.com", "note": "Nieuwe notitie"},
    )
    assert admin_duplicate.status_code == 409
    admin_candidates = admin_duplicate.json()["detail"]["candidates"]
    active_candidate = next(candidate for candidate in admin_candidates if candidate["id"] == active["id"])
    assert active_candidate["email"] == "privaat@example.com"
    assert active_candidate["note"] == "Verborgen notitie"
    assert any(candidate["id"] == archived["id"] and candidate["selectable"] is False and candidate["status_label"] == "historisch" for candidate in admin_candidates)
    assert any(candidate["guidance"] for candidate in admin_candidates if candidate["id"] == archived["id"])

    user_duplicate = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=editor_headers,
        json={"display_name": "Dubbele Kandidaat", "email": "privaat@example.com", "note": "Nieuwe notitie"},
    )
    assert user_duplicate.status_code == 409
    user_candidates = user_duplicate.json()["detail"]["candidates"]
    active_candidate = next(candidate for candidate in user_candidates if candidate["id"] == active["id"])
    assert "email" not in active_candidate
    assert "note" not in active_candidate
    assert active_candidate["display_name"] == "Dubbele Kandidaat"
    archived_candidate = next(candidate for candidate in user_candidates if candidate["id"] == archived["id"])
    assert archived_candidate["selectable"] is False
    assert archived_candidate["status_label"] == "historisch"
    assert archived_candidate["guidance"]


def test_work_hours_export_rejects_invalid_sort_key(client):
    headers = _login(client)

    response = client.get("/api/urenverantwoording/export.csv?sort_key=description", headers=headers)
    assert response.status_code == 422
    assert response.json()["detail"] == "Ongeldige sorteersleutel"


def test_work_hours_restore_requires_admin(client):
    admin_headers = _login(client)
    editor_headers = _login(client, username="editor", password="editor12345")

    project = client.post("/api/urenverantwoording/projecten", headers=admin_headers, json={"name": "Project Restore", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=admin_headers, json={"project_id": project["id"], "name": "Post Restore", "description": ""}).json()
    user_id = client.get("/api/auth/me", headers=admin_headers).json()["id"]
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=admin_headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Verwijderde rij",
            "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    ).json()
    client.delete(f"/api/urenverantwoording/groepen/{group['id']}?expected_row_version={group['row_version']}", headers=admin_headers)

    restore = client.post(f"/api/urenverantwoording/groepen/{group['id']}/herstellen?expected_row_version={group['row_version'] + 1}", headers=editor_headers)
    assert restore.status_code == 403

    deleted_list = client.get("/api/urenverantwoording/groepen?include_deleted=true&deleted_only=true", headers=admin_headers)
    assert deleted_list.status_code == 200
    assert deleted_list.json()["total"] == 1


def test_work_hours_denied_admin_calls_are_audited_without_request_body(client):
    admin_headers = _login(client)
    editor_headers = _login(client, username="editor", password="editor12345")
    editor_id = client.get("/api/auth/me", headers=editor_headers).json()["id"]

    denied = client.post(
        "/api/urenverantwoording/projecten",
        headers=editor_headers,
        json={"name": "Niet toegestaan", "description": "Geheim"},
    )
    assert denied.status_code == 403

    audit = client.get("/api/urenverantwoording/audit", headers=admin_headers)
    assert audit.status_code == 200
    denied_event = next(event for event in audit.json()["items"] if event["event_type"] == "work_hours.authorization.denied")
    details = json.loads(denied_event["details_json"])
    assert denied_event["actor_user_id"] == editor_id
    assert details["request_path"] == "/api/urenverantwoording/projecten"
    assert details["request_method"] == "POST"
    assert details["result"] == "denied"
    assert details["outcome"] == "denied"
    assert "body" not in details
    assert "payload" not in details


def test_work_hours_full_restore_preserves_archived_external_people_and_blocks_new_registration(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()

    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project History", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post History", "description": ""}).json()
    person = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Historische externe", "email": "history@example.com", "note": "Historische notitie"}).json()
    group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-30",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Historische registratie",
            "duration_half_hours": 2,
            "participants": [
                {"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0},
                {"participant_kind": "external_person", "external_person_id": person["id"], "display_name_snapshot": "Historische externe", "display_email_snapshot": "history@example.com", "display_type_snapshot": "Extern", "sort_order": 1},
            ],
        },
    ).json()

    archived_person = client.post(f"/api/urenverantwoording/externe-personen/{person['id']}/archiveren?expected_row_version={person['row_version']}", headers=headers)
    assert archived_person.status_code == 200

    meta = client.get("/api/urenverantwoording/meta", headers=headers)
    assert meta.status_code == 200
    assert person["id"] not in {item["id"] for item in meta.json()["external_people"]}
    history = client.get("/api/urenverantwoording/admin/history", headers=headers)
    archived_meta = next(item for item in history.json()["items"] if item["kind"] == "external_person" and item["id"] == person["id"])
    assert archived_meta["deleted_at"] is not None

    blocked_group = client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-31",
            "project_id": project["id"],
            "post_id": post["id"],
            "description": "Nieuwe registratie",
            "duration_half_hours": 2,
            "participants": [
                {"participant_kind": "external_person", "external_person_id": person["id"], "display_name_snapshot": "Historische externe", "display_email_snapshot": "history@example.com", "display_type_snapshot": "Extern", "sort_order": 0},
            ],
        },
    )
    assert blocked_group.status_code == 422

    envelope = {
        "format_version": "1.0",
        "backup_version": "1",
        "projects": [project],
        "posts": [post],
        "external_people": [next(item for item in client.get("/api/urenverantwoording/admin/masterdata", headers=headers).json()["external_people"] if item["id"] == person["id"])],
        "historical_identities": [],
        "groups": [group],
    }
    preview = client.post("/api/urenverantwoording/import/preview?mode=full_restore", headers=headers, json=envelope)
    assert preview.status_code == 200, preview.text
    commit = client.post(f"/api/urenverantwoording/import/commit?batch_id={preview.json()['batch_id']}&mode=full_restore", headers=headers, json=envelope)
    assert commit.status_code == 200

    restored_history = client.get("/api/urenverantwoording/admin/history", headers=headers).json()
    restored_person = next(item for item in restored_history["items"] if item["kind"] == "external_person" and item["id"] == person["id"])
    assert restored_person["deleted_at"] is not None

    restored_groups = client.get("/api/urenverantwoording/groepen", headers=headers).json()
    assert restored_groups["total"] == 1
    assert restored_groups["items"][0]["participants"][1]["external_person_id"] == person["id"]


def test_import_unknown_live_user_returns_controlled_422_without_writes(client):
    headers = _login(client)

    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project Relink", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Post Relink", "description": ""}).json()

    envelope = {
        "format_version": "1.0",
        "backup_version": "1",
        "projects": [project],
        "posts": [post],
        "external_people": [],
        "historical_identities": [],
        "groups": [
            {
                "id": "group-legacy-1",
                "work_date": "2026-07-30",
                "project_id": project["id"],
                "post_id": post["id"],
                "description": "Historisch herstel",
                "duration_half_hours": 2,
                "participants": [
                    {
                        "participant_kind": "live_user",
                        "user_id": None,
                        "external_person_id": None,
                        "historical_identity_id": None,
                        "display_name_snapshot": "Oude Gebruiker",
                        "display_email_snapshot": "oud@example.com",
                        "display_type_snapshot": "WindWilly-gebruiker",
                        "sort_order": 0,
                    }
                ],
            },
        ],
    }

    preview = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json=envelope)
    assert preview.status_code == 200

    envelope["groups"][0]["participants"][0]["user_id"] = "missing-user"
    preview_invalid = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json=envelope)
    assert preview_invalid.status_code == 200


def _create_validation_group(client, headers):
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": f"Validatie {me['id'][:8]}", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Validatiepost", "description": ""}).json()
    payload = {
        "work_date": "2026-08-04", "project_id": project["id"], "post_id": post["id"], "description": "Ongewijzigd", "duration_half_hours": 2,
        "participants": [{"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
    }
    group = client.post("/api/urenverantwoording/groepen", headers=headers, json=payload).json()
    return me, project, post, payload, group


def test_create_unknown_live_user_returns_controlled_422_without_writes(client):
    headers = _login(client)
    _, project, post, payload, _ = _create_validation_group(client, headers)
    before = client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"]
    before_audit = len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"])
    payload.update({"project_id": project["id"], "post_id": post["id"], "description": "Mag niet bestaan"})
    payload["participants"][0]["user_id"] = "unknown-live-user"

    response = client.post("/api/urenverantwoording/groepen", headers=headers, json=payload)

    assert response.status_code == 422
    assert "participant.user_id" in response.json()["detail"]
    assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"] == before
    assert len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]) == before_audit


def test_update_unknown_live_user_returns_controlled_422_without_writes(client):
    headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, headers)
    before_audit = len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"])
    participant = {**group["participants"][0], "user_id": "unknown-live-user"}

    response = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "Partial write", "participants": [participant], "expected_row_version": group["row_version"]})

    assert response.status_code == 422
    assert "participant.user_id" in response.json()["detail"]
    unchanged = client.get("/api/urenverantwoording/groepen", headers=headers).json()["items"][0]
    assert unchanged["description"] == "Ongewijzigd"
    assert unchanged["row_version"] == group["row_version"]
    assert len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]) == before_audit


@pytest.mark.parametrize("variant", ["unknown_kind", "no_identity", "multiple_identities", "unknown_external", "inactive_external", "new_historical"])
def test_patch_rejects_each_invalid_participant_identity_without_partial_write(client, variant):
    headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, headers)
    archived = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Niet selecteerbaar", "email": "inactive@example.com", "note": ""}).json()
    client.post(f"/api/urenverantwoording/externe-personen/{archived['id']}/archiveren?expected_row_version={archived['row_version']}", headers=headers)
    base = {"display_name_snapshot": "Ongeldig", "display_email_snapshot": "invalid@example.com", "display_type_snapshot": "Extern", "sort_order": 0}
    invalid = {
        "unknown_kind": {**base, "participant_kind": "alien", "external_person_id": archived["id"]},
        "no_identity": {**base, "participant_kind": "external_person"},
        "multiple_identities": {**base, "participant_kind": "live_user", "user_id": "missing", "external_person_id": archived["id"]},
        "unknown_external": {**base, "participant_kind": "external_person", "external_person_id": "missing-external"},
        "inactive_external": {**base, "participant_kind": "external_person", "external_person_id": archived["id"]},
        "new_historical": {**base, "participant_kind": "historical_identity", "historical_identity_id": "missing-history"},
    }[variant]
    before_audit = len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"])

    response = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "Partial write", "participants": [invalid], "expected_row_version": group["row_version"]})

    assert response.status_code == 422
    unchanged = client.get("/api/urenverantwoording/groepen", headers=headers).json()["items"][0]
    assert unchanged["description"] == "Ongewijzigd"
    assert unchanged["row_version"] == group["row_version"]
    assert unchanged["participants"] == group["participants"]
    assert len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]) == before_audit


def test_patch_participant_integrity_error_returns_422_and_rolls_back_every_write(client, monkeypatch):
    headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, headers)
    before_audit = len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"])
    original_flush = Session.flush

    def fail_participant_flush(self, *args, **kwargs):
        raise IntegrityError("participant constraint", {}, Exception("invalid participant"))

    monkeypatch.setattr(Session, "flush", fail_participant_flush)
    response = client.patch(
        f"/api/urenverantwoording/groepen/{group['id']}",
        headers=headers,
        json={"description": "Partial write", "participants": group["participants"], "expected_row_version": group["row_version"]},
    )
    monkeypatch.setattr(Session, "flush", original_flush)

    assert response.status_code == 422
    unchanged = client.get("/api/urenverantwoording/groepen", headers=headers).json()["items"][0]
    assert unchanged["description"] == "Ongewijzigd"
    assert unchanged["row_version"] == group["row_version"]
    assert unchanged["participants"] == group["participants"]
    assert len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]) == before_audit


@pytest.mark.parametrize("user_id,with_metadata", [("unknown-live-user", False), ("unknown-live-user", True), (None, False), (None, True)])
def test_import_missing_live_user_with_and_without_identity_metadata_has_no_undefined_path(client, user_id, with_metadata):
    headers = _login(client)
    _, project, post, _, _ = _create_validation_group(client, headers)
    participant = {
        "participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Legacy" if with_metadata else "Onbekend",
        "display_email_snapshot": "legacy@example.com" if with_metadata else None, "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0,
    }
    envelope = {"format_version": "1.0", "backup_version": "1", "projects": [project], "posts": [post], "external_people": [], "historical_identities": [], "groups": [{"id": "unknown-user-group", "work_date": "2026-08-04", "project_id": project["id"], "post_id": post["id"], "description": "Geen write", "duration_half_hours": 2, "participants": [participant]}]}
    before = client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"]
    before_audit = len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"])

    response = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json=envelope)

    expected_status = 422 if user_id is None and not with_metadata else 200
    assert response.status_code == expected_status
    assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"] == before
    expected_audit_delta = 1 if expected_status == 422 else 2
    assert len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]) == before_audit + expected_audit_delta


def test_person_picker_returns_all_eligible_active_users_and_external_people(client):
    headers = _login(client)
    first = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Extern Een", "email": "een@example.com", "note": ""}).json()
    second = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Extern Twee", "email": "twee@example.com", "note": ""}).json()

    meta = client.get("/api/urenverantwoording/meta", headers=headers).json()

    assert {user["display_name"] for user in meta["eligible_users"]} >= {"admin", "editor"}
    assert {person["id"] for person in meta["external_people"] if person["selectable"]} >= {first["id"], second["id"]}


def test_admin_audit_combined_filters_return_only_matching_actual_request_metadata(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Auditfilterproject", "description": ""}).json()

    response = client.get(f"/api/urenverantwoording/audit?actor={me['id']}&action=work_hours.project.created&result=success&method=POST&path=/projecten&from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z", headers=headers)

    assert response.status_code == 200
    assert response.json()["total"] == 1
    event = response.json()["items"][0]
    assert event["actor_display_name"] == "admin"
    assert event["action"] == "work_hours.project.created"
    assert event["request_method"] == "POST"
    assert event["request_path"] == "/api/urenverantwoording/projecten"
    assert event["result"] == "success"
    assert project["id"] in json.loads(event["details_json"])["target_id"]


def test_backup_full_restore_roundtrip_preserves_all_domain_fields_and_stable_ids():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        project = service.create_project(admin, WorkProjectCreateRequest(name="Roundtrip", description="Exact"))
        post = service.create_post(admin, WorkPostCreateRequest(project_id=project.id, name="Werk", description="Exact"))
        group = service.create_group(admin, WorkHourGroupCreateRequest(
            work_date=date(2026, 8, 4), project_id=project.id, post_id=post.id,
            description="Exact", duration_half_hours=48,
            participants=[{"participant_kind": "live_user", "user_id": admin.id, "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        ))
        persisted = service.repo.get_group(group.id, include_deleted=True)
        assert persisted is not None
        removed = WorkHourGroupParticipant(
            group_id=persisted.id, participant_kind="live_user", user_id=admin.id,
            display_name_snapshot="Admin oud", display_email_snapshot="old@example.com",
            display_type_snapshot="WindWilly-gebruiker", sort_order=9,
            created_by_user_id=admin.id, updated_by_user_id=admin.id,
            created_at=datetime(2026, 8, 4, 9, tzinfo=UTC), updated_at=datetime(2026, 8, 4, 9, tzinfo=UTC),
            deleted_at=datetime(2026, 8, 4, 10, tzinfo=UTC), deleted_by_user_id=admin.id,
            row_version=7,
        )
        db.add(removed)
        persisted.row_version = 6
        db.commit()
        before = service.build_backup_envelope()
        audit_count = db.query(AuditEvent).count()
        preview = service.preview_import(admin, before, "full_restore")
        result = service.commit_import(admin, preview.batch_id, before, "full_restore")
        assert result.status == "completed"
        after = service.build_backup_envelope()
        assert after.model_dump(mode="json") == before.model_dump(mode="json")
        restored = after.groups[0]
        assert restored.id == group.id
        assert {item.id for item in restored.participants} == {group.participants[0].id, removed.id}
        assert next(item for item in restored.participants if item.id == removed.id).row_version == 7
        assert next(item for item in restored.participants if item.id == removed.id).deleted_by_user_id == admin.id
        assert db.query(AuditEvent).count() > audit_count
    finally:
        db.close()


def test_mutations_require_expected_row_version_and_stale_write_has_no_audit(client):
    headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, headers)
    missing = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "missing"})
    assert missing.status_code == 409
    first = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "winner", "expected_row_version": group["row_version"]})
    assert first.status_code == 200
    before_audit = client.get("/api/urenverantwoording/audit", headers=headers).json()["total"]
    stale = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"description": "loser", "expected_row_version": group["row_version"]})
    assert stale.status_code == 409
    assert stale.json()["detail"]["current_row_version"] == first.json()["row_version"]
    assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["items"][0]["description"] == "winner"
    assert client.get("/api/urenverantwoording/audit", headers=headers).json()["total"] == before_audit


def test_backup_roundtrip_preserves_removed_participants_without_reactivating_them(client):
    headers = _login(client)
    me, project, post, _, group = _create_validation_group(client, headers)
    external = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Tijdelijk", "email": "tijdelijk@example.com", "note": ""}).json()
    with_external = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={
        "expected_row_version": group["row_version"],
        "participants": [group["participants"][0], {"participant_kind": "external_person", "external_person_id": external["id"], "display_name_snapshot": "Tijdelijk", "display_type_snapshot": "Extern"}],
    }).json()
    removed = client.patch(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers, json={"expected_row_version": with_external["row_version"], "participants": [with_external["participants"][0]]}).json()
    deleted = client.delete(f"/api/urenverantwoording/groepen/{group['id']}?expected_row_version={removed['row_version']}", headers=headers)
    assert deleted.status_code == 200
    restored = client.post(f"/api/urenverantwoording/groepen/{group['id']}/herstellen?expected_row_version={removed['row_version'] + 1}", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["person_count"] == 1
    assert restored.json()["participants"][0]["user_id"] == me["id"]


def test_portable_work_hours_checks_reject_invalid_duration_identity_cardinality_and_active_participant_duplicate():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        project = WorkProject(name="DB checks", description="")
        db.add(project); db.flush()
        post = WorkPost(project_id=project.id, name="DB post", description="")
        db.add(post); db.flush()
        invalid_group = WorkHourGroup(work_date=date(2026, 8, 4), project_id=project.id, post_id=post.id, description="", duration_half_hours=0)
        db.add(invalid_group)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

        project = WorkProject(name="DB checks 2", description="")
        db.add(project); db.flush()
        post = WorkPost(project_id=project.id, name="DB post 2", description="")
        db.add(post); db.flush()
        group = WorkHourGroup(work_date=date(2026, 8, 4), project_id=project.id, post_id=post.id, description="", duration_half_hours=1)
        db.add(group); db.flush()
        db.add_all([
            WorkHourGroupParticipant(group_id=group.id, participant_kind="live_user", user_id=admin.id, display_name_snapshot="A", display_type_snapshot="User"),
            WorkHourGroupParticipant(group_id=group.id, participant_kind="live_user", user_id=admin.id, display_name_snapshot="A", display_type_snapshot="User"),
        ])
        with pytest.raises(IntegrityError):
            db.flush()
    finally:
        db.rollback()
        db.close()


def test_non_admin_deleted_history_and_relink_endpoints_return_403_without_metadata_leak(client):
    editor = _login(client, username="editor", password="editor12345")
    history = client.get("/api/urenverantwoording/admin/history", headers=editor)
    deleted = client.get("/api/urenverantwoording/groepen?include_deleted=true&deleted_only=true", headers=editor)
    relink = client.post("/api/urenverantwoording/historische-identiteiten/missing/koppelen", headers=editor, json={"linked_user_id": "missing", "expected_row_version": 1})
    assert history.status_code == deleted.status_code == relink.status_code == 403
    for response in (history, deleted, relink):
        serialized = json.dumps(response.json())
        assert "email" not in serialized and "deleted_by" not in serialized and "total" not in serialized


def test_totals_endpoint_does_not_materialize_all_matching_orm_rows(monkeypatch):
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        project = service.create_project(admin, WorkProjectCreateRequest(name="SQL total", description=""))
        post = service.create_post(admin, WorkPostCreateRequest(project_id=project.id, name="SQL post", description=""))
        service.create_group(admin, WorkHourGroupCreateRequest(work_date=date(2026, 8, 4), project_id=project.id, post_id=post.id, description="", duration_half_hours=4, participants=[{"participant_kind": "live_user", "user_id": admin.id, "display_name_snapshot": "Admin", "display_type_snapshot": "User"}]))
        calls = {"count": 0}
        original = service.repo.list_groups
        def counted(*args, **kwargs):
            calls["count"] += 1
            return original(*args, **kwargs)
        monkeypatch.setattr(service.repo, "list_groups", counted)
        result = service.list_hours(WorkHoursListQuery())
        assert calls["count"] == 1
        assert result.totals.total_groups == 1
        assert result.totals.total_person_hours == 2
    finally:
        db.close()


def test_import_stream_accepts_exact_byte_limit_and_rejects_limit_plus_one_before_parse(client):
    headers = _login(client)
    headers["Content-Type"] = "application/json"
    settings = get_settings()
    original = settings.work_hours_import_max_bytes
    try:
        raw = json.dumps({"format_version": "1.0", "backup_version": "1", "projects": [], "posts": [], "external_people": [], "historical_identities": [], "groups": []}).encode()
        settings.work_hours_import_max_bytes = len(raw) + 16
        exact = (b" " * 16) + raw
        accepted = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, content=exact)
        assert accepted.status_code == 200
        rejected = client.post("/api/urenverantwoording/import/preview?mode=merge", headers={**headers, "Content-Length": "1"}, content=b" " + exact)
        assert rejected.status_code == 413
    finally:
        settings.work_hours_import_max_bytes = original


def test_import_postparse_depth_and_node_limits_reject_before_preview_or_writes(client):
    headers = _login(client)
    settings = get_settings()
    original_depth = settings.work_hours_import_max_depth
    original_nodes = settings.work_hours_import_max_nodes
    try:
        settings.work_hours_import_max_depth = 2
        settings.work_hours_import_max_nodes = 100
        payload = {"format_version": "1.0", "backup_version": "1", "projects": [], "posts": [], "external_people": [], "historical_identities": [], "groups": [], "unknown": {"nested": {"too": "deep"}}}
        before = client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"]
        response = client.post("/api/urenverantwoording/import/preview?mode=merge", headers=headers, json=payload)
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "work_hours_import_resource_limit"
        assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"] == before
    finally:
        settings.work_hours_import_max_depth = original_depth
        settings.work_hours_import_max_nodes = original_nodes


def test_audit_filters_sort_count_and_page_in_sql_without_duplicates_or_omissions(client):
    headers = _login(client)
    db_gen = client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        actor = db.query(User).filter_by(username="admin").one()
        for index in range(31):
            db.add(AuditEvent(
                event_type="work_hours.security.test",
                actor_user_id=actor.id,
                details_json=json.dumps({"result": "success", "request_method": "PATCH", "request_path": f"/api/urenverantwoording/test/{index}"}),
                created_at=datetime(2026, 10, 24, 22, 0, tzinfo=UTC) + timedelta(minutes=index),
            ))
        db.commit()
    finally:
        db.close()
        try:
            next(db_gen)
        except StopIteration:
            pass
    first = client.get("/api/urenverantwoording/audit?action=work_hours.security.test&result=success&method=PATCH&path=/test/&page=1&page_size=25", headers=headers).json()
    second = client.get("/api/urenverantwoording/audit?action=work_hours.security.test&result=success&method=PATCH&path=/test/&page=2&page_size=25", headers=headers).json()
    assert first["total"] == second["total"] == 31
    assert len(first["items"]) == 25 and len(second["items"]) == 6
    ids = [item["id"] for item in first["items"] + second["items"]]
    assert len(ids) == len(set(ids)) == 31
    assert all("+01:00" in item["created_at"] or "+02:00" in item["created_at"] for item in first["items"] + second["items"])


def test_work_hours_export_renders_timestamps_in_europe_amsterdam():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        project = WorkProject(name="Project Tijdzone", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        db.add(project)
        db.flush()
        post = WorkPost(project_id=project.id, name="Post Tijdzone", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        db.add(post)
        db.flush()
        group = WorkHourGroup(
            work_date=date(2026, 6, 2),
            project_id=project.id,
            post_id=post.id,
            description="Tijdzone test",
            duration_half_hours=2,
            created_by_user_id=admin.id,
            updated_by_user_id=admin.id,
            created_at=datetime(2026, 6, 2, 13, 32, tzinfo=UTC),
            updated_at=datetime(2026, 6, 2, 13, 32, tzinfo=UTC),
        )
        db.add(group)
        db.flush()
        db.add(
            WorkHourGroupParticipant(
                group_id=group.id,
                participant_kind="live_user",
                user_id=admin.id,
                display_name_snapshot="Admin",
                display_email_snapshot="admin@example.com",
                display_type_snapshot="WindWilly-gebruiker",
                sort_order=0,
                created_by_user_id=admin.id,
                updated_by_user_id=admin.id,
            )
        )
        db.commit()

        csv_bytes = WorkHoursService(WorkHoursRepository(db), AuditService(db)).export_csv(WorkHoursListQuery())
        csv_text = csv_bytes.decode("utf-8")
        assert "02-06-2026, 15:32" in csv_text
    finally:
        db.close()


@pytest.mark.parametrize("query", ["include_deleted=true", "deleted_only=true", "deleted_only=true&include_deleted=false"])
def test_csv_deleted_flags_require_admin_before_query_or_serialization(client, query):
    admin_headers = _login(client)
    _create_validation_group(client, admin_headers)
    editor_headers = _login(client, username="editor", password="editor12345")
    response = client.get(f"/api/urenverantwoording/export.csv?{query}", headers=editor_headers)
    assert response.status_code == 403
    assert not response.headers.get("content-type", "").startswith("text/csv")
    assert "datum;naam persoon" not in response.text
    audit = client.get("/api/urenverantwoording/audit", headers=admin_headers).json()["items"]
    denied = next(item for item in audit if item["action"] == "work_hours.authorization.denied")
    details = json.loads(denied["details_json"])
    assert details["result"] == "denied"
    assert "request_body" not in details


def test_regular_user_csv_without_deleted_flags_exports_only_active_matches(client):
    admin_headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, admin_headers)
    editor_headers = _login(client, username="editor", password="editor12345")
    assert "Ongewijzigd" in client.get("/api/urenverantwoording/export.csv", headers=editor_headers).text
    client.delete(f"/api/urenverantwoording/groepen/{group['id']}?expected_row_version={group['row_version']}", headers=admin_headers)
    assert "Ongewijzigd" not in client.get("/api/urenverantwoording/export.csv", headers=editor_headers).text


def _all_response_keys(value):
    if isinstance(value, dict):
        return set(value) | set().union(*(_all_response_keys(child) for child in value.values()), set())
    if isinstance(value, list):
        return set().union(*(_all_response_keys(child) for child in value), set())
    return set()


def test_non_admin_meta_schema_recursively_excludes_email_internal_identity_provenance_deletion_and_actor_fields(client):
    admin_headers = _login(client)
    _create_validation_group(client, admin_headers)
    editor_headers = _login(client, username="editor", password="editor12345")
    payload = client.get("/api/urenverantwoording/meta", headers=editor_headers).json()
    forbidden = {"email", "username", "note", "source_key", "user_id", "external_person_id", "historical_identity_id", "source_user_id", "linked_user_id", "source_import_batch_id", "deleted_at", "deleted_by_user_id", "created_by_user_id", "updated_by_user_id"}
    assert not (_all_response_keys(payload) & forbidden)


def test_non_admin_group_list_and_detail_schemas_recursively_exclude_email_internal_identity_provenance_deletion_and_actor_fields(client):
    admin_headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, admin_headers)
    editor_headers = _login(client, username="editor", password="editor12345")
    for response in (client.get("/api/urenverantwoording/groepen", headers=editor_headers), client.get(f"/api/urenverantwoording/groepen/{group['id']}", headers=editor_headers)):
        assert response.status_code == 200
        keys = _all_response_keys(response.json())
        assert not (keys & {"email", "user_id", "external_person_id", "historical_identity_id", "source_import_batch_id", "deleted_at", "deleted_by_user_id", "created_by_user_id", "updated_by_user_id"})


@pytest.mark.parametrize("suffix", ["unknown=value", "sort_key=forbidden", "sort_direction=sideways", "project_id=a&project_id=b"])
def test_canonical_query_contract_rejects_unknown_duplicate_and_invalid_values(client, suffix):
    headers = _login(client)
    assert client.get(f"/api/urenverantwoording/groepen?{suffix}", headers=headers).status_code == 422
    assert client.get(f"/api/urenverantwoording/export.csv?{suffix}", headers=headers).status_code == 422


def test_force_create_allows_confirmed_advisory_name_match_without_equal_email(client):
    headers = _login(client)
    assert client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Naamadvies", "email": "een@example.com", "note": ""}).status_code == 201
    assert client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Naamadvies", "email": "twee@example.com", "note": ""}).status_code == 409
    assert client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Naamadvies", "email": "twee@example.com", "note": "", "force_create": True}).status_code == 201


@pytest.mark.parametrize("force_create", [False, True])
def test_force_create_cannot_bypass_hard_identity_or_normalized_email_uniqueness(client, force_create):
    headers = _login(client)
    client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Eerste", "email": "UNIEK@example.com", "note": ""})
    response = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Andere", "email": "uniek@example.com", "note": "", "force_create": force_create})
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "work_hours_external_person_hard_conflict"


def test_external_merge_retargets_reference_but_keeps_all_participant_display_snapshots_byte_identical(client):
    headers = _login(client)
    _, project, post, _, _ = _create_validation_group(client, headers)
    source = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Oude naam", "email": "oud@example.com", "note": ""}).json()
    target = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Nieuwe naam", "email": "nieuw@example.com", "note": ""}).json()
    group = client.post("/api/urenverantwoording/groepen", headers=headers, json={
        "work_date": "2026-08-04", "project_id": project["id"], "post_id": post["id"], "description": "Merge snapshot", "duration_half_hours": 2,
        "participants": [{"participant_kind": "external_person", "external_person_id": source["id"], "display_name_snapshot": "Historische schrijfwijze", "display_email_snapshot": "historisch@example.com", "display_type_snapshot": "Extern oud", "sort_order": 0}],
    }).json()
    before = group["participants"][0]
    merged = client.post(f"/api/urenverantwoording/externe-personen/{source['id']}/merge", headers=headers, json={"target_id": target["id"], "expected_source_row_version": source["row_version"], "expected_target_row_version": target["row_version"]})
    assert merged.status_code == 200
    after = client.get(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers).json()["participants"][0]
    assert after["external_person_id"] == target["id"]
    assert (after["display_name_snapshot"], after["display_email_snapshot"], after["display_type_snapshot"]) == (before["display_name_snapshot"], before["display_email_snapshot"], before["display_type_snapshot"])


def test_external_merge_rejects_source_target_participant_collision_without_silent_dedupe(client):
    headers = _login(client)
    _, project, post, _, _ = _create_validation_group(client, headers)
    source = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Bron", "email": "bron@example.com", "note": ""}).json()
    target = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Doel", "email": "doel@example.com", "note": ""}).json()
    group = client.post("/api/urenverantwoording/groepen", headers=headers, json={
        "work_date": "2026-08-04", "project_id": project["id"], "post_id": post["id"], "description": "Collision", "duration_half_hours": 2,
        "participants": [
            {"participant_kind": "external_person", "external_person_id": source["id"], "display_name_snapshot": "Bron", "display_type_snapshot": "Extern", "sort_order": 0},
            {"participant_kind": "external_person", "external_person_id": target["id"], "display_name_snapshot": "Doel", "display_type_snapshot": "Extern", "sort_order": 1},
        ],
    }).json()
    response = client.post(f"/api/urenverantwoording/externe-personen/{source['id']}/merge", headers=headers, json={"target_id": target["id"], "expected_source_row_version": source["row_version"], "expected_target_row_version": target["row_version"]})
    assert response.status_code == 409
    unchanged = client.get(f"/api/urenverantwoording/groepen/{group['id']}", headers=headers).json()
    assert {item["external_person_id"] for item in unchanged["participants"]} == {source["id"], target["id"]}


def test_restore_from_active_becomes_active_and_restore_from_archived_remains_archived(client):
    headers = _login(client)
    active = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Actief herstel", "description": ""}).json()
    assert client.delete(f"/api/urenverantwoording/projecten/{active['id']}?expected_row_version={active['row_version']}", headers=headers).status_code == 200
    restored_active = client.post(f"/api/urenverantwoording/projecten/{active['id']}/herstellen?expected_row_version={active['row_version'] + 1}", headers=headers).json()
    assert restored_active["is_active"] is True and restored_active["is_archived"] is False

    archived = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Archief herstel", "description": ""}).json()
    archived = client.post(f"/api/urenverantwoording/projecten/{archived['id']}/archiveren?expected_row_version={archived['row_version']}", headers=headers).json()
    assert client.delete(f"/api/urenverantwoording/projecten/{archived['id']}?expected_row_version={archived['row_version']}", headers=headers).status_code == 200
    restored_archived = client.post(f"/api/urenverantwoording/projecten/{archived['id']}/herstellen?expected_row_version={archived['row_version'] + 1}", headers=headers).json()
    assert restored_archived["is_active"] is False and restored_archived["is_archived"] is True
    assert restored_archived["archived_at"] is not None


def test_project_archive_or_delete_removes_child_selectability_without_cascade_restore(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Parent state", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Child state", "description": ""}).json()
    archived = client.post(f"/api/urenverantwoording/projecten/{project['id']}/archiveren?expected_row_version={project['row_version']}", headers=headers).json()
    meta = client.get("/api/urenverantwoording/meta", headers=headers).json()
    assert project["id"] not in {item["id"] for item in meta["projects"]}
    assert post["id"] not in {item["id"] for item in meta["posts"]}
    client.post(f"/api/urenverantwoording/projecten/{project['id']}/herstellen?expected_row_version={archived['row_version']}", headers=headers)
    masterdata = client.get("/api/urenverantwoording/admin/masterdata", headers=headers).json()
    unchanged_post = next(item for item in masterdata["posts"] if item["id"] == post["id"])
    assert unchanged_post["row_version"] == post["row_version"]


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["preview", "commit"])
async def test_non_admin_import_endpoints_deny_and_audit_before_reading_request_body(endpoint):
    from starlette.requests import Request

    db = _service_session()
    reads = 0
    try:
        editor = User(username="body-reader", password_hash=hash_password("editor12345"), is_active=True, is_admin=False)
        db.add(editor)
        db.commit()

        async def receive():
            nonlocal reads
            reads += 1
            raise AssertionError("request body is gelezen")

        path = f"/api/urenverantwoording/import/{endpoint}"
        request = Request({"type": "http", "method": "POST", "path": path, "headers": [], "query_string": b"", "scheme": "https", "server": ("test", 443), "client": ("test", 1)}, receive)
        with pytest.raises(HTTPException) as excinfo:
            if endpoint == "preview":
                await preview_import_endpoint(request=request, mode="merge", current=editor, db=db)
            else:
                await commit_import_endpoint(request=request, batch_id="missing", mode="merge", current=editor, db=db)
        assert excinfo.value.status_code == 403
        assert reads == 0
        denied = db.query(AuditEvent).filter(AuditEvent.event_type == "work_hours.authorization.denied").one()
        detail = json.loads(denied.details_json)
        assert (denied.actor_user_id, detail["request_method"], detail["request_path"], detail["result"]) == (editor.id, "POST", path, "denied")
        assert not ({"body", "content", "hash", "filename"} & set(detail))
    finally:
        db.close()


def test_external_update_hard_email_uniqueness_and_status_fields_are_controlled(client):
    headers = _login(client)
    first = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Eerste update", "email": "first@example.com", "note": ""}).json()
    second = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Tweede update", "email": "second@example.com", "note": ""}).json()
    before_audit = len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"])

    duplicate = client.patch(f"/api/urenverantwoording/externe-personen/{second['id']}", headers=headers, json={"email": " FIRST@example.com ", "expected_row_version": second["row_version"]})
    forbidden_status = client.patch(f"/api/urenverantwoording/externe-personen/{second['id']}", headers=headers, json={"is_active": False, "expected_row_version": second["row_version"]})
    assert duplicate.status_code == 409
    assert forbidden_status.status_code == 422
    unchanged = client.get("/api/urenverantwoording/admin/masterdata", headers=headers).json()["external_people"]
    assert next(item for item in unchanged if item["id"] == second["id"])["row_version"] == second["row_version"]
    assert len(client.get("/api/urenverantwoording/audit", headers=headers).json()["items"]) == before_audit


def test_external_explicit_status_actions_produce_coherent_states(client):
    headers = _login(client)
    person = client.post("/api/urenverantwoording/externe-personen", headers=headers, json={"display_name": "Statuspersoon", "email": "status@example.com", "note": ""}).json()
    inactive = client.post(f"/api/urenverantwoording/externe-personen/{person['id']}/deactiveren?expected_row_version={person['row_version']}", headers=headers)
    assert inactive.status_code == 200 and inactive.json()["is_active"] is False and inactive.json()["deleted_at"] is None
    active = client.post(f"/api/urenverantwoording/externe-personen/{person['id']}/activeren?expected_row_version={inactive.json()['row_version']}", headers=headers)
    assert active.status_code == 200 and active.json()["is_active"] is True and active.json()["deleted_at"] is None
    deleted = client.post(f"/api/urenverantwoording/externe-personen/{person['id']}/archiveren?expected_row_version={active.json()['row_version']}", headers=headers)
    assert deleted.status_code == 200 and deleted.json()["is_active"] is False and deleted.json()["deleted_at"] is not None
    blocked = client.post(f"/api/urenverantwoording/externe-personen/{person['id']}/activeren?expected_row_version={deleted.json()['row_version']}", headers=headers)
    assert blocked.status_code == 422


def test_complete_audit_after_snapshot_contains_definitive_parent_and_all_children(client):
    headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, headers)
    event = next(item for item in client.get("/api/urenverantwoording/audit", headers=headers).json()["items"] if item["event_type"] == "work_hours.group.created")
    after = json.loads(event["details_json"])["after"]
    assert after["id"] == group["id"]
    assert after["row_version"] == group["row_version"]
    assert [item["id"] for item in after["participants"]] == [item["id"] for item in group["participants"]]
    assert all(item["group_id"] == group["id"] for item in after["participants"])


def test_missing_user_reuse_prefers_exact_source_key_then_unique_normalized_email():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        exact = WorkHistoricalUserIdentity(source_key="missing-user:source-1", snapshot_name="Bron", snapshot_email="bron@example.com", snapshot_display_label="Bron", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        other_email = WorkHistoricalUserIdentity(source_key="other", snapshot_name="Ander", snapshot_email="bron@example.com", snapshot_display_label="Ander", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        unique_email = WorkHistoricalUserIdentity(source_key="email-only", snapshot_name="E-mail", snapshot_email="unique@example.com", snapshot_display_label="E-mail", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        db.add_all([exact, other_email, unique_email])
        db.commit()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        assert service._materialize_historical_identity(admin, source_key="missing-user:source-1", snapshot_name="Bron", snapshot_email="bron@example.com", snapshot_display_label="Bron").id == exact.id
        assert service._materialize_historical_identity(admin, source_key="missing-user:new-source", snapshot_name="E-mail", snapshot_email=" UNIQUE@example.com ", snapshot_display_label="E-mail").id == unique_email.id
        assert db.query(WorkHistoricalUserIdentity).count() == 3
    finally:
        db.close()


def test_missing_user_reuse_rejects_conflicting_source_key_ambiguous_email_and_name_only_fallback_without_writes():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        db.add_all([
            WorkHistoricalUserIdentity(source_key="missing-user:conflict", snapshot_name="Origineel", snapshot_email="original@example.com", snapshot_display_label="Origineel", created_by_user_id=admin.id, updated_by_user_id=admin.id),
            WorkHistoricalUserIdentity(source_key="ambiguous-1", snapshot_name="Ambigue", snapshot_email="same@example.com", snapshot_display_label="Ambigue", created_by_user_id=admin.id, updated_by_user_id=admin.id),
            WorkHistoricalUserIdentity(source_key="ambiguous-2", snapshot_name="Ambigue", snapshot_email="same@example.com", snapshot_display_label="Ambigue", created_by_user_id=admin.id, updated_by_user_id=admin.id),
        ])
        db.commit()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        before = db.query(WorkHistoricalUserIdentity).count()
        variants = [
            dict(source_key="missing-user:conflict", snapshot_name="Botsing", snapshot_email="new@example.com", snapshot_display_label="Botsing"),
            dict(source_key="missing-user:new", snapshot_name="Ambigue", snapshot_email="same@example.com", snapshot_display_label="Ambigue"),
            dict(source_key="", snapshot_name="Alleen naam", snapshot_email=None, snapshot_display_label="Alleen naam"),
        ]
        for variant in variants:
            with pytest.raises(HTTPException) as excinfo:
                service._materialize_historical_identity(admin, **variant)
            assert excinfo.value.status_code == 422
            assert db.query(WorkHistoricalUserIdentity).count() == before
    finally:
        db.close()


def test_historical_identity_backup_roundtrip_preserves_all_create_update_delete_link_actor_provenance():
    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        start = datetime(2026, 8, 4, 8, tzinfo=UTC)
        identity = WorkHistoricalUserIdentity(
            source_key="legacy:user-1", source_user_id=admin.id, snapshot_name="Historisch",
            snapshot_email="history@example.com", snapshot_display_label="Historisch", linked_user_id=admin.id,
            linked_at=start + timedelta(hours=2), linked_by_user_id=admin.id, is_active=False,
            created_at=start, created_by_user_id=admin.id, updated_at=start + timedelta(hours=1), updated_by_user_id=admin.id,
            deleted_at=start + timedelta(hours=3), deleted_by_user_id=admin.id, row_version=7,
        )
        db.add(identity)
        db.commit()
        service = WorkHoursService(WorkHoursRepository(db), AuditService(db))
        before = service.build_backup_envelope()
        preview = service.preview_import(admin, before, "full_restore")
        service.commit_import(admin, preview.batch_id, before, "full_restore")
        after = service.build_backup_envelope()
        before_identity = before.historical_identities[0].model_dump(mode="json")
        after_identity = after.historical_identities[0].model_dump(mode="json")
        assert after_identity == before_identity
    finally:
        db.close()
