"""add content channel variants

Revision ID: 20260313_0010
Revises: 20260313_0009
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa


revision = "20260313_0010"
down_revision = "20260313_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "content_channel_variants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("content_version_id", sa.String(length=36), nullable=False),
        sa.Column("topic_id", sa.String(length=36), nullable=False),
        sa.Column(
            "channel",
            sa.Enum("website", "facebook", "newsletter", name="channelname"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("article_body", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("generated_image_id", sa.String(length=36), nullable=True),
        sa.Column(
            "approval_state",
            sa.Enum("pending", "approved", "rejected", name="contentapprovalstate"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("approved_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["content_version_id"], ["content_versions.id"]),
        sa.ForeignKeyConstraint(["generated_image_id"], ["generated_images.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "content_version_id",
            "channel",
            name="uq_content_channel_variants_version_channel",
        ),
    )
    op.create_index(
        "ix_content_channel_variants_topic_channel",
        "content_channel_variants",
        ["topic_id", "channel"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_content_channel_variants_topic_channel",
        table_name="content_channel_variants",
    )
    op.drop_table("content_channel_variants")
