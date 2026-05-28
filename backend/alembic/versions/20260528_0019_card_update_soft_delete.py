"""add soft-delete fields for card updates

Revision ID: 20260528_0019
Revises: 20260528_0018
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "20260528_0019"
down_revision = "20260528_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("card_updates")}

    if "deleted_at" not in columns:
        op.add_column("card_updates", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if "deleted_by_user_id" not in columns:
        op.add_column("card_updates", sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True))
        if not is_sqlite:
            op.create_foreign_key(
                "fk_card_updates_deleted_by_user_id",
                "card_updates",
                "users",
                ["deleted_by_user_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("card_updates")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("card_updates")}

    if not is_sqlite and "fk_card_updates_deleted_by_user_id" in fks:
        op.drop_constraint("fk_card_updates_deleted_by_user_id", "card_updates", type_="foreignkey")
    if "deleted_by_user_id" in columns:
        op.drop_column("card_updates", "deleted_by_user_id")
    if "deleted_at" in columns:
        op.drop_column("card_updates", "deleted_at")
