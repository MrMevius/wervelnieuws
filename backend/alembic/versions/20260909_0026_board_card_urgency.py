"""add urgency to board cards

Revision ID: 20260909_0026
Revises: 20260811_0030
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260909_0026"
down_revision = "20260811_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("board_cards")}
    if "urgency" not in columns:
        op.add_column(
            "board_cards",
            sa.Column(
                "urgency",
                sa.Enum("normal", "urgent", name="boardurgency"),
                nullable=False,
                server_default="normal",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("board_cards")}
    if "urgency" in columns:
        op.drop_column("board_cards", "urgency")
