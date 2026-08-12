from __future__ import annotations

import csv
import json
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, date
from io import StringIO
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import IntegrityError

from app.models.entities import (
    AuditEvent,
    Project,
    User,
    WorkExternalPerson,
    WorkHistoricalUserIdentity,
    WorkHourGroup,
    WorkHourGroupParticipant,
    WorkPost,
    WorkPostLegacyAlias,
    WorkProjectLegacyAlias,
)
from app.repositories.work_hours_repository import WorkHoursRepository
from app.schemas.work_hours import (
    WorkExternalPersonCreateRequest,
    WorkExternalPersonMergeRequest,
    WorkExternalPersonResponse,
    WorkExternalPersonUpdateRequest,
    WorkHourGroupCreateRequest,
    WorkHourGroupResponse,
    WorkHourGroupUpdateRequest,
    WorkHourListResponse,
    WorkHourMetaResponse,
    WorkHourParticipantCreateRequest,
    WorkHourParticipantResponse,
    WorkHourAdminParticipantResponse,
    WorkHourAdminGroupResponse,
    WorkHourAdminListResponse,
    WorkHourParticipantUpdateRequest,
    WorkHourTotalsResponse,
    WorkPostCreateRequest,
    WorkPostResponse,
    WorkPostUpdateRequest,
    WorkProjectCreateRequest,
    WorkProjectResponse,
    WorkProjectUpdateRequest,
    WorkHistoricalIdentityResponse,
    WorkHistoricalIdentityRelinkRequest,
    WorkEligibleUserResponse,
    WorkExternalPersonOptionResponse,
    WorkHistoricalDisplayResponse,
    WorkProjectOptionResponse,
    WorkPostOptionResponse,
    WorkAdminHistoryItemResponse,
    WorkAdminHistoryListResponse,
    WorkAdminMasterdataResponse,
)
from app.services.audit_service import AuditService


SORT_KEYS = {"work_date", "name_person", "type_person", "project", "post", "duration_half_hours", "created_at", "updated_at"}
AMSTERDAM_TZ = ZoneInfo("Europe/Amsterdam")


def _now() -> datetime:
    return datetime.now(UTC)


def _display_name_for_user(user: User | None) -> str:
    if not user:
        return "Onbekend"
    return (user.full_name or "").strip() or user.username


def _normalize(value: str | None) -> str:
    return " ".join(unicodedata.normalize("NFKC", value or "").strip().split()).casefold()


def _work_date(value: date | datetime) -> date:
    return value.date() if isinstance(value, datetime) else value


@dataclass(slots=True)
class WorkHoursListQuery:
    work_date: date | None = None
    project_id: str | None = None
    post_id: str | None = None
    participant_kind: str | None = None
    participant_query: str | None = None
    query: str | None = None
    include_deleted: bool = False
    deleted_only: bool = False
    page: int = 1
    page_size: int = 25
    sort_key: str = "work_date"
    sort_direction: str = "desc"


