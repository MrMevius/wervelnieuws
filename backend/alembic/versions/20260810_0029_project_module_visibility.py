"""add central project module visibility

Revision ID: 20260810_0029
Revises: 20260810_0028
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260810_0029"
down_revision = "20260810_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The server default makes the addition safe for existing SQLite and
    # PostgreSQL rows and keeps direct database inserts backward compatible.
    op.add_column(
        "projects",
        sa.Column("is_visible_in_boards", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "projects",
        sa.Column("is_visible_in_work_hours", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("projects", "is_visible_in_work_hours")
    op.drop_column("projects", "is_visible_in_boards")
