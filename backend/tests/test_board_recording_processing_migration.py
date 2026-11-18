from datetime import UTC, datetime
from pathlib import Path

import pytest

from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, Table, create_engine, inspect, select, text

from app.core.settings import get_settings


def test_upgrade_preserves_historical_recordings_without_queuing_them(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "20261105_0035")
    engine = create_engine(database_url)
    metadata = MetaData()
    users = Table("users", metadata, autoload_with=engine)
    projects = Table("projects", metadata, autoload_with=engine)
    cards = Table("board_cards", metadata, autoload_with=engine)
    recordings = Table("recordings", metadata, autoload_with=engine)
    now = datetime.now(UTC)
    with engine.begin() as conn:
        conn.execute(users.insert().values(id="u", username="user", password_hash="unused", is_active=True, is_admin=True, created_at=now, updated_at=now))
        conn.execute(projects.insert().values(id="p", name="Project", description="", is_active=True, is_archived=False, invited_user_ids_json="[]", is_visible_in_boards=True, is_visible_in_work_hours=True, is_visible_in_participation=True, created_at=now, updated_at=now))
        conn.execute(cards.insert().values(id="c", project_id="p", title="Card", description="", column="todo", position=0, is_archived=False, urgency="normal", created_at=now, updated_at=now))
        for status in ("pending", "done", "failed"):
            conn.execute(recordings.insert().values(id=status, card_id="c", uploaded_by_user_id="u", filename="audio.webm", file_path="/retained/audio.webm", duration=5, recorded_at=now, created_at=now, mime_type="audio/webm", size_bytes=10, transcription_status=status, transcription_text="Original transcript" if status == "done" else ""))
        before = [dict(row) for row in conn.execute(select(recordings).order_by(recordings.c.id)).mappings()]
    # Pin the revision under test so later migrations do not change this check.
    command.upgrade(config, "20261117_0036")
    upgraded = Table("recordings", MetaData(), autoload_with=engine)
    with engine.connect() as conn:
        after = list(conn.execute(select(upgraded).order_by(upgraded.c.id)).mappings())
        assert [{key: row[key] for key in recordings.c.keys()} for row in after] == before
        assert all(row["processing_status"] is None and row["client_request_id"] is None for row in after)
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "20261117_0036"
        assert conn.scalar(text("PRAGMA quick_check")) == "ok"
    assert any(index["name"] == "uq_recordings_upload_request" and index["unique"] for index in inspect(engine).get_indexes("recordings"))
    command.downgrade(config, "20261105_0035")
    with engine.connect() as conn:
        assert [dict(row) for row in conn.execute(select(recordings).order_by(recordings.c.id)).mappings()] == before
    command.upgrade(config, "head")
    with engine.begin() as conn:
        conn.execute(text("UPDATE recordings SET processing_status='queued', client_request_id='kept-job' WHERE id='pending'"))
    with pytest.raises(RuntimeError, match="do not discard recording processing state"):
        command.downgrade(config, "20261105_0035")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT processing_status FROM recordings WHERE id='pending'")) == "queued"
    engine.dispose()
    get_settings.cache_clear()
