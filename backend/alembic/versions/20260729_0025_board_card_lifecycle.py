"""add board card archive and soft delete fields

Revision ID: 20260729_0025
Revises: 20260630_0024
Create Date: 2026-07-29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260729_0025"
down_revision = "20260630_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("board_cards")}
    indexes = {index["name"] for index in inspector.get_indexes("board_cards")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("board_cards")}

    if "is_archived" not in columns:
        op.add_column(
            "board_cards",
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
    if "deleted_at" not in columns:
        op.add_column(
            "board_cards",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "deleted_by_user_id" not in columns:
        op.add_column(
            "board_cards",
            sa.Column("deleted_by_user_id", sa.String(length=36), nullable=True),
        )
    if "ix_board_cards_deleted_by_user_id" not in indexes:
        op.create_index("ix_board_cards_deleted_by_user_id", "board_cards", ["deleted_by_user_id"])
    if not is_sqlite and "fk_board_cards_deleted_by_user_id" not in fks:
        op.create_foreign_key(
            "fk_board_cards_deleted_by_user_id",
            "board_cards",
            "users",
            ["deleted_by_user_id"],
            ["id"],
        )
    if "ix_board_cards_deleted_at" not in indexes:
        op.create_index("ix_board_cards_deleted_at", "board_cards", ["deleted_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("board_cards")}
    indexes = {index["name"] for index in inspector.get_indexes("board_cards")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("board_cards")}

    if not is_sqlite and "fk_board_cards_deleted_by_user_id" in fks:
        op.drop_constraint("fk_board_cards_deleted_by_user_id", "board_cards", type_="foreignkey")
    if "ix_board_cards_deleted_by_user_id" in indexes:
        op.drop_index("ix_board_cards_deleted_by_user_id", table_name="board_cards")
    if "ix_board_cards_deleted_at" in indexes:
        op.drop_index("ix_board_cards_deleted_at", table_name="board_cards")
    for column_name in ["deleted_by_user_id", "deleted_at", "is_archived"]:
        if column_name in columns:
            op.drop_column("board_cards", column_name)
