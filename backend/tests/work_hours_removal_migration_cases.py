from __future__ import annotations

import importlib.util
from pathlib import Path
import sqlite3

from alembic import command
from alembic.config import Config
import pytest

from app.core.settings import get_settings


REVISION = "20260810_0028"
PREVIOUS_REVISION = "20260809_0027"
_MIGRATION_PATH = (
    Path(__file__).parents[1]
    / "alembic/versions/20260810_0028_remove_work_hours_json_restore.py"
)
_MIGRATION_SPEC = importlib.util.spec_from_file_location("hours_removal_migration", _MIGRATION_PATH)
assert _MIGRATION_SPEC and _MIGRATION_SPEC.loader
MIGRATION = importlib.util.module_from_spec(_MIGRATION_SPEC)
_MIGRATION_SPEC.loader.exec_module(MIGRATION)


def _config(database: Path) -> Config:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database}")
    return config


def _prepare(tmp_path: Path, monkeypatch) -> tuple[Path, Path, Config]:
    database = tmp_path / "hours-removal.db"
    storage = tmp_path / "storage"
    storage.mkdir()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database}")
    monkeypatch.setenv("STORAGE_ROOT", str(storage))
    get_settings.cache_clear()
    config = _config(database)
    command.upgrade(config, PREVIOUS_REVISION)
    return database, storage, config


def _seed_subsystem(database: Path, hours_dir: Path, unsafe_path: Path | None = None) -> None:
    batch_table = "work_" + "import_batches"
    source_column = "source_" + "import_batch_id"
    hours_dir.mkdir(parents=True, exist_ok=True)
    (hours_dir / "registered.json").write_bytes(b"registered")
    (hours_dir / "leftover.json").write_bytes(b"json")
    (hours_dir / "leftover.tmp").write_bytes(b"tmp")
    (hours_dir / "keep.csv").write_bytes(b"csv")
    with sqlite3.connect(database) as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute(
            "INSERT INTO users (id, username, password_hash, is_active, is_admin, created_at, updated_at) "
            "VALUES ('user-1', 'migration-admin', 'hash', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        db.execute(
            "INSERT INTO projects (id, name, description, is_active, is_archived, invited_user_ids_json, created_at, updated_at) "
            "VALUES ('project-1', 'Project', '', 1, 0, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        db.execute(
            "INSERT INTO work_posts (id, name, normalized_name, description, is_active, is_archived, row_version, created_at, updated_at) "
            "VALUES ('post-1', 'Post', 'post', '', 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        db.execute(
            "INSERT INTO work_external_people "
            "(id, display_name, normalized_name, email, normalized_email, note, is_active, row_version, created_at, updated_at) "
            "VALUES ('external-1', 'Externe bron', 'externe bron', 'bron@example.com', 'bron@example.com', "
            "'Blijft behouden', 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        db.execute(
            "INSERT INTO work_historical_user_identities "
            "(id, source_key, snapshot_name, snapshot_email, snapshot_display_label, is_active, row_version, created_at, updated_at) "
            "VALUES ('history-1', 'legacy:user', 'Historische bron', 'historisch@example.com', "
            "'Historische bron', 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        for batch_id, path in (
            ("batch-1", hours_dir / "registered.json"),
            ("batch-2", unsafe_path or hours_dir / "already-missing.json"),
        ):
            db.execute(
                f"INSERT INTO {batch_table} "
                "(id, created_at, updated_at, requested_by_user_id, format_version, backup_version, mode, "
                "source_filename, source_hash, pre_import_backup_path, status, counts_json, warnings_json, errors_json) "
                "VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'user-1', '1.0', '3', 'merge', "
                "'backup.json', 'hash', ?, 'previewed', '{}', '[]', '[]')",
                (batch_id, str(path)),
            )
        db.execute(
            f"INSERT INTO work_hour_groups "
            f"(id, created_at, updated_at, work_date, project_id, post_id, description, duration_half_hours, {source_column}, row_version) "
            "VALUES ('group-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '2026-08-01', 'project-1', 'post-1', 'Werk', 2, 'batch-1', 1)"
        )
        db.execute(
            "INSERT INTO work_hour_groups "
            "(id, created_at, updated_at, work_date, project_id, post_id, description, duration_half_hours, row_version) "
            "VALUES ('group-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '2026-08-02', 'project-1', 'post-1', 'Historie', 4, 2)"
        )
        db.execute(
            "INSERT INTO work_hour_group_participants "
            "(id, group_id, participant_kind, external_person_id, display_name_snapshot, display_email_snapshot, "
            "display_type_snapshot, sort_order, row_version, active_identity_key, created_at, updated_at) "
            "VALUES ('participant-1', 'group-1', 'external_person', 'external-1', 'Externe snapshot', "
            "'snapshot@example.com', 'Extern', 0, 5, 'external_person:external-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        db.execute(
            "INSERT INTO work_hour_group_participants "
            "(id, group_id, participant_kind, historical_identity_id, display_name_snapshot, display_email_snapshot, "
            "display_type_snapshot, sort_order, row_version, active_identity_key, created_at, updated_at) "
            "VALUES ('participant-2', 'group-2', 'historical_identity', 'history-1', 'Historische snapshot', "
            "'historisch@example.com', 'Historisch', 0, 6, 'historical_identity:history-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        db.execute(
            "INSERT INTO audit_events (id, event_type, details_json, created_at) VALUES "
            "('audit-import', 'work_hours.import.preview', '{}', CURRENT_TIMESTAMP), "
            "('audit-backup', 'work_hours.backup.created', '{}', CURRENT_TIMESTAMP), "
            "('audit-keep', 'work_hours.group.created', '{\"kept\":true}', CURRENT_TIMESTAMP), "
            "('audit-near-x', 'workXhours.import.preview', '{\"sentinel\":\"x\"}', CURRENT_TIMESTAMP), "
            "('audit-near-hyphen', 'work-hours.import.preview', '{\"sentinel\":\"hyphen\"}', CURRENT_TIMESTAMP), "
            "('audit-near-import', 'work_hours.importXpreview', '{\"sentinel\":\"import\"}', CURRENT_TIMESTAMP), "
            "('audit-near-backup', 'work_hours.backupXcreated', '{\"sentinel\":\"backup\"}', CURRENT_TIMESTAMP)"
        )
        db.commit()


