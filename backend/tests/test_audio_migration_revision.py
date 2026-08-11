from pathlib import Path
import subprocess

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.core.settings import get_settings


PRE_AUDIO_REVISION = "20260616_0023"
AUDIO_REVISION = "20260630_0024"
HEAD_CHAIN_REVISION = "20260810_0028"
REPOSITORY_ROOT = Path(__file__).parents[2]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"


def _git_output(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=REPOSITORY_ROOT)


def _head_audio_script(tmp_path: Path) -> Path:
    """Build HEAD's tracked migration graph plus this change's new audio revision."""
    script_root = tmp_path / "alembic"
    versions_root = script_root / "versions"
    versions_root.mkdir(parents=True)
    (script_root / "env.py").write_bytes((BACKEND_ROOT / "alembic" / "env.py").read_bytes())

    tracked_versions = _git_output(
        "ls-tree", "--name-only", "HEAD", "backend/alembic/versions/"
    ).decode().splitlines()
    for repository_path in tracked_versions:
        target = versions_root / Path(repository_path).name
        target.write_bytes(_git_output("show", f"HEAD:{repository_path}"))

    target_audio = versions_root / "20260630_0024_audio_topic_transcription.py"
    target_audio.write_bytes(
        (BACKEND_ROOT / "alembic" / "versions" / target_audio.name).read_bytes()
    )
    return script_root


def test_audio_revision_roundtrip_and_continuation_through_unchanged_head_chain(
    tmp_path, monkeypatch
):
    database_url = f"sqlite:///{tmp_path / 'audio-migration.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()

    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(_head_audio_script(tmp_path)))
    engine = create_engine(database_url)
    try:
        script = ScriptDirectory.from_config(config)
        assert script.get_heads() == [HEAD_CHAIN_REVISION]
        assert script.get_revision("20260729_0025").down_revision == AUDIO_REVISION

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
        command.upgrade(config, "heads")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == HEAD_CHAIN_REVISION
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
