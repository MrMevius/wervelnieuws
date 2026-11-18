"""Add participation logbook fields to participation moments.

Revision ID: 20261118_0037
Revises: 20261117_0036
"""
from alembic import op
import sqlalchemy as sa

revision = "20261118_0037"
down_revision = "20261117_0036"
branch_labels = None
depends_on = None

TEXT_COLUMNS = ("goal", "collected_information", "notes")
SHORT_COLUMNS = {
    "participation_levels": 120,
    "invitation_status": 12, "invitation_note": 500,
    "informed_status": 12, "informed_note": 500,
    "feedback_status": 12, "feedback_note": 500,
    "goal_status": 12,
}


def upgrade() -> None:
    with op.batch_alter_table("participation_moments") as batch:
        batch.add_column(sa.Column("moment_type", sa.String(24), nullable=False, server_default="conversation"))
        for name in TEXT_COLUMNS:
            batch.add_column(sa.Column(name, sa.Text(), nullable=False, server_default=""))
        for name, length in SHORT_COLUMNS.items():
            batch.add_column(sa.Column(name, sa.String(length), nullable=False, server_default=""))
        batch.add_column(sa.Column("is_historical", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    filled = " OR ".join(
        [f"{name} <> ''" for name in (*TEXT_COLUMNS, *SHORT_COLUMNS)]
        + ["moment_type <> 'conversation'", "is_historical"]
    )
    used = op.get_bind().scalar(sa.text(f"SELECT count(*) FROM participation_moments WHERE {filled}"))
    if used:
        raise RuntimeError(
            f"Refusing downgrade: {used} participation moments use logbook fields that would be lost. "
            "Restore a backup instead."
        )
    with op.batch_alter_table("participation_moments") as batch:
        for name in ("is_historical", *SHORT_COLUMNS, *TEXT_COLUMNS, "moment_type"):
            batch.drop_column(name)
