"""backfill admin user role

Revision ID: 20260312_0006
Revises: 20260312_0005
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0006"
down_revision = "20260312_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE users SET is_admin = 1 WHERE username = :username"),
        {"username": "admin"},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE users SET is_admin = 0 WHERE username = :username"),
        {"username": "admin"},
    )
