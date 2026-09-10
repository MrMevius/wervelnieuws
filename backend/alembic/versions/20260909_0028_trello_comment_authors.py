"""preserve external Trello comment authors on imported updates

Revision ID: 20260909_0028
Revises: 20260909_0027
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260909_0028"
down_revision = "20260909_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("card_updates")}
    if "external_author_name" not in columns:
        op.add_column("card_updates", sa.Column("external_author_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("card_updates")}
    if "external_author_name" in columns:
        op.drop_column("card_updates", "external_author_name")
