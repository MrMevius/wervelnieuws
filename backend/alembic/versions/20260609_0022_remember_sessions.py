"""add remember sessions

Revision ID: 20260609_0022
Revises: 20260528_0019
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260609_0022"
down_revision = "20260528_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "remember_sessions" in tables:
        return

    op.create_table(
        "remember_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_remember_sessions_token_hash", "remember_sessions", ["token_hash"], unique=True)
    op.create_index("ix_remember_sessions_user_revoked", "remember_sessions", ["user_id", "revoked_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "remember_sessions" not in set(inspector.get_table_names()):
        return
    op.drop_index("ix_remember_sessions_user_revoked", table_name="remember_sessions")
    op.drop_index("ix_remember_sessions_token_hash", table_name="remember_sessions")
    op.drop_table("remember_sessions")
