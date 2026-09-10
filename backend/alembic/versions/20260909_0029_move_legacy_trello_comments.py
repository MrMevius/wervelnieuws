"""move legacy Trello comments from descriptions to card updates

Revision ID: 20260909_0029
Revises: 20260909_0028
Create Date: 2026-09-09
"""

import re
from datetime import UTC, datetime
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "20260909_0029"
down_revision = "20260909_0028"
branch_labels = None
depends_on = None


_COMMENTS_HEADING = "### Trello-opmerkingen"
_COMMENT_PATTERN = re.compile(
    r"^- \*\*(?P<author>.+?) · (?P<date>[^*]+?)\*\*:\s*(?P<message>.*?)(?=^- \*\*.+? · [^*]+?\*\*:\s*|\Z)",
    re.MULTILINE | re.DOTALL,
)


def _parse_date(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def upgrade() -> None:
    bind = op.get_bind()
    fallback_author_id = bind.execute(
        sa.text("SELECT id FROM users WHERE is_active = 1 ORDER BY is_admin DESC, username ASC LIMIT 1")
    ).scalar_one_or_none()
    if not fallback_author_id:
        return

    cards = bind.execute(
        sa.text(
            "SELECT id, description FROM board_cards "
            "WHERE trello_card_id IS NOT NULL AND description LIKE :heading"
        ),
        {"heading": f"%{_COMMENTS_HEADING}%"},
    ).mappings()

    for card in cards:
        description = card["description"] or ""
        before, separator, legacy_comments = description.partition(_COMMENTS_HEADING)
        if not separator:
            continue

        comments = [
            match.groupdict()
            for match in _COMMENT_PATTERN.finditer(legacy_comments)
            if match.group("message").strip()
        ]
        # Leave an unrecognised block untouched rather than risk dropping a
        # user's description. All blocks produced by the prior importer match
        # the pattern above.
        if not comments:
            continue

        for comment in comments:
            bind.execute(
                sa.text(
                    "INSERT INTO card_updates "
                    "(id, card_id, author_user_id, external_author_name, message, created_at) "
                    "VALUES (:id, :card_id, :author_user_id, :external_author_name, :message, :created_at)"
                ),
                {
                    "id": str(uuid4()),
                    "card_id": card["id"],
                    "author_user_id": fallback_author_id,
                    "external_author_name": comment["author"].strip() or None,
                    "message": comment["message"].strip(),
                    "created_at": _parse_date(comment["date"]) or datetime.now(UTC),
                },
            )

        bind.execute(
            sa.text("UPDATE board_cards SET description = :description WHERE id = :id"),
            {"id": card["id"], "description": before.rstrip()},
        )


def downgrade() -> None:
    # Imported comments are preserved as regular card updates; moving them
    # back into descriptions would be lossy, so this data migration is
    # intentionally not reversed.
    pass
