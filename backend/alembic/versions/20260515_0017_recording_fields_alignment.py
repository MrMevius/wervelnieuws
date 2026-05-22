"""align recordings fields with spec

Revision ID: 20260515_0017
Revises: 20260514_0016
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260515_0017"
down_revision = "20260514_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("recordings")}

    if "filename" not in columns:
        op.add_column(
            "recordings",
            sa.Column("filename", sa.String(length=255), nullable=False, server_default="opname.webm"),
        )
    if "duration" not in columns:
        op.add_column("recordings", sa.Column("duration", sa.Integer(), nullable=True))
    if "recorded_at" not in columns:
        op.add_column(
            "recordings",
            sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    if "transcript_status" in columns and "transcription_status" not in columns:
        op.alter_column("recordings", "transcript_status", new_column_name="transcription_status")
    if "transcript_text" in columns and "transcription_text" not in columns:
        op.alter_column("recordings", "transcript_text", new_column_name="transcription_text")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("recordings")}

    if "transcription_status" in columns and "transcript_status" not in columns:
        op.alter_column("recordings", "transcription_status", new_column_name="transcript_status")
    if "transcription_text" in columns and "transcript_text" not in columns:
        op.alter_column("recordings", "transcription_text", new_column_name="transcript_text")
    if "recorded_at" in columns:
        op.drop_column("recordings", "recorded_at")
    if "duration" in columns:
        op.drop_column("recordings", "duration")
    if "filename" in columns:
        op.drop_column("recordings", "filename")
