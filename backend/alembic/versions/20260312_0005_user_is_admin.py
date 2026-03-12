"""add user is_admin flag

Revision ID: 20260312_0005
Revises: 20260312_0004
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0005"
down_revision = "20260312_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_admin", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("is_admin")
