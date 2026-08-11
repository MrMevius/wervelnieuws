"""add audio transcription support to topic sources

Revision ID: 20260630_0024
Revises: 20260616_0023
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260630_0024"
down_revision = "20260616_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("topic_source_documents")}

    if "parent_source_document_id" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column("parent_source_document_id", sa.String(length=36), nullable=True),
        )
    if "duration_seconds" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column("duration_seconds", sa.Integer(), nullable=True),
        )
    if "transcription_status" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "transcription_status",
                sa.String(length=40),
                nullable=False,
                server_default="not_applicable",
            ),
        )
    if "transcription_attempts" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "transcription_attempts",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
        )
    if "transcription_error" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "transcription_error",
                sa.Text(),
                nullable=False,
                server_default="",
            ),
        )
    if "transcription_text" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "transcription_text",
                sa.Text(),
                nullable=False,
                server_default="",
            ),
        )
    if "transcription_model" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "transcription_model",
                sa.String(length=120),
                nullable=False,
                server_default="",
            ),
        )
    if "transcription_language" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "transcription_language",
                sa.String(length=20),
                nullable=False,
                server_default="",
            ),
        )
    if "speaker_labels_json" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column(
                "speaker_labels_json",
                sa.Text(),
                nullable=False,
                server_default="[]",
            ),
        )
    if "transcript_document_id" not in columns:
        op.add_column(
            "topic_source_documents",
            sa.Column("transcript_document_id", sa.String(length=36), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("topic_source_documents")}

    for column_name in [
        "transcript_document_id",
        "speaker_labels_json",
        "transcription_language",
        "transcription_model",
        "transcription_text",
        "transcription_error",
        "transcription_attempts",
        "transcription_status",
        "duration_seconds",
        "parent_source_document_id",
    ]:
        if column_name in columns:
            op.drop_column("topic_source_documents", column_name)
