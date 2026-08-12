from hashlib import sha256
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.core.settings import get_settings


PRE_AUDIO_REVISION = "20260616_0023"
AUDIO_REVISION = "20260630_0024"
RELEASE_HEAD = "20260811_0030"
BACKEND_ROOT = Path(__file__).parents[1]
BOARD_CARD_LIFECYCLE_SHA256 = "c57ff036bbcb3274961f20e88f4fe43d8fab42110edbcecb6870b51f8e7a8ef1"


def test_audio_revision_roundtrip_and_continuation_through_release_graph(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'audio-migration.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()

    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    engine = create_engine(database_url)
    try:
        script = ScriptDirectory.from_config(config)
        assert script.get_heads() == [RELEASE_HEAD]
        assert script.get_revision("20260729_0025").down_revision == AUDIO_REVISION
        assert sha256(
            (BACKEND_ROOT / "alembic" / "versions" / "20260729_0025_board_card_lifecycle.py").read_bytes()
        ).hexdigest() == BOARD_CARD_LIFECYCLE_SHA256

        command.upgrade(config, PRE_AUDIO_REVISION)
        command.upgrade(config, AUDIO_REVISION)
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == AUDIO_REVISION
            assert "transcription_status" in {
                column["name"]
                for column in inspect(connection).get_columns("topic_source_documents")
            }

        command.downgrade(config, PRE_AUDIO_REVISION)
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == PRE_AUDIO_REVISION
            assert "transcription_status" not in {
                column["name"]
                for column in inspect(connection).get_columns("topic_source_documents")
            }

        command.upgrade(config, AUDIO_REVISION)
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == RELEASE_HEAD
            assert "transcription_status" in {
                column["name"]
                for column in inspect(connection).get_columns("topic_source_documents")
            }
            assert "is_archived" in {
                column["name"] for column in inspect(connection).get_columns("board_cards")
            }
    finally:
        engine.dispose()
        get_settings.cache_clear()
