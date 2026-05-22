"""add vergaderborden domain tables

Revision ID: 20260514_0016
Revises: 20260324_0015
Create Date: 2026-05-14
"""

from alembic import op
import sqlalchemy as sa


revision = "20260514_0016"
down_revision = "20260324_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    project_columns = {col["name"] for col in inspector.get_columns("projects")}
    if "description" not in project_columns:
        op.add_column("projects", sa.Column("description", sa.Text(), nullable=False, server_default=""))
    if "is_archived" not in project_columns:
        op.add_column("projects", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    if "invited_user_ids_json" not in project_columns:
        op.add_column("projects", sa.Column("invited_user_ids_json", sa.Text(), nullable=False, server_default="[]"))
    if "last_activity_at" not in project_columns:
        op.add_column("projects", sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True))

    if "board_cards" not in inspector.get_table_names():
        op.create_table(
            "board_cards",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("column", sa.Enum("todo", "doing", "done", name="boardcolumn"), nullable=False, server_default="todo"),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_board_cards_project_column_position", "board_cards", ["project_id", "column", "position"])

    if "card_assignments" not in inspector.get_table_names():
        op.create_table(
            "card_assignments",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("card_id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["card_id"], ["board_cards.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("card_id", "user_id", name="uq_card_assignments_card_user"),
        )

    if "card_updates" not in inspector.get_table_names():
        op.create_table(
            "card_updates",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("card_id", sa.String(length=36), nullable=False),
            sa.Column("author_user_id", sa.String(length=36), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["card_id"], ["board_cards.id"]),
            sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_card_updates_card_created", "card_updates", ["card_id", "created_at"])

    if "recordings" not in inspector.get_table_names():
        op.create_table(
            "recordings",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("card_id", sa.String(length=36), nullable=False),
            sa.Column("uploaded_by_user_id", sa.String(length=36), nullable=False),
            sa.Column("file_path", sa.String(length=500), nullable=False),
            sa.Column("mime_type", sa.String(length=100), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("transcript_status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("transcript_text", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["card_id"], ["board_cards.id"]),
            sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_recordings_card_created", "recordings", ["card_id", "created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "recordings" in inspector.get_table_names():
        op.drop_index("ix_recordings_card_created", table_name="recordings")
        op.drop_table("recordings")
    if "card_updates" in inspector.get_table_names():
        op.drop_index("ix_card_updates_card_created", table_name="card_updates")
        op.drop_table("card_updates")
    if "card_assignments" in inspector.get_table_names():
        op.drop_table("card_assignments")
    if "board_cards" in inspector.get_table_names():
        op.drop_index("ix_board_cards_project_column_position", table_name="board_cards")
        op.drop_table("board_cards")

    project_columns = {col["name"] for col in inspector.get_columns("projects")}
    if "last_activity_at" in project_columns:
        op.drop_column("projects", "last_activity_at")
    if "invited_user_ids_json" in project_columns:
        op.drop_column("projects", "invited_user_ids_json")
    if "is_archived" in project_columns:
        op.drop_column("projects", "is_archived")
    if "description" in project_columns:
        op.drop_column("projects", "description")
