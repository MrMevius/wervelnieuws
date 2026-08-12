"""Validate the Alembic release graph and visibility schema without shared state."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.core.settings import get_settings


EXPECTED_HEAD = "20260811_0030"
REQUIRED_PROJECT_COLUMNS = {
    "is_visible_in_boards",
    "is_visible_in_work_hours",
}
BACKEND_ROOT = Path(__file__).resolve().parents[1]


def validate_graph(config: Config) -> None:
    heads = ScriptDirectory.from_config(config).get_heads()
    if tuple(heads) != (EXPECTED_HEAD,):
        raise RuntimeError(
            f"Unexpected Alembic heads: {', '.join(heads) or '(none)'}; "
            f"expected exactly {EXPECTED_HEAD}."
        )


def validate_visibility_schema(database_url: str) -> None:
    engine = create_engine(database_url)
    try:
        columns = {
            column["name"]: column
            for column in inspect(engine).get_columns("projects")
        }
    finally:
        engine.dispose()

    missing = REQUIRED_PROJECT_COLUMNS - columns.keys()
    if missing:
        raise RuntimeError(
            "Missing required projects visibility columns: " + ", ".join(sorted(missing))
        )
    nullable = [name for name in REQUIRED_PROJECT_COLUMNS if columns[name]["nullable"]]
    if nullable:
        raise RuntimeError(
            "Projects visibility columns must be NOT NULL: " + ", ".join(sorted(nullable))
        )


def run_preflight() -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    validate_graph(config)
    with tempfile.TemporaryDirectory(prefix="wervelnieuws-schema-preflight-") as temp_dir:
        database_url = f"sqlite:///{Path(temp_dir) / 'schema.db'}"
        previous_database_url = os.environ.get("DATABASE_URL")
        previous_storage_root = os.environ.get("STORAGE_ROOT")
        try:
            os.environ["DATABASE_URL"] = database_url
            os.environ["STORAGE_ROOT"] = str(Path(temp_dir) / "storage")
            get_settings.cache_clear()
            command.upgrade(config, "head")
            validate_visibility_schema(database_url)
        finally:
            if previous_database_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = previous_database_url
            if previous_storage_root is None:
                os.environ.pop("STORAGE_ROOT", None)
            else:
                os.environ["STORAGE_ROOT"] = previous_storage_root
            get_settings.cache_clear()


if __name__ == "__main__":
    try:
        run_preflight()
    except Exception as exc:
        raise SystemExit(f"Release schema preflight failed: {exc}") from exc
    print(f"Release schema preflight passed: {EXPECTED_HEAD}")
