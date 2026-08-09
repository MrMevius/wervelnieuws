import json
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.settings import get_settings
from app.models.entities import User
from app.repositories.work_hours_repository import WorkHoursRepository
from app.schemas.work_hours import (
    WorkAuditEventResponse,
    WorkAuditListResponse,
    WorkAdminHistoryListResponse,
    WorkAdminMasterdataResponse,
    WorkExternalPersonCreateRequest,
    WorkExternalPersonResponse,
    WorkExternalPersonUpdateRequest,
    WorkExternalPersonMergeRequest,
    WorkHourGroupCreateRequest,
    WorkHourGroupResponse,
    WorkHourGroupUpdateRequest,
    WorkHourListResponse,
    WorkHourMetaResponse,
    WorkImportCommitResponse,
    WorkImportEnvelope,
    WorkImportPreviewResponse,
    WorkHistoricalIdentityResponse,
    WorkHistoricalIdentityRelinkRequest,
    WorkPostCreateRequest,
    WorkPostResponse,
    WorkPostUpdateRequest,
    WorkProjectCreateRequest,
    WorkProjectResponse,
    WorkProjectUpdateRequest,
)
from app.services.audit_service import AuditService
from app.services.work_hours_service import WorkHoursListQuery, WorkHoursService

router = APIRouter(prefix="/urenverantwoording", tags=["urenverantwoording"])

_FILTER_KEYS = {
    "work_date", "project_id", "post_id", "participant_kind", "query",
    "include_deleted", "deleted_only", "sort_key", "sort_direction",
}


def _validate_query_contract(request: Request, *, list_request: bool) -> None:
    allowed = _FILTER_KEYS | ({"page", "page_size"} if list_request else set())
    unknown = sorted(set(request.query_params.keys()) - allowed)
    conflicting = sorted(
        key for key in request.query_params.keys()
        if len(set(request.query_params.getlist(key))) > 1
    )
    if unknown or conflicting:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "work_hours_invalid_query",
                "message": "De filterparameters zijn ongeldig.",
                "unknown": unknown,
                "conflicting_duplicates": conflicting,
            },
        )


def _service(db: Session, request: Request | None = None) -> WorkHoursService:
    return WorkHoursService(WorkHoursRepository(db), AuditService(db), request=request)


@router.get("/meta", response_model=WorkHourMetaResponse)
def get_meta(request: Request, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkHourMetaResponse:
    return _service(db, request).list_meta(current)


@router.get("/groepen", response_model=None)
def list_groups(
    request: Request,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    work_date: date | None = None,
    project_id: str | None = None,
    post_id: str | None = None,
    participant_kind: str | None = None,
    query: str | None = None,
    include_deleted: bool = False,
    deleted_only: bool = False,
    page: int = 1,
    page_size: int = Query(default=25, alias="page_size"),
    sort_key: str = "work_date",
    sort_direction: str = "desc",
    ) -> WorkHourListResponse:
    _validate_query_contract(request, list_request=True)
    deleted_only = bool(deleted_only)
    include_deleted = bool(include_deleted or deleted_only)
    if include_deleted or deleted_only:
        _service(db, request)._ensure_admin(current)
    return _service(db, request).list_hours(
        WorkHoursListQuery(
            work_date=work_date,
            project_id=project_id,
            post_id=post_id,
            participant_kind=participant_kind,
            query=query,
            include_deleted=include_deleted,
            deleted_only=deleted_only,
            page=page,
            page_size=page_size,
            sort_key=sort_key,
            sort_direction=sort_direction,
        ), current
    )


@router.get("/export.csv")
def export_csv(
    request: Request,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    work_date: date | None = None,
    project_id: str | None = None,
    post_id: str | None = None,
    participant_kind: str | None = None,
    query: str | None = None,
    include_deleted: bool = False,
    deleted_only: bool = False,
    sort_key: str = "work_date",
    sort_direction: str = "desc",
) -> Response:
    _validate_query_contract(request, list_request=False)
    deleted_only = bool(deleted_only)
    include_deleted = bool(include_deleted or deleted_only)
    if include_deleted:
        _service(db, request)._ensure_admin(current)
    csv_bytes = _service(db, request).export_csv(
        WorkHoursListQuery(
            work_date=work_date,
            project_id=project_id,
            post_id=post_id,
            participant_kind=participant_kind,
            query=query,
            include_deleted=include_deleted,
            deleted_only=deleted_only,
            sort_key=sort_key,
            sort_direction=sort_direction,
        )
    )
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=urenverantwoording.csv"},
    )


