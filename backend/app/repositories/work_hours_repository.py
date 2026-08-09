from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime, date

from sqlalchemy import JSON, and_, asc, cast, desc, func, literal, or_, select, union_all, update
from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    AuditEvent,
    User,
    WorkExternalPerson,
    WorkHistoricalUserIdentity,
    WorkHourGroup,
    WorkHourGroupParticipant,
    WorkImportBatch,
    WorkPost,
    WorkProject,
)


class WorkHoursRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _apply_group_filters(self, stmt, filters: dict[str, object]):
        conditions = []
        include_deleted = bool(filters.get("include_deleted"))
        deleted_only = bool(filters.get("deleted_only"))
        if not include_deleted:
            conditions.append(WorkHourGroup.deleted_at.is_(None))
        elif deleted_only:
            conditions.append(WorkHourGroup.deleted_at.is_not(None))
        if work_date := filters.get("work_date"):
            conditions.append(WorkHourGroup.work_date == work_date)
        if project_id := filters.get("project_id"):
            conditions.append(WorkHourGroup.project_id == project_id)
        if post_id := filters.get("post_id"):
            conditions.append(WorkHourGroup.post_id == post_id)
        if query := str(filters.get("query") or "").strip():
            like = f"%{query}%"
            conditions.append(
                or_(
                    WorkHourGroup.description.ilike(like),
                    WorkProject.name.ilike(like),
                    WorkPost.name.ilike(like),
                )
            )
            stmt = stmt.join(WorkProject, WorkProject.id == WorkHourGroup.project_id).join(
                WorkPost, WorkPost.id == WorkHourGroup.post_id
            )
        if participant_kind := filters.get("participant_kind"):
            stmt = stmt.join(WorkHourGroupParticipant, WorkHourGroupParticipant.group_id == WorkHourGroup.id)
            conditions.append(WorkHourGroupParticipant.deleted_at.is_(None))
            conditions.append(WorkHourGroupParticipant.participant_kind == participant_kind)
        if not conditions:
            return stmt
        return stmt.where(and_(*conditions))

    def get_user(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)

    def list_active_users(self) -> list[User]:
        return list(self.db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name.asc(), User.username.asc())).all())

    def list_projects(self, include_deleted: bool = False) -> list[WorkProject]:
        stmt = select(WorkProject).order_by(WorkProject.name.asc())
        if not include_deleted:
            stmt = stmt.where(WorkProject.deleted_at.is_(None))
        return list(self.db.scalars(stmt).all())

    def list_selectable_projects(self) -> list[WorkProject]:
        return list(self.db.scalars(select(WorkProject).where(
            WorkProject.deleted_at.is_(None),
            WorkProject.is_active.is_(True),
            WorkProject.is_archived.is_(False),
        ).order_by(WorkProject.name.asc())).all())

    def get_project(self, project_id: str) -> WorkProject | None:
        return self.db.get(WorkProject, project_id)

    def list_posts(self, include_deleted: bool = False, project_id: str | None = None) -> list[WorkPost]:
        stmt = select(WorkPost).order_by(WorkPost.name.asc())
        if not include_deleted:
            stmt = stmt.where(WorkPost.deleted_at.is_(None))
        if project_id:
            stmt = stmt.where(WorkPost.project_id == project_id)
        return list(self.db.scalars(stmt).all())

    def list_selectable_posts(self) -> list[WorkPost]:
        return list(self.db.scalars(select(WorkPost).join(WorkProject).where(
            WorkPost.deleted_at.is_(None),
            WorkPost.is_active.is_(True),
            WorkPost.is_archived.is_(False),
            WorkProject.deleted_at.is_(None),
            WorkProject.is_active.is_(True),
            WorkProject.is_archived.is_(False),
        ).order_by(WorkPost.name.asc())).all())

    def get_post(self, post_id: str) -> WorkPost | None:
        return self.db.get(WorkPost, post_id)

    def list_external_people(self, include_deleted: bool = False) -> list[WorkExternalPerson]:
        stmt = select(WorkExternalPerson).order_by(WorkExternalPerson.display_name.asc())
        if not include_deleted:
            stmt = stmt.where(WorkExternalPerson.deleted_at.is_(None))
        return list(self.db.scalars(stmt).all())

    def get_external_person(self, person_id: str) -> WorkExternalPerson | None:
        return self.db.get(WorkExternalPerson, person_id)

    def list_historical_identities(self, include_deleted: bool = False) -> list[WorkHistoricalUserIdentity]:
        stmt = select(WorkHistoricalUserIdentity).order_by(WorkHistoricalUserIdentity.snapshot_display_label.asc())
        if not include_deleted:
            stmt = stmt.where(WorkHistoricalUserIdentity.deleted_at.is_(None))
        return list(self.db.scalars(stmt).all())

    def get_historical_identity(self, identity_id: str) -> WorkHistoricalUserIdentity | None:
        return self.db.get(WorkHistoricalUserIdentity, identity_id)

    def list_import_batches_by_ids(self, batch_ids: set[str]) -> list[WorkImportBatch]:
        if not batch_ids:
            return []
        return list(self.db.scalars(select(WorkImportBatch).where(WorkImportBatch.id.in_(batch_ids))).all())

    def query_admin_history(
        self, *, kind: str | None, query: str | None, page: int, page_size: int, sort_key: str, sort_direction: str
    ) -> tuple[list[dict[str, object]], int]:
        """Return the archive/history surface using one SQL count/page query."""
        project_rows = select(
            literal("project").label("kind"), WorkProject.id.label("id"),
            WorkProject.name.label("display_name"), WorkProject.row_version.label("row_version"),
            WorkProject.is_active.label("is_active"), WorkProject.is_archived.label("is_archived"),
            WorkProject.deleted_at.label("deleted_at"), literal(None).label("project_id"),
            literal(None).label("linked_user_id"),
        ).where(or_(WorkProject.is_archived.is_(True), WorkProject.deleted_at.is_not(None)))
        post_rows = select(
            literal("post").label("kind"), WorkPost.id.label("id"),
            WorkPost.name.label("display_name"), WorkPost.row_version.label("row_version"),
            WorkPost.is_active.label("is_active"), WorkPost.is_archived.label("is_archived"),
            WorkPost.deleted_at.label("deleted_at"), WorkPost.project_id.label("project_id"),
            literal(None).label("linked_user_id"),
        ).where(or_(WorkPost.is_archived.is_(True), WorkPost.deleted_at.is_not(None)))
        people_rows = select(
            literal("external_person").label("kind"), WorkExternalPerson.id.label("id"),
            WorkExternalPerson.display_name.label("display_name"), WorkExternalPerson.row_version.label("row_version"),
            WorkExternalPerson.is_active.label("is_active"), literal(None).label("is_archived"),
            WorkExternalPerson.deleted_at.label("deleted_at"), literal(None).label("project_id"),
            literal(None).label("linked_user_id"),
        ).where(or_(WorkExternalPerson.is_active.is_(False), WorkExternalPerson.deleted_at.is_not(None)))
        identity_rows = select(
            literal("historical_identity").label("kind"), WorkHistoricalUserIdentity.id.label("id"),
            WorkHistoricalUserIdentity.snapshot_display_label.label("display_name"),
            WorkHistoricalUserIdentity.row_version.label("row_version"),
            WorkHistoricalUserIdentity.is_active.label("is_active"), literal(None).label("is_archived"),
            WorkHistoricalUserIdentity.deleted_at.label("deleted_at"), literal(None).label("project_id"),
            WorkHistoricalUserIdentity.linked_user_id.label("linked_user_id"),
        )
        by_kind = {
            "project": project_rows, "post": post_rows,
            "external_person": people_rows, "historical_identity": identity_rows,
        }
        history = (by_kind[kind] if kind else union_all(*by_kind.values())).subquery()
        conditions = []
        normalized_query = (query or "").strip()
        if normalized_query:
            conditions.append(func.lower(history.c.display_name).contains(normalized_query.casefold()))
        total = int(self.db.scalar(select(func.count()).select_from(history).where(*conditions)) or 0)
        primary = history.c.id if sort_key == "id" else history.c.display_name
        ordered = primary.desc() if sort_direction == "desc" else primary.asc()
        statement = (
            select(history).where(*conditions)
            .order_by(ordered, history.c.id.asc())
            .offset((page - 1) * page_size).limit(page_size)
        )
        return [dict(row) for row in self.db.execute(statement).mappings().all()], total

    def create_project(self, project: WorkProject) -> WorkProject:
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def create_post(self, post: WorkPost) -> WorkPost:
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post

    def create_external_person(self, person: WorkExternalPerson) -> WorkExternalPerson:
        self.db.add(person)
        self.db.commit()
        self.db.refresh(person)
        return person

    def create_historical_identity(self, identity: WorkHistoricalUserIdentity) -> WorkHistoricalUserIdentity:
        self.db.add(identity)
        self.db.commit()
        self.db.refresh(identity)
        return identity

    def create_group(self, group: WorkHourGroup) -> WorkHourGroup:
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def get_group(self, group_id: str, include_deleted: bool = False) -> WorkHourGroup | None:
        stmt = select(WorkHourGroup).where(WorkHourGroup.id == group_id).options(
            joinedload(WorkHourGroup.project),
            joinedload(WorkHourGroup.post),
            joinedload(WorkHourGroup.participants).joinedload(WorkHourGroupParticipant.user),
            joinedload(WorkHourGroup.participants).joinedload(WorkHourGroupParticipant.external_person),
            joinedload(WorkHourGroup.participants).joinedload(WorkHourGroupParticipant.historical_identity),
        )
        if not include_deleted:
            stmt = stmt.where(WorkHourGroup.deleted_at.is_(None))
        return self.db.scalars(stmt).unique().one_or_none()

    def list_groups(self, filters: dict[str, object], *, offset: int | None = None, limit: int | None = None) -> list[WorkHourGroup]:
        query_text = str(filters.get("query") or "").strip()
        sort_key = str(filters.get("sort_key") or "work_date")
        direction = str(filters.get("sort_direction") or "desc")
        primary_participant_name = (
            select(WorkHourGroupParticipant.display_name_snapshot)
            .where(
                WorkHourGroupParticipant.group_id == WorkHourGroup.id,
                WorkHourGroupParticipant.deleted_at.is_(None),
            )
            .order_by(WorkHourGroupParticipant.sort_order.asc(), WorkHourGroupParticipant.created_at.asc(), WorkHourGroupParticipant.id.asc())
            .limit(1)
            .scalar_subquery()
        )
        primary_participant_type = (
            select(WorkHourGroupParticipant.display_type_snapshot)
            .where(
                WorkHourGroupParticipant.group_id == WorkHourGroup.id,
                WorkHourGroupParticipant.deleted_at.is_(None),
            )
            .order_by(WorkHourGroupParticipant.sort_order.asc(), WorkHourGroupParticipant.created_at.asc(), WorkHourGroupParticipant.id.asc())
            .limit(1)
            .scalar_subquery()
        )
        sort_map = {
            "work_date": WorkHourGroup.work_date,
            "project": WorkProject.name,
            "post": WorkPost.name,
            "name_person": primary_participant_name,
            "type_person": primary_participant_type,
            "duration_half_hours": WorkHourGroup.duration_half_hours,
            "created_at": WorkHourGroup.created_at,
            "updated_at": WorkHourGroup.updated_at,
        }
        sort_column = sort_map.get(sort_key, WorkHourGroup.work_date)

        ids_stmt = select(WorkHourGroup.id)
        ids_stmt = self._apply_group_filters(ids_stmt, filters)
        if sort_key in {"project", "post"} and not query_text:
            ids_stmt = ids_stmt.join(WorkProject, WorkProject.id == WorkHourGroup.project_id).join(
                WorkPost, WorkPost.id == WorkHourGroup.post_id
            )
        ids_stmt = ids_stmt.distinct()
        ids_stmt = ids_stmt.order_by(desc(sort_column) if direction == "desc" else asc(sort_column), WorkHourGroup.id.asc())
        if offset is not None:
            ids_stmt = ids_stmt.offset(offset)
        if limit is not None:
            ids_stmt = ids_stmt.limit(limit)

        group_ids = list(self.db.scalars(ids_stmt).all())
        if not group_ids:
            return []

        stmt = select(WorkHourGroup).options(
            joinedload(WorkHourGroup.project),
            joinedload(WorkHourGroup.post),
            joinedload(WorkHourGroup.participants).joinedload(WorkHourGroupParticipant.user),
            joinedload(WorkHourGroup.participants).joinedload(WorkHourGroupParticipant.external_person),
            joinedload(WorkHourGroup.participants).joinedload(WorkHourGroupParticipant.historical_identity),
        ).where(WorkHourGroup.id.in_(group_ids))
        groups = list(self.db.scalars(stmt).unique().all())
        group_by_id = {group.id: group for group in groups}
        return [group_by_id[group_id] for group_id in group_ids if group_id in group_by_id]

    def count_groups(self, filters: dict[str, object]) -> int:
        stmt = select(func.count(func.distinct(WorkHourGroup.id)))
        stmt = stmt.select_from(WorkHourGroup)
        stmt = self._apply_group_filters(stmt, filters)
        return int(self.db.scalar(stmt) or 0)

    def aggregate_totals(self, filters: dict[str, object]) -> tuple[int, int, int, float]:
        """Aggregate over the same deduplicated group basis as list/count."""
        ids_stmt = self._apply_group_filters(select(WorkHourGroup.id), filters).distinct()
        group_ids = ids_stmt.subquery()
        participant_counts = (
            select(
                WorkHourGroupParticipant.group_id.label("group_id"),
                func.count(WorkHourGroupParticipant.id).label("participant_count"),
            )
            .where(WorkHourGroupParticipant.deleted_at.is_(None))
            .group_by(WorkHourGroupParticipant.group_id)
            .subquery()
        )
        count_value, duration_value, people_value, person_half_hours = self.db.execute(
            select(
                func.count(WorkHourGroup.id),
                func.coalesce(func.sum(WorkHourGroup.duration_half_hours), 0),
                func.coalesce(func.sum(participant_counts.c.participant_count), 0),
                func.coalesce(func.sum(WorkHourGroup.duration_half_hours * participant_counts.c.participant_count), 0),
            )
            .join(group_ids, group_ids.c.id == WorkHourGroup.id)
            .outerjoin(participant_counts, participant_counts.c.group_id == WorkHourGroup.id)
        ).one()
        return int(count_value or 0), int(people_value or 0), int(duration_value or 0), float(person_half_hours or 0) / 2

    def compare_and_bump(self, model, row_id: str, expected_row_version: int) -> int | None:
        result = self.db.execute(
            update(model)
            .where(model.id == row_id, model.row_version == expected_row_version)
            .values(row_version=expected_row_version + 1, updated_at=datetime.now(UTC))
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            return None
        return expected_row_version + 1

    def current_row_version(self, model, row_id: str) -> int | None:
        return self.db.scalar(select(model.row_version).where(model.id == row_id))

    def list_audit_events(self, limit: int = 100) -> list[AuditEvent]:
        return list(
            self.db.scalars(
                select(AuditEvent)
                .where(AuditEvent.event_type.like("work_hours.%"))
                .order_by(AuditEvent.created_at.desc())
                .limit(limit)
            ).all()
        )

    def query_audit_events(
        self,
        *,
        actor: str | None,
        action: str | None,
        result: str | None,
        method: str | None,
        path: str | None,
        from_utc: datetime | None,
        to_utc: datetime | None,
        page: int,
        page_size: int,
    ) -> tuple[list[AuditEvent], int]:
        if self.db.bind is not None and self.db.bind.dialect.name == "sqlite":
            result_expr = func.json_extract(AuditEvent.details_json, "$.result")
            method_expr = func.json_extract(AuditEvent.details_json, "$.request_method")
            path_expr = func.json_extract(AuditEvent.details_json, "$.request_path")
        else:
            details = cast(AuditEvent.details_json, JSON)
            result_expr = details["result"].as_string()
            method_expr = details["request_method"].as_string()
            path_expr = details["request_path"].as_string()
        conditions = [AuditEvent.event_type.like("work_hours.%")]
        if actor:
            conditions.append(AuditEvent.actor_user_id == actor)
        if action:
            conditions.append(AuditEvent.event_type == action)
        if result:
            conditions.append(result_expr == result)
        if method:
            conditions.append(func.upper(method_expr) == method.upper())
        if path:
            conditions.append(func.lower(path_expr).contains(path.casefold()))
        if from_utc:
            conditions.append(AuditEvent.created_at >= from_utc)
        if to_utc:
            conditions.append(AuditEvent.created_at <= to_utc)
        total = int(self.db.scalar(select(func.count(AuditEvent.id)).where(*conditions)) or 0)
        rows = list(self.db.scalars(
            select(AuditEvent)
            .where(*conditions)
            .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all())
        return rows, total

    def create_import_batch(self, batch: WorkImportBatch) -> WorkImportBatch:
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def update_import_batch(self, batch: WorkImportBatch) -> WorkImportBatch:
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def replace_group_participants(self, group: WorkHourGroup, participants: Iterable[WorkHourGroupParticipant]) -> None:
        self.db.query(WorkHourGroupParticipant).filter(WorkHourGroupParticipant.group_id == group.id).delete()
        for participant in participants:
            self.db.add(participant)
        self.db.flush()

    def soft_delete_group(self, group: WorkHourGroup) -> WorkHourGroup:
        group.deleted_at = datetime.now(UTC)
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def restore_group(self, group: WorkHourGroup) -> WorkHourGroup:
        group.deleted_at = None
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def save(self) -> None:
        self.db.commit()
