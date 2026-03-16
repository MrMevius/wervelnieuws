"""extend notification events for n8n delivery

Revision ID: 20260315_0012
Revises: 20260313_0011
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260315_0012"
down_revision = "20260313_0011"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, column_name: str) -> bool:
    return any(
        column.get("name") == column_name
        for column in inspector.get_columns("notification_events")
    )


def _has_dedupe_index(inspector: sa.Inspector) -> bool:
    return any(
        index.get("name") == "uq_notification_events_dedupe_key"
        for index in inspector.get_indexes("notification_events")
    )


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not _has_column(inspector, "event_type"):
        op.add_column(
            "notification_events",
            sa.Column(
                "event_type", sa.String(length=100), nullable=False, server_default=""
            ),
        )
    if not _has_column(inspector, "status"):
        op.add_column(
            "notification_events",
            sa.Column(
                "status", sa.String(length=20), nullable=False, server_default="success"
            ),
        )
    if not _has_column(inspector, "payload_json"):
        op.add_column(
            "notification_events",
            sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        )
    if not _has_column(inspector, "dedupe_key"):
        op.add_column(
            "notification_events",
            sa.Column(
                "dedupe_key", sa.String(length=255), nullable=False, server_default=""
            ),
        )
    if not _has_column(inspector, "delivery_attempts"):
        op.add_column(
            "notification_events",
            sa.Column(
                "delivery_attempts", sa.Integer(), nullable=False, server_default="0"
            ),
        )
    if not _has_column(inspector, "delivered_at"):
        op.add_column(
            "notification_events",
            sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not _has_column(inspector, "last_error"):
        op.add_column(
            "notification_events",
            sa.Column("last_error", sa.Text(), nullable=False, server_default=""),
        )

    conn.execute(
        sa.text(
            "UPDATE notification_events SET event_type = 'legacy.notification' WHERE event_type = ''"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE notification_events SET status = CASE WHEN success = 1 THEN 'success' ELSE 'error' END WHERE status = ''"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE notification_events SET payload_json = '{}' WHERE payload_json = '' OR payload_json IS NULL"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE notification_events SET dedupe_key = id WHERE dedupe_key = '' OR dedupe_key IS NULL"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE notification_events SET last_error = '' WHERE last_error IS NULL"
        )
    )

    inspector = sa.inspect(conn)
    if not _has_dedupe_index(inspector):
        op.create_index(
            "uq_notification_events_dedupe_key",
            "notification_events",
            ["dedupe_key"],
            unique=True,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if _has_dedupe_index(inspector):
        op.drop_index(
            "uq_notification_events_dedupe_key", table_name="notification_events"
        )

    for column_name in [
        "last_error",
        "delivered_at",
        "delivery_attempts",
        "dedupe_key",
        "payload_json",
        "status",
        "event_type",
    ]:
        inspector = sa.inspect(conn)
        if _has_column(inspector, column_name):
            op.drop_column("notification_events", column_name)