def _table_rows(
    db: sqlite3.Connection, table: str, *, excluded_columns: set[str] | None = None
) -> list[tuple]:
    excluded = excluded_columns or set()
    columns = [
        row[1] for row in db.execute(f'PRAGMA table_info("{table}")')
        if row[1] not in excluded
    ]
    selected = ", ".join(f'"{column}"' for column in columns)
    return db.execute(f'SELECT {selected} FROM "{table}" ORDER BY id').fetchall()


def _preserved_snapshot(db: sqlite3.Connection) -> dict[str, list[tuple]]:
    source_column = "source_" + "import_batch_id"
    snapshot = {
        "groups": _table_rows(db, "work_hour_groups", excluded_columns={source_column}),
        "participants": _table_rows(db, "work_hour_group_participants"),
        "external_people": _table_rows(db, "work_external_people"),
        "historical_identities": _table_rows(db, "work_historical_user_identities"),
        "projects": _table_rows(db, "projects"),
        "posts": _table_rows(db, "work_posts"),
    }
    audit_columns = [row[1] for row in db.execute('PRAGMA table_info("audit_events")')]
    event_type_index = audit_columns.index("event_type")
    audit_rows = _table_rows(db, "audit_events")
    snapshot["audit"] = [
        row for row in audit_rows
        if not row[event_type_index].startswith(("work_hours.import.", "work_hours.backup."))
    ]
    return snapshot


def _destructive_state(db: sqlite3.Connection) -> dict[str, object]:
    batch_table = "work_" + "import_batches"
    return {
        "schema": db.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_master "
            "WHERE name IN (?, 'work_hour_groups') OR tbl_name IN (?, 'work_hour_groups') "
            "ORDER BY type, name",
            (batch_table, batch_table),
        ).fetchall(),
        "batches": _table_rows(db, batch_table),
        "groups": _table_rows(db, "work_hour_groups"),
        "audit": _table_rows(db, "audit_events"),
    }


