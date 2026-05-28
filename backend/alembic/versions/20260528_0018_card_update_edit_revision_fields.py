"""add card update edit/revision fields

Revision ID: 20260528_0018
Revises: 20260515_0017
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "20260528_0018"
down_revision = "20260515_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("card_updates")}

    if "image_path" not in columns:
        op.add_column("card_updates", sa.Column("image_path", sa.String(length=500), nullable=True))
    if "edited_from_update_id" not in columns:
        op.add_column("card_updates", sa.Column("edited_from_update_id", sa.String(length=36), nullable=True))
        if not is_sqlite:
            op.create_foreign_key(
                "fk_card_updates_edited_from_update_id",
                "card_updates",
                "card_updates",
                ["edited_from_update_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("card_updates")}

    fks = {fk.get("name") for fk in inspector.get_foreign_keys("card_updates")}
    if not is_sqlite and "fk_card_updates_edited_from_update_id" in fks:
        op.drop_constraint("fk_card_updates_edited_from_update_id", "card_updates", type_="foreignkey")
    if "edited_from_update_id" in columns:
        op.drop_column("card_updates", "edited_from_update_id")
    if "image_path" in columns:
        op.drop_column("card_updates", "image_path")
