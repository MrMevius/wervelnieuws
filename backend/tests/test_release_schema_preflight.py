from alembic.config import Config
import pytest
from sqlalchemy import create_engine, text

from scripts import release_schema_preflight as preflight


def test_release_schema_preflight_passes_on_release_source():
    preflight.run_preflight()


def test_release_schema_preflight_rejects_unexpected_head():
    config = Config(str(preflight.BACKEND_ROOT / "alembic.ini"))
    with pytest.raises(RuntimeError, match="Unexpected Alembic heads"):
        original_head = preflight.EXPECTED_HEAD
        try:
            preflight.EXPECTED_HEAD = "not-a-release-head"
            preflight.validate_graph(config)
        finally:
            preflight.EXPECTED_HEAD = original_head


def test_release_schema_preflight_rejects_missing_visibility_column(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'incomplete.db'}"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE projects (id TEXT PRIMARY KEY, is_visible_in_boards BOOLEAN NOT NULL)"))

    with pytest.raises(RuntimeError, match="is_visible_in_work_hours"):
        preflight.validate_visibility_schema(database_url)
    engine.dispose()
