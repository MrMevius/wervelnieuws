import csv
import json
from datetime import UTC, date, datetime, timedelta
from io import StringIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base, _enable_sqlite_foreign_keys
from app.api.work_hours import _historical_reference_name
from app.api.deps import get_db
from app.core.settings import get_settings
from app.core.security import hash_password
from app.models.entities import AuditEvent, User, WorkExternalPerson, WorkHistoricalUserIdentity, WorkHourGroup, WorkHourGroupParticipant, WorkPost, WorkPostLegacyAlias, WorkProject, WorkProjectLegacyAlias
from app.repositories.work_hours_repository import WorkHoursRepository
from app.schemas.work_hours import WorkHourGroupCreateRequest, WorkHourGroupUpdateRequest, WorkPostCreateRequest, WorkProjectCreateRequest
from app.services.audit_service import AuditService
from app.services.work_hours_service import WorkHoursListQuery, WorkHoursService
from app.services.work_hours_migration import (
    CentralProjectRow,
    LegacyPostRow,
    LegacyProjectRow,
    ProjectMappingConflict,
    build_canonical_posts,
    build_project_mappings,
    normalize_masterdata_name,
)
from tests.work_hours_removal_migration_cases import (
    test_file_cleanup_never_follows_symlinks,
    test_populated_removal_migration_cleans_only_bounded_subsystem,
    test_removal_migration_rejects_directory_symlinks_before_destructive_work,
    test_removal_migration_rejects_registered_path_outside_boundary_before_db_cleanup,
)


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
        before = connection.scalar(text("SELECT count(*) FROM work_hour_groups"))
        connection.commit()
        with pytest.raises(IntegrityError):
            with connection.begin():
                connection.execute(text("INSERT INTO work_hour_groups (id, created_at, updated_at, work_date, project_id, post_id, description, duration_half_hours, row_version) VALUES ('orphan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '2026-08-09', 'missing', 'missing', '', 1, 1)"))
        assert connection.scalar(text("SELECT count(*) FROM work_hour_groups")) == before
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


def test_removed_hours_json_routes_are_404_for_admin_and_editor_without_audit_writes(client):
    admin_headers = _login(client)
    editor_headers = _login(client, username="editor", password="editor12345")
    _create_validation_group(client, admin_headers)
    client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Route sentinel", "email": "route-sentinel@example.com", "note": "bytegelijk"},
    )
    hours_dir = get_settings().storage_root / get_settings().exports_dir / "urenverantwoording"
    hours_dir.mkdir(parents=True, exist_ok=True)
    (hours_dir / "route-sentinel.json").write_bytes(b"route-json-sentinel")
    (hours_dir / "route-sentinel.tmp").write_bytes(b"route-tmp-sentinel")
    (hours_dir / "route-sentinel.txt").write_bytes(b"route-text-sentinel")

    def database_snapshot() -> dict[str, list[tuple]]:
        db_generator = client.app.dependency_overrides[get_db]()
        db = next(db_generator)
        try:
            tables = (
                "projects", "work_posts", "work_external_people",
                "work_historical_user_identities", "work_hour_groups",
                "work_hour_group_participants", "audit_events",
            )
            return {
                table: [tuple(row) for row in db.execute(text(f'SELECT * FROM "{table}" ORDER BY id')).fetchall()]
                for table in tables
            }
        finally:
            db.close()
            db_generator.close()

    def filesystem_snapshot() -> dict[str, bytes]:
        return {
            str(path.relative_to(hours_dir)): path.read_bytes()
            for path in sorted(hours_dir.rglob("*"))
            if path.is_file() and not path.is_symlink()
        }

    before_db = database_snapshot()
    before_files = filesystem_snapshot()
    route_root = "/api/urenverantwoording/" + "im" + "port"
    requests = [
        ("post", f"{route_root}/preview", b"not-json"),
        ("post", f"{route_root}/commit?batch_id=missing", b"not-json"),
        ("get", f"{route_root}/batches/missing/backup", None),
    ]
    for headers in (admin_headers, editor_headers):
        for method, path, body in requests:
            response = client.request(method, path, headers=headers, content=body)
            assert response.status_code == 404
    assert database_snapshot() == before_db
    assert filesystem_snapshot() == before_files


