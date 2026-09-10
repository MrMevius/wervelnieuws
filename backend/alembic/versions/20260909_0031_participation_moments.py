"""Add participation conversation reports with multiple people and projects."""

from alembic import op
import sqlalchemy as sa

revision = "20260909_0031"
down_revision = "20260909_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "participation_moments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("contact_type", sa.String(24), nullable=False),
        sa.Column("conversation_partners", sa.Text(), nullable=False),
        sa.Column("location", sa.String(240), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("report", sa.Text(), nullable=False),
        sa.Column("agreements", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_by_name", sa.String(160), nullable=False),
        sa.Column("updated_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("duration_minutes IS NULL OR duration_minutes > 0", name="ck_participation_duration"),
        sa.CheckConstraint("row_version > 0", name="ck_participation_version"),
    )
    op.create_index("ix_participation_moments_date", "participation_moments", ["occurred_on", "id"])
    op.create_table(
        "participation_participants",
        sa.Column("moment_id", sa.String(36), sa.ForeignKey("participation_moments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source_user_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("display_name", sa.String(160), nullable=False),
    )
    op.create_table(
        "participation_projects",
        sa.Column("moment_id", sa.String(36), sa.ForeignKey("participation_moments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source_project_id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("participation_projects")
    op.drop_table("participation_participants")
    op.drop_index("ix_participation_moments_date", table_name="participation_moments")
    op.drop_table("participation_moments")
