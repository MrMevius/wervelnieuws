"""central projects and global work posts

Revision ID: 20260809_0027
Revises: 20260730_0026
Create Date: 2026-08-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from app.services.work_hours_migration import (
    CentralProjectRow,
    LegacyPostRow,
    LegacyProjectRow,
    build_canonical_posts,
    build_project_mappings,
    assert_migration_baseline_unchanged,
    stable_rows_snapshot,
)


revision = "20260809_0027"
down_revision = "20260730_0026"
branch_labels = None
depends_on = None

NAMING = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
}


def _rows(connection, statement: str) -> list[dict]:
    return [dict(row) for row in connection.execute(sa.text(statement)).mappings()]


def upgrade() -> None:
    connection = op.get_bind()

    # Full preflight happens before the first write.  Ambiguity raises with all
    # candidate IDs and lets Alembic roll back the revision transaction.
    legacy_project_data = _rows(connection, "SELECT * FROM work_projects")
    central_project_data = _rows(connection, "SELECT id, name FROM projects")
    legacy_post_data = _rows(connection, "SELECT * FROM work_posts")
    group_data = _rows(connection, "SELECT id, project_id, post_id FROM work_hour_groups")
    participant_count = connection.scalar(sa.text("SELECT count(*) FROM work_hour_group_participants"))
    audit_count = connection.scalar(sa.text("SELECT count(*) FROM audit_events"))

    legacy_projects = [
        LegacyProjectRow(
            id=row["id"], name=row["name"], description=row["description"],
            is_active=bool(row["is_active"]), is_archived=bool(row["is_archived"]),
            created_at=row["created_at"],
        )
        for row in legacy_project_data
    ]
    mappings = build_project_mappings(
        legacy_projects,
        [CentralProjectRow(id=row["id"], name=row["name"]) for row in central_project_data],
    )
    posts = [
        LegacyPostRow(
            id=row["id"], project_id=row["project_id"], name=row["name"],
            description=row["description"], is_active=bool(row["is_active"]),
            is_archived=bool(row["is_archived"]), deleted=row["deleted_at"] is not None,
            created_at=row["created_at"],
        )
        for row in legacy_post_data
    ]
    canonical_posts = build_canonical_posts(posts)
    project_map = {item.legacy_id: item.project_id for item in mappings}
    post_map = {
        source_id: post.canonical_id
        for post in canonical_posts
        for source_id in post.source_ids
    }
    invalid_groups = [
        row["id"] for row in group_data
        if row["project_id"] not in project_map or row["post_id"] not in post_map
    ]
    if invalid_groups:
        raise RuntimeError("Onoplosbare urenreferenties: " + ", ".join(sorted(invalid_groups)))

    sqlite = connection.dialect.name == "sqlite"

    op.create_table(
        "work_project_legacy_aliases",
        sa.Column("legacy_project_id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), nullable=False),
        sa.Column("migration_created_project", sa.Boolean(), nullable=False),
        sa.Column("legacy_snapshot_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("ix_work_project_alias_project_id", "work_project_legacy_aliases", ["project_id"])
    op.create_table(
        "work_post_legacy_aliases",
        sa.Column("legacy_post_id", sa.String(36), primary_key=True),
        sa.Column("post_id", sa.String(36), nullable=False),
        sa.Column("legacy_project_id", sa.String(36), nullable=True),
        sa.Column("legacy_snapshot_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["work_posts.id"]),
        sa.ForeignKeyConstraint(["legacy_project_id"], ["work_projects.id"]),
    )
    op.create_index("ix_work_post_alias_post_id", "work_post_legacy_aliases", ["post_id"])
    op.create_table(
        "work_hour_migration_group_snapshots",
        sa.Column("group_id", sa.String(36), primary_key=True),
        sa.Column("legacy_project_id", sa.String(36), nullable=False),
        sa.Column("legacy_post_id", sa.String(36), nullable=False),
    )
    op.create_table(
        "work_hour_migration_baseline",
        sa.Column("scope", sa.String(40), primary_key=True),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
    )

    import json

    legacy_project_by_id = {row["id"]: row for row in legacy_project_data}
    for mapping in mappings:
        source = legacy_project_by_id[mapping.legacy_id]
        if mapping.create_project:
            connection.execute(
                sa.text(
                    "INSERT INTO projects (id, name, description, is_active, is_archived, "
                    "invited_user_ids_json, created_at, updated_at) "
                    "VALUES (:id, :name, :description, :active, :archived, '[]', :created, :updated)"
                ),
                {
                    "id": mapping.project_id, "name": source["name"],
                    "description": source["description"],
                    "active": bool(source["is_active"] and not source["is_archived"] and source["deleted_at"] is None),
                    "archived": bool(source["is_archived"] or source["deleted_at"] is not None),
                    "created": source["created_at"], "updated": source["updated_at"],
                },
            )
        connection.execute(
            sa.text(
                "INSERT INTO work_project_legacy_aliases "
                "(legacy_project_id, project_id, migration_created_project, legacy_snapshot_json) "
                "VALUES (:legacy, :project, :created, :snapshot)"
            ),
            {
                "legacy": mapping.legacy_id, "project": mapping.project_id,
                "created": mapping.create_project,
                "snapshot": json.dumps(source, default=str, ensure_ascii=False),
            },
        )

    canonical_by_id = {post.canonical_id: post for post in canonical_posts}
    legacy_project_ids = {row["id"] for row in legacy_project_data}
    shadow_work_project_ids = sorted(set(project_map.values()) - legacy_project_ids)
    for shadow_id in shadow_work_project_ids:
        connection.execute(
            sa.text(
                "INSERT INTO work_projects (id, created_at, updated_at, name, description, "
                "is_active, is_archived, row_version) "
                "VALUES (:id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :name, '', 0, 0, 1)"
            ),
            {"id": shadow_id, "name": f"__migration_shadow__{shadow_id}"},
        )
    for source in legacy_post_data:
        connection.execute(
            sa.text(
                "INSERT INTO work_post_legacy_aliases "
                "(legacy_post_id, post_id, legacy_project_id, legacy_snapshot_json) "
                "VALUES (:legacy, :post, :project, :snapshot)"
            ),
            {
                "legacy": source["id"], "post": post_map[source["id"]],
                "project": source["project_id"],
                "snapshot": json.dumps(source, default=str, ensure_ascii=False),
            },
        )
    for group in group_data:
        connection.execute(
            sa.text(
                "INSERT INTO work_hour_migration_group_snapshots "
                "(group_id, legacy_project_id, legacy_post_id) VALUES (:id, :project, :post)"
            ),
            {"id": group["id"], "project": group["project_id"], "post": group["post_id"]},
        )
        connection.execute(
            sa.text("UPDATE work_hour_groups SET project_id=:project, post_id=:post WHERE id=:id"),
            {"id": group["id"], "project": project_map[group["project_id"]], "post": post_map[group["post_id"]]},
        )

    op.add_column("work_posts", sa.Column("normalized_name", sa.String(120), nullable=True))
    for canonical_id, canonical in canonical_by_id.items():
        connection.execute(
            sa.text(
                "UPDATE work_posts SET name=:name, normalized_name=:normalized, description=:description, "
                "is_active=:active WHERE id=:id"
            ),
            {
                "id": canonical_id, "name": canonical.name,
                "normalized": canonical.normalized_name, "description": canonical.description,
                "active": canonical.is_active,
            },
        )
    duplicate_ids = sorted(set(post_map) - set(canonical_by_id))
    for post_id in duplicate_ids:
        connection.execute(sa.text("DELETE FROM work_posts WHERE id=:id"), {"id": post_id})

    with op.batch_alter_table("work_posts", recreate="always", naming_convention=NAMING) as batch:
        batch.drop_index("ix_work_posts_project_id")
        batch.drop_constraint("uq_work_posts_project_name", type_="unique")
        batch.drop_constraint("fk_work_posts_project_id_work_projects", type_="foreignkey")
        batch.drop_column("project_id")
        batch.alter_column("normalized_name", nullable=False)
        batch.create_unique_constraint("uq_work_posts_normalized_name", ["normalized_name"])

    with op.batch_alter_table("work_hour_groups", recreate="always", naming_convention=NAMING) as batch:
        batch.drop_constraint("fk_work_hour_groups_project_id_work_projects", type_="foreignkey")
        batch.create_foreign_key(
            "fk_work_hour_groups_project_id_projects", "projects", ["project_id"], ["id"]
        )
    for shadow_id in shadow_work_project_ids:
        connection.execute(sa.text("DELETE FROM work_projects WHERE id=:id"), {"id": shadow_id})

    baseline_queries = {
        "groups": "SELECT * FROM work_hour_groups ORDER BY id",
        "participants": "SELECT * FROM work_hour_group_participants ORDER BY id",
        "posts": "SELECT * FROM work_posts ORDER BY id",
    }
    for scope, statement in baseline_queries.items():
        connection.execute(
            sa.text("INSERT INTO work_hour_migration_baseline (scope, snapshot_json) VALUES (:scope, :snapshot)"),
            {"scope": scope, "snapshot": stable_rows_snapshot(_rows(connection, statement))},
        )

    if connection.scalar(sa.text("SELECT count(*) FROM work_hour_groups")) != len(group_data):
        raise RuntimeError("Groepentelling wijzigde tijdens urenmigratie")
    if connection.scalar(sa.text("SELECT count(*) FROM work_hour_group_participants")) != participant_count:
        raise RuntimeError("Deelnemerstelling wijzigde tijdens urenmigratie")
    if connection.scalar(sa.text("SELECT count(*) FROM audit_events")) != audit_count:
        raise RuntimeError("Audittelling wijzigde tijdens urenmigratie")
    if sqlite:
        violations = list(connection.exec_driver_sql("PRAGMA foreign_key_check"))
        if violations:
            raise RuntimeError(f"Foreign-keyfout na urenmigratie: {violations}")


def downgrade() -> None:
    connection = op.get_bind()
    import json

    baseline = {row["scope"]: row["snapshot_json"] for row in _rows(connection, "SELECT * FROM work_hour_migration_baseline")}
    current = {
        "groups": stable_rows_snapshot(_rows(connection, "SELECT * FROM work_hour_groups ORDER BY id")),
        "participants": stable_rows_snapshot(_rows(connection, "SELECT * FROM work_hour_group_participants ORDER BY id")),
        "posts": stable_rows_snapshot(_rows(connection, "SELECT * FROM work_posts ORDER BY id")),
    }
    assert_migration_baseline_unchanged(baseline, current)

    snapshots = _rows(connection, "SELECT * FROM work_hour_migration_group_snapshots")
    groups = _rows(connection, "SELECT id, project_id, post_id FROM work_hour_groups")
    if {row["id"] for row in groups} != {row["group_id"] for row in snapshots}:
        raise RuntimeError(
            "Downgrade geweigerd: nieuwe live urenwrites aanwezig; herstel de pre-migratiebackup."
        )

    aliases = _rows(connection, "SELECT * FROM work_post_legacy_aliases")
    if any(not row["legacy_snapshot_json"] or row["legacy_snapshot_json"] == "{}" for row in aliases):
        raise RuntimeError(
            "Downgrade geweigerd: post-migratie writes aanwezig; herstel de pre-migratiebackup."
        )
    sqlite = connection.dialect.name == "sqlite"
    with op.batch_alter_table("work_posts", recreate="always", naming_convention=NAMING) as batch:
        batch.drop_constraint("uq_work_posts_normalized_name", type_="unique")
        batch.add_column(sa.Column("project_id", sa.String(36), nullable=True))
        batch.drop_column("normalized_name")
        batch.create_foreign_key(
            "fk_work_posts_project_id_work_projects", "work_projects", ["project_id"], ["id"]
        )

    canonical_legacy_ids: dict[str, str] = {}
    for post_id in {row["post_id"] for row in aliases}:
        source_ids = sorted(row["legacy_post_id"] for row in aliases if row["post_id"] == post_id)
        canonical_legacy_ids[post_id] = post_id if post_id in source_ids else source_ids[0]
    for row in aliases:
        snapshot = json.loads(row["legacy_snapshot_json"])
        values = {
            key: snapshot.get(key)
            for key in (
                "id", "created_at", "updated_at", "project_id", "name", "description",
                "is_active", "is_archived", "archived_at", "archived_by_user_id",
                "created_by_user_id", "updated_by_user_id", "deleted_at",
                "deleted_by_user_id", "row_version",
            )
        }
        if row["legacy_post_id"] == canonical_legacy_ids[row["post_id"]]:
            assignments = ", ".join(f"{key}=:{key}" for key in values if key != "id")
            connection.execute(sa.text(f"UPDATE work_posts SET {assignments} WHERE id=:id"), values)
        else:
            columns = ", ".join(values)
            placeholders = ", ".join(f":{key}" for key in values)
            connection.execute(sa.text(f"INSERT INTO work_posts ({columns}) VALUES ({placeholders})"), values)

    with op.batch_alter_table("work_posts", recreate="always", naming_convention=NAMING) as batch:
        batch.alter_column("project_id", nullable=False)
        batch.create_index("ix_work_posts_project_id", ["project_id"])
        batch.create_unique_constraint("uq_work_posts_project_name", ["project_id", "name"])

    snapshot_by_group = {row["group_id"]: row for row in snapshots}
    central_project_ids = {row["id"] for row in _rows(connection, "SELECT id FROM projects")}
    shadow_project_ids = sorted(
        {row["legacy_project_id"] for row in snapshots} - central_project_ids
    )
    for shadow_id in shadow_project_ids:
        connection.execute(
            sa.text(
                "INSERT INTO projects (id, name, description, is_active, is_archived, "
                "invited_user_ids_json, created_at, updated_at) "
                "VALUES (:id, :name, '', 0, 1, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {"id": shadow_id, "name": f"__migration_shadow__{shadow_id}"},
        )
    for group in groups:
        snapshot = snapshot_by_group[group["id"]]
        connection.execute(
            sa.text("UPDATE work_hour_groups SET project_id=:project, post_id=:post WHERE id=:id"),
            {"id": group["id"], "project": snapshot["legacy_project_id"], "post": snapshot["legacy_post_id"]},
        )
    with op.batch_alter_table("work_hour_groups", recreate="always", naming_convention=NAMING) as batch:
        batch.drop_constraint("fk_work_hour_groups_project_id_projects", type_="foreignkey")
        batch.create_foreign_key(
            "fk_work_hour_groups_project_id_work_projects", "work_projects", ["project_id"], ["id"]
        )
    for shadow_id in shadow_project_ids:
        connection.execute(sa.text("DELETE FROM projects WHERE id=:id"), {"id": shadow_id})

    op.drop_table("work_hour_migration_baseline")
    op.drop_table("work_hour_migration_group_snapshots")
    op.drop_index("ix_work_post_alias_post_id", table_name="work_post_legacy_aliases")
    op.drop_table("work_post_legacy_aliases")
    op.drop_index("ix_work_project_alias_project_id", table_name="work_project_legacy_aliases")
    op.drop_table("work_project_legacy_aliases")
    if sqlite:
        violations = list(connection.exec_driver_sql("PRAGMA foreign_key_check"))
        if violations:
            raise RuntimeError(f"Foreign-keyfout na urendowngrade: {violations}")
