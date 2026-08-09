from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, date
from io import StringIO
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import IntegrityError

from app.core.settings import get_settings
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
    WorkImportCommitResponse,
    WorkImportEnvelope,
    WorkImportPreviewResponse,
    WorkImportGroupSnapshot,
    WorkImportParticipantSnapshot,
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
    WorkImportSourceBatchSnapshot,
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
    return " ".join((value or "").strip().split()).casefold()


def _work_date(value: date | datetime) -> date:
    return value.date() if isinstance(value, datetime) else value


@dataclass(slots=True)
class WorkHoursListQuery:
    work_date: date | None = None
    project_id: str | None = None
    post_id: str | None = None
    participant_kind: str | None = None
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

    def _project_to_response(self, project: WorkProject) -> WorkProjectResponse:
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

    def _materialize_historical_identity(
        self,
        current: User,
        *,
        source_key: str,
        snapshot_name: str,
        snapshot_email: str | None,
        snapshot_display_label: str,
    ) -> WorkHistoricalUserIdentity:
        if not snapshot_name.strip() or (not source_key.strip() and not _normalize(snapshot_email)):
            raise HTTPException(status_code=422, detail="Ontbrekende gebruiker heeft onvoldoende snapshotmetadata")
        identities = self.repo.list_historical_identities(include_deleted=True)
        identity = next((item for item in identities if item.source_key == source_key), None)
        normalized_email = _normalize(snapshot_email)
        if identity is None and normalized_email:
            email_matches = [item for item in identities if _normalize(item.snapshot_email) == normalized_email]
            if len(email_matches) > 1:
                raise HTTPException(status_code=422, detail="Ontbrekende gebruiker heeft ambigue snapshotmetadata")
            identity = email_matches[0] if email_matches else None
        if identity:
            if (
                _normalize(identity.snapshot_name) != _normalize(snapshot_name)
                or (_normalize(identity.snapshot_email) and _normalize(identity.snapshot_email) != normalized_email)
            ):
                raise HTTPException(status_code=422, detail="Ontbrekende gebruiker heeft conflicterende snapshotmetadata")
            return identity

        identity = WorkHistoricalUserIdentity(
            source_key=source_key,
            snapshot_name=snapshot_name,
            snapshot_email=snapshot_email,
            snapshot_display_label=snapshot_display_label,
            is_active=True,
            created_by_user_id=current.id,
            updated_by_user_id=current.id,
        )
        self.repo.db.add(identity)
        self.repo.db.flush()
        return identity

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
            source_import_batch_id=group.source_import_batch_id,
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
            "post_id": group.post_id,
            "description": group.description,
            "duration_half_hours": group.duration_half_hours,
            "source_import_batch_id": group.source_import_batch_id,
            "participants": [
                self._full_participant_snapshot(participant)
                for participant in sorted(group.participants, key=lambda item: (item.sort_order, item.id))
            ],
        }

    def _validate_project_post(self, project_id: str, post_id: str, *, allow_unchanged: tuple[str, str] | None = None) -> tuple[WorkProject, WorkPost]:
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project niet gevonden")
        post = self.repo.get_post(post_id)
        if not post or post.project_id != project.id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Post hoort niet bij dit project")
        historical_unchanged = allow_unchanged == (project_id, post_id)
        if not historical_unchanged and (
            project.deleted_at is not None or not project.is_active or project.is_archived
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

    def _post_name_conflicts(self, project_id: str, name: str, *, exclude_post_id: str | None = None) -> bool:
        normalized_name = _normalize(name)
        return any(
            post.id != exclude_post_id and post.project_id == project_id and _normalize(post.name) == normalized_name
            for post in self.repo.list_posts(include_deleted=True, project_id=project_id)
        )

    def _participant_entity(
        self,
        payload: WorkHourParticipantCreateRequest | WorkImportParticipantSnapshot,
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
    def _participant_reference_count(payload: WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest | WorkImportParticipantSnapshot) -> int:
        return sum(1 for value in (payload.user_id, payload.external_person_id, payload.historical_identity_id) if value)

    @staticmethod
    def _participant_expected_kind(payload: WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest | WorkImportParticipantSnapshot) -> str | None:
        if payload.user_id:
            return "live_user"
        if payload.external_person_id:
            return "external_person"
        if payload.historical_identity_id:
            return "historical_identity"
        return None

    def _validate_participant_identity(self, payload: WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest | WorkImportParticipantSnapshot, *, context: str) -> None:
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

    def _validate_participants(self, participants: list[WorkHourParticipantCreateRequest | WorkHourParticipantUpdateRequest | WorkImportParticipantSnapshot] | None, *, context: str) -> None:
        if not participants:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: voeg minimaal één deelnemer toe")
        for participant in participants:
            if participant.participant_kind == "live_user" and self._participant_reference_count(participant) == 0:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: Gebruiker ontbreekt")
            self._validate_participant_identity(participant, context=context)
        self._validate_unique_participants(participants, context=f"{context}.participants")

    def _validate_import_participants(
        self,
        participants: list[WorkImportParticipantSnapshot] | None,
        *,
        context: str,
        external_person_ids: set[str],
        historical_identity_ids: set[str],
    ) -> None:
        if not participants:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: voeg minimaal één deelnemer toe")
        for participant in participants:
            if participant.participant_kind == "live_user" and self._participant_reference_count(participant) == 0:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{context}: Gebruiker ontbreekt")
            self._validate_participant_identity(participant, context=context)
            if participant.participant_kind == "live_user":
                self._validate_live_user_reference(participant.user_id, context=context, missing_detail="Gebruiker ontbreekt")
            elif participant.participant_kind == "external_person":
                if participant.external_person_id not in external_person_ids:
                    raise HTTPException(status_code=422, detail=f"{context}: onbekende externe persoon")
            elif participant.participant_kind == "historical_identity":
                if participant.historical_identity_id not in historical_identity_ids:
                    raise HTTPException(status_code=422, detail=f"{context}: onbekende historische identiteit")

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
            "query": query.query,
            "include_deleted": query.include_deleted,
            "deleted_only": query.deleted_only,
            "sort_key": query.sort_key,
            "sort_direction": query.sort_direction,
        }

    @staticmethod
    def _import_payload_hash(payload: WorkImportEnvelope) -> str:
        return hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

    def _ensure_pre_import_backup(self, batch: WorkImportBatch, current: User, *, create: bool) -> Path:
        if batch.pre_import_backup_path:
            path = Path(batch.pre_import_backup_path)
            if path.exists():
                return path
            if not create:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pre-importbackup ontbreekt")
        if not create:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pre-importbackup ontbreekt")
        backup_path = self._backup_path(batch.id)
        temporary_path = backup_path.with_suffix(".tmp")
        backup_json = self._serialize_backup()
        temporary_path.write_text(backup_json, encoding="utf-8")
        try:
            batch.pre_import_backup_path = str(backup_path)
            self.repo.db.add(batch)
            self._log(
                event_type="work_hours.backup.created", actor=current,
                target_type="backup_artifact", target_id=batch.id,
                after={"status": "available", "counts": json.loads(batch.counts_json or "{}")},
                commit=False,
            )
            self.repo.db.flush()
            temporary_path.replace(backup_path)
            self.repo.db.commit()
        except Exception:
            self.repo.db.rollback()
            temporary_path.unlink(missing_ok=True)
            backup_path.unlink(missing_ok=True)
            raise
        return backup_path

    @staticmethod
    def _group_snapshot_conflicts(existing: WorkHourGroup, snapshot: WorkImportGroupSnapshot) -> list[str]:
        conflicts: list[str] = []
        if _work_date(existing.work_date) != snapshot.work_date:
            conflicts.append(f"groep {existing.id}: work_date")
        if existing.project_id != snapshot.project_id:
            conflicts.append(f"groep {existing.id}: project_id")
        if existing.post_id != snapshot.post_id:
            conflicts.append(f"groep {existing.id}: post_id")
        if (existing.description or "").strip() != snapshot.description.strip():
            conflicts.append(f"groep {existing.id}: description")
        if existing.duration_half_hours != snapshot.duration_half_hours:
            conflicts.append(f"groep {existing.id}: duration_half_hours")
        existing_participants = sorted(existing.participants, key=lambda item: (item.sort_order, item.id))
        snapshot_participants = sorted(snapshot.participants, key=lambda item: (item.sort_order, item.id or ""))
        if len(existing_participants) != len(snapshot_participants):
            conflicts.append(f"groep {existing.id}: participants")
            return conflicts
        for existing_participant, snapshot_participant in zip(existing_participants, snapshot_participants, strict=False):
            if snapshot_participant.id and existing_participant.id != snapshot_participant.id:
                conflicts.append(f"groep {existing.id}: participant_id")
                break
            if existing_participant.participant_kind != snapshot_participant.participant_kind:
                conflicts.append(f"groep {existing.id}: participant_kind")
                break
            if existing_participant.user_id != snapshot_participant.user_id:
                conflicts.append(f"groep {existing.id}: user_id")
                break
            if existing_participant.external_person_id != snapshot_participant.external_person_id:
                conflicts.append(f"groep {existing.id}: external_person_id")
                break
            if existing_participant.historical_identity_id != snapshot_participant.historical_identity_id:
                conflicts.append(f"groep {existing.id}: historical_identity_id")
                break
            if existing_participant.display_name_snapshot != snapshot_participant.display_name_snapshot:
                conflicts.append(f"groep {existing.id}: display_name_snapshot")
                break
            if existing_participant.display_email_snapshot != snapshot_participant.display_email_snapshot:
                conflicts.append(f"groep {existing.id}: display_email_snapshot")
                break
            if existing_participant.display_type_snapshot != snapshot_participant.display_type_snapshot:
                conflicts.append(f"groep {existing.id}: display_type_snapshot")
                break
            if existing_participant.deleted_at != snapshot_participant.deleted_at or existing_participant.deleted_by_user_id != snapshot_participant.deleted_by_user_id:
                conflicts.append(f"groep {existing.id}: participant_deleted_state")
                break
        return conflicts

    def _import_conflicts(self, envelope: WorkImportEnvelope, mode: str) -> list[str]:
        if mode != "merge":
            return []
        current = self.build_backup_envelope()
        conflicts: list[str] = []
        for collection in ("projects", "posts", "external_people", "historical_identities", "source_batches", "groups"):
            target_by_id = {item.id: item for item in getattr(current, collection)}
            for incoming in getattr(envelope, collection):
                target = target_by_id.get(incoming.id)
                if not target:
                    continue
                incoming_fields = incoming.model_dump(mode="python")
                target_fields = target.model_dump(mode="python")
                if collection == "groups":
                    for presentation_field in ("project_name", "post_name", "duration_hours", "person_count", "person_hours"):
                        incoming_fields.pop(presentation_field, None)
                        target_fields.pop(presentation_field, None)
                for field in sorted(set(incoming_fields) | set(target_fields)):
                    if self._equivalence_value(incoming_fields.get(field)) != self._equivalence_value(target_fields.get(field)):
                        conflicts.append(f"{collection}:{incoming.id}:{field}")
        # Keep conflict locations stable and caller-safe; values are never exposed.
        return conflicts

    @classmethod
    def _equivalence_value(cls, value):
        if isinstance(value, datetime):
            aware = value if value.tzinfo else value.replace(tzinfo=UTC)
            return aware.astimezone(UTC).isoformat(timespec="microseconds")
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: cls._equivalence_value(child) for key, child in sorted(value.items())}
        if isinstance(value, list):
            return [cls._equivalence_value(child) for child in value]
        return value

    @staticmethod
    def _normalize_email(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def _serialize_backup(self) -> str:
        return json.dumps(self.build_backup_envelope().model_dump(mode="json"), ensure_ascii=False, indent=2)

    @staticmethod
    def _envelope_metrics(payload: object) -> tuple[int, int]:
        max_depth = 0
        nodes = 0
        stack: list[tuple[object, int]] = [(payload, 0)]
        while stack:
            value, depth = stack.pop()
            nodes += 1
            max_depth = max(max_depth, depth)
            if isinstance(value, dict):
                stack.extend((child, depth + 1) for child in value.values())
            elif isinstance(value, list):
                stack.extend((child, depth + 1) for child in value)
        return max_depth, nodes

    @classmethod
    def validate_json_resource_limits(cls, payload: object) -> None:
        settings = get_settings()
        metrics_depth, metrics_nodes = cls._envelope_metrics(payload)
        errors = []
        if metrics_depth > settings.work_hours_import_max_depth:
            errors.append({"location": "$", "message": "maximale JSON-diepte overschreden"})
        if metrics_nodes > settings.work_hours_import_max_nodes:
            errors.append({"location": "$", "message": "maximaal aantal JSON-nodes overschreden"})
        if errors:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "work_hours_import_resource_limit", "errors": errors})

    def _validate_import_payload(self, envelope: WorkImportEnvelope, mode: str) -> None:
        self.validate_json_resource_limits(envelope.model_dump(mode="json"))
        self._validate_import_envelope(envelope, mode)

    def _find_project_by_name(self, name: str) -> WorkProject | None:
        normalized = _normalize(name)
        return next((project for project in self.repo.list_projects(include_deleted=True) if _normalize(project.name) == normalized), None)

    def _find_post_by_name(self, project_id: str, name: str) -> WorkPost | None:
        normalized = _normalize(name)
        return next((post for post in self.repo.list_posts(include_deleted=True, project_id=project_id) if _normalize(post.name) == normalized), None)

    def _find_external_person(self, display_name: str, email: str | None) -> WorkExternalPerson | None:
        normalized_name = _normalize(display_name)
        normalized_email = _normalize(email)
        for person in self.repo.list_external_people(include_deleted=True):
            if person.normalized_name == normalized_name and (not normalized_email or person.normalized_email == normalized_email):
                return person
        return None

    @staticmethod
    def _project_semantic_key(name: str) -> str:
        return _normalize(name)

    @staticmethod
    def _post_semantic_key(project_name: str, name: str) -> tuple[str, str]:
        return (_normalize(project_name), _normalize(name))

    @staticmethod
    def _person_semantic_key(display_name: str, email: str | None) -> tuple[str, str | None]:
        normalized_email = _normalize(email)
        return (_normalize(display_name), normalized_email or None)

    def _import_semantic_conflicts(self, envelope: WorkImportEnvelope, mode: str) -> list[dict[str, object]]:
        conflicts: list[dict[str, object]] = []
        existing_projects = self.repo.list_projects(include_deleted=True) if mode == "merge" else []
        existing_posts = self.repo.list_posts(include_deleted=True) if mode == "merge" else []
        existing_people = self.repo.list_external_people(include_deleted=True) if mode == "merge" else []

        project_name_by_id = {project.id: self._project_semantic_key(project.name) for project in existing_projects}
        project_name_by_id.update({project.id: self._project_semantic_key(project.name) for project in envelope.projects})

        existing_project_keys = {self._project_semantic_key(project.name): project.id for project in existing_projects}
        seen_project_keys: dict[str, str] = {}
        for project in envelope.projects:
            project_key = self._project_semantic_key(project.name)
            if project_key in seen_project_keys:
                conflicts.append({"entity_type": "project", "incoming_id": project.id, "existing_id": seen_project_keys[project_key], "conflict_fields": ["name"]})
            elif mode == "merge" and project_key in existing_project_keys and existing_project_keys[project_key] != project.id:
                conflicts.append({"entity_type": "project", "incoming_id": project.id, "existing_id": existing_project_keys[project_key], "conflict_fields": ["name"]})
            seen_project_keys[project_key] = project.id

        existing_post_keys = {
            self._post_semantic_key(project_name_by_id.get(post.project_id, ""), post.name): post.id
            for post in existing_posts
            if project_name_by_id.get(post.project_id)
        }
        seen_post_keys: dict[tuple[str, str], str] = {}
        for post in envelope.posts:
            project_name = project_name_by_id.get(post.project_id)
            if project_name is None:
                continue
            post_key = self._post_semantic_key(project_name, post.name)
            if post_key in seen_post_keys:
                conflicts.append({"entity_type": "post", "incoming_id": post.id, "existing_id": seen_post_keys[post_key], "conflict_fields": ["project_id", "name"]})
            elif mode == "merge" and post_key in existing_post_keys and existing_post_keys[post_key] != post.id:
                conflicts.append({"entity_type": "post", "incoming_id": post.id, "existing_id": existing_post_keys[post_key], "conflict_fields": ["project_id", "name"]})
            seen_post_keys[post_key] = post.id

        existing_names = {_normalize(person.display_name): person.id for person in existing_people}
        existing_emails = {_normalize(person.email): person.id for person in existing_people if _normalize(person.email)}
        seen_names: dict[str, str] = {}
        seen_emails: dict[str, str] = {}
        for person in envelope.external_people:
            name_key = _normalize(person.display_name)
            email_key = _normalize(person.email)
            matches: dict[str, list[str]] = {}
            name_match = seen_names.get(name_key) or (existing_names.get(name_key) if mode == "merge" else None)
            email_match = seen_emails.get(email_key) or (existing_emails.get(email_key) if mode == "merge" and email_key else None)
            if name_match and name_match != person.id:
                matches.setdefault(name_match, []).append("normalized_name")
            if email_match and email_match != person.id:
                matches.setdefault(email_match, []).append("normalized_email")
            for existing_id, fields in matches.items():
                conflicts.append({"entity_type": "external_person", "incoming_id": person.id, "existing_id": existing_id, "conflict_fields": fields})
            seen_names[name_key] = person.id
            if email_key:
                seen_emails[email_key] = person.id

        return conflicts

    @staticmethod
    def _semantic_conflict_detail(candidates: list[dict[str, object]]) -> dict[str, object]:
        counts = {
            "total": len(candidates),
            "projects": sum(item["entity_type"] == "project" for item in candidates),
            "posts": sum(item["entity_type"] == "post" for item in candidates),
            "external_people": sum(item["entity_type"] == "external_person" for item in candidates),
        }
        return {
            "code": "work_hours_import_semantic_conflict",
            "message": "De import bevat gegevens die al onder een andere identificatie bestaan.",
            "counts": counts,
            "candidates": candidates,
        }

    def _raise_semantic_conflict(self, candidates: list[dict[str, object]]) -> None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=self._semantic_conflict_detail(candidates))

    def _validate_import_envelope(self, envelope: WorkImportEnvelope, mode: str) -> None:
        errors: list[dict[str, str]] = []
        project_by_id = {} if mode == "full_restore" else {project.id: project for project in self.repo.list_projects(include_deleted=True)}
        project_by_id.update({project.id: project for project in envelope.projects})
        post_by_id = {} if mode == "full_restore" else {post.id: post for post in self.repo.list_posts(include_deleted=True)}
        post_by_id.update({post.id: post for post in envelope.posts})
        external_person_ids = (set() if mode == "full_restore" else {person.id for person in self.repo.list_external_people(include_deleted=True)}) | {person.id for person in envelope.external_people}
        historical_identity_ids = (set() if mode == "full_restore" else {identity.id for identity in self.repo.list_historical_identities(include_deleted=True)}) | {identity.id for identity in envelope.historical_identities}
        source_batch_ids = {batch.id for batch in envelope.source_batches}
        source_batch_ids.update(batch.id for batch in self.repo.list_import_batches_by_ids({group.source_import_batch_id for group in envelope.groups if group.source_import_batch_id}))
        actor_ids = {user.id for user in self.repo.list_active_users()}
        actor_ids.update(user.id for user in self.repo.db.query(User).all())

        def add(location: str, message: str) -> None:
            errors.append({"location": location, "message": message})

        def validate_event_coherence(record, location: str, *, archive: bool = False, link: bool = False) -> None:
            if int(getattr(record, "row_version", 0) or 0) < 1:
                add(f"{location}.row_version", "versie moet positief zijn")
            created_at = getattr(record, "created_at", None)
            updated_at = getattr(record, "updated_at", None)
            created_by = getattr(record, "created_by_user_id", None)
            updated_by = getattr(record, "updated_by_user_id", None)
            if bool(created_at) != bool(created_by):
                add(location, "create-actor en timestamp moeten samen aanwezig zijn")
            if bool(updated_at) != bool(updated_by):
                add(location, "update-actor en timestamp moeten samen aanwezig zijn")
            if created_at and updated_at and updated_at < created_at:
                add(f"{location}.updated_at", "update mag niet vóór create liggen")
            event_names = (["archived"] if archive else []) + ["deleted"] + (["linked"] if link else [])
            for name in event_names:
                timestamp = getattr(record, f"{name}_at", None)
                actor = getattr(record, f"{name}_by_user_id", None)
                if bool(timestamp) != bool(actor):
                    add(location, f"{name}-actor en timestamp moeten samen aanwezig zijn")
                if created_at and timestamp and timestamp < created_at:
                    add(f"{location}.{name}_at", f"{name} mag niet vóór create liggen")
                if updated_at and timestamp and timestamp < updated_at:
                    add(f"{location}.{name}_at", f"{name} mag niet vóór update liggen")
            for field in ("created_by_user_id", "updated_by_user_id", "archived_by_user_id", "deleted_by_user_id", "linked_by_user_id"):
                actor_id = getattr(record, field, None)
                if actor_id and actor_id not in actor_ids:
                    add(f"{location}.{field}", "onbekende actor")

        if envelope.format_version != "1.0":
            add("$.format_version", "onbekende formatversie")
        if envelope.backup_version not in {"1", "2"}:
            add("$.backup_version", "onbekende backupversie")

        def validate_uuid(location: str, value: str | None) -> None:
            if envelope.backup_version != "2" or value is None:
                return
            try:
                UUID(value)
            except (ValueError, AttributeError):
                add(location, "ongeldig UUID-formaat")

        for collection_name, records in (
            ("projects", envelope.projects),
            ("posts", envelope.posts),
            ("external_people", envelope.external_people),
            ("historical_identities", envelope.historical_identities),
            ("source_batches", envelope.source_batches),
            ("groups", envelope.groups),
        ):
            seen: set[str] = set()
            for index, record in enumerate(records):
                validate_uuid(f"$.{collection_name}[{index}].id", record.id)
                if record.id in seen:
                    add(f"$.{collection_name}[{index}].id", "dubbele ID")
                seen.add(record.id)

        for index, post in enumerate(envelope.posts):
            validate_uuid(f"$.posts[{index}].project_id", post.project_id)
            if post.project_id not in project_by_id:
                add(f"$.posts[{index}].project_id", "onbekend project")
            project = project_by_id.get(post.project_id)
            self._collect_masterdata_state_errors(post, f"$.posts[{index}]", add)
            validate_event_coherence(post, f"$.posts[{index}]", archive=True)
            if post.is_active and project and not self._is_selectable_masterdata(project):
                add(f"$.posts[{index}].is_active", "actieve post vereist een actief/selecteerbaar project")
        for index, project in enumerate(envelope.projects):
            self._collect_masterdata_state_errors(project, f"$.projects[{index}]", add)
            validate_event_coherence(project, f"$.projects[{index}]", archive=True)
        for index, person in enumerate(envelope.external_people):
            validate_event_coherence(person, f"$.external_people[{index}]")
            if bool(person.deleted_at) != bool(person.deleted_by_user_id):
                add(f"$.external_people[{index}]", "verwijderstatus is niet coherent")
            if person.is_active and person.deleted_at is not None:
                add(f"$.external_people[{index}].is_active", "actief kan niet samen met deleted")
        for index, batch in enumerate(envelope.source_batches):
            if batch.requested_by_user_id and batch.requested_by_user_id not in actor_ids:
                add(f"$.source_batches[{index}].requested_by_user_id", "onbekende actor")
        for index, identity in enumerate(envelope.historical_identities):
            validate_event_coherence(identity, f"$.historical_identities[{index}]", link=True)
            if identity.linked_user_id and identity.linked_user_id not in actor_ids:
                add(f"$.historical_identities[{index}].linked_user_id", "onbekende gebruiker")
            if identity.source_user_id and identity.source_user_id not in actor_ids:
                if str(identity.source_user_id) not in identity.source_key:
                    add(f"$.historical_identities[{index}].source_user_id", "ontbrekende brongebruiker is niet duurzaam in source_key vastgelegd")
            if identity.linked_by_user_id and identity.linked_by_user_id not in actor_ids:
                add(f"$.historical_identities[{index}].linked_by_user_id", "onbekende actor")
            linked_values = (identity.linked_user_id, identity.linked_at, identity.linked_by_user_id)
            if any(value is not None for value in linked_values) and not all(value is not None for value in linked_values):
                add(f"$.historical_identities[{index}]", "relinkvelden moeten volledig gevuld of volledig leeg zijn")
            if bool(identity.deleted_at) != bool(identity.deleted_by_user_id):
                add(f"$.historical_identities[{index}]", "verwijderstatus is niet coherent")
            if identity.is_active and identity.deleted_at is not None:
                add(f"$.historical_identities[{index}].is_active", "actief kan niet samen met deleted")

        all_participant_ids: set[str] = set()
        for group_index, group in enumerate(envelope.groups):
            location = f"$.groups[{group_index}]"
            validate_event_coherence(group, location)
            validate_uuid(f"{location}.project_id", group.project_id)
            validate_uuid(f"{location}.post_id", group.post_id)
            project = project_by_id.get(group.project_id)
            post = post_by_id.get(group.post_id)
            if not project:
                add(f"{location}.project_id", "onbekend project")
            if not post:
                add(f"{location}.post_id", "onbekende post")
            elif post.project_id != group.project_id:
                add(f"{location}.post_id", "post hoort niet bij project")
            if group.deleted_at is None and project and post and (
                not self._is_selectable_masterdata(project) or not self._is_selectable_masterdata(post)
            ):
                add(location, "actieve registratie vereist selecteerbare project- en postmasterdata")
            if group.source_import_batch_id and group.source_import_batch_id not in source_batch_ids:
                add(f"{location}.source_import_batch_id", "onbekende source batch")
            if group.duration_half_hours < 1 or group.duration_half_hours > 48:
                add(f"{location}.duration_half_hours", "duur moet 0,5 tot en met 24 uur zijn")
            if group.work_date > datetime.now(AMSTERDAM_TZ).date():
                add(f"{location}.work_date", "datum mag niet in de toekomst liggen")
            for field in ("created_by_user_id", "updated_by_user_id", "deleted_by_user_id"):
                actor_id = getattr(group, field)
                if actor_id and actor_id not in actor_ids:
                    add(f"{location}.{field}", "onbekende actor")
            if bool(group.deleted_at) != bool(group.deleted_by_user_id):
                add(f"{location}.deleted_at", "verwijderstatus en verwijderactor zijn niet coherent")
            if not group.participants:
                add(f"{location}.participants", "voeg minimaal één deelnemer toe")
            active_keys: set[str] = set()
            participant_ids: set[str] = set()
            for participant_index, participant in enumerate(group.participants):
                participant_location = f"{location}.participants[{participant_index}]"
                validate_event_coherence(participant, participant_location)
                validate_uuid(f"{participant_location}.id", participant.id)
                validate_uuid(f"{participant_location}.user_id", participant.user_id)
                validate_uuid(f"{participant_location}.external_person_id", participant.external_person_id)
                validate_uuid(f"{participant_location}.historical_identity_id", participant.historical_identity_id)
                if participant.id and participant.id in participant_ids:
                    add(f"{participant_location}.id", "dubbele participant-ID")
                if participant.id:
                    participant_ids.add(participant.id)
                    if participant.id in all_participant_ids:
                        add(f"{participant_location}.id", "participant-ID komt in meerdere groepen voor")
                    all_participant_ids.add(participant.id)
                refs = self._participant_reference_count(participant)
                missing_live_user = participant.participant_kind == "live_user" and refs == 0 and self._missing_user_metadata_is_sufficient(participant)
                if not missing_live_user and (refs != 1 or self._participant_expected_kind(participant) != participant.participant_kind):
                    add(participant_location, "precies één passende identity-reference vereist")
                    continue
                key = (
                    f"missing-user:{_normalize(participant.display_email_snapshot)}"
                    if missing_live_user
                    else self._identity_key(participant.participant_kind, participant.user_id, participant.external_person_id, participant.historical_identity_id)
                )
                if participant.deleted_at is None and key in active_keys:
                    add(participant_location, "dubbele actieve deelnemer")
                if participant.deleted_at is None:
                    active_keys.add(key)
                if bool(participant.deleted_at) != bool(participant.deleted_by_user_id):
                    add(f"{participant_location}.deleted_at", "verwijderstatus en verwijderactor zijn niet coherent")
                if group.deleted_at is not None and participant.deleted_at is None:
                    add(participant_location, "actieve deelnemer kan geen verwijderde registratie als parent hebben")
                for field in ("created_by_user_id", "updated_by_user_id", "deleted_by_user_id"):
                    actor_id = getattr(participant, field)
                    if actor_id and actor_id not in actor_ids:
                        add(f"{participant_location}.{field}", "onbekende actor")
                if participant.participant_kind == "external_person" and participant.external_person_id not in external_person_ids:
                    add(f"{participant_location}.external_person_id", "onbekende externe persoon")
                elif participant.participant_kind == "historical_identity" and participant.historical_identity_id not in historical_identity_ids:
                    add(f"{participant_location}.historical_identity_id", "onbekende historische identiteit")
                elif participant.participant_kind == "live_user":
                    user = self.repo.get_user(participant.user_id) if participant.user_id else None
                    if not user and not self._missing_user_metadata_is_sufficient(participant):
                        add(participant_location, "ontbrekende gebruiker heeft onvoldoende of inconsistente snapshotmetadata")
            if group.deleted_at is None and not active_keys:
                add(f"{location}.participants", "actieve registratie vereist minimaal één actieve deelnemer")
        if errors:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "work_hours_import_validation", "errors": errors})

    @staticmethod
    def _is_selectable_masterdata(row: WorkProjectResponse | WorkPostResponse | WorkProject | WorkPost) -> bool:
        return bool(row.is_active and not row.is_archived and row.deleted_at is None)

    @staticmethod
    def _collect_masterdata_state_errors(row, location: str, add) -> None:
        archived_complete = bool(row.is_archived and not row.is_active and row.archived_at and row.archived_by_user_id)
        archived_empty = bool(not row.is_archived and row.archived_at is None and row.archived_by_user_id is None)
        deleted_complete = bool(row.deleted_at and row.deleted_by_user_id)
        deleted_empty = bool(row.deleted_at is None and row.deleted_by_user_id is None)
        if not (archived_complete or archived_empty):
            add(location, "archive-status is niet coherent")
        if not (deleted_complete or deleted_empty):
            add(location, "delete-status is niet coherent")
        if row.is_active and (row.is_archived or row.deleted_at is not None):
            add(location, "actief kan niet samen met archived/deleted")
        if row.deleted_at is None and not row.is_archived and not row.is_active:
            add(location, "inactieve masterdata moet archived of deleted zijn")

    def _missing_user_metadata_is_sufficient(self, participant: WorkImportParticipantSnapshot) -> bool:
        source_key = (participant.user_id or "").strip()
        name = (participant.display_name_snapshot or "").strip()
        email = _normalize(participant.display_email_snapshot)
        if not name or (not source_key and not email):
            return False
        existing_source = next((item for item in self.repo.list_historical_identities(include_deleted=True) if item.source_key == f"missing-user:{source_key}"), None) if source_key else None
        if existing_source and (
            _normalize(existing_source.snapshot_name) != _normalize(name)
            or (_normalize(existing_source.snapshot_email) and email and _normalize(existing_source.snapshot_email) != email)
        ):
            return False
        matching = [identity for identity in self.repo.list_historical_identities(include_deleted=True) if email and _normalize(identity.snapshot_email) == email]
        live_matches = [user for user in self.repo.db.query(User).all() if email and _normalize(user.email) == email]
        return bool(source_key or email) and len(matching) + len(live_matches) <= 1

    def _upsert_project(self, current: User, payload: WorkProjectResponse) -> WorkProject:
        existing = self.repo.get_project(payload.id)
        if existing:
            existing.name = payload.name
            existing.description = payload.description
            existing.is_active = payload.is_active
            existing.is_archived = payload.is_archived
            existing.archived_at = payload.archived_at
            existing.archived_by_user_id = payload.archived_by_user_id
            existing.created_at = payload.created_at or existing.created_at
            existing.created_by_user_id = payload.created_by_user_id
            existing.updated_at = payload.updated_at or existing.updated_at
            existing.updated_by_user_id = payload.updated_by_user_id
            existing.deleted_at = payload.deleted_at
            existing.deleted_by_user_id = payload.deleted_by_user_id
            existing.row_version = payload.row_version
            return existing
        project = WorkProject(
            id=payload.id,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
            is_archived=payload.is_archived,
            archived_at=payload.archived_at,
            archived_by_user_id=payload.archived_by_user_id,
            created_at=payload.created_at or _now(),
            created_by_user_id=payload.created_by_user_id,
            updated_at=payload.updated_at or payload.created_at or _now(),
            updated_by_user_id=payload.updated_by_user_id,
            deleted_at=payload.deleted_at,
            deleted_by_user_id=payload.deleted_by_user_id,
            row_version=payload.row_version,
        )
        return project

    def _upsert_post(self, current: User, payload: WorkPostResponse) -> WorkPost:
        existing = self.repo.get_post(payload.id)
        if existing:
            existing.project_id = payload.project_id
            existing.name = payload.name
            existing.description = payload.description
            existing.is_active = payload.is_active
            existing.is_archived = payload.is_archived
            existing.archived_at = payload.archived_at
            existing.archived_by_user_id = payload.archived_by_user_id
            existing.created_at = payload.created_at or existing.created_at
            existing.created_by_user_id = payload.created_by_user_id
            existing.updated_at = payload.updated_at or existing.updated_at
            existing.updated_by_user_id = payload.updated_by_user_id
            existing.deleted_at = payload.deleted_at
            existing.deleted_by_user_id = payload.deleted_by_user_id
            existing.row_version = payload.row_version
            return existing
        post = WorkPost(
            id=payload.id,
            project_id=payload.project_id,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
            is_archived=payload.is_archived,
            archived_at=payload.archived_at,
            archived_by_user_id=payload.archived_by_user_id,
            created_at=payload.created_at or _now(),
            created_by_user_id=payload.created_by_user_id,
            updated_at=payload.updated_at or payload.created_at or _now(),
            updated_by_user_id=payload.updated_by_user_id,
            deleted_at=payload.deleted_at,
            deleted_by_user_id=payload.deleted_by_user_id,
            row_version=payload.row_version,
        )
        return post

    def _upsert_external_person(self, current: User, payload: WorkExternalPersonResponse) -> WorkExternalPerson:
        existing = self.repo.get_external_person(payload.id)
        normalized_name = _normalize(payload.display_name)
        normalized_email = _normalize(payload.email)
        if existing:
            existing.display_name = payload.display_name
            existing.normalized_name = normalized_name
            existing.email = payload.email
            existing.normalized_email = normalized_email
            existing.note = payload.note
            existing.is_active = payload.is_active
            existing.deleted_at = payload.deleted_at
            existing.created_at = payload.created_at or existing.created_at
            existing.created_by_user_id = payload.created_by_user_id
            existing.updated_at = payload.updated_at or existing.updated_at
            existing.updated_by_user_id = payload.updated_by_user_id
            existing.deleted_by_user_id = payload.deleted_by_user_id
            existing.row_version = payload.row_version
            return existing
        person = WorkExternalPerson(
            id=payload.id,
            display_name=payload.display_name,
            normalized_name=normalized_name,
            email=payload.email,
            normalized_email=normalized_email,
            note=payload.note,
            is_active=payload.is_active,
            deleted_at=payload.deleted_at,
            created_at=payload.created_at or _now(),
            created_by_user_id=payload.created_by_user_id,
            updated_at=payload.updated_at or payload.created_at or _now(),
            updated_by_user_id=payload.updated_by_user_id,
            deleted_by_user_id=payload.deleted_by_user_id,
            row_version=payload.row_version,
        )
        return person

    def _upsert_historical_identity(self, current: User, payload: WorkHistoricalIdentityResponse) -> WorkHistoricalUserIdentity:
        source_user_exists = bool(payload.source_user_id and self.repo.get_user(payload.source_user_id))
        source_key = payload.source_key
        if payload.source_user_id and not source_user_exists and str(payload.source_user_id) not in source_key:
            source_key = f"{source_key}|missing-user:{payload.source_user_id}"
        existing = self.repo.get_historical_identity(payload.id)
        if not existing:
            existing = self._find_historical_identity_by_source_key(payload.source_key)
        if existing:
            existing.source_key = source_key
            existing.snapshot_name = payload.snapshot_name
            existing.snapshot_email = payload.snapshot_email
            existing.snapshot_display_label = payload.snapshot_display_label
            existing.source_user_id = payload.source_user_id if source_user_exists else None
            existing.linked_user_id = payload.linked_user_id
            existing.linked_at = payload.linked_at
            existing.linked_by_user_id = payload.linked_by_user_id
            existing.is_active = payload.is_active
            existing.created_at = payload.created_at or existing.created_at
            existing.created_by_user_id = payload.created_by_user_id
            existing.updated_at = payload.updated_at or existing.updated_at
            existing.updated_by_user_id = payload.updated_by_user_id
            existing.deleted_at = payload.deleted_at
            existing.deleted_by_user_id = payload.deleted_by_user_id
            existing.row_version = payload.row_version
            return existing
        identity = WorkHistoricalUserIdentity(
            id=payload.id,
            source_key=source_key,
            snapshot_name=payload.snapshot_name,
            snapshot_email=payload.snapshot_email,
            snapshot_display_label=payload.snapshot_display_label,
            source_user_id=payload.source_user_id if source_user_exists else None,
            linked_user_id=payload.linked_user_id,
            linked_at=payload.linked_at,
            linked_by_user_id=payload.linked_by_user_id,
            is_active=payload.is_active,
            created_at=payload.created_at or _now(),
            created_by_user_id=payload.created_by_user_id,
            updated_at=payload.updated_at or payload.created_at or _now(),
            updated_by_user_id=payload.updated_by_user_id,
            deleted_at=payload.deleted_at,
            deleted_by_user_id=payload.deleted_by_user_id,
            row_version=payload.row_version,
        )
        return identity

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

    def _mark_import_batch_failed(self, batch: WorkImportBatch, current: User, *, error_type: str, error_message: str, extra: dict | None = None) -> None:
        # This is deliberately called only after rollback. Persist the failed
        # operational record and exactly one sanitized audit in one fresh txn.
        persisted = self.repo.db.get(WorkImportBatch, batch.id)
        if not persisted:
            persisted = batch
            self.repo.db.add(persisted)
        persisted.status = "failed"
        safe_code = error_type[:120]
        persisted.errors_json = json.dumps([{"code": safe_code}], ensure_ascii=False)
        self._log(
            event_type="work_hours.import.failed",
            actor=current,
            target_type="import_batch",
            target_id=persisted.id,
            after={"status": "failed", "error_code": safe_code, "counts": json.loads(persisted.counts_json or "{}"), **(extra or {})},
            outcome="failed",
            commit=False,
        )
        self.repo.db.commit()

    @staticmethod
    def _map_integrity_error(exc: IntegrityError) -> tuple[int, dict[str, object]] | None:
        text = str(getattr(exc, "orig", exc)).casefold()
        unique_constraints = {
            "uq_work_projects_name",
            "uq_work_posts_project_name",
            "uq_work_external_people_name_email",
            "uq_work_external_people_normalized_email",
            "ix_work_historical_user_identities_source_key",
            "uq_work_hour_group_participants_active_identity",
        }
        shape_constraints = {
            "ck_work_hour_groups_duration_half_hours",
            "ck_work_hour_group_participants_exactly_one_identity",
            "ck_work_projects_deleted_tuple", "ck_work_projects_archived_tuple", "ck_work_projects_active_state",
            "ck_work_posts_deleted_tuple", "ck_work_posts_archived_tuple", "ck_work_posts_active_state",
        }
        for name in unique_constraints:
            if name in text:
                return 409, {"code": "work_hours_import_unique_conflict", "message": "De import botst met bestaande unieke gegevens.", "constraint": name}
        for name in shape_constraints:
            if name in text:
                return 422, {"code": "work_hours_import_invalid_state", "message": "De import bevat een ongeldige status of vorm.", "constraint": name}
        # SQLite reports columns rather than a named unique constraint.
        sqlite_unique_columns = {
            "work_projects.name": "uq_work_projects_name",
            "work_posts.project_id, work_posts.name": "uq_work_posts_project_name",
            "work_external_people.normalized_email": "uq_work_external_people_normalized_email",
            "work_hour_group_participants.group_id, work_hour_group_participants.active_identity_key": "uq_work_hour_group_participants_active_identity",
        }
        for columns, name in sqlite_unique_columns.items():
            if columns in text:
                return 409, {"code": "work_hours_import_unique_conflict", "message": "De import botst met bestaande unieke gegevens.", "constraint": name}
        if "foreign key constraint" in text:
            return 422, {"code": "work_hours_import_invalid_reference", "message": "De import bevat een ongeldige verwijzing.", "constraint": "foreign_key"}
        if "check constraint" in text:
            return 422, {"code": "work_hours_import_invalid_state", "message": "De import bevat een ongeldige status of vorm.", "constraint": "check"}
        return None

    def list_meta(self, current: User) -> WorkHourMetaResponse:
        return WorkHourMetaResponse(
            projects=[WorkProjectOptionResponse(id=project.id, display_name=project.name) for project in self.repo.list_selectable_projects()],
            posts=[WorkPostOptionResponse(id=post.id, project_selection_key=post.project_id, display_name=post.name) for post in self.repo.list_selectable_posts()],
            external_people=[WorkExternalPersonOptionResponse(id=person.id, display_name=person.display_name) for person in self.repo.list_external_people() if person.is_active],
            historical_identities=[],
            eligible_users=[WorkEligibleUserResponse(id=user.id, display_name=_display_name_for_user(user)) for user in self.repo.list_active_users()],
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
        if payload.project_id or payload.post_id:
            self._validate_project_post(project_id, post_id, allow_unchanged=(group.project_id, group.post_id))
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
        project = WorkProject(name=payload.name, description=payload.description, created_by_user_id=current.id, updated_by_user_id=current.id)
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
        project.row_version = self._require_expected_version(WorkProject, project.id, payload.expected_row_version)
        if payload.name is not None:
            project.name = payload.name.strip()
        if payload.description is not None:
            project.description = payload.description.strip()
        project.updated_by_user_id = current.id
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
        if project.deleted_at is not None:
            raise HTTPException(status_code=422, detail="Een verwijderd project kan niet worden gearchiveerd")
        before = self._project_to_response(project).model_dump()
        project.row_version = self._require_expected_version(WorkProject, project.id, expected_row_version)
        project.is_active = False
        project.is_archived = True
        project.archived_at = _now()
        project.updated_at = project.archived_at
        project.archived_by_user_id = current.id
        project.updated_by_user_id = current.id
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
        project.row_version = self._require_expected_version(WorkProject, project.id, expected_row_version)
        if project.deleted_at is not None:
            was_archived = project.is_archived
            project.deleted_at = None
            project.deleted_by_user_id = None
            project.is_active = not was_archived
        else:
            project.is_active = True
            project.is_archived = False
            project.archived_at = None
            project.archived_by_user_id = None
        project.updated_by_user_id = current.id
        self.repo.db.add(project)
        self._log(event_type="work_hours.project.restored", actor=current, target_type="project", target_id=project.id, before=before, after=self._project_to_response(project).model_dump(), commit=False)
        self.repo.db.commit()
        return self._project_to_response(project)

    def delete_project(self, current: User, project_id: str, expected_row_version: int | None) -> dict[str, str]:
        self._ensure_admin(current)
        project = self.repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        if project.deleted_at is not None:
            raise HTTPException(status_code=409, detail="Project is al verwijderd")
        before = self._project_to_response(project).model_dump()
        project.row_version = self._require_expected_version(WorkProject, project.id, expected_row_version)
        project.is_active = False
        project.deleted_at = _now()
        project.updated_at = project.deleted_at
        project.deleted_by_user_id = current.id
        project.updated_by_user_id = current.id
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
        project = self.repo.get_project(payload.project_id)
        if not project or project.deleted_at is not None or not project.is_active or project.is_archived:
            raise HTTPException(status_code=422, detail="Project is niet actief/selecteerbaar")
        if self._post_name_conflicts(payload.project_id, payload.name):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al binnen dit project"})
        post = WorkPost(project_id=payload.project_id, name=payload.name, description=payload.description, created_by_user_id=current.id, updated_by_user_id=current.id)
        try:
            self.repo.db.add(post)
            self.repo.db.flush()
            self._log(event_type="work_hours.post.created", actor=current, target_type="post", target_id=post.id, after=self._post_to_response(post).model_dump(), commit=False)
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al binnen dit project"}) from exc
        return self._post_to_response(post)

    def update_post(self, current: User, post_id: str, payload: WorkPostUpdateRequest) -> WorkPostResponse:
        self._ensure_admin(current)
        post = self.repo.get_post(post_id)
        if not post:
            raise HTTPException(status_code=404, detail="Post niet gevonden")
        if payload.name is not None and self._post_name_conflicts(post.project_id, payload.name, exclude_post_id=post.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al binnen dit project"})
        before = self._post_to_response(post).model_dump()
        post.row_version = self._require_expected_version(WorkPost, post.id, payload.expected_row_version)
        if payload.name is not None:
            post.name = payload.name.strip()
        if payload.description is not None:
            post.description = payload.description.strip()
        post.updated_by_user_id = current.id
        self.repo.db.add(post)
        try:
            self._log(event_type="work_hours.post.updated", actor=current, target_type="post", target_id=post.id, before=before, after=self._post_to_response(post).model_dump(), commit=False)
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Postnaam bestaat al binnen dit project"}) from exc
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
        project = self.repo.get_project(post.project_id)
        if not project or not self._is_selectable_masterdata(project):
            raise HTTPException(status_code=422, detail="Herstel eerst het actieve bovenliggende project")
        if self._post_name_conflicts(post.project_id, post.name, exclude_post_id=post.id):
            raise HTTPException(status_code=409, detail={"message": "Postnaam bestaat al binnen dit project"})
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

    def build_backup_envelope(self) -> WorkImportEnvelope:
        groups = self.repo.list_groups({"include_deleted": True})
        source_batch_ids = {group.source_import_batch_id for group in groups if group.source_import_batch_id}
        return WorkImportEnvelope(
            projects=[self._project_to_response(project) for project in self.repo.list_projects(include_deleted=True)],
            posts=[self._post_to_response(post) for post in self.repo.list_posts(include_deleted=True)],
            external_people=[self._person_to_response(person) for person in self.repo.list_external_people(include_deleted=True)],
            historical_identities=[self._historical_to_response(identity) for identity in self.repo.list_historical_identities(include_deleted=True)],
            source_batches=[
                WorkImportSourceBatchSnapshot(
                    id=batch.id,
                    requested_by_user_id=batch.requested_by_user_id,
                    format_version=batch.format_version,
                    backup_version=batch.backup_version,
                    mode=batch.mode,
                    source_hash=batch.source_hash,
                    status=batch.status,
                    counts={str(key): int(value) for key, value in json.loads(batch.counts_json or "{}").items()},
                    created_at=batch.created_at,
                    updated_at=batch.updated_at,
                )
                for batch in self.repo.list_import_batches_by_ids(source_batch_ids)
            ],
            groups=[
                WorkImportGroupSnapshot(
                    id=group.id,
                    work_date=_work_date(group.work_date),
                    project_id=group.project_id,
                    post_id=group.post_id,
                    description=group.description,
                    duration_half_hours=group.duration_half_hours,
                    source_import_batch_id=group.source_import_batch_id,
                    created_at=group.created_at,
                    created_by_user_id=group.created_by_user_id,
                    updated_at=group.updated_at,
                    updated_by_user_id=group.updated_by_user_id,
                    deleted_at=group.deleted_at,
                    deleted_by_user_id=group.deleted_by_user_id,
                    row_version=group.row_version,
                    participants=[
                        WorkImportParticipantSnapshot(
                            id=participant.id,
                            participant_kind=participant.participant_kind,
                            user_id=participant.user_id,
                            external_person_id=participant.external_person_id,
                            historical_identity_id=participant.historical_identity_id,
                            display_name_snapshot=participant.display_name_snapshot,
                            display_email_snapshot=participant.display_email_snapshot,
                            display_type_snapshot=participant.display_type_snapshot,
                            sort_order=participant.sort_order,
                            created_at=participant.created_at,
                            created_by_user_id=participant.created_by_user_id,
                            updated_at=participant.updated_at,
                            updated_by_user_id=participant.updated_by_user_id,
                            deleted_at=participant.deleted_at,
                            deleted_by_user_id=participant.deleted_by_user_id,
                            row_version=participant.row_version,
                        )
                        for participant in sorted(group.participants, key=lambda item: item.sort_order)
                    ],
                )
                for group in groups
            ],
        )

    def _upsert_source_batch(self, payload: WorkImportSourceBatchSnapshot) -> WorkImportBatch:
        existing = self.repo.db.get(WorkImportBatch, payload.id)
        if existing:
            existing.requested_by_user_id = payload.requested_by_user_id
            existing.format_version = payload.format_version
            existing.backup_version = payload.backup_version
            existing.mode = payload.mode
            existing.source_hash = payload.source_hash
            existing.status = payload.status
            existing.counts_json = json.dumps(payload.counts, sort_keys=True)
            existing.created_at = payload.created_at
            existing.updated_at = payload.updated_at
            return existing
        return WorkImportBatch(
            id=payload.id,
            requested_by_user_id=payload.requested_by_user_id,
            format_version=payload.format_version,
            backup_version=payload.backup_version,
            mode=payload.mode,
            source_filename="herstelde-provenance.json",
            source_hash=payload.source_hash,
            status=payload.status,
            counts_json=json.dumps(payload.counts, sort_keys=True),
            warnings_json="[]",
            errors_json="[]",
            created_at=payload.created_at,
            updated_at=payload.updated_at,
        )

    def _backup_path(self, batch_id: str) -> Path:
        settings = get_settings()
        root = settings.storage_root / settings.exports_dir / "urenverantwoording"
        root.mkdir(parents=True, exist_ok=True)
        return root / f"{batch_id}.json"

    def _resolve_import_participant_snapshot(
        self,
        current: User,
        participant_snapshot: WorkImportParticipantSnapshot,
        historical_identity_ids: dict[str, str],
    ) -> WorkImportParticipantSnapshot:
        resolved_snapshot = participant_snapshot
        if resolved_snapshot.historical_identity_id and resolved_snapshot.historical_identity_id in historical_identity_ids:
            resolved_snapshot = resolved_snapshot.model_copy(update={"historical_identity_id": historical_identity_ids[resolved_snapshot.historical_identity_id]})
        if resolved_snapshot.participant_kind == "live_user":
            user = self.repo.get_user(resolved_snapshot.user_id) if resolved_snapshot.user_id else None
            if not user or not user.is_active:
                if not self._missing_user_metadata_is_sufficient(resolved_snapshot):
                    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ontbrekende gebruiker heeft onvoldoende of inconsistente snapshotmetadata")
                source_key = f"missing-user:{resolved_snapshot.user_id or _normalize(resolved_snapshot.display_email_snapshot)}"
                identity = self._materialize_historical_identity(
                    current,
                    source_key=source_key,
                    snapshot_name=resolved_snapshot.display_name_snapshot,
                    snapshot_email=resolved_snapshot.display_email_snapshot,
                    snapshot_display_label=resolved_snapshot.display_type_snapshot or resolved_snapshot.display_name_snapshot,
                )
                resolved_snapshot = resolved_snapshot.model_copy(update={
                    "participant_kind": "historical_identity",
                    "user_id": None,
                    "historical_identity_id": identity.id,
                })
        return resolved_snapshot

    def _participant_from_import_snapshot(
        self,
        current: User,
        snapshot: WorkImportParticipantSnapshot,
        historical_identity_ids: dict[str, str],
    ) -> WorkHourGroupParticipant:
        resolved = self._resolve_import_participant_snapshot(current, snapshot, historical_identity_ids)
        participant = self._participant_entity(
            resolved,
            current,
            allow_inactive_external_person=True,
            allow_historical_identity=True,
        )
        if snapshot.id:
            participant.id = snapshot.id
        participant.created_at = snapshot.created_at or _now()
        participant.created_by_user_id = snapshot.created_by_user_id
        participant.updated_at = snapshot.updated_at or snapshot.created_at or _now()
        participant.updated_by_user_id = snapshot.updated_by_user_id
        participant.deleted_at = snapshot.deleted_at
        participant.deleted_by_user_id = snapshot.deleted_by_user_id
        participant.row_version = snapshot.row_version
        self._set_active_identity_key(participant)
        return participant

    def preview_import(self, current: User, envelope: WorkImportEnvelope, mode: str) -> WorkImportPreviewResponse:
        self._ensure_admin(current)
        preview_id = str(uuid4())
        try:
            self._validate_import_payload(envelope, mode)
            semantic_conflicts = self._import_semantic_conflicts(envelope, mode)
            if semantic_conflicts:
                self._raise_semantic_conflict(semantic_conflicts)
        except HTTPException as exc:
            self._log(
                event_type="work_hours.import.preview", actor=current,
                target_type="import_preview", target_id=preview_id,
                outcome="failed", extra={"status_code": exc.status_code, "counts": {}},
            )
            raise
        source_hash = self._import_payload_hash(envelope)
        batch = WorkImportBatch(
            requested_by_user_id=current.id,
            format_version=envelope.format_version,
            backup_version=envelope.backup_version,
            mode=mode,
            source_filename="backup.json",
            source_hash=source_hash,
            status="preview",
            counts_json=json.dumps({
                "projects": len(envelope.projects),
                "posts": len(envelope.posts),
                "external_people": len(envelope.external_people),
                "historical_identities": len(envelope.historical_identities),
                "groups": len(envelope.groups),
            }),
            warnings_json=json.dumps([], ensure_ascii=False),
            errors_json=json.dumps([], ensure_ascii=False),
        )
        self.repo.create_import_batch(batch)
        warnings: list[str] = []
        errors: list[str] = []
        if envelope.format_version != "1.0":
            warnings.append("Andere formatversie gedetecteerd")
        if mode not in {"merge", "full_restore"}:
            errors.append("Ongeldige importmodus")
        conflicts = self._import_conflicts(envelope, mode)
        if conflicts:
            errors.extend([f"Conflict: {conflict}" for conflict in conflicts])
        if mode == "full_restore" and not envelope.groups:
            warnings.append("Full restore zonder urenregistraties")
        self._ensure_pre_import_backup(batch, current, create=True)
        batch.status = "conflict" if errors else "previewed"
        batch.warnings_json = json.dumps(warnings, ensure_ascii=False)
        batch.errors_json = json.dumps(errors, ensure_ascii=False)
        self.repo.db.add(batch)
        self._log(
            event_type="work_hours.import.preview", actor=current,
            target_type="import_batch", target_id=batch.id,
            after={"status": batch.status, "counts": json.loads(batch.counts_json)},
            commit=False,
        )
        self.repo.db.commit()
        return WorkImportPreviewResponse(
            batch_id=batch.id,
            status=batch.status,
            counts=json.loads(batch.counts_json),
            warnings=warnings,
            errors=errors,
            backup_download_url=f"/api/urenverantwoording/import/batches/{batch.id}/backup",
        )

    def commit_import(self, current: User, batch_id: str, envelope: WorkImportEnvelope, mode: str) -> WorkImportCommitResponse:
        self._ensure_admin(current)
        batch = self.repo.db.get(WorkImportBatch, batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Importbatch niet gevonden")
        if batch.status not in {"preview", "previewed"}:
            raise HTTPException(status_code=409, detail="Importbatch is al verwerkt")
        if mode not in {"merge", "full_restore"}:
            raise HTTPException(status_code=422, detail="Ongeldige importmodus")
        if batch.mode != mode:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Importbatch komt niet overeen met deze bevestiging"})
        if batch.source_hash != self._import_payload_hash(envelope):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Importbatch komt niet overeen met de preview"})
        batch.status = "committing"
        try:
            domain_before = self.build_backup_envelope().model_dump(mode="json")
            self._validate_import_payload(envelope, mode)
            semantic_conflicts = self._import_semantic_conflicts(envelope, mode)
            if semantic_conflicts:
                self._raise_semantic_conflict(semantic_conflicts)
            conflicts = self._import_conflicts(envelope, mode)
            if conflicts:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Importconflict", "conflicts": conflicts})
            backup_path = self._ensure_pre_import_backup(batch, current, create=False)
            backup_json = backup_path.read_text(encoding="utf-8")
            historical_identity_ids: dict[str, str] = {}
            if mode == "full_restore":
                self.repo.db.query(WorkHourGroupParticipant).delete()
                self.repo.db.query(WorkHourGroup).delete()
                self.repo.db.query(WorkPost).delete()
                self.repo.db.query(WorkProject).delete()
                self.repo.db.query(WorkExternalPerson).delete()
                self.repo.db.query(WorkHistoricalUserIdentity).delete()
                self.repo.db.flush()
            for source_batch in envelope.source_batches:
                self.repo.db.add(self._upsert_source_batch(source_batch))
            self.repo.db.flush()
            for project in envelope.projects:
                self.repo.db.add(self._upsert_project(current, project))
            self.repo.db.flush()
            for post in envelope.posts:
                self.repo.db.add(self._upsert_post(current, post))
            self.repo.db.flush()
            for person in envelope.external_people:
                self.repo.db.add(self._upsert_external_person(current, person))
            self.repo.db.flush()
            for identity in envelope.historical_identities:
                persisted_identity = self._upsert_historical_identity(current, identity)
                historical_identity_ids[identity.id] = persisted_identity.id
                self.repo.db.add(persisted_identity)
            self.repo.db.flush()

            existing_groups = {group.id: group for group in self.repo.list_groups({"include_deleted": True})}
            for group_snapshot in envelope.groups:
                project = self.repo.get_project(group_snapshot.project_id)
                post = self.repo.get_post(group_snapshot.post_id)
                if not project or not post:
                    raise HTTPException(status_code=422, detail="Import bevat een onopgeloste project/post-reference")
                existing_group = existing_groups.get(group_snapshot.id)
                if existing_group:
                    existing_group.work_date = group_snapshot.work_date
                    existing_group.project_id = group_snapshot.project_id
                    existing_group.post_id = group_snapshot.post_id
                    existing_group.description = group_snapshot.description
                    existing_group.duration_half_hours = group_snapshot.duration_half_hours
                    existing_group.source_import_batch_id = group_snapshot.source_import_batch_id
                    existing_group.created_at = group_snapshot.created_at or existing_group.created_at
                    existing_group.created_by_user_id = group_snapshot.created_by_user_id
                    existing_group.updated_at = group_snapshot.updated_at or existing_group.updated_at
                    existing_group.updated_by_user_id = group_snapshot.updated_by_user_id
                    existing_group.deleted_at = group_snapshot.deleted_at
                    existing_group.deleted_by_user_id = group_snapshot.deleted_by_user_id
                    existing_group.row_version = group_snapshot.row_version
                    incoming_ids = {item.id for item in group_snapshot.participants if item.id}
                    for current_participant in list(existing_group.participants):
                        if current_participant.id not in incoming_ids:
                            self.repo.db.delete(current_participant)
                    by_id = {item.id: item for item in existing_group.participants}
                    for participant_snapshot in group_snapshot.participants:
                        restored = self._participant_from_import_snapshot(current, participant_snapshot, historical_identity_ids)
                        current_participant = by_id.get(participant_snapshot.id) if participant_snapshot.id else None
                        if current_participant:
                            for field in (
                                "participant_kind", "user_id", "external_person_id", "historical_identity_id",
                                "display_name_snapshot", "display_email_snapshot", "display_type_snapshot", "sort_order",
                                "created_at", "created_by_user_id", "updated_at", "updated_by_user_id",
                                "deleted_at", "deleted_by_user_id", "row_version", "active_identity_key",
                            ):
                                setattr(current_participant, field, getattr(restored, field))
                        else:
                            existing_group.participants.append(restored)
                    self.repo.db.add(existing_group)
                    continue
                group = WorkHourGroup(
                    id=group_snapshot.id,
                    work_date=group_snapshot.work_date,
                    project_id=group_snapshot.project_id,
                    post_id=group_snapshot.post_id,
                    description=group_snapshot.description,
                    duration_half_hours=group_snapshot.duration_half_hours,
                    source_import_batch_id=group_snapshot.source_import_batch_id,
                    created_at=group_snapshot.created_at or _now(),
                    created_by_user_id=group_snapshot.created_by_user_id,
                    updated_at=group_snapshot.updated_at or group_snapshot.created_at or _now(),
                    updated_by_user_id=group_snapshot.updated_by_user_id,
                    deleted_at=group_snapshot.deleted_at,
                    deleted_by_user_id=group_snapshot.deleted_by_user_id,
                    row_version=group_snapshot.row_version,
                )
                self.repo.db.add(group)
                self.repo.db.flush()
                for index, participant_snapshot in enumerate(group_snapshot.participants):
                    participant = self._participant_from_import_snapshot(current, participant_snapshot, historical_identity_ids)
                    participant.group_id = group.id
                    participant.sort_order = participant_snapshot.sort_order if participant_snapshot.sort_order is not None else index
                    self.repo.db.add(participant)
            batch.status = "completed"
            self.repo.db.flush()
            domain_after = self.build_backup_envelope().model_dump(mode="json")
            self._log(event_type="work_hours.import.committed", actor=current, target_type="import_batch", target_id=batch.id, before=domain_before, after=domain_after, extra={"mode": mode, "backup_bytes": len(backup_json)}, commit=False)
            self.repo.db.flush()
            self.repo.db.commit()
        except IntegrityError as exc:
            self.repo.db.rollback()
            mapped = self._map_integrity_error(exc)
            if mapped is None:
                self._mark_import_batch_failed(batch, current, error_type="database_error", error_message="Databasefout", extra={"mode": mode})
                raise HTTPException(status_code=500, detail={"code": "work_hours_import_database_error", "message": "Import mislukt door een databasefout."}) from exc
            status_code, detail = mapped
            if status_code == 409:
                semantic_candidates = self._import_semantic_conflicts(envelope, mode)
                if semantic_candidates:
                    detail = self._semantic_conflict_detail(semantic_candidates)
            self._mark_import_batch_failed(batch, current, error_type=str(detail["code"]), error_message="Importconflict", extra={"mode": mode})
            raise HTTPException(status_code=status_code, detail=detail) from exc
        except HTTPException as exc:
            self.repo.db.rollback()
            self._mark_import_batch_failed(batch, current, error_type=f"http_{exc.status_code}", error_message="Import geweigerd", extra={"mode": mode})
            raise
        except Exception as exc:
            self.repo.db.rollback()
            self._mark_import_batch_failed(batch, current, error_type=exc.__class__.__name__, error_message=str(exc) or exc.__class__.__name__, extra={"mode": mode})
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"message": "Import mislukt"}) from exc
        return WorkImportCommitResponse(batch_id=batch.id, status=batch.status, backup_download_url=f"/api/urenverantwoording/import/batches/{batch.id}/backup")

    def download_backup(self, current: User, batch_id: str) -> tuple[bytes, str]:
        if not current.is_admin:
            self._log(event_type="work_hours.backup.download", actor=current, target_type="backup_artifact", target_id=batch_id, outcome="denied", extra={"counts": {}})
            raise HTTPException(status_code=403, detail="Beheerderstoegang vereist")
        batch = self.repo.db.get(WorkImportBatch, batch_id)
        if not batch or not batch.pre_import_backup_path:
            self._log(event_type="work_hours.backup.download", actor=current, target_type="backup_artifact", target_id=batch_id, outcome="not_found", extra={"counts": {}})
            raise HTTPException(status_code=404, detail="Backup niet gevonden")
        path = Path(batch.pre_import_backup_path)
        if not path.exists():
            self._log(event_type="work_hours.backup.download", actor=current, target_type="backup_artifact", target_id=batch_id, outcome="not_found", extra={"counts": {}})
            raise HTTPException(status_code=404, detail="Backup niet gevonden")
        try:
            content = path.read_bytes()
        except OSError as exc:
            self._log(event_type="work_hours.backup.download", actor=current, target_type="backup_artifact", target_id=batch_id, outcome="failed", extra={"counts": {}})
            raise HTTPException(status_code=500, detail={"code": "work_hours_backup_download_failed", "message": "Backup kon niet worden gelezen."}) from exc
        self._log(event_type="work_hours.backup.download", actor=current, target_type="backup_artifact", target_id=batch_id, extra={"counts": json.loads(batch.counts_json or "{}")})
        return content, path.name
