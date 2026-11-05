"""add project visibility for participation moments

Revision ID: 20261105_0035
Revises: 20261031_0034
Create Date: 2026-11-05
"""

from alembic import op
import sqlalchemy as sa


revision = "20261105_0035"
down_revision = "20261031_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing projects stay selectable in participation moments.
    op.add_column(
        "projects",
        sa.Column("is_visible_in_participation", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("projects", "is_visible_in_participation")