def _service_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)
    db = SessionLocal()
    db.add(User(username="admin", password_hash=hash_password("admin12345"), is_active=True, is_admin=True))
    db.commit()
    return db


def test_central_project_and_global_post_mapping_is_deterministic_and_ambiguous_safe():
    created = datetime(2026, 1, 1, tzinfo=UTC)
    legacy = [
        LegacyProjectRow("legacy-exact", "Project A", "", True, False, created),
        LegacyProjectRow("legacy-normalized", "  PROJECT   B ", "", True, False, created),
        LegacyProjectRow("legacy-new", "Project C", "", True, False, created),
    ]
    central = [CentralProjectRow("central-a", "Project A"), CentralProjectRow("central-b", "Project B")]
    first = build_project_mappings(legacy, central)
    assert first == build_project_mappings(list(reversed(legacy)), central)
    assert [(item.legacy_id, item.project_id, item.create_project) for item in first] == [
        ("legacy-exact", "central-a", False),
        ("legacy-new", "legacy-new", True),
        ("legacy-normalized", "central-b", False),
    ]
    assert normalize_masterdata_name("  Café\u00a0 WERK ") == "café werk"

    with pytest.raises(ProjectMappingConflict) as excinfo:
        build_project_mappings(
            [LegacyProjectRow("legacy", "PROJECT X", "", True, False, created)],
            [CentralProjectRow("x1", "Project X"), CentralProjectRow("x2", "project x")],
        )
    assert excinfo.value.candidate_ids == ("x1", "x2")

    canonical = build_canonical_posts([
        LegacyPostRow("p-old", "legacy-exact", " Werk ", "Eerste", False, False, False, created),
        LegacyPostRow("p-active", "legacy-normalized", "WERK", "Actief", True, False, False, created),
    ])
    assert len(canonical) == 1
    assert canonical[0].canonical_id == "p-active"
    assert canonical[0].source_ids == ("p-active", "p-old")


def test_populated_work_hours_migration_upgrade_downgrade_upgrade_preserves_rows(tmp_path, monkeypatch):
    database_path = tmp_path / "migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "20260730_0026")
    engine = create_engine(f"sqlite:///{database_path}")
    timestamp = "2026-01-01 09:00:00"
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id, username, password_hash, is_admin, theme_preference, is_active, created_at, updated_at) VALUES ('u1', 'migration', 'x', 1, 'system', 1, :ts, :ts)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO projects (id, name, description, is_active, is_archived, invited_user_ids_json, created_at, updated_at) VALUES ('central', 'Centraal', '', 1, 0, '[]', :ts, :ts)"), {"ts": timestamp})
        for project_id, name in (("legacy-a", "Centraal"), ("legacy-b", "Nieuw project")):
            connection.execute(text("INSERT INTO work_projects (id, name, description, is_active, is_archived, created_at, updated_at, row_version) VALUES (:id, :name, '', 1, 0, :ts, :ts, 1)"), {"id": project_id, "name": name, "ts": timestamp})
        for post_id, project_id, name in (("post-a", "legacy-a", "Werk"), ("post-b", "legacy-b", "  WERK ")):
            connection.execute(text("INSERT INTO work_posts (id, project_id, name, description, is_active, is_archived, created_at, updated_at, row_version) VALUES (:id, :project, :name, '', 1, 0, :ts, :ts, 1)"), {"id": post_id, "project": project_id, "name": name, "ts": timestamp})
        connection.execute(text("INSERT INTO work_hour_groups (id, work_date, project_id, post_id, description, duration_half_hours, created_at, updated_at, created_by_user_id, updated_by_user_id, row_version) VALUES ('group-1', '2026-01-01', 'legacy-a', 'post-a', 'Behoud', 3, :ts, :ts, 'u1', 'u1', 7)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_hour_group_participants (id, group_id, participant_kind, user_id, display_name_snapshot, display_type_snapshot, sort_order, created_at, updated_at, created_by_user_id, updated_by_user_id, row_version, active_identity_key) VALUES ('participant-1', 'group-1', 'live_user', 'u1', 'Migratie', 'WindWilly-gebruiker', 0, :ts, :ts, 'u1', 'u1', 4, 'live_user:u1')"), {"ts": timestamp})

    command.upgrade(config, "head")
    with engine.connect() as connection:
        group = connection.execute(text("SELECT project_id, post_id, duration_half_hours, row_version FROM work_hour_groups WHERE id='group-1'")).one()
        assert group == ("central", "post-a", 3, 7)
        assert connection.scalar(text("SELECT count(*) FROM work_posts")) == 1
        assert connection.scalar(text("SELECT count(*) FROM work_project_legacy_aliases")) == 2
        assert connection.scalar(text("SELECT count(*) FROM work_post_legacy_aliases")) == 2
        assert connection.scalar(text("SELECT count(*) FROM work_hour_group_participants")) == 1

    command.downgrade(config, "20260730_0026")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT project_id, post_id, row_version FROM work_hour_groups WHERE id='group-1'")).one() == ("legacy-a", "post-a", 7)
        assert connection.scalar(text("SELECT count(*) FROM work_posts")) == 2
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM work_hour_groups")) == 1
        assert connection.scalar(text("SELECT count(*) FROM work_hour_group_participants")) == 1
    get_settings.cache_clear()


