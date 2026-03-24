"""add persisted rate limit events

Revision ID: 20260324_0014
Revises: 20260316_0013
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa


revision = "20260324_0014"
down_revision = "20260316_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "rate_limit_events" not in inspector.get_table_names():
        op.create_table(
            "rate_limit_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("rate_key", sa.String(length=300), nullable=False),
            sa.Column("actor_key", sa.String(length=120), nullable=False),
            sa.Column("route_path", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    indexes = {
        index.get("name") for index in inspector.get_indexes("rate_limit_events")
    }
    if "ix_rate_limit_events_rate_key_created_at" not in indexes:
        op.create_index(
            "ix_rate_limit_events_rate_key_created_at",
            "rate_limit_events",
            ["rate_key", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "rate_limit_events" not in inspector.get_table_names():
        return
    indexes = {
        index.get("name") for index in inspector.get_indexes("rate_limit_events")
    }
    if "ix_rate_limit_events_rate_key_created_at" in indexes:
        op.drop_index(
            "ix_rate_limit_events_rate_key_created_at", table_name="rate_limit_events"
        )
    op.drop_table("rate_limit_events")
