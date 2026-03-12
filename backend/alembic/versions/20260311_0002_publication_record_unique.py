"""publication record unique schedule

Revision ID: 20260311_0002
Revises: 20260311_0001
Create Date: 2026-03-11
"""

from alembic import op


revision = "20260311_0002"
down_revision = "20260311_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("publication_records") as batch_op:
        batch_op.create_unique_constraint(
            "uq_publication_records_schedule_id",
            ["schedule_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("publication_records") as batch_op:
        batch_op.drop_constraint("uq_publication_records_schedule_id", type_="unique")
