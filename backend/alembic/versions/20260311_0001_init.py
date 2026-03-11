"""init schema

Revision ID: 20260311_0001
Revises:
Create Date: 2026-03-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260311_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("username", sa.String(length=80), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    workflow_state = sa.Enum(
        "draft",
        "planned",
        "generating",
        "review",
        "approved",
        "scheduled",
        "publishing",
        "published",
        "rejected",
        "error",
        name="workflowstate",
    )
    doc_type = sa.Enum("pdf", "docx", "xlsx", "txt", "markdown", name="documenttype")
    doc_status = sa.Enum(
        "uploaded", "parsing", "indexed", "failed", name="documentstatus"
    )
    channel = sa.Enum("website", "facebook", "newsletter", name="channelname")
    channel_state = sa.Enum(
        "pending",
        "scheduled",
        "publishing",
        "published",
        "updated",
        "failed",
        "retrying",
        "skipped",
        name="channelpublishstate",
    )
    retry_status = sa.Enum(
        "queued", "in_progress", "failed", "resolved", name="retrystatus"
    )

    workflow_state.create(op.get_bind(), checkfirst=True)
    doc_type.create(op.get_bind(), checkfirst=True)
    doc_status.create(op.get_bind(), checkfirst=True)
    channel.create(op.get_bind(), checkfirst=True)
    channel_state.create(op.get_bind(), checkfirst=True)
    retry_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "topics",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("theme", sa.String(length=255), nullable=False),
        sa.Column("editorial_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("planning_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "workflow_state", workflow_state, nullable=False, server_default="draft"
        ),
        sa.Column(
            "is_archived", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "topic_source_documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("doc_type", doc_type, nullable=False),
        sa.Column("status", doc_status, nullable=False, server_default="uploaded"),
        sa.Column("extraction_error", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(length=36),
            sa.ForeignKey("topic_source_documents.id"),
            nullable=False,
        ),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
    )
    op.execute(
        "CREATE VIRTUAL TABLE document_chunks_fts USING fts5(chunk_id, topic_id, text)"
    )

    op.create_table(
        "topic_notes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "generated_images",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("image_path", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "content_versions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("article_body", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("source_trace_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column(
            "generated_image_id",
            sa.String(length=36),
            sa.ForeignKey("generated_images.id"),
            nullable=True,
        ),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "is_published", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "topic_id", "version_number", name="uq_topic_version_number"
        ),
    )

    op.create_table(
        "publication_schedules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column(
            "content_version_id",
            sa.String(length=36),
            sa.ForeignKey("content_versions.id"),
            nullable=False,
        ),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", workflow_state, nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "publication_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "schedule_id",
            sa.String(length=36),
            sa.ForeignKey("publication_schedules.id"),
            nullable=False,
        ),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column(
            "content_version_id",
            sa.String(length=36),
            sa.ForeignKey("content_versions.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "channel_publication_states",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "publication_record_id",
            sa.String(length=36),
            sa.ForeignKey("publication_records.id"),
            nullable=False,
        ),
        sa.Column("channel", channel, nullable=False),
        sa.Column("state", channel_state, nullable=False, server_default="pending"),
        sa.Column(
            "external_id", sa.String(length=255), nullable=False, server_default=""
        ),
        sa.Column("error_message", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("topic_id", sa.String(length=36), nullable=True),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("details_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "notification_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("topic_id", sa.String(length=36), nullable=True),
        sa.Column("channel", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "system_settings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("key", sa.String(length=100), nullable=False, unique=True),
        sa.Column("value", sa.Text(), nullable=False),
    )

    op.create_table(
        "retry_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "topic_id", sa.String(length=36), sa.ForeignKey("topics.id"), nullable=False
        ),
        sa.Column("flow_name", sa.String(length=100), nullable=False),
        sa.Column("error_type", sa.String(length=100), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("status", retry_status, nullable=False, server_default="queued"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("retry_jobs")
    op.drop_table("system_settings")
    op.drop_table("notification_events")
    op.drop_table("audit_events")
    op.drop_table("channel_publication_states")
    op.drop_table("publication_records")
    op.drop_table("publication_schedules")
    op.drop_table("content_versions")
    op.drop_table("generated_images")
    op.drop_table("topic_notes")
    op.execute("DROP TABLE IF EXISTS document_chunks_fts")
    op.drop_table("document_chunks")
    op.drop_table("topic_source_documents")
    op.drop_table("topics")
    op.drop_table("users")
