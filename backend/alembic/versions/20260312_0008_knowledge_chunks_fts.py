"""add knowledge chunks and fts index

Revision ID: 20260312_0008
Revises: 20260312_0007
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0008"
down_revision = "20260312_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "knowledge_document_id",
            sa.String(length=36),
            sa.ForeignKey("knowledge_documents.id"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
    )
    op.execute(
        "CREATE VIRTUAL TABLE knowledge_chunks_fts USING fts5(chunk_id, knowledge_document_id, project_id, text)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS knowledge_chunks_fts")
    op.drop_table("knowledge_chunks")
