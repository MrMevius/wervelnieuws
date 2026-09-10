"""Exact minute durations, optional category and local starting time."""

from alembic import op
import sqlalchemy as sa

revision = "20260910_0032"
down_revision = "20260909_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Earlier batch migrations can prefix already-named checks. Resolve the
    # real constraint name rather than assuming the ORM metadata's spelling.
    duration_checks = [check["name"] for check in sa.inspect(op.get_bind()).get_check_constraints("work_hour_groups") if "duration_half_hours" in check["sqltext"]]
    op.add_column("work_hour_groups", sa.Column("duration_minutes", sa.Integer(), nullable=True))
    op.add_column("work_hour_groups", sa.Column("start_time", sa.String(5), nullable=True))
    op.execute("UPDATE work_hour_groups SET duration_minutes = duration_half_hours * 30")
    with op.batch_alter_table("work_hour_groups") as batch:
        for name in duration_checks:
            batch.drop_constraint(name, type_="check")
        batch.drop_column("duration_half_hours")
        batch.alter_column("duration_minutes", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("post_id", existing_type=sa.String(36), nullable=True)
        batch.create_check_constraint("ck_work_hour_groups_duration_minutes", "duration_minutes >= 1 AND duration_minutes <= 1440")


def downgrade() -> None:
    # A downgrade cannot silently round minutes or invent a category/time.
    count = op.get_bind().scalar(sa.text("SELECT COUNT(*) FROM work_hour_groups WHERE duration_minutes % 30 != 0 OR post_id IS NULL OR start_time IS NOT NULL"))
    if count:
        raise RuntimeError("Downgrade zou minuten, begintijden of registraties zonder post verliezen. Herstel een gecontroleerde back-up met de bijbehorende applicatieversie.")
    op.add_column("work_hour_groups", sa.Column("duration_half_hours", sa.Integer(), nullable=True))
    op.execute("UPDATE work_hour_groups SET duration_half_hours = duration_minutes / 30")
    with op.batch_alter_table("work_hour_groups") as batch:
        batch.drop_constraint("ck_work_hour_groups_duration_minutes", type_="check")
        batch.drop_column("duration_minutes")
        batch.drop_column("start_time")
        batch.alter_column("duration_half_hours", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("post_id", existing_type=sa.String(36), nullable=False)
        batch.create_check_constraint("ck_work_hour_groups_duration_half_hours", "duration_half_hours >= 1 AND duration_half_hours <= 48")