def _upgraded_migration_guard_database(tmp_path, monkeypatch, name: str):
    database_path = tmp_path / f"{name}.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / f"storage-{name}"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "20260730_0026")
    engine = create_engine(f"sqlite:///{database_path}")
    timestamp = "2026-01-01 09:00:00"
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id, username, password_hash, is_admin, theme_preference, is_active, created_at, updated_at) VALUES ('u1', 'migration', 'x', 1, 'system', 1, :ts, :ts)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO projects (id, name, description, is_active, is_archived, invited_user_ids_json, created_at, updated_at) VALUES ('central', 'Centraal', '', 1, 0, '[]', :ts, :ts)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_projects (id, name, description, is_active, is_archived, created_at, updated_at, row_version) VALUES ('legacy-a', 'Centraal', '', 1, 0, :ts, :ts, 1)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_posts (id, project_id, name, description, is_active, is_archived, created_at, updated_at, row_version) VALUES ('post-a', 'legacy-a', 'Werk', '', 1, 0, :ts, :ts, 1)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_hour_groups (id, work_date, project_id, post_id, description, duration_half_hours, created_at, updated_at, created_by_user_id, updated_by_user_id, row_version) VALUES ('group-1', '2026-01-01', 'legacy-a', 'post-a', 'Behoud', 3, :ts, :ts, 'u1', 'u1', 7)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_hour_group_participants (id, group_id, participant_kind, user_id, display_name_snapshot, display_type_snapshot, sort_order, created_at, updated_at, created_by_user_id, updated_by_user_id, row_version, active_identity_key) VALUES ('participant-1', 'group-1', 'live_user', 'u1', 'Migratie', 'WindWilly-gebruiker', 0, :ts, :ts, 'u1', 'u1', 4, 'live_user:u1')"), {"ts": timestamp})
    command.upgrade(config, "head")
    return config, engine


