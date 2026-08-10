#!/usr/bin/env python3
"""Create, read, restore and compare a SQLite pre-migration backup."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from pathlib import Path


HOURS_TABLES = (
    "work_projects", "work_posts", "work_hour_groups",
    "work_hour_group_participants", "work_external_people",
    "work_historical_user_identities", "work_import_batches", "audit_events",
)


def _digest(connection: sqlite3.Connection, table: str) -> tuple[int, str]:
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    if not exists:
        return 0, "missing"
    rows = connection.execute(f'SELECT * FROM "{table}" ORDER BY rowid').fetchall()
    encoded = json.dumps(rows, ensure_ascii=False, default=str, separators=(",", ":")).encode()
    return len(rows), hashlib.sha256(encoded).hexdigest()


def create_and_verify_backup(source: Path, backup: Path, restored: Path) -> dict[str, tuple[int, str]]:
    if not source.is_file():
        raise RuntimeError(f"Brondatabase ontbreekt: {source}")
    for target in (backup, restored):
        if target.exists():
            raise RuntimeError(f"Doel bestaat al; overschrijven geweigerd: {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as source_db, sqlite3.connect(backup) as backup_db:
        if source_db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Brondatabase faalt integrity_check")
        source_db.backup(backup_db)
    with sqlite3.connect(backup) as backup_db, sqlite3.connect(restored) as restored_db:
        if backup_db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Backup faalt integrity_check")
        backup_db.backup(restored_db)
    with sqlite3.connect(source) as source_db, sqlite3.connect(restored) as restored_db:
        if restored_db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Herstelde database faalt integrity_check")
        source_state = {table: _digest(source_db, table) for table in HOURS_TABLES}
        restored_state = {table: _digest(restored_db, table) for table in HOURS_TABLES}
    if source_state != restored_state:
        raise RuntimeError("Backup/restorevergelijking van uren- en audittabellen wijkt af")
    return source_state


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("backup", type=Path)
    parser.add_argument("restored", type=Path)
    args = parser.parse_args()
    evidence = create_and_verify_backup(args.source, args.backup, args.restored)
    print(json.dumps({"status": "ok", "tables": evidence}, sort_keys=True))


if __name__ == "__main__":
    main()
