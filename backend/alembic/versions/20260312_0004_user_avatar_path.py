"""add user avatar path

Revision ID: 20260312_0004
Revises: 20260312_0003
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0004"
down_revision = "20260312_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("avatar_path", sa.String(length=500), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("avatar_path")