def test_populated_removal_migration_cleans_only_bounded_subsystem(tmp_path, monkeypatch):
    database, storage, config = _prepare(tmp_path, monkeypatch)
    hours_dir = storage / "exports" / "urenverantwoording"
    sentinel = storage / "sentinel.json"
    sentinel.write_bytes(b"outside")
    _seed_subsystem(database, hours_dir)
    with sqlite3.connect(database) as db:
        before = _preserved_snapshot(db)

    command.upgrade(config, REVISION)

    batch_table = "work_" + "import_batches"
    source_column = "source_" + "import_batch_id"
    with sqlite3.connect(database) as db:
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
        assert not db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (batch_table,)
        ).fetchone()
        assert source_column not in {
            row[1] for row in db.execute("PRAGMA table_info(work_hour_groups)")
        }
        assert _preserved_snapshot(db) == before
        assert db.execute("SELECT id FROM work_hour_groups ORDER BY id").fetchall() == [("group-1",), ("group-2",)]
        assert db.execute("SELECT id FROM audit_events ORDER BY id").fetchall() == [
            ("audit-keep",),
            ("audit-near-backup",),
            ("audit-near-hyphen",),
            ("audit-near-import",),
            ("audit-near-x",),
        ]
    assert sentinel.read_bytes() == b"outside"
    assert (hours_dir / "keep.csv").read_bytes() == b"csv"
    assert not (hours_dir / "registered.json").exists()
    assert not (hours_dir / "leftover.json").exists()
    assert not (hours_dir / "leftover.tmp").exists()

    # Missing files remain harmless, and the structural empty roundtrip is supported.
    command.downgrade(config, PREVIOUS_REVISION)
    command.upgrade(config, REVISION)


def test_removal_migration_rejects_registered_path_outside_boundary_before_db_cleanup(
    tmp_path, monkeypatch
):
    database, storage, config = _prepare(tmp_path, monkeypatch)
    hours_dir = storage / "exports" / "urenverantwoording"
    sentinel = storage / "outside.json"
    sentinel.write_bytes(b"outside")
    _seed_subsystem(database, hours_dir, unsafe_path=sentinel)
    with sqlite3.connect(database) as db:
        before = _destructive_state(db)

    with pytest.raises(RuntimeError, match="buiten de urenexportdirectory"):
        command.upgrade(config, REVISION)

    batch_table = "work_" + "import_batches"
    source_column = "source_" + "import_batch_id"
    with sqlite3.connect(database) as db:
        assert db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (batch_table,)
        ).fetchone()
        assert source_column in {
            row[1] for row in db.execute("PRAGMA table_info(work_hour_groups)")
        }
        assert _destructive_state(db) == before
    assert sentinel.read_bytes() == b"outside"
    assert (hours_dir / "registered.json").read_bytes() == b"registered"


@pytest.mark.parametrize("symlink_case", ["root", "nested", "broken"])
def test_removal_migration_rejects_directory_symlinks_before_destructive_work(
    tmp_path, monkeypatch, symlink_case
):
    database, storage, config = _prepare(tmp_path, monkeypatch)
    hours_dir = storage / "exports" / "urenverantwoording"
    target = storage / "symlink-target"
    target.mkdir()
    target_sentinel = target / "target-sentinel.json"
    target_sentinel.write_bytes(b"target-byte-sentinel")

    if symlink_case == "root":
        hours_dir.parent.mkdir(parents=True, exist_ok=True)
        hours_dir.symlink_to(target, target_is_directory=True)
        symlink = hours_dir
    else:
        _seed_subsystem(database, hours_dir)
        symlink = hours_dir / "nested-directory-link"
        symlink_target = target if symlink_case == "nested" else storage / "missing-directory"
        symlink.symlink_to(symlink_target, target_is_directory=True)
    if symlink_case == "root":
        _seed_subsystem(database, hours_dir)

    with sqlite3.connect(database) as db:
        before_db = _destructive_state(db)
    before_registered = (hours_dir / "registered.json").read_bytes()
    before_leftover = (hours_dir / "leftover.json").read_bytes()
    link_target = symlink.readlink()

    with pytest.raises(RuntimeError, match="symlink"):
        command.upgrade(config, REVISION)

    with sqlite3.connect(database) as db:
        assert _destructive_state(db) == before_db
    assert symlink.is_symlink()
    assert symlink.readlink() == link_target
    assert target_sentinel.read_bytes() == b"target-byte-sentinel"
    assert (hours_dir / "registered.json").read_bytes() == before_registered
    assert (hours_dir / "leftover.json").read_bytes() == before_leftover


def test_file_cleanup_never_follows_symlinks(tmp_path):
    configured = tmp_path / "hours"
    configured.mkdir()
    outside = tmp_path / "outside.json"
    outside.write_bytes(b"outside")
    (configured / "linked.json").symlink_to(outside)

    MIGRATION._remove_hours_artifacts(configured, configured.resolve())

    assert outside.read_bytes() == b"outside"
    assert (configured / "linked.json").is_symlink()