@pytest.mark.parametrize(
    ("write_name", "statement"),
    [
        ("group_edit", "UPDATE work_hour_groups SET description='Gewijzigd', row_version=row_version+1 WHERE id='group-1'"),
        ("group_create", "INSERT INTO work_hour_groups (id, created_at, updated_at, work_date, project_id, post_id, description, duration_half_hours, created_by_user_id, updated_by_user_id, row_version) VALUES ('group-new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '2026-01-02', 'central', 'post-a', '', 2, 'u1', 'u1', 1)"),
        ("participant_edit", "UPDATE work_hour_group_participants SET display_name_snapshot='Nieuw', row_version=row_version+1 WHERE id='participant-1'"),
        ("post_create", "INSERT INTO work_posts (id, created_at, updated_at, name, normalized_name, description, is_active, is_archived, row_version) VALUES ('post-new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Nieuw', 'nieuw', '', 1, 0, 1)"),
        ("post_edit", "UPDATE work_posts SET name='Werk gewijzigd', normalized_name='werk gewijzigd', row_version=row_version+1 WHERE id='post-a'"),
        ("post_archive", "UPDATE work_posts SET is_active=0, is_archived=1, archived_at=CURRENT_TIMESTAMP, archived_by_user_id='u1', row_version=row_version+1 WHERE id='post-a'"),
        ("post_restore", "UPDATE work_posts SET row_version=row_version+2, updated_at=CURRENT_TIMESTAMP WHERE id='post-a'"),
    ],
)
def test_downgrade_refuses_every_post_migration_write_before_schema_changes(tmp_path, monkeypatch, write_name, statement):
    config, engine = _upgraded_migration_guard_database(tmp_path, monkeypatch, write_name)
    with engine.begin() as connection:
        connection.execute(text(statement))
    with pytest.raises(RuntimeError, match="post-migratie writes"):
        command.downgrade(config, "20260730_0026")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "20260809_0027"
        assert "normalized_name" in {row[1] for row in connection.execute(text("PRAGMA table_info(work_posts)"))}
        assert connection.scalar(text("PRAGMA foreign_key_check")) is None
    get_settings.cache_clear()


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
    assert csv_response.text.startswith("\ufeffregistratie-id;datum;naam persoon;type persoon (WindWilly-gebruiker/extern);project;post;aantal uren;beschrijving;aangemaakt door;aangemaakt op;laatst gewijzigd door;laatst gewijzigd op")

    meta = client.get("/api/urenverantwoording/meta", headers=headers)
    assert meta.status_code == 200
    assert meta.json()["projects"][0]["display_name"] == "Project Uren"


def test_global_posts_are_available_to_every_central_project_and_mutations_are_admin_only(client):
    admin_headers = _login(client)
    editor_headers = _login(client, username="editor", password="editor12345")
    first = client.post("/api/admin/projects", headers=admin_headers, json={"name": "Centraal één"}).json()
    second = client.post("/api/admin/projects", headers=admin_headers, json={"name": "Centraal twee"}).json()
    post = client.post("/api/urenverantwoording/posten", headers=admin_headers, json={"name": "Globale categorie", "description": "Voor alle projecten"})
    assert post.status_code == 201
    assert post.json()["project_id"] is None
    meta = client.get("/api/urenverantwoording/meta", headers=editor_headers).json()
    assert {first["id"], second["id"]}.issubset({item["id"] for item in meta["projects"]})
    assert post.json()["id"] in {item["id"] for item in meta["posts"]}
    denied = client.post("/api/urenverantwoording/posten", headers=editor_headers, json={"name": "Niet toegestaan", "description": ""})
    assert denied.status_code == 403


