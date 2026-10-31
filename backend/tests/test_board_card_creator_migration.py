from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.settings import get_settings


PARENT_REVISION = "20260910_0032"
CREATOR_REVISION = "20261031_0033"


def test_creator_migration_backfills_from_audit_trail_and_roundtrips(tmp_path, monkeypatch):
    database_path = tmp_path / "creator.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, PARENT_REVISION)
    engine = create_engine(f"sqlite:///{database_path}")
    ts = "2026-10-01 09:00:00"
    with engine.begin() as connection:
        for user_id in ("u1", "u2"):
            connection.execute(text("INSERT INTO users (id, username, password_hash, is_admin, theme_preference, is_active, created_at, updated_at) VALUES (:id, :id, 'x', 1, 'system', 1, :ts, :ts)"), {"id": user_id, "ts": ts})
        connection.execute(text("INSERT INTO projects (id, name, description, is_active, is_archived, invited_user_ids_json, is_visible_in_boards, is_visible_in_work_hours, created_at, updated_at) VALUES ('p1', 'Bord', '', 1, 0, '[]', 1, 1, :ts, :ts)"), {"ts": ts})
        for card_id, trello_id in (("card-u1", None), ("card-u2", None), ("card-none", None), ("card-trello", "t-1"), ("card-gone", None)):
            connection.execute(text("INSERT INTO board_cards (id, project_id, title, description, column, urgency, trello_card_id, position, is_archived, created_at, updated_at) VALUES (:id, 'p1', 'Kaart', '', 'todo', 'normal', :trello, 0, 0, :ts, :ts)"), {"id": card_id, "trello": trello_id, "ts": ts})
        events = (
            ("e1", "u1", '{"project_id": "p1", "card_id": "card-u1"}', "2026-10-01 09:00:00"),
            ("e2", "u2", '{"project_id": "p1", "card_id": "card-u2"}', "2026-10-01 09:01:00"),
            ("e3", "u1", '{"project_id": "p1", "card_id": "card-u2"}', "2026-10-01 09:02:00"),
            ("e4", "u1", '{"project_id": "p1", "card_id": "card-trello"}', "2026-10-01 09:03:00"),
            ("e5", "deleted-user", '{"project_id": "p1", "card_id": "card-gone"}', "2026-10-01 09:04:00"),
            ("e6", "u1", "not json", "2026-10-01 09:05:00"),
        )
        for event_id, actor, details, created_at in events:
            connection.execute(text("INSERT INTO audit_events (id, actor_user_id, event_type, details_json, created_at) VALUES (:id, :actor, 'board.card.created', :details, :created_at)"), {"id": event_id, "actor": actor, "details": details, "created_at": created_at})

    command.upgrade(config, CREATOR_REVISION)
    with engine.connect() as connection:
        creators = dict(connection.execute(text("SELECT id, created_by_user_id FROM board_cards")).all())
        assert creators == {
            "card-u1": "u1",
            "card-u2": "u2",
            "card-none": None,
            "card-trello": None,
            "card-gone": None,
        }
        assert connection.scalar(text("PRAGMA foreign_key_check")) is None

    command.downgrade(config, PARENT_REVISION)
    with engine.connect() as connection:
        assert "created_by_user_id" not in {column["name"] for column in inspect(connection).get_columns("board_cards")}
        assert connection.scalar(text("SELECT COUNT(*) FROM board_cards")) == 5
    engine.dispose()
    get_settings.cache_clear()


def test_update_recording_migration_roundtrips(tmp_path, monkeypatch):
    database_path = tmp_path / "update-recording.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, "20261031_0034")
    engine = create_engine(f"sqlite:///{database_path}")
    with engine.connect() as connection:
        inspector = inspect(connection)
        assert "recording_id" in {column["name"] for column in inspector.get_columns("card_updates")}
        assert "ix_card_updates_recording_id" in {index["name"] for index in inspector.get_indexes("card_updates")}

    command.downgrade(config, CREATOR_REVISION)
    with engine.connect() as connection:
        assert "recording_id" not in {column["name"] for column in inspect(connection).get_columns("card_updates")}
    engine.dispose()
    get_settings.cache_clear()
