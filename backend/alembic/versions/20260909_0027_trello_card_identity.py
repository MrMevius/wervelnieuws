"""store Trello source ids on imported board cards

Revision ID: 20260909_0027
Revises: 20260909_0026
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260909_0027"
down_revision = "20260909_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("board_cards")}
    if "trello_card_id" not in columns:
        op.add_column("board_cards", sa.Column("trello_card_id", sa.String(length=64), nullable=True))
    indexes = {index["name"] for index in inspector.get_indexes("board_cards")}
    if "ix_board_cards_trello_card_id" not in indexes:
        op.create_index("ix_board_cards_trello_card_id", "board_cards", ["trello_card_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("board_cards")}
    if "trello_card_id" in columns:
        indexes = {index["name"] for index in inspector.get_indexes("board_cards")}
        if "ix_board_cards_trello_card_id" in indexes:
            op.drop_index("ix_board_cards_trello_card_id", table_name="board_cards")
        op.drop_column("board_cards", "trello_card_id")
