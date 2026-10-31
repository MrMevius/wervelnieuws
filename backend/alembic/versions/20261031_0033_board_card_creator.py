"""record who created a board card

Revision ID: 20261031_0033
Revises: 20260910_0032
Create Date: 2026-10-31
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20261031_0033"
down_revision = "20260910_0032"
branch_labels = None
depends_on = None


def _backfill_from_audit(bind) -> None:
    # Every card created through the API has logged `board.card.created` with the
    # actor since the boards module existed. Trello imports never did, so their
    # creator stays unknown. The earliest event wins if a card id ever repeats.
    user_ids = set(bind.scalars(sa.text("SELECT id FROM users")).all())
    rows = bind.execute(
        sa.text(
            "SELECT actor_user_id, details_json FROM audit_events "
            "WHERE event_type = 'board.card.created' AND actor_user_id IS NOT NULL "
            "ORDER BY created_at ASC"
        )
    ).all()
    creators: dict[str, str] = {}
    for actor_user_id, details_json in rows:
        try:
            card_id = json.loads(details_json or "{}").get("card_id")
        except (ValueError, AttributeError):
            continue
        if isinstance(card_id, str) and actor_user_id in user_ids:
            creators.setdefault(card_id, actor_user_id)
    for card_id, user_id in creators.items():
        bind.execute(
            sa.text(
                "UPDATE board_cards SET created_by_user_id = :user_id "
                "WHERE id = :card_id AND created_by_user_id IS NULL AND trello_card_id IS NULL"
            ),
            {"user_id": user_id, "card_id": card_id},
        )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("board_cards")}
    indexes = {index["name"] for index in inspector.get_indexes("board_cards")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("board_cards")}

    if "created_by_user_id" not in columns:
        op.add_column(
            "board_cards",
            sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        )
    if "ix_board_cards_created_by_user_id" not in indexes:
        op.create_index("ix_board_cards_created_by_user_id", "board_cards", ["created_by_user_id"])
    if not is_sqlite and "fk_board_cards_created_by_user_id" not in fks:
        op.create_foreign_key(
            "fk_board_cards_created_by_user_id",
            "board_cards",
            "users",
            ["created_by_user_id"],
            ["id"],
        )
    _backfill_from_audit(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_sqlite = bind.dialect.name == "sqlite"
    columns = {col["name"] for col in inspector.get_columns("board_cards")}
    indexes = {index["name"] for index in inspector.get_indexes("board_cards")}
    fks = {fk.get("name") for fk in inspector.get_foreign_keys("board_cards")}

    if not is_sqlite and "fk_board_cards_created_by_user_id" in fks:
        op.drop_constraint("fk_board_cards_created_by_user_id", "board_cards", type_="foreignkey")
    if "ix_board_cards_created_by_user_id" in indexes:
        op.drop_index("ix_board_cards_created_by_user_id", table_name="board_cards")
    if "created_by_user_id" in columns:
        # The creator can be re-derived from the audit trail on a later upgrade.
        with op.batch_alter_table("board_cards") as batch:
            batch.drop_column("created_by_user_id")
