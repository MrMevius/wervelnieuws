from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.api.deps import get_db
from app.core.settings import get_settings
from app.core.security import hash_password
from app.main import app


RELEASED_PARENT = "20260810_0028"
VISIBILITY_REVISION = "20260810_0029"
RELEASE_HEAD = "20260811_0030"


def test_visibility_migration_preserves_populated_legacy_relations_and_isolates_audio(tmp_path, monkeypatch):
    database_path = tmp_path / "visibility.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, RELEASED_PARENT)
    engine = create_engine(f"sqlite:///{database_path}")
    timestamp = "2026-08-10 09:00:00"
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id, username, password_hash, is_admin, theme_preference, is_active, created_at, updated_at) VALUES ('u1', 'legacy', 'x', 1, 'system', 1, :ts, :ts)"), {"ts": timestamp})
        for project_id, name in (("p-board", "Oud bord"), ("p-hours", "Oude uren")):
            connection.execute(text("INSERT INTO projects (id, name, description, is_active, is_archived, invited_user_ids_json, created_at, updated_at) VALUES (:id, :name, '', 1, 0, '[]', :ts, :ts)"), {"id": project_id, "name": name, "ts": timestamp})
        connection.execute(text("INSERT INTO board_cards (id, project_id, title, description, column, position, is_archived, created_at, updated_at) VALUES ('card-1', 'p-board', 'Historische kaart', '', 'todo', 0, 0, :ts, :ts)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_posts (id, name, normalized_name, description, is_active, is_archived, created_at, updated_at, row_version) VALUES ('post-1', 'Werk', 'werk', '', 1, 0, :ts, :ts, 1)"), {"ts": timestamp})
        connection.execute(text("INSERT INTO work_hour_groups (id, work_date, project_id, post_id, description, duration_half_hours, created_at, updated_at, created_by_user_id, updated_by_user_id, row_version) VALUES ('group-1', '2026-08-10', 'p-hours', 'post-1', 'Historische uren', 2, :ts, :ts, 'u1', 'u1', 1)"), {"ts": timestamp})

    command.upgrade(config, VISIBILITY_REVISION)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == VISIBILITY_REVISION
        assert connection.execute(text("SELECT id, is_visible_in_boards, is_visible_in_work_hours FROM projects WHERE id IN ('p-board', 'p-hours') ORDER BY id")).all() == [("p-board", 1, 1), ("p-hours", 1, 1)]
        assert connection.execute(text("SELECT project_id FROM board_cards WHERE id='card-1'")).scalar_one() == "p-board"
        assert connection.execute(text("SELECT project_id, post_id FROM work_hour_groups WHERE id='group-1'")).one() == ("p-hours", "post-1")
        assert connection.scalar(text("PRAGMA foreign_key_check")) is None

    command.downgrade(config, RELEASED_PARENT)
    with engine.connect() as connection:
        assert {column["name"] for column in inspect(connection).get_columns("projects")}.isdisjoint({"is_visible_in_boards", "is_visible_in_work_hours"})
        assert connection.execute(text("SELECT project_id FROM board_cards WHERE id='card-1'")).scalar_one() == "p-board"
        assert connection.execute(text("SELECT project_id, post_id FROM work_hour_groups WHERE id='group-1'")).one() == ("p-hours", "post-1")
        assert connection.scalar(text("PRAGMA foreign_key_check")) is None
    engine.dispose()
    get_settings.cache_clear()


def test_relevant_migration_starts_upgrade_to_single_head_with_visibility_defaults(tmp_path, monkeypatch):
    for start_revision in (RELEASED_PARENT, "20260630_0024"):
        database_path = tmp_path / f"{start_revision}.db"
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
        monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / f"storage-{start_revision}"))
        get_settings.cache_clear()
        config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
        command.upgrade(config, start_revision)
        engine = create_engine(f"sqlite:///{database_path}")
        with engine.begin() as connection:
            connection.execute(
                text("INSERT INTO projects (id, name, description, is_active, is_archived, invited_user_ids_json, created_at, updated_at) VALUES ('legacy', 'Bestaand', '', 1, 0, '[]', '2026-08-10', '2026-08-10')")
            )

        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == RELEASE_HEAD
            columns = {column["name"]: column for column in inspect(connection).get_columns("projects")}
            assert {"is_visible_in_boards", "is_visible_in_work_hours"} <= columns.keys()
            assert not columns["is_visible_in_boards"]["nullable"]
            assert not columns["is_visible_in_work_hours"]["nullable"]
            assert connection.execute(text("SELECT is_visible_in_boards, is_visible_in_work_hours FROM projects WHERE id = 'legacy'")).one() == (1, 1)
        engine.dispose()
    get_settings.cache_clear()


def test_project_routes_read_visibility_fields_after_upgrade_to_head(tmp_path, monkeypatch):
    database_path = tmp_path / "routes.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, RELEASE_HEAD)
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO users (id, username, password_hash, is_admin, is_active, theme_preference, created_at, updated_at) VALUES ('admin', 'admin', :password_hash, 1, 1, 'system', '2026-08-10', '2026-08-10')"),
            {"password_hash": hash_password("admin12345")},
        )

    from sqlalchemy.orm import Session, sessionmaker
    from fastapi.testclient import TestClient

    testing_session = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app, base_url="https://testserver") as client:
            login = client.post("/api/auth/login", json={"username": "admin", "password": "admin12345"})
            assert login.status_code == 200
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
            created = client.post("/api/admin/projects", headers=headers, json={"name": "Gemigreerd project"})
            assert created.status_code == 200
            assert client.get("/api/admin/projects", headers=headers).status_code == 200
            assert client.get("/api/database/projects", headers=headers).status_code == 200
            assert client.get("/api/boards/projects", headers=headers).status_code == 200
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
        get_settings.cache_clear()
