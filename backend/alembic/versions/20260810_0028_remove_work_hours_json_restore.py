"""remove work-hours JSON backup and restore subsystem

Revision ID: 20260810_0028
Revises: 20260809_0027
Create Date: 2026-08-10
"""

from __future__ import annotations

import os
from pathlib import Path

from alembic import op
import sqlalchemy as sa

from app.core.settings import get_settings


revision = "20260810_0028"
down_revision = "20260809_0027"
branch_labels = None
depends_on = None

NAMING = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
}


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def _contains_symlink(path: Path, root: Path) -> bool:
    current = path
    while current != root:
        if current.is_symlink():
            return True
        if current.parent == current:
            return True
        current = current.parent
    return root.is_symlink()


def _preflight_registered_paths(raw_paths: list[str], hours_root: Path) -> None:
    for raw_path in raw_paths:
        registered = Path(raw_path).expanduser()
        resolved = registered.resolve(strict=False)
        if not _is_within(resolved, hours_root):
            raise RuntimeError(
                "Onveilig geregistreerd urenbackuppad buiten de urenexportdirectory: "
                f"{raw_path}"
            )


def _preflight_hours_tree(configured_root: Path) -> None:
    if configured_root.is_symlink():
        raise RuntimeError(
            "Onveilige symlink als geconfigureerde urenexportdirectory: "
            f"{configured_root}"
        )
    if not configured_root.exists():
        return
    pending = [configured_root]
    while pending:
        directory = pending.pop()
        with os.scandir(directory) as entries:
            for entry in entries:
                candidate = Path(entry.path)
                if entry.is_symlink():
                    broken = not candidate.exists()
                    points_to_directory = not broken and entry.is_dir(follow_symlinks=True)
                    if broken or points_to_directory:
                        raise RuntimeError(
                            "Onveilige directorysymlink in urenexportdirectory: "
                            f"{candidate}"
                        )
                    continue
                if entry.is_dir(follow_symlinks=False):
                    pending.append(candidate)


def _remove_hours_artifacts(configured_root: Path, hours_root: Path) -> None:
    if not configured_root.exists():
        return
    for directory, directory_names, filenames in os.walk(configured_root, followlinks=False):
        parent = Path(directory)
        directory_names[:] = [name for name in directory_names if not (parent / name).is_symlink()]
        for filename in filenames:
            candidate = parent / filename
            if candidate.suffix.lower() not in {".json", ".tmp"}:
                continue
            if candidate.is_symlink() or _contains_symlink(candidate, configured_root):
                continue
            if not _is_within(candidate.resolve(strict=False), hours_root):
                continue
            candidate.unlink(missing_ok=True)
    for directory, _, _ in os.walk(configured_root, topdown=False, followlinks=False):
        candidate = Path(directory)
        if candidate.is_symlink():
            continue
        try:
            candidate.rmdir()
        except OSError:
            pass


def upgrade() -> None:
    connection = op.get_bind()
    settings = get_settings()
    configured_root = settings.storage_root / settings.exports_dir / "urenverantwoording"
    hours_root = configured_root.resolve(strict=False)
    raw_paths = [
        str(row[0])
        for row in connection.execute(
            sa.text(
                "SELECT pre_import_backup_path FROM work_import_batches "
                "WHERE pre_import_backup_path IS NOT NULL"
            )
        )
    ]

    # Validate every persisted path before deleting files or touching data/schema.
    _preflight_hours_tree(configured_root)
    _preflight_registered_paths(raw_paths, hours_root)
    _remove_hours_artifacts(configured_root, hours_root)

    connection.execute(
        sa.text(
            "DELETE FROM audit_events "
            "WHERE substr(event_type, 1, length(:import_prefix)) = :import_prefix "
            "OR substr(event_type, 1, length(:backup_prefix)) = :backup_prefix"
        ),
        {
            "import_prefix": "work_hours.import.",
            "backup_prefix": "work_hours.backup.",
        },
    )
    with op.batch_alter_table(
        "work_hour_groups", recreate="always", naming_convention=NAMING
    ) as batch:
        batch.drop_constraint(
            "fk_work_hour_groups_source_import_batch_id_work_import_batches",
            type_="foreignkey",
        )
        batch.drop_column("source_import_batch_id")
    op.drop_index("ix_work_import_batches_status", table_name="work_import_batches")
    op.drop_index(
        "ix_work_import_batches_requested_by_user_id",
        table_name="work_import_batches",
    )
    op.drop_table("work_import_batches")


def downgrade() -> None:
    op.create_table(
        "work_import_batches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_by_user_id", sa.String(36), nullable=True),
        sa.Column("format_version", sa.String(40), nullable=False),
        sa.Column("backup_version", sa.String(40), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("source_filename", sa.String(255), nullable=False),
        sa.Column("source_hash", sa.String(128), nullable=False),
        sa.Column("pre_import_backup_path", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="preview"),
        sa.Column("counts_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("warnings_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("errors_json", sa.Text(), nullable=False, server_default="[]"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
    )
    op.create_index(
        "ix_work_import_batches_status", "work_import_batches", ["status"]
    )
    op.create_index(
        "ix_work_import_batches_requested_by_user_id",
        "work_import_batches",
        ["requested_by_user_id"],
    )
    with op.batch_alter_table(
        "work_hour_groups", recreate="always", naming_convention=NAMING
    ) as batch:
        batch.add_column(sa.Column("source_import_batch_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_work_hour_groups_source_import_batch_id_work_import_batches",
            "work_import_batches",
            ["source_import_batch_id"],
            ["id"],
        )