class WorkHoursService:
    def __init__(self, repo: WorkHoursRepository, audit: AuditService, request: Request | None = None) -> None:
        self.repo = repo
        self.audit = audit
        self.request = request

    def _ensure_admin(self, current: User) -> None:
        if not current.is_admin:
            self._log(event_type="work_hours.authorization.denied", actor=current, target_type="work_hours", target_id="admin-only", outcome="denied")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Beheerderstoegang vereist")

    def _project_to_response(self, project: Project) -> WorkProjectResponse:
        return WorkProjectResponse.model_validate(project)

    def _post_to_response(self, post: WorkPost) -> WorkPostResponse:
        return WorkPostResponse.model_validate(post)

    def _historical_to_response(self, identity: WorkHistoricalUserIdentity) -> WorkHistoricalIdentityResponse:
        return WorkHistoricalIdentityResponse.model_validate(identity)

    def _find_historical_identity_by_source_key(self, source_key: str) -> WorkHistoricalUserIdentity | None:
        normalized_source_key = _normalize(source_key)
        return next(
            (
                identity
                for identity in self.repo.list_historical_identities(include_deleted=True)
                if _normalize(identity.source_key) == normalized_source_key
            ),
            None,
        )

    def _person_to_response(self, person: WorkExternalPerson) -> WorkExternalPersonResponse:
        return WorkExternalPersonResponse.model_validate(person)

    def _duplicate_candidate_payload(self, person: WorkExternalPerson, current: User) -> dict[str, object]:
        selectable = person.deleted_at is None and person.is_active
        payload: dict[str, object] = {
            "id": person.id,
            "display_name": person.display_name,
            "is_active": person.is_active,
            "status_label": "actief" if selectable else ("historisch" if person.deleted_at is not None else "inactief"),
            "selectable": selectable,
            "guidance": None if selectable else ("Herstel of koppel deze historische persoon eerst." if person.deleted_at is not None else "Activeer deze persoon eerst."),
        }
        if current.is_admin:
            payload["email"] = person.email
            payload["note"] = person.note
            payload["deleted_at"] = person.deleted_at.isoformat() if person.deleted_at else None
        return payload

    def _participant_to_response(self, participant: WorkHourGroupParticipant) -> WorkHourParticipantResponse:
        return WorkHourParticipantResponse(
            id=participant.id,
            display_name_snapshot=participant.display_name_snapshot,
            display_type_snapshot=participant.display_type_snapshot,
            sort_order=participant.sort_order,
        )

    def _participant_to_admin_response(self, participant: WorkHourGroupParticipant) -> WorkHourAdminParticipantResponse:
        return WorkHourAdminParticipantResponse.model_validate(participant)

    def _group_to_response(self, group: WorkHourGroup) -> WorkHourGroupResponse:
        participants = [
            participant for participant in sorted(group.participants, key=lambda item: item.sort_order)
            if participant.deleted_at is None or (
                group.deleted_at is not None
                and participant.deleted_at == group.deleted_at
                and participant.deleted_by_user_id == group.deleted_by_user_id
            )
        ]
        person_count = len(participants)
        duration_hours = group.duration_half_hours / 2
        return WorkHourGroupResponse(
            id=group.id,
            work_date=_work_date(group.work_date),
            project_id=group.project_id,
            project_name=group.project.name if group.project else "",
            post_id=group.post_id,
            post_name=group.post.name if group.post else "",
            description=group.description,
            duration_half_hours=group.duration_half_hours,
            duration_hours=duration_hours,
            person_count=person_count,
            person_hours=duration_hours * person_count,
            row_version=group.row_version,
            created_at=group.created_at,
            updated_at=group.updated_at,
            participants=[self._participant_to_response(participant) for participant in participants],
        )

    def _group_to_admin_response(self, group: WorkHourGroup) -> WorkHourAdminGroupResponse:
        public = self._group_to_response(group)
        visible_ids = {participant.id for participant in public.participants}
        return WorkHourAdminGroupResponse(
            **public.model_dump(exclude={"participants"}),
            created_by_user_id=group.created_by_user_id,
            updated_by_user_id=group.updated_by_user_id,
            deleted_at=group.deleted_at,
            deleted_by_user_id=group.deleted_by_user_id,
            participants=[self._participant_to_admin_response(participant) for participant in sorted(group.participants, key=lambda item: item.sort_order) if participant.id in visible_ids],
        )

    def get_group(self, current: User, group_id: str) -> WorkHourGroupResponse | WorkHourAdminGroupResponse:
        group = self.repo.get_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Registratie niet gevonden")
        return self._group_to_admin_response(group) if current.is_admin else self._group_to_response(group)

    @staticmethod
    def _row_state(row) -> dict[str, object]:
        return {
            "id": row.id,
            "created_at": row.created_at,
            "created_by_user_id": getattr(row, "created_by_user_id", None),
            "updated_at": row.updated_at,
            "updated_by_user_id": getattr(row, "updated_by_user_id", None),
            "deleted_at": getattr(row, "deleted_at", None),
            "deleted_by_user_id": getattr(row, "deleted_by_user_id", None),
            "row_version": row.row_version,
        }

    def _full_participant_snapshot(self, participant: WorkHourGroupParticipant) -> dict[str, object]:
        return {
            **self._row_state(participant),
            "group_id": participant.group_id,
            "participant_kind": participant.participant_kind,
            "user_id": participant.user_id,
            "external_person_id": participant.external_person_id,
            "historical_identity_id": participant.historical_identity_id,
            "display_name_snapshot": participant.display_name_snapshot,
            "display_email_snapshot": participant.display_email_snapshot,
            "display_type_snapshot": participant.display_type_snapshot,
            "sort_order": participant.sort_order,
        }

    def _full_group_snapshot(self, group: WorkHourGroup) -> dict[str, object]:
        return {
            **self._row_state(group),
            "work_date": _work_date(group.work_date),
            "project_id": group.project_id,
            "project_name_snapshot": group.project.name if group.project else "",
            "post_id": group.post_id,
            "post_name_snapshot": group.post.name if group.post else "",
            "description": group.description,
            "duration_half_hours": group.duration_half_hours,
            "participants": [
                self._full_participant_snapshot(participant)
                for participant in sorted(group.participants, key=lambda item: (item.sort_order, item.id))
            ],
        }

    def _validate_project_post(self, project_id: str, post_id: str, *, allow_unchanged: tuple[str, str] | None = None) -> tuple[Project, WorkPost]:
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project niet gevonden")
        post = self.repo.get_post(post_id)
        if not post:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Post niet gevonden")
        historical_unchanged = allow_unchanged == (project_id, post_id)
        if not historical_unchanged and (
            not project.is_active or project.is_archived or not project.is_visible_in_work_hours
            or post.deleted_at is not None or not post.is_active or post.is_archived
        ):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project of post is niet actief/selecteerbaar")
        return project, post

    @staticmethod
    def _identity_key(kind: str, user_id: str | None, external_id: str | None, historical_id: str | None) -> str:
        identity_id = user_id if kind == "live_user" else external_id if kind == "external_person" else historical_id
        return f"{kind}:{identity_id or ''}"

    def _set_active_identity_key(self, participant: WorkHourGroupParticipant) -> None:
        participant.active_identity_key = None if participant.deleted_at is not None else self._identity_key(
            participant.participant_kind,
            participant.user_id,
            participant.external_person_id,
            participant.historical_identity_id,
        )

    def _validate_unique_participants(self, participants, *, context: str) -> None:
        keys: set[str] = set()
        for index, participant in enumerate(participants):
            key = self._identity_key(participant.participant_kind, participant.user_id, participant.external_person_id, participant.historical_identity_id)
            if key in keys:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}[{index}]: dubbele deelnemer")
            keys.add(key)

    @staticmethod
    def _validate_work_date(value: date) -> None:
        if value > datetime.now(AMSTERDAM_TZ).date():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="work_date: datum mag niet in de toekomst liggen")

    def _require_expected_version(self, model, row_id: str, expected: int | None) -> int:
        current = self.repo.current_row_version(model, row_id)
        if expected is None or current is None or self.repo.compare_and_bump(model, row_id, expected) is None:
            self.repo.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "stale_row_version", "message": "De gegevens zijn intussen gewijzigd.", "current_row_version": current},
            )
        return expected + 1

    def _project_name_conflicts(self, name: str, *, exclude_project_id: str | None = None) -> bool:
        normalized_name = _normalize(name)
        return any(
            project.id != exclude_project_id and _normalize(project.name) == normalized_name
            for project in self.repo.list_projects(include_deleted=True)
        )

    def _post_name_conflicts(self, name: str, *, exclude_post_id: str | None = None) -> bool:
        normalized_name = _normalize(name)
        return any(
            post.id != exclude_post_id and _normalize(post.name) == normalized_name
            for post in self.repo.list_posts(include_deleted=True)
        )

    def _participant_entity(
        self,
        payload: WorkHourParticipantCreateRequest,
        current: User,
        *,
        allow_inactive_external_person: bool = False,
        allow_historical_identity: bool = False,
    ) -> WorkHourGroupParticipant:
        if payload.participant_kind == "live_user":
            if payload.user_id:
                user = self.repo.get_user(payload.user_id)
                if user and user.is_active:
                    display_name = payload.display_name_snapshot or _display_name_for_user(user)
                    display_email = payload.display_email_snapshot or user.email
                    return WorkHourGroupParticipant(
                        participant_kind="live_user",
                        user_id=user.id,
                        display_name_snapshot=display_name,
                        display_email_snapshot=display_email,
                        display_type_snapshot=payload.display_type_snapshot or "WindWilly-gebruiker",
                        sort_order=payload.sort_order,
                        created_by_user_id=current.id,
                        updated_by_user_id=current.id,
                    )
                raise HTTPException(status_code=422, detail="participant.user_id: Onbekende of inactieve gebruiker")
            raise HTTPException(status_code=422, detail="participant.user_id: Gebruiker ontbreekt")
        if payload.participant_kind == "external_person":
            if not payload.external_person_id:
                raise HTTPException(status_code=422, detail="Externe persoon ontbreekt")
            person = self.repo.get_external_person(payload.external_person_id)
            if not person or ((person.deleted_at is not None or not person.is_active) and not allow_inactive_external_person):
                raise HTTPException(status_code=422, detail="participant.external_person_id: onbekende of niet-selecteerbare externe persoon")
            return WorkHourGroupParticipant(
                participant_kind="external_person",
                external_person_id=person.id,
                display_name_snapshot=payload.display_name_snapshot or person.display_name,
                display_email_snapshot=payload.display_email_snapshot or person.email,
                display_type_snapshot=payload.display_type_snapshot or "Extern",
                sort_order=payload.sort_order,
                created_by_user_id=current.id,
                updated_by_user_id=current.id,
            )
        if not allow_historical_identity:
            raise HTTPException(status_code=422, detail="participant.historical_identity_id: historische identiteit is niet selecteerbaar")
        if not payload.historical_identity_id:
            raise HTTPException(status_code=422, detail="Historische identiteit ontbreekt")
        identity = self.repo.get_historical_identity(payload.historical_identity_id)
        if not identity or identity.deleted_at is not None:
            raise HTTPException(status_code=422, detail="Onbekende historische identiteit")
        return WorkHourGroupParticipant(
            participant_kind="historical_identity",
            historical_identity_id=identity.id,
            display_name_snapshot=payload.display_name_snapshot or identity.snapshot_display_label,
            display_email_snapshot=payload.display_email_snapshot or identity.snapshot_email,
            display_type_snapshot=payload.display_type_snapshot or "Historisch",
            sort_order=payload.sort_order,
            created_by_user_id=current.id,
            updated_by_user_id=current.id,
        )

    @staticmethod
    def _participant_reference_count(payload: WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest) -> int:
        return sum(1 for value in (payload.user_id, payload.external_person_id, payload.historical_identity_id) if value)

    @staticmethod
    def _participant_expected_kind(payload: WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest) -> str | None:
        if payload.user_id:
            return "live_user"
        if payload.external_person_id:
            return "external_person"
        if payload.historical_identity_id:
            return "historical_identity"
        return None

    def _validate_participant_identity(self, payload: WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest, *, context: str) -> None:
        if self._participant_reference_count(payload) != 1:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: elke deelnemer heeft precies één identity-reference nodig")
        expected_kind = self._participant_expected_kind(payload)
        if expected_kind != payload.participant_kind:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: participant_kind komt niet overeen met de gekozen identity-reference")

    def _validate_live_user_reference(self, user_id: str | None, *, context: str, missing_detail: str = "Gebruiker ontbreekt") -> None:
        if not user_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: {missing_detail}")
        user = self.repo.get_user(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: Onbekende of inactieve gebruiker")

    def _validate_participants(self, participants: list[WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest] | None, *, context: str) -> None:
        if not participants:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: voeg minimaal één deelnemer toe")
        for participant in participants:
            if participant.participant_kind == "live_user" and self._participant_reference_count(participant) == 0:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: Gebruiker ontbreekt")
            self._validate_participant_identity(participant, context=context)
        self._validate_unique_participants(participants, context=f"{context}.participants")

    def _bump_version(self, row) -> None:
        row.row_version = int(getattr(row, "row_version", 0) or 0) + 1

    def _request_path(self) -> str:
        return self.request.url.path if self.request else "/api/urenverantwoording"

    def _request_method(self) -> str:
        return self.request.method if self.request else "N/A"

    def _query_filters(self, query: WorkHoursListQuery) -> dict[str, object]:
        return {
            "work_date": query.work_date,
            "project_id": query.project_id,
            "post_id": query.post_id,
            "participant_kind": query.participant_kind,
            "participant_query": query.participant_query,
            "query": query.query,
            "include_deleted": query.include_deleted,
            "deleted_only": query.deleted_only,
            "sort_key": query.sort_key,
            "sort_direction": query.sort_direction,
        }

    @staticmethod
    def _is_selectable_masterdata(row: WorkProjectResponse | WorkPostResponse | Project | WorkPost) -> bool:
        return bool(
            row.is_active
            and not row.is_archived
            and getattr(row, "deleted_at", None) is None
            and (not isinstance(row, Project) or row.is_visible_in_work_hours)
        )

    def relink_historical_identity(self, current: User, identity_id: str, payload: WorkHistoricalIdentityRelinkRequest) -> WorkHistoricalIdentityResponse:
        self._ensure_admin(current)
        identity = self.repo.get_historical_identity(identity_id)
        if not identity or identity.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historische identiteit niet gevonden")
        linked_user = self.repo.get_user(payload.linked_user_id)
        if not linked_user or not linked_user.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Onbekende of inactieve gebruiker")
        before = self._historical_to_response(identity).model_dump()
        identity.row_version = self._require_expected_version(WorkHistoricalUserIdentity, identity.id, payload.expected_row_version)
        identity.linked_user_id = linked_user.id
        identity.linked_at = _now()
        identity.updated_at = identity.linked_at
        identity.linked_by_user_id = current.id
        identity.is_active = True
        self.repo.db.add(identity)
        try:
            self.repo.db.flush()
            self._log(event_type="work_hours.historical_identity.relinked", actor=current, target_type="historical_identity", target_id=identity.id, before=before, after=self._historical_to_response(identity).model_dump(), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(identity)
        return self._historical_to_response(identity)

    def _log(self, *, event_type: str, actor: User | None, target_type: str, target_id: str, before: dict | None = None, after: dict | None = None, outcome: str = "success", extra: dict | None = None, commit: bool = True) -> None:
        payload = {
            "target_type": target_type,
            "target_id": target_id,
            "before": before,
            "after": after,
            "outcome": outcome,
            "result": outcome,
            "correlation_id": str(uuid4()),
            "request_path": self._request_path(),
            "request_method": self._request_method(),
        }
        if extra:
            payload.update(extra)
        details_json = json.dumps(payload, ensure_ascii=False, default=str)
        if commit:
            self.audit.log(event_type=event_type, actor_user_id=actor.id if actor else None, details_json=details_json)
        else:
            self.repo.db.add(AuditEvent(event_type=event_type, actor_user_id=actor.id if actor else None, details_json=details_json))


    def list_meta(self, current: User) -> WorkHourMetaResponse:
        return WorkHourMetaResponse(
            projects=[WorkProjectOptionResponse(id=project.id, display_name=project.name) for project in self.repo.list_selectable_projects()],
            posts=[WorkPostOptionResponse(id=post.id, display_name=post.name) for post in self.repo.list_selectable_posts()],
            external_people=[WorkExternalPersonOptionResponse(id=person.id, display_name=person.display_name) for person in self.repo.list_external_people() if person.is_active],
            historical_identities=[],
            eligible_users=[WorkEligibleUserResponse(id=user.id, display_name=_display_name_for_user(user)) for user in self.repo.list_active_users()],
            filter_projects=[WorkProjectOptionResponse(id=project.id, display_name=project.name, selectable=self._is_selectable_masterdata(project)) for project in self.repo.list_filter_projects()],
            filter_posts=[WorkPostOptionResponse(id=post.id, display_name=post.name, selectable=self._is_selectable_masterdata(post)) for post in self.repo.list_filter_posts()],
            filter_participants=self.repo.list_filter_participants(),
            filter_dates=self.repo.list_filter_dates(),
            is_admin=current.is_admin,
        )

    def list_admin_history(self, *, page: int, page_size: int, kind: str | None, query: str | None, sort_key: str, sort_direction: str) -> WorkAdminHistoryListResponse:
        rows, total = self.repo.query_admin_history(kind=kind, query=query, page=page, page_size=page_size, sort_key=sort_key, sort_direction=sort_direction)
        return WorkAdminHistoryListResponse(
            items=[WorkAdminHistoryItemResponse.model_validate(row) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    def list_admin_masterdata(self) -> WorkAdminMasterdataResponse:
        return WorkAdminMasterdataResponse(
            projects=[self._project_to_response(item) for item in self.repo.list_projects(include_deleted=True)],
            posts=[self._post_to_response(item) for item in self.repo.list_posts(include_deleted=True)],
            external_people=[self._person_to_response(item) for item in self.repo.list_external_people(include_deleted=True)],
        )

    def list_hours(self, query: WorkHoursListQuery, current: User | None = None) -> WorkHourListResponse | WorkHourAdminListResponse:
        if query.sort_key not in SORT_KEYS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ongeldige sorteersleutel")
        if query.page_size not in {25, 50, 100}:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ongeldige paginagrootte")
        if query.page < 1:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ongeldige pagina")
        if query.sort_direction not in {"asc", "desc"}:
            raise HTTPException(status_code=422, detail="Ongeldige sorteervolgorde")
        if query.participant_kind not in {None, "live_user", "external_person", "historical_identity"}:
            raise HTTPException(status_code=422, detail="Ongeldig persoonstype")

        filters = self._query_filters(query)
        total = self.repo.count_groups(filters)
        start = (query.page - 1) * query.page_size
        groups = self.repo.list_groups(filters, offset=start, limit=query.page_size)
        items = [self._group_to_admin_response(group) if current and current.is_admin else self._group_to_response(group) for group in groups]
        total_groups, total_people, duration_half_hours, person_hours = self.repo.aggregate_totals(filters)
        totals = WorkHourTotalsResponse(
            total_groups=total_groups,
            total_people=total_people,
            total_duration_hours=duration_half_hours / 2,
            total_person_hours=person_hours,
        )
        response_type = WorkHourAdminListResponse if current and current.is_admin else WorkHourListResponse
        return response_type(
            items=items,
            total=total,
            page=query.page,
            page_size=query.page_size,
            sort_key=query.sort_key,
            sort_direction=query.sort_direction,
            totals=totals,
        )

    def _build_totals(self, groups: list[WorkHourGroup]) -> WorkHourTotalsResponse:
        duration_half_hours = sum(group.duration_half_hours for group in groups)
        total_people = sum(len([p for p in group.participants if p.deleted_at is None]) for group in groups)
        total_person_hours = sum((group.duration_half_hours / 2) * len([p for p in group.participants if p.deleted_at is None]) for group in groups)
        return WorkHourTotalsResponse(
            total_groups=len(groups),
            total_people=total_people,
            total_duration_hours=duration_half_hours / 2,
            total_person_hours=total_person_hours,
        )

    def _sort_groups(self, groups: list[WorkHourGroup], sort_key: str, sort_direction: str) -> list[WorkHourGroup]:
        reverse = sort_direction != "asc"

        def sort_value(group: WorkHourGroup):
            primary_participant = next((participant for participant in group.participants if participant.deleted_at is None), None)
            if sort_key == "project":
                return (group.project.name if group.project else "")
            if sort_key == "post":
                return (group.post.name if group.post else "")
            if sort_key == "name_person":
                return primary_participant.display_name_snapshot if primary_participant else ""
            if sort_key == "type_person":
                return primary_participant.display_type_snapshot if primary_participant else ""
            if sort_key == "duration_half_hours":
                return group.duration_half_hours
            if sort_key == "created_at":
                return group.created_at
            if sort_key == "updated_at":
                return group.updated_at
            return group.work_date

        return sorted(groups, key=sort_value, reverse=reverse)

    def create_group(self, current: User, payload: WorkHourGroupCreateRequest) -> WorkHourGroupResponse:
        self._validate_work_date(payload.work_date)
        project, post = self._validate_project_post(payload.project_id, payload.post_id)
        self._validate_participants(payload.participants, context="groep")
        participants = [self._participant_entity(p, current) for p in payload.participants]
        group = WorkHourGroup(
            work_date=payload.work_date,
            project_id=project.id,
            post_id=post.id,
            description=payload.description,
            duration_half_hours=payload.duration_half_hours,
            created_by_user_id=current.id,
            updated_by_user_id=current.id,
        )
        try:
            self.repo.db.add(group)
            self.repo.db.flush()
            for index, participant in enumerate(participants):
                participant.group_id = group.id
                participant.sort_order = index if participant.sort_order is None else participant.sort_order
                self._set_active_identity_key(participant)
                self.repo.db.add(participant)
            self.repo.db.flush()
            self._log(event_type="work_hours.group.created", actor=current, target_type="group", target_id=group.id, before=None, after=self._full_group_snapshot(group), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=422, detail="participants: ongeldige deelnemer-reference") from exc
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(group)
        group = self.repo.get_group(group.id, include_deleted=True) or group
        return self._group_to_admin_response(group) if current.is_admin else self._group_to_response(group)

    @staticmethod
    def _same_participant_reference(existing: WorkHourGroupParticipant, payload: WorkHourParticipantUpdateRequest) -> bool:
        return (
            existing.participant_kind == payload.participant_kind
            and existing.user_id == payload.user_id
            and existing.external_person_id == payload.external_person_id
            and existing.historical_identity_id == payload.historical_identity_id
        )

    def _validate_patch_participants(
        self,
        payloads: list[WorkHourParticipantUpdateRequest],
        existing: dict[str, WorkHourGroupParticipant],
        current: User,
    ) -> list[tuple[WorkHourParticipantUpdateRequest, WorkHourGroupParticipant | None]]:
        if not payloads:
            raise HTTPException(status_code=422, detail="groep: voeg minimaal één deelnemer toe")
        seen_ids: set[str] = set()
        validated: list[tuple[WorkHourParticipantUpdateRequest, WorkHourGroupParticipant | None]] = []
        for index, payload in enumerate(payloads):
            context = f"participants[{index}]"
            current_participant = existing.get(payload.id) if payload.id else None
            if payload.id and current_participant is None:
                raise HTTPException(status_code=422, detail=f"{context}.id: deelnemer hoort niet bij deze groep")
            if payload.id and payload.id in seen_ids:
                raise HTTPException(status_code=422, detail=f"{context}.id: dubbele deelnemer")
            if payload.id:
                seen_ids.add(payload.id)

            if current_participant is not None and payload.participant_kind is None and self._participant_reference_count(payload) == 0:
                validated.append((payload, current_participant))
                continue
            self._validate_participant_identity(payload, context=context)
            if payload.display_name_snapshot is None or payload.display_type_snapshot is None:
                raise HTTPException(status_code=422, detail=f"{context}: display snapshot ontbreekt")

            unchanged = current_participant is not None and self._same_participant_reference(current_participant, payload)
            if unchanged:
                target_selectable = False
                if current_participant.participant_kind == "live_user" and current_participant.user_id:
                    user = self.repo.get_user(current_participant.user_id)
                    target_selectable = bool(user and user.is_active)
                elif current_participant.participant_kind == "external_person" and current_participant.external_person_id:
                    person = self.repo.get_external_person(current_participant.external_person_id)
                    target_selectable = bool(person and person.is_active and person.deleted_at is None)
                if not target_selectable and (
                    (payload.display_name_snapshot is not None and current_participant.display_name_snapshot != payload.display_name_snapshot)
                    or (payload.display_email_snapshot is not None and current_participant.display_email_snapshot != payload.display_email_snapshot)
                    or (payload.display_type_snapshot is not None and current_participant.display_type_snapshot != payload.display_type_snapshot)
                ):
                    raise HTTPException(status_code=422, detail=f"{context}: historische of inactieve deelnemer is alleen-lezen")
                validated.append((payload, current_participant))
                continue
            # Building the entity performs existence and selectability checks without writing.
            validated.append((payload, self._participant_entity(payload, current)))
        identity_keys: set[str] = set()
        for index, (payload, current_participant) in enumerate(validated):
            kind = payload.participant_kind or (current_participant.participant_kind if current_participant else "")
            user_id = payload.user_id if payload.participant_kind else (current_participant.user_id if current_participant else None)
            external_id = payload.external_person_id if payload.participant_kind else (current_participant.external_person_id if current_participant else None)
            historical_id = payload.historical_identity_id if payload.participant_kind else (current_participant.historical_identity_id if current_participant else None)
            key = self._identity_key(kind, user_id, external_id, historical_id)
            if key in identity_keys:
                raise HTTPException(status_code=422, detail=f"participants[{index}]: dubbele deelnemer")
            identity_keys.add(key)
        return validated

    def update_group(self, current: User, group_id: str, payload: WorkHourGroupUpdateRequest) -> WorkHourGroupResponse:
        group = self.repo.get_group(group_id, include_deleted=True)
        if not group:
            raise HTTPException(status_code=404, detail="Registratie niet gevonden")
        if group.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Herstel de registratie eerst voordat je deze wijzigt")
        before = self._full_group_snapshot(group)
        project_id = payload.project_id or group.project_id
        post_id = payload.post_id or group.post_id
        self._validate_project_post(
            project_id,
            post_id,
            allow_unchanged=(group.project_id, group.post_id),
        )
        existing = {participant.id: participant for participant in group.participants if participant.deleted_at is None}
        validated_participants = self._validate_patch_participants(payload.participants, existing, current) if payload.participants is not None else None

        if payload.work_date is not None:
            self._validate_work_date(payload.work_date)
        group.row_version = self._require_expected_version(WorkHourGroup, group.id, payload.expected_row_version)

        if payload.work_date is not None:
            group.work_date = payload.work_date
        if payload.project_id or payload.post_id:
            group.project_id = project_id
            group.post_id = post_id
        if payload.description is not None:
            group.description = payload.description.strip()
        if payload.duration_half_hours is not None:
            group.duration_half_hours = payload.duration_half_hours
        pending_audits: list[tuple[str, WorkHourGroupParticipant]] = []
        if validated_participants is not None:
            added_participants: list[WorkHourGroupParticipant] = []
            removed_participants: list[WorkHourGroupParticipant] = []
            for participant_payload, validated_entity in validated_participants:
                if participant_payload.id:
                    participant = existing[participant_payload.id]
                    if participant_payload.participant_kind is not None:
                        participant.participant_kind = participant_payload.participant_kind
                        participant.user_id = participant_payload.user_id
                        participant.external_person_id = participant_payload.external_person_id
                        participant.historical_identity_id = participant_payload.historical_identity_id
                    if participant_payload.display_name_snapshot is not None:
                        participant.display_name_snapshot = participant_payload.display_name_snapshot
                    if participant_payload.display_email_snapshot is not None:
                        participant.display_email_snapshot = participant_payload.display_email_snapshot
                    if participant_payload.display_type_snapshot is not None:
                        participant.display_type_snapshot = participant_payload.display_type_snapshot
                    participant.sort_order = participant_payload.sort_order
                    participant.updated_by_user_id = current.id
                    self._bump_version(participant)
                    self._set_active_identity_key(participant)
                else:
                    assert validated_entity is not None
                    participant = validated_entity
                    self._set_active_identity_key(participant)
                    group.participants.append(participant)
                    added_participants.append(participant)
            removed_ids = set(existing) - {item.id for item in payload.participants if item.id}
            for removed_id in removed_ids:
                participant = existing[removed_id]
                participant.deleted_at = _now()
                participant.updated_at = participant.deleted_at
                participant.deleted_by_user_id = current.id
                self._bump_version(participant)
                self._set_active_identity_key(participant)
                removed_participants.append(participant)
            pending_audits.extend(("added", participant) for participant in added_participants)
            pending_audits.extend(("removed", participant) for participant in removed_participants)
        group.updated_by_user_id = current.id
        self.repo.db.add(group)
        try:
            self.repo.db.flush()
            for action, participant in pending_audits:
                self._log(
                    event_type=f"work_hours.group.participant.{action}",
                    actor=current,
                    target_type="group_participant",
                    target_id=participant.id,
                    before={"deleted_at": str(participant.deleted_at)} if action == "removed" else None,
                    after={"participant_kind": participant.participant_kind} if action == "added" else None,
                    commit=False,
                )
            self.repo.db.flush()
            self._log(event_type="work_hours.group.updated", actor=current, target_type="group", target_id=group.id, before=before, after=self._full_group_snapshot(group), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=422, detail="participants: ongeldige deelnemer-reference") from exc
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(group)
        group = self.repo.get_group(group.id, include_deleted=True) or group
        return self._group_to_admin_response(group) if current.is_admin else self._group_to_response(group)

    def delete_group(self, current: User, group_id: str, expected_row_version: int | None) -> dict[str, str]:
        group = self.repo.get_group(group_id, include_deleted=True)
        if not group:
            raise HTTPException(status_code=404, detail="Registratie niet gevonden")
        if group.deleted_at is not None:
            raise HTTPException(status_code=409, detail="Registratie is al verwijderd")
        before = self._full_group_snapshot(group)
        group.row_version = self._require_expected_version(WorkHourGroup, group.id, expected_row_version)
        deletion_time = _now()
        group.updated_at = deletion_time
        group.deleted_at = deletion_time
        group.deleted_by_user_id = current.id
        for participant in group.participants:
            if participant.deleted_at is None:
                participant.deleted_at = deletion_time
                participant.updated_at = deletion_time
                participant.deleted_by_user_id = current.id
                self._bump_version(participant)
                self._set_active_identity_key(participant)
        try:
            self.repo.db.add(group)
            self.repo.db.flush()
            self._log(event_type="work_hours.group.deleted", actor=current, target_type="group", target_id=group.id, before=before, after=self._full_group_snapshot(group), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            raise
        return {"status": "deleted"}

    def restore_group(self, current: User, group_id: str, expected_row_version: int | None) -> WorkHourGroupResponse:
        self._ensure_admin(current)
        group = self.repo.get_group(group_id, include_deleted=True)
        if not group:
            raise HTTPException(status_code=404, detail="Registratie niet gevonden")
        if group.deleted_at is None:
            raise HTTPException(status_code=409, detail="Registratie is niet verwijderd")
        self._validate_project_post(group.project_id, group.post_id)
        before = self._full_group_snapshot(group)
        group.row_version = self._require_expected_version(WorkHourGroup, group.id, expected_row_version)
        group_deleted_at = group.deleted_at
        group_deleted_by = group.deleted_by_user_id
        group.deleted_at = None
        group.deleted_by_user_id = None
        for participant in group.participants:
            if participant.deleted_at == group_deleted_at and participant.deleted_by_user_id == group_deleted_by:
                participant.deleted_at = None
                participant.deleted_by_user_id = None
                self._bump_version(participant)
                self._set_active_identity_key(participant)
        self.repo.db.add(group)
        try:
            self.repo.db.flush()
            self._log(event_type="work_hours.group.restored", actor=current, target_type="group", target_id=group.id, before=before, after=self._full_group_snapshot(group), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=409, detail="Deelnemer bestaat al in deze groep") from exc
        except Exception:
            self.repo.db.rollback()
            raise
        group = self.repo.get_group(group.id, include_deleted=True) or group
        return self._group_to_admin_response(group) if current.is_admin else self._group_to_response(group)

    def create_external_person(self, current: User, payload: WorkExternalPersonCreateRequest) -> WorkExternalPersonResponse:
        normalized_name = _normalize(payload.display_name)
        normalized_email = _normalize(payload.email)
        candidates = [
            person
            for person in self.repo.list_external_people(include_deleted=True)
            if person.normalized_name == normalized_name or (normalized_email and person.normalized_email == normalized_email)
        ]
        hard_candidates = [
            person for person in candidates
            if normalized_email and person.normalized_email == normalized_email
        ]
        advisory_candidates = [person for person in candidates if person not in hard_candidates]
        if hard_candidates:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "work_hours_external_person_hard_conflict",
                    "message": "Dit e-mailadres hoort al bij een externe persoon.",
                    "candidates": [self._duplicate_candidate_payload(person, current) for person in candidates],
                },
            )
        if advisory_candidates and not payload.force_create:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Mogelijke dubbele externe persoon",
                    "code": "work_hours_external_person_advisory_conflict",
                    "candidates": [self._duplicate_candidate_payload(person, current) for person in advisory_candidates],
                },
            )
        person = WorkExternalPerson(
            display_name=payload.display_name,
            normalized_name=normalized_name,
            email=payload.email,
            normalized_email=normalized_email or None,
            note=payload.note,
            is_active=True,
            created_by_user_id=current.id,
            updated_by_user_id=current.id,
        )
        try:
            self.repo.db.add(person)
            self.repo.db.flush()
            self._log(event_type="work_hours.external_person.created", actor=current, target_type="external_person", target_id=person.id, after=self._person_to_response(person).model_dump(), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=409, detail={"code": "work_hours_external_person_hard_conflict", "message": "Deze externe persoon bestaat al."}) from exc
        return self._person_to_response(person)

    def update_external_person(self, current: User, person_id: str, payload: WorkExternalPersonUpdateRequest) -> WorkExternalPersonResponse:
        self._ensure_admin(current)
        person = self.repo.get_external_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Externe persoon niet gevonden")
        if person.deleted_at is not None:
            raise HTTPException(status_code=422, detail="Herstel de externe persoon vóór een profielwijziging")
        next_email = payload.email if payload.email is not None else person.email
        normalized_email = _normalize(next_email) or None
        if normalized_email and any(
            candidate.id != person.id and candidate.normalized_email == normalized_email
            for candidate in self.repo.list_external_people(include_deleted=True)
        ):
            raise HTTPException(status_code=409, detail={"code": "work_hours_external_person_hard_conflict", "message": "Dit e-mailadres hoort al bij een externe persoon."})
        before = self._person_to_response(person).model_dump()
        person.row_version = self._require_expected_version(WorkExternalPerson, person.id, payload.expected_row_version)
        if payload.display_name is not None:
            person.display_name = payload.display_name
            person.normalized_name = _normalize(payload.display_name)
        if payload.email is not None:
            person.email = payload.email
            person.normalized_email = normalized_email
        if payload.note is not None:
            person.note = payload.note
        person.updated_by_user_id = current.id
        self.repo.db.add(person)
        try:
            self.repo.db.flush()
            self._log(event_type="work_hours.external_person.updated", actor=current, target_type="external_person", target_id=person.id, before=before, after=self._person_to_response(person).model_dump(), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=409, detail={"code": "work_hours_external_person_hard_conflict", "message": "Dit e-mailadres hoort al bij een externe persoon."}) from exc
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(person)
        return self._person_to_response(person)

    def set_external_person_active(self, current: User, person_id: str, expected_row_version: int | None, *, active: bool) -> WorkExternalPersonResponse:
        self._ensure_admin(current)
        person = self.repo.get_external_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Externe persoon niet gevonden")
        if person.deleted_at is not None:
            raise HTTPException(status_code=422, detail="Een verwijderde persoon moet eerst worden hersteld")
        before = self._person_to_response(person).model_dump()
        person.row_version = self._require_expected_version(WorkExternalPerson, person.id, expected_row_version)
        person.is_active = active
        person.updated_by_user_id = current.id
        try:
            self.repo.db.add(person)
            self.repo.db.flush()
            self._log(event_type=f"work_hours.external_person.{'activated' if active else 'deactivated'}", actor=current, target_type="external_person", target_id=person.id, before=before, after=self._person_to_response(person).model_dump(), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(person)
        return self._person_to_response(person)

    def archive_external_person(self, current: User, person_id: str, expected_row_version: int | None) -> WorkExternalPersonResponse:
        self._ensure_admin(current)
        person = self.repo.get_external_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Externe persoon niet gevonden")
        before = self._person_to_response(person).model_dump()
        person.row_version = self._require_expected_version(WorkExternalPerson, person.id, expected_row_version)
        person.is_active = False
        person.deleted_at = _now()
        person.updated_at = person.deleted_at
        person.deleted_by_user_id = current.id
        person.updated_by_user_id = current.id
        try:
            self.repo.db.add(person)
            self.repo.db.flush()
            self._log(event_type="work_hours.external_person.archived", actor=current, target_type="external_person", target_id=person.id, before=before, after=self._person_to_response(person).model_dump(), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(person)
        return self._person_to_response(person)

    def restore_external_person(self, current: User, person_id: str, expected_row_version: int | None) -> WorkExternalPersonResponse:
        self._ensure_admin(current)
        person = self.repo.get_external_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Externe persoon niet gevonden")
        before = self._person_to_response(person).model_dump()
        person.row_version = self._require_expected_version(WorkExternalPerson, person.id, expected_row_version)
        person.deleted_at = None
        person.deleted_by_user_id = None
        person.is_active = True
        person.updated_by_user_id = current.id
        try:
            self.repo.db.add(person)
            self.repo.db.flush()
            self._log(event_type="work_hours.external_person.restored", actor=current, target_type="external_person", target_id=person.id, before=before, after=self._person_to_response(person).model_dump(), commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=409, detail={"code": "work_hours_external_person_hard_conflict", "message": "Herstel botst met een bestaande externe persoon."}) from exc
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(person)
        return self._person_to_response(person)

    def merge_external_person(self, current: User, person_id: str, payload: WorkExternalPersonMergeRequest) -> WorkExternalPersonResponse:
        self._ensure_admin(current)
        source = self.repo.get_external_person(person_id)
        target = self.repo.get_external_person(payload.target_id)
        if not source or not target:
            raise HTTPException(status_code=404, detail="Externe persoon niet gevonden")
        if source.id == target.id or (
            source.normalized_name == target.normalized_name and (source.normalized_email or "") == (target.normalized_email or "")
        ):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Een externe persoon kan niet met zichzelf worden samengevoegd")
        affected = list(self.repo.db.query(WorkHourGroupParticipant).filter(WorkHourGroupParticipant.external_person_id == source.id))
        target_group_ids = {
            item.group_id for item in self.repo.db.query(WorkHourGroupParticipant).filter(
                WorkHourGroupParticipant.external_person_id == target.id,
                WorkHourGroupParticipant.deleted_at.is_(None),
            )
        }
        if any(item.deleted_at is None and item.group_id in target_group_ids for item in affected):
            raise HTTPException(status_code=409, detail={"code": "work_hours_external_merge_participant_collision", "message": "Bron en doel staan al in dezelfde registratie."})
        before_children = [self._full_participant_snapshot(item) for item in affected]
        before = {"source": self._person_to_response(source).model_dump(), "target": self._person_to_response(target).model_dump(), "participants": before_children}
        source.row_version = self._require_expected_version(WorkExternalPerson, source.id, payload.expected_source_row_version)
        target.row_version = self._require_expected_version(WorkExternalPerson, target.id, payload.expected_target_row_version)
        for participant in affected:
            participant.external_person_id = target.id
            participant.updated_by_user_id = current.id
            self._bump_version(participant)
        source.is_active = False
        source.deleted_at = _now()
        source.updated_at = source.deleted_at
        source.deleted_by_user_id = current.id
        source.updated_by_user_id = current.id
        source.note = payload.note or source.note
        self.repo.db.add(source)
        try:
            self.repo.db.flush()
            self._log(event_type="work_hours.external_person.merged", actor=current, target_type="external_person", target_id=source.id, before=before, after={"source": self._person_to_response(source).model_dump(), "target": self._person_to_response(target).model_dump(), "participants": [self._full_participant_snapshot(item) for item in affected]}, commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=409, detail="Samenvoegen zou een dubbele deelnemer veroorzaken") from exc
        except Exception:
            self.repo.db.rollback()
            raise
        self.repo.db.refresh(target)
        return self._person_to_response(target)

    def create_project(self, current: User, payload: WorkProjectCreateRequest) -> WorkProjectResponse:
        self._ensure_admin(current)
        if self._project_name_conflicts(payload.name):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Projectnaam bestaat al"})
        project = Project(name=payload.name, description=payload.description)
        try:
            self.repo.db.add(project)
            self.repo.db.flush()
            self._log(event_type="work_hours.project.created", actor=current, target_type="project", target_id=project.id, after=self._project_to_response(project).model_dump(), commit=False)
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Projectnaam bestaat al"}) from exc
        return self._project_to_response(project)

    def update_project(self, current: User, project_id: str, payload: WorkProjectUpdateRequest) -> WorkProjectResponse:
        self._ensure_admin(current)
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        if payload.name is not None and self._project_name_conflicts(payload.name, exclude_project_id=project.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Projectnaam bestaat al"})
        before = self._project_to_response(project).model_dump()
        if payload.name is not None:
            project.name = payload.name.strip()
        if payload.description is not None:
            project.description = payload.description.strip()
        self.repo.db.add(project)
        try:
            self._log(event_type="work_hours.project.updated", actor=current, target_type="project", target_id=project.id, before=before, after=self._project_to_response(project).model_dump(), commit=False)
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Projectnaam bestaat al"}) from exc
        return self._project_to_response(project)

    def archive_project(self, current: User, project_id: str, expected_row_version: int | None) -> WorkProjectResponse:
        self._ensure_admin(current)
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        before = self._project_to_response(project).model_dump()
        del expected_row_version
        project.is_active = False
        project.is_archived = True
        self.repo.db.add(project)
        self._log(event_type="work_hours.project.archived", actor=current, target_type="project", target_id=project.id, before=before, after=self._project_to_response(project).model_dump(), commit=False)
        self.repo.db.commit()
        return self._project_to_response(project)

    def restore_project(self, current: User, project_id: str, expected_row_version: int | None) -> WorkProjectResponse:
        self._ensure_admin(current)
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        if self._project_name_conflicts(project.name, exclude_project_id=project.id):
            raise HTTPException(status_code=409, detail={"message": "Projectnaam bestaat al"})
        before = self._project_to_response(project).model_dump()
        del expected_row_version
        project.is_active = True
        project.is_archived = False
        self.repo.db.add(project)
        self._log(event_type="work_hours.project.restored", actor=current, target_type="project", target_id=project.id, before=before, after=self._project_to_response(project).model_dump(), commit=False)
        self.repo.db.commit()
        return self._project_to_response(project)

    def delete_project(self, current: User, project_id: str, expected_row_version: int | None) -> dict[str, str]:
        self._ensure_admin(current)
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        before = self._project_to_response(project).model_dump()
        del expected_row_version
        project.is_active = False
        project.is_archived = True
        try:
            self.repo.db.add(project)
            self._log(event_type="work_hours.project.deleted", actor=current, target_type="project", target_id=project.id, before=before, after=self._project_to_response(project).model_dump(), commit=False)
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            raise
        return {"status": "deleted"}

    def create_post(self, current: User, payload: WorkPostCreateRequest) -> WorkPostResponse:
        self._ensure_admin(current)
        if self._post_name_conflicts(payload.name):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al"})
        post = WorkPost(name=payload.name, normalized_name=_normalize(payload.name), description=payload.description, created_by_user_id=current.id, updated_by_user_id=current.id)
        try:
            self.repo.db.add(post)
            self.repo.db.flush()
            self._log(event_type="work_hours.post.created", actor=current, target_type="post", target_id=post.id, after=self._post_to_response(post).model_dump(), commit=False)
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al"}) from exc
        return self._post_to_response(post)

    def update_post(self, current: User, post_id: str, payload: WorkPostUpdateRequest) -> WorkPostResponse:
        self._ensure_admin(current)
        post = self.repo.get_post(post_id)
        if not post:
            raise HTTPException(status_code=404, detail="Post niet gevonden")
        if payload.name is not None and self._post_name_conflicts(payload.name, exclude_post_id=post.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al"})
        before = self._post_to_response(post).model_dump()
        post.row_version = self._require_expected_version(WorkPost, post.id, payload.expected_row_version)
        if payload.name is not None:
            post.name = payload.name.strip()
            post.normalized_name = _normalize(payload.name)
        if payload.description is not None:
            post.description = payload.description.strip()
        post.updated_by_user_id = current.id
        self.repo.db.add(post)
        try:
            self._log(event_type="work_hours.post.updated", actor=current, target_type="post", target_id=post.id, before=before, after=self._post_to_response(post).model_dump(), commit=False)
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al"}) from exc
        return self._post_to_response(post)

    def archive_post(self, current: User, post_id: str, expected_row_version: int | None) -> WorkPostResponse:
        self._ensure_admin(current)
        post = self.repo.get_post(post_id)
        if not post:
            raise HTTPException(status_code=404, detail="Post niet gevonden")
        if post.deleted_at is not None:
            raise HTTPException(status_code=422, detail="Een verwijderde post kan niet worden gearchiveerd")
        before = self._post_to_response(post).model_dump()
        post.row_version = self._require_expected_version(WorkPost, post.id, expected_row_version)
        post.is_active = False
        post.is_archived = True
        post.archived_at = _now()
        post.updated_at = post.archived_at
        post.archived_by_user_id = current.id
        post.updated_by_user_id = current.id
        self.repo.db.add(post)
        self._log(event_type="work_hours.post.archived", actor=current, target_type="post", target_id=post.id, before=before, after=self._post_to_response(post).model_dump(), commit=False)
        self.repo.db.commit()
        return self._post_to_response(post)

    def restore_post(self, current: User, post_id: str, expected_row_version: int | None) -> WorkPostResponse:
        self._ensure_admin(current)
        post = self.repo.get_post(post_id)
        if not post:
            raise HTTPException(status_code=404, detail="Post niet gevonden")
        if self._post_name_conflicts(post.name, exclude_post_id=post.id):
            raise HTTPException(status_code=409, detail={"message": "Postnaam bestaat al"})
        before = self._post_to_response(post).model_dump()
        post.row_version = self._require_expected_version(WorkPost, post.id, expected_row_version)
        if post.deleted_at is not None:
            was_archived = post.is_archived
            post.deleted_at = None
            post.deleted_by_user_id = None
            post.is_active = not was_archived
        else:
            post.is_active = True
            post.is_archived = False
            post.archived_at = None
            post.archived_by_user_id = None
        post.updated_by_user_id = current.id
        self.repo.db.add(post)
        self._log(event_type="work_hours.post.restored", actor=current, target_type="post", target_id=post.id, before=before, after=self._post_to_response(post).model_dump(), commit=False)
        self.repo.db.commit()
        return self._post_to_response(post)

    def delete_post(self, current: User, post_id: str, expected_row_version: int | None) -> dict[str, str]:
        self._ensure_admin(current)
        post = self.repo.get_post(post_id)
        if not post:
            raise HTTPException(status_code=404, detail="Post niet gevonden")
        if post.deleted_at is not None:
            raise HTTPException(status_code=409, detail="Post is al verwijderd")
        before = self._post_to_response(post).model_dump()
        post.row_version = self._require_expected_version(WorkPost, post.id, expected_row_version)
        post.is_active = False
        post.deleted_at = _now()
        post.updated_at = post.deleted_at
        post.deleted_by_user_id = current.id
        post.updated_by_user_id = current.id
        try:
            self.repo.db.add(post)
            self._log(event_type="work_hours.post.deleted", actor=current, target_type="post", target_id=post.id, before=before, after=self._post_to_response(post).model_dump(), commit=False)
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            raise
        return {"status": "deleted"}

    def export_csv(self, query: WorkHoursListQuery) -> bytes:
        filters = self._query_filters(query)
        if query.sort_key not in SORT_KEYS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ongeldige sorteersleutel")
        if query.sort_direction not in {"asc", "desc"}:
            raise HTTPException(status_code=422, detail="Ongeldige sorteervolgorde")
        if query.participant_kind not in {None, "live_user", "external_person", "historical_identity"}:
            raise HTTPException(status_code=422, detail="Ongeldig persoonstype")
        groups = self.repo.list_groups(filters)
        buffer = StringIO()
        writer = csv.writer(buffer, delimiter=";", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            "registratie-id",
            "datum",
            "naam persoon",
            "type persoon (WindWilly-gebruiker/extern)",
            "project",
            "post",
            "aantal uren",
            "beschrijving",
            "aangemaakt door",
            "aangemaakt op",
            "laatst gewijzigd door",
            "laatst gewijzigd op",
        ])
        for group in groups:
            created_by = _display_name_for_user(group.created_by)
            updated_by = _display_name_for_user(group.updated_by)
            created_at = self._format_csv_timestamp(group.created_at)
            updated_at = self._format_csv_timestamp(group.updated_at)
            for participant in group.participants:
                include_group_deleted_child = bool(
                    query.deleted_only and group.deleted_at is not None
                    and participant.deleted_at == group.deleted_at
                    and participant.deleted_by_user_id == group.deleted_by_user_id
                )
                if participant.deleted_at is not None and not include_group_deleted_child:
                    continue
                writer.writerow([
                    group.id,
                    _work_date(group.work_date).strftime("%d-%m-%Y"),
                    self._safe_csv(participant.display_name_snapshot),
                    self._safe_csv(participant.display_type_snapshot),
                    self._safe_csv(group.project.name if group.project else ""),
                    self._safe_csv(group.post.name if group.post else ""),
                    f"{group.duration_half_hours / 2:g}",
                    self._safe_csv(group.description),
                    self._safe_csv(created_by),
                    created_at,
                    self._safe_csv(updated_by),
                    updated_at,
                ])
        return ("\ufeff" + buffer.getvalue()).encode("utf-8")

    @staticmethod
    def _format_csv_timestamp(value: datetime) -> str:
        timestamp = value if value.tzinfo else value.replace(tzinfo=UTC)
        return timestamp.astimezone(AMSTERDAM_TZ).strftime("%d-%m-%Y, %H:%M")

    @staticmethod
    def _safe_csv(value: str) -> str:
        text = str(value or "")
        if text[:1] in {"=", "+", "-", "@"}:
            return f"'{text}"
        return text
