"""add project link to topics

Revision ID: 20260313_0011
Revises: 20260313_0010
Create Date: 2026-03-13
"""

import uuid
from datetime import UTC, datetime

from alembic import op
import sqlalchemy as sa


revision = "20260313_0011"
down_revision = "20260313_0010"
branch_labels = None
depends_on = None

DEFAULT_PROJECT_NAME = "Windpark de Boldijk"


def upgrade() -> None:
    conn = op.get_bind()

    default_project_id = conn.execute(
        sa.text("SELECT id FROM projects WHERE name = :name"),
        {"name": DEFAULT_PROJECT_NAME},
    ).scalar_one_or_none()
    if default_project_id is None:
        default_project_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        conn.execute(
            sa.text(
                """
                INSERT INTO projects (id, name, is_active, created_at, updated_at)
                VALUES (:id, :name, :is_active, :created_at, :updated_at)
                """
            ),
            {
                "id": default_project_id,
                "name": DEFAULT_PROJECT_NAME,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
        )

    op.add_column(
        "topics", sa.Column("project_id", sa.String(length=36), nullable=True)
    )
    conn.execute(
        sa.text("UPDATE topics SET project_id = :project_id WHERE project_id IS NULL"),
        {"project_id": default_project_id},
    )
    op.alter_column("topics", "project_id", nullable=False)

    op.create_foreign_key(
        "fk_topics_project_id_projects",
        "topics",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.create_index("ix_topics_project_id", "topics", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_topics_project_id", table_name="topics")
    op.drop_constraint("fk_topics_project_id_projects", "topics", type_="foreignkey")
    op.drop_column("topics", "project_id")
