"""record the verified project visibility release head

Revision ID: 20260811_0030
Revises: 20260810_0029
Create Date: 2026-08-11
"""


revision = "20260811_0030"
down_revision = "20260810_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Advance release metadata without changing schema or data."""


def downgrade() -> None:
    """Restore the preceding release metadata without changing schema or data."""
