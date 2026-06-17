"""add board card attachments

Revision ID: 20260616_0023
Revises: 20260609_0022
Create Date: 2026-06-16
"""

from alembic import op
import sqlalchemy as sa


revision = "20260616_0023"
down_revision = "20260609_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "board_card_attachments" not in inspector.get_table_names():
        op.create_table(
            "board_card_attachments",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("card_id", sa.String(length=36), nullable=False),
            sa.Column("uploaded_by_user_id", sa.String(length=36), nullable=False),
            sa.Column("filename", sa.String(length=255), nullable=False),
            sa.Column("file_path", sa.String(length=500), nullable=False),
            sa.Column("mime_type", sa.String(length=120), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["card_id"], ["board_cards.id"]),
            sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_board_card_attachments_card_created",
            "board_card_attachments",
            ["card_id", "created_at"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "board_card_attachments" in inspector.get_table_names():
        op.drop_index("ix_board_card_attachments_card_created", table_name="board_card_attachments")
        op.drop_table("board_card_attachments")
