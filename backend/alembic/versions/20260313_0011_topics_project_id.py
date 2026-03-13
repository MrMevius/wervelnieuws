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


def _has_topic_project_id_column(inspector: sa.Inspector) -> bool:
    columns = inspector.get_columns("topics")
    return any(column.get("name") == "project_id" for column in columns)


def _has_project_id_index(inspector: sa.Inspector) -> bool:
    indexes = inspector.get_indexes("topics")
    return any(index.get("name") == "ix_topics_project_id" for index in indexes)


def _has_named_project_fk(inspector: sa.Inspector) -> bool:
    foreign_keys = inspector.get_foreign_keys("topics")
    return any(fk.get("name") == "fk_topics_project_id_projects" for fk in foreign_keys)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    is_sqlite = conn.dialect.name == "sqlite"

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

    if not _has_topic_project_id_column(inspector):
        op.add_column(
            "topics", sa.Column("project_id", sa.String(length=36), nullable=True)
        )
        inspector = sa.inspect(conn)

    conn.execute(
        sa.text("UPDATE topics SET project_id = :project_id WHERE project_id IS NULL"),
        {"project_id": default_project_id},
    )
    if not is_sqlite:
        op.alter_column("topics", "project_id", nullable=False)

    if not is_sqlite and not _has_named_project_fk(inspector):
        op.create_foreign_key(
            "fk_topics_project_id_projects",
            "topics",
            "projects",
            ["project_id"],
            ["id"],
        )

    if not _has_project_id_index(inspector):
        op.create_index("ix_topics_project_id", "topics", ["project_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    is_sqlite = conn.dialect.name == "sqlite"

    if _has_project_id_index(inspector):
        op.drop_index("ix_topics_project_id", table_name="topics")

    if not is_sqlite and _has_named_project_fk(inspector):
        op.drop_constraint(
            "fk_topics_project_id_projects", "topics", type_="foreignkey"
        )

    if _has_topic_project_id_column(inspector):
        op.drop_column("topics", "project_id")
