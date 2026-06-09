"""add variant part approval states and topic feedback fields

Revision ID: 20260316_0013
Revises: 20260315_0012
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa


revision = "20260316_0013"
down_revision = "20260315_0012"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(
        column.get("name") == column_name
        for column in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not _has_column(inspector, "topics", "text_feedback"):
        op.add_column(
            "topics",
            sa.Column("text_feedback", sa.Text(), nullable=False, server_default=""),
        )
    if not _has_column(inspector, "topics", "image_feedback"):
        op.add_column(
            "topics",
            sa.Column("image_feedback", sa.Text(), nullable=False, server_default=""),
        )

    if not _has_column(inspector, "content_channel_variants", "text_approval_state"):
        op.add_column(
            "content_channel_variants",
            sa.Column(
                "text_approval_state",
                sa.Enum(
                    "pending",
                    "approved",
                    "rejected",
                    name="contentapprovalstate",
                    create_type=False,
                ),
                nullable=False,
                server_default="pending",
            ),
        )
    if not _has_column(inspector, "content_channel_variants", "image_approval_state"):
        op.add_column(
            "content_channel_variants",
            sa.Column(
                "image_approval_state",
                sa.Enum(
                    "pending",
                    "approved",
                    "rejected",
                    name="contentapprovalstate",
                    create_type=False,
                ),
                nullable=False,
                server_default="pending",
            ),
        )

    conn.execute(
        sa.text(
            "UPDATE content_channel_variants "
            "SET text_approval_state = approval_state, image_approval_state = approval_state"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if _has_column(inspector, "content_channel_variants", "image_approval_state"):
        op.drop_column("content_channel_variants", "image_approval_state")
    inspector = sa.inspect(conn)
    if _has_column(inspector, "content_channel_variants", "text_approval_state"):
        op.drop_column("content_channel_variants", "text_approval_state")

    inspector = sa.inspect(conn)
    if _has_column(inspector, "topics", "image_feedback"):
        op.drop_column("topics", "image_feedback")
    inspector = sa.inspect(conn)
    if _has_column(inspector, "topics", "text_feedback"):
        op.drop_column("topics", "text_feedback")
