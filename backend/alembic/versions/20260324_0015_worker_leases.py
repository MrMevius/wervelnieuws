"""add worker leases table

Revision ID: 20260324_0015
Revises: 20260324_0014
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260324_0015"
down_revision = "20260324_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "worker_leases" in inspector.get_table_names():
        return

    op.create_table(
        "worker_leases",
        sa.Column("lock_key", sa.String(length=100), nullable=False),
        sa.Column("owner_id", sa.String(length=120), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("lock_key"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "worker_leases" not in inspector.get_table_names():
        return
    op.drop_table("worker_leases")
