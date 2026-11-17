"""Persist resumable meeting-card recording processing.

Revision ID: 20261117_0036
Revises: 20261105_0035
"""
from alembic import op
import sqlalchemy as sa

revision = "20261117_0036"
down_revision = "20261105_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recordings", sa.Column("client_request_id", sa.String(36), nullable=True))
    op.add_column("recordings", sa.Column("processing_status", sa.String(24), nullable=True))
    op.add_column("recordings", sa.Column("processing_token", sa.String(36), nullable=True))
    op.add_column("recordings", sa.Column("processing_lease_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("recordings", sa.Column("processing_error", sa.String(32), nullable=True))
    op.add_column("recordings", sa.Column("summary_text", sa.Text(), nullable=True))
    op.create_index("uq_recordings_upload_request", "recordings", ["uploaded_by_user_id", "client_request_id"], unique=True)
    op.create_index("ix_recordings_processing", "recordings", ["processing_status", "processing_lease_until"])


def downgrade() -> None:
    managed = op.get_bind().scalar(sa.text(
        "SELECT count(*) FROM recordings WHERE processing_status IS NOT NULL OR client_request_id IS NOT NULL"
    ))
    if managed:
        raise RuntimeError("Restore the previous release and matching database/storage backup; do not discard recording processing state.")
    op.drop_index("ix_recordings_processing", table_name="recordings")
    op.drop_index("uq_recordings_upload_request", table_name="recordings")
    for column in ("summary_text", "processing_error", "processing_lease_until", "processing_token", "processing_status", "client_request_id"):
        op.drop_column("recordings", column)