@router.post("/groepen", response_model=None, status_code=status.HTTP_201_CREATED)
def create_group(request: Request, payload: WorkHourGroupCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkHourGroupResponse:
    return _service(db, request).create_group(current, payload)


@router.get("/groepen/{group_id}", response_model=None)
def get_group(request: Request, group_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkHourGroupResponse:
    return _service(db, request).get_group(current, group_id)


@router.patch("/groepen/{group_id}", response_model=None)
def update_group(request: Request, group_id: str, payload: WorkHourGroupUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkHourGroupResponse:
    return _service(db, request).update_group(current, group_id, payload)


@router.delete("/groepen/{group_id}")
def delete_group(request: Request, group_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    return _service(db, request).delete_group(current, group_id, expected_row_version)


@router.post("/groepen/{group_id}/herstellen", response_model=None)
def restore_group(request: Request, group_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkHourGroupResponse:
    return _service(db, request).restore_group(current, group_id, expected_row_version)


@router.post("/externe-personen", response_model=WorkExternalPersonResponse, status_code=status.HTTP_201_CREATED)
def create_external_person(request: Request, payload: WorkExternalPersonCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).create_external_person(current, payload)


@router.patch("/externe-personen/{person_id}", response_model=WorkExternalPersonResponse)
def update_external_person(request: Request, person_id: str, payload: WorkExternalPersonUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).update_external_person(current, person_id, payload)


@router.post("/externe-personen/{person_id}/archiveren", response_model=WorkExternalPersonResponse)
def archive_external_person(request: Request, person_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).archive_external_person(current, person_id, expected_row_version)


@router.post("/externe-personen/{person_id}/deactiveren", response_model=WorkExternalPersonResponse)
def deactivate_external_person(request: Request, person_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).set_external_person_active(current, person_id, expected_row_version, active=False)


@router.post("/externe-personen/{person_id}/activeren", response_model=WorkExternalPersonResponse)
def activate_external_person(request: Request, person_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).set_external_person_active(current, person_id, expected_row_version, active=True)


@router.post("/externe-personen/{person_id}/herstellen", response_model=WorkExternalPersonResponse)
def restore_external_person(request: Request, person_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).restore_external_person(current, person_id, expected_row_version)


@router.post("/externe-personen/{person_id}/merge", response_model=WorkExternalPersonResponse)
def merge_external_person(request: Request, person_id: str, payload: WorkExternalPersonMergeRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkExternalPersonResponse:
    return _service(db, request).merge_external_person(current, person_id, payload)


@router.post("/projecten", response_model=WorkProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(request: Request, payload: WorkProjectCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkProjectResponse:
    return _service(db, request).create_project(current, payload)


@router.post("/projecten/{project_id}/archiveren", response_model=WorkProjectResponse)
def archive_project(request: Request, project_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkProjectResponse:
    return _service(db, request).archive_project(current, project_id, expected_row_version)


@router.post("/projecten/{project_id}/herstellen", response_model=WorkProjectResponse)
def restore_project(request: Request, project_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkProjectResponse:
    return _service(db, request).restore_project(current, project_id, expected_row_version)


@router.delete("/projecten/{project_id}")
def delete_project(request: Request, project_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    return _service(db, request).delete_project(current, project_id, expected_row_version)


@router.patch("/projecten/{project_id}", response_model=WorkProjectResponse)
def update_project(request: Request, project_id: str, payload: WorkProjectUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkProjectResponse:
    return _service(db, request).update_project(current, project_id, payload)


@router.post("/posten", response_model=WorkPostResponse, status_code=status.HTTP_201_CREATED)
def create_post(request: Request, payload: WorkPostCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkPostResponse:
    return _service(db, request).create_post(current, payload)


@router.post("/posten/{post_id}/archiveren", response_model=WorkPostResponse)
def archive_post(request: Request, post_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkPostResponse:
    return _service(db, request).archive_post(current, post_id, expected_row_version)


@router.post("/posten/{post_id}/herstellen", response_model=WorkPostResponse)
def restore_post(request: Request, post_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkPostResponse:
    return _service(db, request).restore_post(current, post_id, expected_row_version)


@router.delete("/posten/{post_id}")
def delete_post(request: Request, post_id: str, expected_row_version: int | None = None, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    return _service(db, request).delete_post(current, post_id, expected_row_version)


@router.patch("/posten/{post_id}", response_model=WorkPostResponse)
def update_post(request: Request, post_id: str, payload: WorkPostUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkPostResponse:
    return _service(db, request).update_post(current, post_id, payload)


async def _stream_import_envelope(request: Request) -> WorkImportEnvelope:
    limit = get_settings().work_hours_import_max_bytes
    declared = request.headers.get("content-length")
    if declared:
        try:
            if int(declared) > limit:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Importbestand is te groot")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ongeldige Content-Length") from None
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Importbestand is te groot")
        body.extend(chunk)
    try:
        raw = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Importbestand bevat geen geldige JSON") from None
    WorkHoursService.validate_json_resource_limits(raw)
    try:
        return WorkImportEnvelope.model_validate(raw)
    except ValidationError as exc:
        errors = [{"location": "$." + ".".join(str(item) for item in error["loc"]), "message": error["msg"]} for error in exc.errors()]
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "work_hours_import_validation", "errors": errors}) from None


@router.post("/import/preview", response_model=WorkImportPreviewResponse)
async def preview_import(
    request: Request,
    mode: str = Query(default="merge", pattern="^(merge|full_restore)$"),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkImportPreviewResponse:
    _service(db, request)._ensure_admin(current)
    payload = await _stream_import_envelope(request)
    return _service(db, request).preview_import(current, payload, mode)


@router.post("/import/commit", response_model=WorkImportCommitResponse)
async def commit_import(
    request: Request,
    batch_id: str,
    mode: str = Query(default="merge", pattern="^(merge|full_restore)$"),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkImportCommitResponse:
    _service(db, request)._ensure_admin(current)
    payload = await _stream_import_envelope(request)
    return _service(db, request).commit_import(current, batch_id, payload, mode)


@router.get("/import/batches/{batch_id}/backup")
def download_backup(request: Request, batch_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service = _service(db, request)
    content, filename = service.download_backup(current, batch_id)
    return Response(content=content, media_type="application/json", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.post("/historische-identiteiten/{identity_id}/koppelen", response_model=WorkHistoricalIdentityResponse)
def relink_historical_identity(
    request: Request,
    identity_id: str,
    payload: WorkHistoricalIdentityRelinkRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkHistoricalIdentityResponse:
    return _service(db, request).relink_historical_identity(current, identity_id, payload)


@router.get("/audit", response_model=WorkAuditListResponse)
def list_audit(
    request: Request,
    actor: str | None = None,
    action: str | None = None,
    result: str | None = None,
    method: str | None = None,
    path: str | None = None,
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkAuditListResponse:
    _service(db, request)._ensure_admin(current)
    repo = WorkHoursRepository(db)
    if page_size not in {25, 50, 100}:
        raise HTTPException(status_code=422, detail="Ongeldige paginagrootte")
    amsterdam = ZoneInfo("Europe/Amsterdam")
    def utc_boundary(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        localized = value if value.tzinfo else value.replace(tzinfo=amsterdam)
        return localized.astimezone(UTC)
    rows, total = repo.query_audit_events(
        actor=actor,
        action=action,
        result=result,
        method=method,
        path=path,
        from_utc=utc_boundary(from_time),
        to_utc=utc_boundary(to_time),
        page=page,
        page_size=page_size,
    )
    response: list[WorkAuditEventResponse] = []
    for row in rows:
        details = json.loads(row.details_json or "{}")
        row_result = str(details.get("result") or details.get("outcome") or "")
        row_method = str(details.get("request_method") or "")
        row_path = str(details.get("request_path") or "")
        created_at = row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=UTC)
        actor_user = repo.get_user(row.actor_user_id) if row.actor_user_id else None
        actor_name = ((actor_user.full_name or "").strip() or actor_user.username) if actor_user else "Systeem"
        response.append(
            WorkAuditEventResponse(
                id=row.id,
                event_type=row.event_type,
                actor_user_id=row.actor_user_id,
                details_json=row.details_json,
                created_at=created_at.astimezone(amsterdam),
                actor_display_name=actor_name,
                action=row.event_type,
                result=row_result,
                request_method=row_method,
                request_path=row_path,
            )
        )
    return WorkAuditListResponse(items=response, total=total, page=page, page_size=page_size)


@router.get("/admin/history", response_model=WorkAdminHistoryListResponse)
def list_admin_history(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25),
    kind: str | None = Query(default=None, pattern="^(project|post|external_person|historical_identity)$"),
    query: str | None = None,
    sort_key: str = Query(default="display_name", pattern="^(display_name|id)$"),
    sort_direction: str = Query(default="asc", pattern="^(asc|desc)$"),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkAdminHistoryListResponse:
    service = _service(db, request)
    service._ensure_admin(current)
    if page_size not in {25, 50, 100}:
        raise HTTPException(status_code=422, detail="Ongeldige paginagrootte")
    return service.list_admin_history(page=page, page_size=page_size, kind=kind, query=query, sort_key=sort_key, sort_direction=sort_direction)


@router.get("/admin/masterdata", response_model=WorkAdminMasterdataResponse)
def list_admin_masterdata(request: Request, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkAdminMasterdataResponse:
    service = _service(db, request)
    service._ensure_admin(current)
    return service.list_admin_masterdata()
