"""add topic target channels json

Revision ID: 20260313_0009
Revises: 20260312_0008
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa


revision = "20260313_0009"
down_revision = "20260312_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column(
            "target_channels_json",
            sa.Text(),
            nullable=False,
            server_default='["website","facebook","newsletter"]',
        ),
    )


def downgrade() -> None:
    op.drop_column("topics", "target_channels_json")
