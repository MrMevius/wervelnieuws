"""add user profile and theme fields

Revision ID: 20260312_0003
Revises: 20260311_0002
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0003"
down_revision = "20260311_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    theme_preference = sa.Enum("light", "dark", "system", name="themepreference")
    theme_preference.create(op.get_bind(), checkfirst=True)

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("full_name", sa.String(length=160), nullable=True)
        )
        batch_op.add_column(sa.Column("email", sa.String(length=255), nullable=True))
        batch_op.add_column(
            sa.Column(
                "theme_preference",
                theme_preference,
                nullable=False,
                server_default="system",
            )
        )
        batch_op.create_unique_constraint("uq_users_email", ["email"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_email", type_="unique")
        batch_op.drop_column("theme_preference")
        batch_op.drop_column("email")
        batch_op.drop_column("full_name")

    theme_preference = sa.Enum("light", "dark", "system", name="themepreference")
    theme_preference.drop(op.get_bind(), checkfirst=True)
