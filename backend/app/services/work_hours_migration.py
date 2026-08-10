"""Pure planning helpers for the central-project/global-post migration.

The Alembic revision deliberately computes this complete plan before doing any
writes.  Keeping the rules here also makes the production migration directly
unit-testable without constructing an Alembic context.
"""

from __future__ import annotations

import unicodedata
import json
from dataclasses import dataclass
from datetime import datetime
from uuid import NAMESPACE_URL, uuid5


def normalize_masterdata_name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).strip().split()).casefold()


@dataclass(frozen=True, slots=True)
class LegacyProjectRow:
    id: str
    name: str
    description: str
    is_active: bool
    is_archived: bool
    created_at: datetime


@dataclass(frozen=True, slots=True)
class CentralProjectRow:
    id: str
    name: str


@dataclass(frozen=True, slots=True)
class LegacyPostRow:
    id: str
    project_id: str
    name: str
    description: str
    is_active: bool
    is_archived: bool
    deleted: bool
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ProjectMapping:
    legacy_id: str
    project_id: str
    create_project: bool


@dataclass(frozen=True, slots=True)
class CanonicalPost:
    canonical_id: str
    normalized_name: str
    name: str
    description: str
    is_active: bool
    source_ids: tuple[str, ...]


class ProjectMappingConflict(ValueError):
    def __init__(self, legacy_id: str, name: str, candidate_ids: list[str]) -> None:
        self.legacy_id = legacy_id
        self.name = name
        self.candidate_ids = tuple(sorted(candidate_ids))
        super().__init__(
            f"Ambigue projectmapping voor {legacy_id} ({name}): "
            + ", ".join(self.candidate_ids)
        )


class PostMigrationWriteConflict(RuntimeError):
    pass


def stable_rows_snapshot(rows: list[dict]) -> str:
    """Canonical JSON for migration-write guards across SQLite/Python types."""
    normalized = [
        {key: value.isoformat() if isinstance(value, datetime) else value for key, value in sorted(row.items())}
        for row in rows
    ]
    normalized.sort(key=lambda row: tuple(str(row.get(key, "")) for key in ("id", "group_id", "post_id")))
    return json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def assert_migration_baseline_unchanged(
    baseline: dict[str, str], current: dict[str, str]
) -> None:
    changed = sorted(key for key in baseline if baseline.get(key) != current.get(key))
    if changed:
        raise PostMigrationWriteConflict(
            "Downgrade geweigerd: post-migratie writes in "
            + ", ".join(changed)
            + "; herstel de pre-migratiebackup."
        )


def build_project_mappings(
    legacy_projects: list[LegacyProjectRow], central_projects: list[CentralProjectRow]
) -> list[ProjectMapping]:
    """Apply exact, unique-normalized, create precedence in stable order."""
    result: list[ProjectMapping] = []
    available = list(central_projects)
    used_ids = {project.id for project in available}
    for legacy in sorted(legacy_projects, key=lambda item: (item.created_at, item.id)):
        exact = sorted(
            (project for project in available if project.name == legacy.name),
            key=lambda item: item.id,
        )
        if exact:
            result.append(ProjectMapping(legacy.id, exact[0].id, False))
            continue
        normalized = normalize_masterdata_name(legacy.name)
        candidates = sorted(
            (
                project
                for project in available
                if normalize_masterdata_name(project.name) == normalized
            ),
            key=lambda item: item.id,
        )
        if len(candidates) > 1:
            raise ProjectMappingConflict(
                legacy.id, legacy.name, [project.id for project in candidates]
            )
        if candidates:
            result.append(ProjectMapping(legacy.id, candidates[0].id, False))
            continue
        candidate_id = legacy.id
        if candidate_id in used_ids:
            candidate_id = str(
                uuid5(NAMESPACE_URL, f"wervelnieuws:work-project:{legacy.id}")
            )
        used_ids.add(candidate_id)
        available.append(CentralProjectRow(candidate_id, legacy.name))
        result.append(ProjectMapping(legacy.id, candidate_id, True))
    return result


def _post_rank(post: LegacyPostRow) -> tuple[bool, bool, bool, datetime, str]:
    return (
        not post.is_active,
        post.is_archived,
        post.deleted,
        post.created_at,
        post.id,
    )


def build_canonical_posts(posts: list[LegacyPostRow]) -> list[CanonicalPost]:
    grouped: dict[str, list[LegacyPostRow]] = {}
    for post in posts:
        grouped.setdefault(normalize_masterdata_name(post.name), []).append(post)
    result: list[CanonicalPost] = []
    for normalized_name in sorted(grouped):
        ranked = sorted(grouped[normalized_name], key=_post_rank)
        canonical = ranked[0]
        description = next((item.description for item in ranked if item.description.strip()), "")
        result.append(
            CanonicalPost(
                canonical_id=canonical.id,
                normalized_name=normalized_name,
                name=canonical.name,
                description=description,
                is_active=any(item.is_active and not item.deleted for item in ranked),
                source_ids=tuple(item.id for item in ranked),
            )
        )
    return result
