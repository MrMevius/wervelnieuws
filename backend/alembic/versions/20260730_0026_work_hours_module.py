"""create work hours module tables

Revision ID: 20260730_0026
Revises: 20260729_0025
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260730_0026"
down_revision = "20260729_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_projects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["archived_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
        sa.UniqueConstraint("name", name="uq_work_projects_name"),
        sa.CheckConstraint("(deleted_at IS NULL) = (deleted_by_user_id IS NULL)", name="ck_work_projects_deleted_tuple"),
        sa.CheckConstraint("(is_archived = false AND archived_at IS NULL AND archived_by_user_id IS NULL) OR (is_archived = true AND is_active = false AND archived_at IS NOT NULL AND archived_by_user_id IS NOT NULL)", name="ck_work_projects_archived_tuple"),
        sa.CheckConstraint("NOT (is_active = true AND (is_archived = true OR deleted_at IS NOT NULL))", name="ck_work_projects_active_state"),
    )
    op.create_index("ix_work_projects_is_active", "work_projects", ["is_active"])
    op.create_index("ix_work_projects_is_archived", "work_projects", ["is_archived"])
    op.create_index("ix_work_projects_deleted_at", "work_projects", ["deleted_at"])

    op.create_table(
        "work_posts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["project_id"], ["work_projects.id"]),
        sa.ForeignKeyConstraint(["archived_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
        sa.UniqueConstraint("project_id", "name", name="uq_work_posts_project_name"),
        sa.CheckConstraint("(deleted_at IS NULL) = (deleted_by_user_id IS NULL)", name="ck_work_posts_deleted_tuple"),
        sa.CheckConstraint("(is_archived = false AND archived_at IS NULL AND archived_by_user_id IS NULL) OR (is_archived = true AND is_active = false AND archived_at IS NOT NULL AND archived_by_user_id IS NOT NULL)", name="ck_work_posts_archived_tuple"),
        sa.CheckConstraint("NOT (is_active = true AND (is_archived = true OR deleted_at IS NOT NULL))", name="ck_work_posts_active_state"),
    )
    op.create_index("ix_work_posts_project_id", "work_posts", ["project_id"])
    op.create_index("ix_work_posts_is_active", "work_posts", ["is_active"])
    op.create_index("ix_work_posts_is_archived", "work_posts", ["is_archived"])
    op.create_index("ix_work_posts_deleted_at", "work_posts", ["deleted_at"])

    op.create_table(
        "work_external_people",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column("normalized_name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("normalized_email", sa.String(length=255), nullable=True),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
        sa.UniqueConstraint("normalized_name", "normalized_email", name="uq_work_external_people_name_email"),
        sa.UniqueConstraint("normalized_email", name="uq_work_external_people_normalized_email"),
    )
    op.create_index("ix_work_external_people_normalized_name", "work_external_people", ["normalized_name"])
    op.create_index("ix_work_external_people_normalized_email", "work_external_people", ["normalized_email"])
    op.create_index("ix_work_external_people_is_active", "work_external_people", ["is_active"])
    op.create_index("ix_work_external_people_deleted_at", "work_external_people", ["deleted_at"])

    op.create_table(
        "work_historical_user_identities",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_key", sa.String(length=120), nullable=False),
        sa.Column("source_user_id", sa.String(length=36), nullable=True),
        sa.Column("snapshot_name", sa.String(length=160), nullable=False),
        sa.Column("snapshot_email", sa.String(length=255), nullable=True),
        sa.Column("snapshot_display_label", sa.String(length=200), nullable=False),
        sa.Column("linked_user_id", sa.String(length=36), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("linked_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["source_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["linked_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["linked_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
    )
    op.create_index("ix_work_historical_user_identities_source_key", "work_historical_user_identities", ["source_key"], unique=True)
    op.create_index("ix_work_historical_user_identities_linked_user_id", "work_historical_user_identities", ["linked_user_id"])
    op.create_index("ix_work_historical_user_identities_deleted_at", "work_historical_user_identities", ["deleted_at"])

    op.create_table(
        "work_import_batches",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("format_version", sa.String(length=40), nullable=False),
        sa.Column("backup_version", sa.String(length=40), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("source_hash", sa.String(length=128), nullable=False),
        sa.Column("pre_import_backup_path", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="preview"),
        sa.Column("counts_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("warnings_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("errors_json", sa.Text(), nullable=False, server_default="[]"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
    )
    op.create_index("ix_work_import_batches_status", "work_import_batches", ["status"])
    op.create_index("ix_work_import_batches_requested_by_user_id", "work_import_batches", ["requested_by_user_id"])

    op.create_table(
        "work_hour_groups",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("post_id", sa.String(length=36), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("duration_half_hours", sa.Integer(), nullable=False),
        sa.Column("source_import_batch_id", sa.String(length=36), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["project_id"], ["work_projects.id"]),
        sa.ForeignKeyConstraint(["post_id"], ["work_posts.id"]),
        sa.ForeignKeyConstraint(["source_import_batch_id"], ["work_import_batches.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
        sa.CheckConstraint(
            "duration_half_hours >= 1 AND duration_half_hours <= 48",
            name="ck_work_hour_groups_duration_half_hours",
        ),
    )
    op.create_index("ix_work_hour_groups_work_date", "work_hour_groups", ["work_date"])
    op.create_index("ix_work_hour_groups_project_id", "work_hour_groups", ["project_id"])
    op.create_index("ix_work_hour_groups_post_id", "work_hour_groups", ["post_id"])
    op.create_index("ix_work_hour_groups_deleted_at", "work_hour_groups", ["deleted_at"])
    op.create_index("ix_work_hour_groups_created_at", "work_hour_groups", ["created_at"])
    op.create_index("ix_work_hour_groups_updated_at", "work_hour_groups", ["updated_at"])

    op.create_table(
        "work_hour_group_participants",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("group_id", sa.String(length=36), nullable=False),
        sa.Column("participant_kind", sa.String(length=40), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("external_person_id", sa.String(length=36), nullable=True),
        sa.Column("historical_identity_id", sa.String(length=36), nullable=True),
        sa.Column("display_name_snapshot", sa.String(length=160), nullable=False),
        sa.Column("display_email_snapshot", sa.String(length=255), nullable=True),
        sa.Column("display_type_snapshot", sa.String(length=80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("active_identity_key", sa.String(length=80), nullable=True),
        sa.CheckConstraint(
            "((user_id IS NOT NULL) + (external_person_id IS NOT NULL) + (historical_identity_id IS NOT NULL)) = 1",
            name="ck_work_hour_group_participants_exactly_one_identity",
        ),
        sa.ForeignKeyConstraint(["group_id"], ["work_hour_groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["external_person_id"], ["work_external_people.id"]),
        sa.ForeignKeyConstraint(["historical_identity_id"], ["work_historical_user_identities.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
        sa.UniqueConstraint(
            "group_id",
            "active_identity_key",
            name="uq_work_hour_group_participants_active_identity",
        ),
    )
    op.create_index("ix_work_hour_group_participants_group_id", "work_hour_group_participants", ["group_id"])
    op.create_index("ix_work_hour_group_participants_participant_kind", "work_hour_group_participants", ["participant_kind"])
    op.create_index("ix_work_hour_group_participants_deleted_at", "work_hour_group_participants", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_work_hour_group_participants_deleted_at", table_name="work_hour_group_participants")
    op.drop_index("ix_work_hour_group_participants_participant_kind", table_name="work_hour_group_participants")
    op.drop_index("ix_work_hour_group_participants_group_id", table_name="work_hour_group_participants")
    op.drop_table("work_hour_group_participants")

    op.drop_index("ix_work_hour_groups_updated_at", table_name="work_hour_groups")
    op.drop_index("ix_work_hour_groups_created_at", table_name="work_hour_groups")
    op.drop_index("ix_work_hour_groups_deleted_at", table_name="work_hour_groups")
    op.drop_index("ix_work_hour_groups_post_id", table_name="work_hour_groups")
    op.drop_index("ix_work_hour_groups_project_id", table_name="work_hour_groups")
    op.drop_index("ix_work_hour_groups_work_date", table_name="work_hour_groups")
    op.drop_table("work_hour_groups")

    op.drop_index("ix_work_import_batches_requested_by_user_id", table_name="work_import_batches")
    op.drop_index("ix_work_import_batches_status", table_name="work_import_batches")
    op.drop_table("work_import_batches")

    op.drop_index("ix_work_historical_user_identities_deleted_at", table_name="work_historical_user_identities")
    op.drop_index("ix_work_historical_user_identities_linked_user_id", table_name="work_historical_user_identities")
    op.drop_index("ix_work_historical_user_identities_source_key", table_name="work_historical_user_identities")
    op.drop_table("work_historical_user_identities")

    op.drop_index("ix_work_external_people_deleted_at", table_name="work_external_people")
    op.drop_index("ix_work_external_people_is_active", table_name="work_external_people")
    op.drop_index("ix_work_external_people_normalized_email", table_name="work_external_people")
    op.drop_index("ix_work_external_people_normalized_name", table_name="work_external_people")
    op.drop_table("work_external_people")

    op.drop_index("ix_work_posts_deleted_at", table_name="work_posts")
    op.drop_index("ix_work_posts_is_archived", table_name="work_posts")
    op.drop_index("ix_work_posts_is_active", table_name="work_posts")
    op.drop_index("ix_work_posts_project_id", table_name="work_posts")
    op.drop_table("work_posts")

    op.drop_index("ix_work_projects_deleted_at", table_name="work_projects")
    op.drop_index("ix_work_projects_is_archived", table_name="work_projects")
    op.drop_index("ix_work_projects_is_active", table_name="work_projects")
    op.drop_table("work_projects")
