"""link a board card update to the audio recording it summarizes

Revision ID: 20261031_0034
Revises: 20261031_0033
Create Date: 2026-10-31
"""

from alembic import op
import sqlalchemy as sa


revision = "20261031_0034"
down_revision = "20261031_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("card_updates")}
    indexes = {index["name"] for index in inspector.get_indexes("card_updates")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("card_updates")}

    if "recording_id" not in columns:
        op.add_column("card_updates", sa.Column("recording_id", sa.String(length=36), nullable=True))
    if "ix_card_updates_recording_id" not in indexes:
        op.create_index("ix_card_updates_recording_id", "card_updates", ["recording_id"])
    if not is_sqlite and "fk_card_updates_recording_id" not in fks:
        op.create_foreign_key(
            "fk_card_updates_recording_id",
            "card_updates",
            "recordings",
            ["recording_id"],
            ["id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("card_updates")}
    indexes = {index["name"] for index in inspector.get_indexes("card_updates")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("card_updates")}

    if not is_sqlite and "fk_card_updates_recording_id" in fks:
        op.drop_constraint("fk_card_updates_recording_id", "card_updates", type_="foreignkey")
    if "ix_card_updates_recording_id" in indexes:
        op.drop_index("ix_card_updates_recording_id", table_name="card_updates")
    if "recording_id" in columns:
        # Recordings stay on the card and show as standalone activity again.
        with op.batch_alter_table("card_updates") as batch:
            batch.drop_column("recording_id")
