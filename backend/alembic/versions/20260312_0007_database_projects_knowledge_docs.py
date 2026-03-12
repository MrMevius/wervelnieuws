"""add projects and knowledge documents

Revision ID: 20260312_0007
Revises: 20260312_0006
Create Date: 2026-03-12
"""

import uuid
from datetime import UTC, datetime

from alembic import op
import sqlalchemy as sa


revision = "20260312_0007"
down_revision = "20260312_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_by_user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column(
            "doc_type",
            sa.Enum("pdf", "docx", "xlsx", "txt", "markdown", name="documenttype"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("uploaded", "parsing", "indexed", "failed", name="documentstatus"),
            nullable=False,
            server_default="uploaded",
        ),
        sa.Column("extraction_error", sa.Text(), nullable=False, server_default=""),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    now = datetime.now(UTC)
    op.execute(
        sa.text(
            """
            INSERT INTO projects (id, name, is_active, created_at, updated_at)
            SELECT :id, :name, 1, :created_at, :updated_at
            WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = :name)
            """
        ).bindparams(
            id=str(uuid.uuid4()),
            name="Windpark de Boldijk",
            created_at=now,
            updated_at=now,
        )
    )


def downgrade() -> None:
    op.drop_table("knowledge_documents")
    op.drop_table("projects")