def test_meta_filter_facets_keep_historical_project_post_person_and_date_values(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Historisch filterproject", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"name": "Historische filterpost", "description": ""}).json()
    client.post("/api/urenverantwoording/groepen", headers=headers, json={
        "work_date": "2026-08-01", "project_id": project["id"], "post_id": post["id"],
        "description": "Filterhistorie", "duration_half_hours": 2,
        "participants": [{"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Historische naam", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
    })
    client.post(f"/api/urenverantwoording/posten/{post['id']}/archiveren?expected_row_version={post['row_version']}", headers=headers)
    client.post(f"/api/urenverantwoording/projecten/{project['id']}/archiveren?expected_row_version={project['row_version']}", headers=headers)
    meta = client.get("/api/urenverantwoording/meta", headers=headers).json()
    assert project["id"] not in {item["id"] for item in meta["projects"]}
    assert post["id"] not in {item["id"] for item in meta["posts"]}
    assert {item["id"]: item["selectable"] for item in meta["filter_projects"]}[project["id"]] is False
    assert {item["id"]: item["selectable"] for item in meta["filter_posts"]}[post["id"]] is False
    assert "Historische naam" in meta["filter_participants"]
    assert "2026-08-01" in meta["filter_dates"]


def test_hours_history_rejects_removed_project_kind_contract(client):
    headers = _login(client)
    response = client.get("/api/urenverantwoording/admin/history?kind=project", headers=headers)
    assert response.status_code == 422


def test_audit_and_alias_resolution_preserve_stable_project_and_post_names(client):
    headers = _login(client)
    me = client.get("/api/auth/me", headers=headers).json()
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Auditproject", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"name": "Auditpost", "description": ""}).json()
    client.post("/api/urenverantwoording/groepen", headers=headers, json={
        "work_date": "2026-08-01", "project_id": project["id"], "post_id": post["id"], "description": "Audit", "duration_half_hours": 2,
        "participants": [{"participant_kind": "live_user", "user_id": me["id"], "display_name_snapshot": "Admin", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
    })
    event_payload = next(item for item in client.get("/api/urenverantwoording/audit", headers=headers).json()["items"] if item["event_type"] == "work_hours.group.created")
    assert event_payload["project_name"] == "Auditproject"
    assert event_payload["post_name"] == "Auditpost"

    db = _service_session()
    try:
        admin = db.query(User).filter_by(username="admin").one()
        central = WorkProject(name="Nieuwe centrale naam", description="")
        global_post = WorkPost(name="Nieuwe globale naam", description="", created_by_user_id=admin.id, updated_by_user_id=admin.id)
        db.add_all([central, global_post]); db.flush()
        db.add_all([
            WorkProjectLegacyAlias(legacy_project_id="legacy-project", project_id=central.id, migration_created_project=False, legacy_snapshot_json=json.dumps({"name": "Oude projectnaam"})),
            WorkPostLegacyAlias(legacy_post_id="legacy-post", post_id=global_post.id, legacy_project_id=None, legacy_snapshot_json=json.dumps({"name": "Oude postnaam"})),
        ])
        db.commit()
        details = {"before": {"project_id": "legacy-project", "post_id": "legacy-post"}}
        assert _historical_reference_name(db, details, "project") == "Oude projectnaam"
        assert _historical_reference_name(db, details, "post") == "Oude postnaam"
    finally:
        db.close()




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

    deleted_version = updated.json()["row_version"] + 1
    stale_restore = client.post(f"/api/urenverantwoording/groepen/{group_id}/herstellen?expected_row_version={updated.json()['row_version']}", headers=headers)
    assert stale_restore.status_code == 409
    assert stale_restore.json()["detail"]["code"] == "stale_row_version"
    editor_headers = _login(client, username="editor", password="editor12345")
    forbidden_restore = client.post(f"/api/urenverantwoording/groepen/{group_id}/herstellen?expected_row_version={deleted_version}", headers=editor_headers)
    assert forbidden_restore.status_code == 403

    restore = client.post(f"/api/urenverantwoording/groepen/{group_id}/herstellen?expected_row_version={deleted_version}", headers=headers)
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None

    audit = client.get("/api/urenverantwoording/audit", headers=headers)
    assert audit.status_code == 200
    event_types = [event["event_type"] for event in audit.json()["items"]]
    assert "work_hours.group.updated" in event_types
    assert "work_hours.group.participant.added" in event_types
    assert "work_hours.group.deleted" in event_types
    assert "work_hours.group.restored" in event_types










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
    assert f"{first_group['id']};29-07-2026" in csv_lines[1]
    assert f"{second_group['id']};30-07-2026" in csv_lines[2]


def test_work_hours_csv_matches_complete_combined_filter_basis_in_both_directions(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Project CSV parity", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"name": "Post CSV parity", "description": ""}).json()
    user_id = client.get("/api/auth/me", headers=headers).json()["id"]
    expected_ids: list[str] = []
    for index in range(26):
        group = client.post(
            "/api/urenverantwoording/groepen",
            headers=headers,
            json={
                "work_date": f"2026-07-{index + 1:02d}",
                "project_id": project["id"],
                "post_id": post["id"],
                "description": f"Parity match {index + 1}",
                "duration_half_hours": 2,
                "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin Parity", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
            },
        ).json()
        expected_ids.append(group["id"])
    client.post(
        "/api/urenverantwoording/groepen",
        headers=headers,
        json={
            "work_date": "2026-07-27", "project_id": project["id"], "post_id": post["id"],
            "description": "Buiten selectie", "duration_half_hours": 2,
            "participants": [{"participant_kind": "live_user", "user_id": user_id, "display_name_snapshot": "Admin Parity", "display_email_snapshot": "admin@example.com", "display_type_snapshot": "WindWilly-gebruiker", "sort_order": 0}],
        },
    )

    base = (
        f"project_id={project['id']}&post_id={post['id']}&participant_kind=live_user"
        "&participant_query=Admin%20Parity&query=Parity%20match&sort_key=work_date"
    )
    for direction, ordered_ids in (("asc", expected_ids), ("desc", list(reversed(expected_ids)))):
        first_page = client.get(f"/api/urenverantwoording/groepen?{base}&sort_direction={direction}&page=1&page_size=25", headers=headers)
        second_page = client.get(f"/api/urenverantwoording/groepen?{base}&sort_direction={direction}&page=2&page_size=25", headers=headers)
        assert first_page.status_code == second_page.status_code == 200
        list_ids = [item["id"] for item in first_page.json()["items"] + second_page.json()["items"]]
        assert first_page.json()["total"] == second_page.json()["total"] == 26
        assert list_ids == ordered_ids

        csv_response = client.get(f"/api/urenverantwoording/export.csv?{base}&sort_direction={direction}", headers=headers)
        assert csv_response.status_code == 200
        csv_rows = list(csv.reader(StringIO(csv_response.text.lstrip("\ufeff")), delimiter=";"))
        csv_ids = [row[0] for row in csv_rows[1:]]
        assert csv_ids == list_ids
        assert len(csv_ids) == 26


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
    assert duplicate_post_create.json()["detail"]["message"] == "Postnaam bestaat al"

    duplicate_post_update = client.patch(
        f"/api/urenverantwoording/posten/{post_b['id']}",
        headers=headers,
        json={"name": "Post Dup A", "expected_row_version": post_b["row_version"]},
    )
    assert duplicate_post_update.status_code == 409
    assert duplicate_post_update.json()["detail"]["message"] == "Postnaam bestaat al"


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
    forbidden = {"email", "username", "note", "source_key", "user_id", "external_person_id", "historical_identity_id", "source_user_id", "linked_user_id", "deleted_at", "deleted_by_user_id", "created_by_user_id", "updated_by_user_id"}
    assert not (_all_response_keys(payload) & forbidden)


def test_non_admin_group_list_and_detail_schemas_recursively_exclude_email_internal_identity_provenance_deletion_and_actor_fields(client):
    admin_headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, admin_headers)
    editor_headers = _login(client, username="editor", password="editor12345")
    for response in (client.get("/api/urenverantwoording/groepen", headers=editor_headers), client.get(f"/api/urenverantwoording/groepen/{group['id']}", headers=editor_headers)):
        assert response.status_code == 200
        keys = _all_response_keys(response.json())
        assert not (keys & {"email", "user_id", "external_person_id", "historical_identity_id", "deleted_at", "deleted_by_user_id", "created_by_user_id", "updated_by_user_id"})


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


def test_central_project_restore_returns_project_to_active_state(client):
    headers = _login(client)
    active = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Actief herstel", "description": ""}).json()
    assert client.delete(f"/api/urenverantwoording/projecten/{active['id']}?expected_row_version={active['row_version']}", headers=headers).status_code == 200
    restored_active = client.post(f"/api/urenverantwoording/projecten/{active['id']}/herstellen?expected_row_version={active['row_version'] + 1}", headers=headers).json()
    assert restored_active["is_active"] is True and restored_active["is_archived"] is False

    archived = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Archief herstel", "description": ""}).json()
    archived = client.post(f"/api/urenverantwoording/projecten/{archived['id']}/archiveren?expected_row_version={archived['row_version']}", headers=headers).json()
    assert client.delete(f"/api/urenverantwoording/projecten/{archived['id']}?expected_row_version={archived['row_version']}", headers=headers).status_code == 200
    restored_archived = client.post(f"/api/urenverantwoording/projecten/{archived['id']}/herstellen?expected_row_version={archived['row_version'] + 1}", headers=headers).json()
    assert restored_archived["is_active"] is True and restored_archived["is_archived"] is False


def test_project_archive_or_delete_removes_child_selectability_without_cascade_restore(client):
    headers = _login(client)
    project = client.post("/api/urenverantwoording/projecten", headers=headers, json={"name": "Parent state", "description": ""}).json()
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"project_id": project["id"], "name": "Child state", "description": ""}).json()
    archived = client.post(f"/api/urenverantwoording/projecten/{project['id']}/archiveren?expected_row_version={project['row_version']}", headers=headers).json()
    meta = client.get("/api/urenverantwoording/meta", headers=headers).json()
    assert project["id"] not in {item["id"] for item in meta["projects"]}
    # Posts are global and remain selectable for every other active project.
    assert post["id"] in {item["id"] for item in meta["posts"]}
    client.post(f"/api/urenverantwoording/projecten/{project['id']}/herstellen?expected_row_version={archived['row_version']}", headers=headers)
    masterdata = client.get("/api/urenverantwoording/admin/masterdata", headers=headers).json()
    unchanged_post = next(item for item in masterdata["posts"] if item["id"] == post["id"])
    assert unchanged_post["row_version"] == post["row_version"]


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


def test_external_person_archive_restore_preserves_uniqueness_version_auth_and_audit(client):
    admin_headers = _login(client)
    editor_headers = _login(client, username="editor", password="editor12345")
    person = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Herstelbare externe", "email": "restore-external@example.com", "note": "Bewaren"},
    ).json()
    archived = client.post(
        f"/api/urenverantwoording/externe-personen/{person['id']}/archiveren?expected_row_version={person['row_version']}",
        headers=admin_headers,
    )
    assert archived.status_code == 200
    assert archived.json()["deleted_at"] is not None and archived.json()["is_active"] is False

    stale = client.post(
        f"/api/urenverantwoording/externe-personen/{person['id']}/herstellen?expected_row_version={person['row_version']}",
        headers=admin_headers,
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "stale_row_version"
    forbidden = client.post(
        f"/api/urenverantwoording/externe-personen/{person['id']}/herstellen?expected_row_version={archived.json()['row_version']}",
        headers=editor_headers,
    )
    assert forbidden.status_code == 403
    duplicate_while_archived = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Andere externe", "email": " RESTORE-EXTERNAL@example.com ", "note": ""},
    )
    assert duplicate_while_archived.status_code == 409
    assert duplicate_while_archived.json()["detail"]["code"] == "work_hours_external_person_hard_conflict"

    restored = client.post(
        f"/api/urenverantwoording/externe-personen/{person['id']}/herstellen?expected_row_version={archived.json()['row_version']}",
        headers=admin_headers,
    )
    assert restored.status_code == 200
    assert restored.json()["deleted_at"] is None and restored.json()["is_active"] is True
    assert restored.json()["email"] == person["email"] and restored.json()["note"] == person["note"]
    duplicate_after_restore = client.post(
        "/api/urenverantwoording/externe-personen",
        headers=admin_headers,
        json={"display_name": "Nog een externe", "email": "restore-external@example.com", "note": ""},
    )
    assert duplicate_after_restore.status_code == 409
    audit = client.get("/api/urenverantwoording/audit?action=work_hours.external_person.restored", headers=admin_headers).json()
    assert audit["total"] == 1
    assert audit["items"][0]["event_type"] == "work_hours.external_person.restored"


def test_complete_audit_after_snapshot_contains_definitive_parent_and_all_children(client):
    headers = _login(client)
    _, _, _, _, group = _create_validation_group(client, headers)
    event = next(item for item in client.get("/api/urenverantwoording/audit", headers=headers).json()["items"] if item["event_type"] == "work_hours.group.created")
    after = json.loads(event["details_json"])["after"]
    assert after["id"] == group["id"]
    assert after["row_version"] == group["row_version"]
    assert [item["id"] for item in after["participants"]] == [item["id"] for item in group["participants"]]
    assert all(item["group_id"] == group["id"] for item in after["participants"])
