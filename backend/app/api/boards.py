from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.db import get_db
from app.models.entities import Recording, User
from app.repositories.board_repository import BoardRepository
from app.schemas.boards import (
    BoardAccessUserResponse,
    BoardCardCreateRequest,
    BoardCardMoveRequest,
    BoardCardDescriptionUpdateRequest,
    BoardAttachmentResponse,
    BoardCardResponse,
    BoardCardTitleUpdateRequest,
    BoardProjectCreateRequest,
    BoardProjectRightsResponse,
    BoardProjectRightsUpdateRequest,
    BoardProjectSummaryResponse,
    BoardRecycleBinCardResponse,
    BoardRightsOverviewResponse,
    BoardRightsUserResponse,
    CardAssignmentResponse,
    CardDetailResponse,
    CardUpdateCreateRequest,
    CardUpdateResponse,
    ProjectBoardResponse,
    RecordingResponse,
)
from app.services.audit_service import AuditService
from app.services.board_service import BoardService

router = APIRouter(prefix="/boards", tags=["boards"])

_COLUMN_LABELS_NL = {
    "todo": "Te doen",
    "doing": "Bezig",
    "done": "Klaar",
}


def _column_label_nl(column_value: str) -> str:
    return _COLUMN_LABELS_NL.get(column_value, column_value)


def _display_name(user: User | None) -> str:
    if not user:
        return "onbekend"
    return (user.full_name or "").strip() or user.username


def _access_user_sort_key(user: User) -> tuple[int, str, str]:
    return (
        0 if user.is_admin else 1,
        _display_name(user).casefold(),
        user.username.casefold(),
    )


def _project_access_users(repo: BoardRepository, project) -> list[BoardAccessUserResponse]:
    invited_ids = set(project.invited_user_ids)
    users = [
        user
        for user in repo.list_users()
        if user.is_admin or user.id in invited_ids
    ]
    ordered_users = sorted(users, key=_access_user_sort_key)
    unique_users: dict[str, BoardAccessUserResponse] = {}
    for user in ordered_users:
        if user.id in unique_users:
            continue
        unique_users[user.id] = BoardAccessUserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            is_admin=user.is_admin,
            is_active=user.is_active,
            has_avatar=bool(user.avatar_path),
        )
    return list(unique_users.values())


def _build_move_update_message(old_column: str, new_column: str) -> str:
    return f"Kaart verplaatst van {_column_label_nl(old_column)} naar {_column_label_nl(new_column)}."


def _card_response(repo: BoardRepository, card) -> BoardCardResponse:
    return BoardCardResponse(
        id=card.id,
        project_id=card.project_id,
        title=card.title,
        description=card.description,
        column=card.column,
        position=card.position,
        is_archived=card.is_archived,
        assignments=[
            CardAssignmentResponse(
                id=row.id,
                user_id=row.user_id,
                username=row.user.username,
                user_display_name=_display_name(row.user),
                has_avatar=bool(row.user.avatar_path),
            )
            for row in card.assignments
        ],
        updates_count=repo.count_updates(card.id),
        recordings_count=repo.count_recordings(card.id),
        attachments_count=repo.count_attachments(card.id),
    )


def _recycle_bin_card_response(repo: BoardRepository, card) -> BoardRecycleBinCardResponse:
    deleted_by = card.deleted_by or (repo.get_user(card.deleted_by_user_id) if card.deleted_by_user_id else None)
    project = card.project or repo.get_project(card.project_id)
    return BoardRecycleBinCardResponse(
        id=card.id,
        project_id=card.project_id,
        project_name=project.name if project else "Onbekend project",
        title=card.title,
        description=card.description,
        column=card.column,
        position=card.position,
        is_archived=card.is_archived,
        deleted_at=card.deleted_at,
        deleted_by_user_id=card.deleted_by_user_id,
        deleted_by_username=deleted_by.username if deleted_by else None,
        deleted_by_display_name=_display_name(deleted_by) if deleted_by else None,
        assignments=[
            CardAssignmentResponse(
                id=row.id,
                user_id=row.user_id,
                username=row.user.username,
                user_display_name=_display_name(row.user),
                has_avatar=bool(row.user.avatar_path),
            )
            for row in card.assignments
        ],
        updates_count=repo.count_updates(card.id),
        recordings_count=repo.count_recordings(card.id),
        attachments_count=repo.count_attachments(card.id),
    )


def _update_image_url(update_id: str, image_path: str | None) -> str | None:
    if not image_path:
        return None
    return f"/api/boards/updates/{update_id}/image"


def _attachment_response(repo: BoardRepository, row) -> BoardAttachmentResponse:
    uploaded_by = row.uploaded_by or repo.get_user(row.uploaded_by_user_id)
    return BoardAttachmentResponse(
        id=row.id,
        uploaded_by_user_id=row.uploaded_by_user_id,
        uploaded_by_username=uploaded_by.username if uploaded_by else None,
        uploaded_by_display_name=_display_name(uploaded_by),
        filename=row.filename,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        created_at=row.created_at,
        download_url=f"/api/boards/attachments/{row.id}/download",
    )


@router.get("/projects", response_model=list[BoardProjectSummaryResponse])
def list_projects(current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BoardProjectSummaryResponse]:
    repo = BoardRepository(db)
    service = BoardService(repo)
    projects = service.list_visible_projects(current)
    result: list[BoardProjectSummaryResponse] = []
    for project in projects:
        card_count = len(repo.list_project_cards(project.id))
        result.append(
            BoardProjectSummaryResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                invited_user_ids=project.invited_user_ids,
                card_count=card_count,
                last_activity_at=project.last_activity_at,
            )
        )
    return result


def _project_rights_response(repo: BoardRepository, project) -> BoardProjectRightsResponse:
    return BoardProjectRightsResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        invited_user_ids=project.invited_user_ids,
        card_count=len(repo.list_project_cards(project.id)),
        last_activity_at=project.last_activity_at,
    )


@router.get("/admin/rights", response_model=BoardRightsOverviewResponse)
def list_board_rights(current: User = Depends(require_admin), db: Session = Depends(get_db)) -> BoardRightsOverviewResponse:
    del current
    repo = BoardRepository(db)
    users = [
        BoardRightsUserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_admin=user.is_admin,
            is_active=user.is_active,
            has_avatar=bool(user.avatar_path),
        )
        for user in repo.list_users()
    ]
    return BoardRightsOverviewResponse(
        users=users,
        projects=[_project_rights_response(repo, project) for project in repo.list_projects()],
    )


@router.patch("/admin/projects/{project_id}/rights", response_model=BoardProjectRightsResponse)
def update_board_rights(
    project_id: str,
    payload: BoardProjectRightsUpdateRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BoardProjectRightsResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    project = service.update_project_access_rights(project_id, payload.invited_user_ids)
    AuditService(db).log("board.project.rights_updated", actor_user_id=current.id, details_json=service.audit_details(project_id=project.id))
    return _project_rights_response(repo, project)


@router.delete("/admin/projects/{project_id}", response_model=BoardProjectRightsResponse)
def archive_board_project(project_id: str, current: User = Depends(require_admin), db: Session = Depends(get_db)) -> BoardProjectRightsResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    project = service.archive_project(project_id)
    AuditService(db).log("board.project.archived", actor_user_id=current.id, details_json=service.audit_details(project_id=project.id))
    return _project_rights_response(repo, project)


@router.post("/projects", response_model=BoardProjectSummaryResponse)
def create_project(payload: BoardProjectCreateRequest, current: User = Depends(require_admin), db: Session = Depends(get_db)) -> BoardProjectSummaryResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    invited = service.ensure_active_non_admin_users_exist(payload.invited_user_ids)
    project = repo.create_project(payload.name, payload.description, invited)
    AuditService(db).log("board.project.created", actor_user_id=current.id, details_json=service.audit_details(project_id=project.id))
    return BoardProjectSummaryResponse(id=project.id, name=project.name, description=project.description, invited_user_ids=project.invited_user_ids, card_count=0, last_activity_at=project.last_activity_at)


@router.get("/projects/{project_id}", response_model=ProjectBoardResponse)
def get_project_board(project_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectBoardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    project = service.ensure_project_access(repo.get_project(project_id), current)
    cards = repo.list_project_cards(project.id)
    archived_cards = repo.list_archived_project_cards(project.id)
    return ProjectBoardResponse(
        project_id=project.id,
        project_name=project.name,
        invited_user_ids=project.invited_user_ids,
        access_users=_project_access_users(repo, project),
        cards=[_card_response(repo, card) for card in cards],
        archived_cards=[_card_response(repo, card) for card in archived_cards],
    )


@router.post("/projects/{project_id}/cards", response_model=BoardCardResponse)
def create_card(project_id: str, payload: BoardCardCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    project = service.ensure_project_access(repo.get_project(project_id), current)
    assignment_user_ids = service.ensure_active_board_assignment_users(project, payload.assignment_user_ids)
    card = repo.create_card(project.id, payload.title, payload.description, payload.column)
    repo.replace_assignments(card, assignment_user_ids)
    card = service.ensure_card_access(repo.get_card(card.id), current)
    service.touch_activity(project)
    AuditService(db).log("board.card.created", actor_user_id=current.id, details_json=service.audit_details(project_id=project.id, card_id=card.id))
    return _card_response(repo, card)


@router.patch("/cards/{card_id}/archive", response_model=BoardCardResponse)
def archive_card(card_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    archived = repo.archive_card(card)
    service.touch_activity(service.ensure_project_access(repo.get_project(archived.project_id), current))
    AuditService(db).log("board.card.archived", actor_user_id=current.id, details_json=service.audit_details(card_id=archived.id, project_id=archived.project_id))
    return _card_response(repo, archived)


@router.patch("/cards/{card_id}/restore", response_model=BoardCardResponse)
def restore_archived_card(card_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    restored = repo.restore_card(card)
    service.touch_activity(service.ensure_project_access(repo.get_project(restored.project_id), current))
    AuditService(db).log("board.card.restored", actor_user_id=current.id, details_json=service.audit_details(card_id=restored.id, project_id=restored.project_id))
    return _card_response(repo, restored)


@router.delete("/cards/{card_id}")
def soft_delete_card(card_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    repo.soft_delete_card(card, current.id)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log("board.card.deleted", actor_user_id=current.id, details_json=service.audit_details(card_id=card.id, project_id=card.project_id))
    return {"status": "deleted"}


@router.get("/admin/recycle-bin", response_model=list[BoardRecycleBinCardResponse])
def list_recycle_bin(current: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[BoardRecycleBinCardResponse]:
    del current
    repo = BoardRepository(db)
    return [_recycle_bin_card_response(repo, card) for card in repo.list_deleted_cards()]


@router.patch("/admin/recycle-bin/{card_id}/restore", response_model=BoardCardResponse)
def restore_deleted_card(card_id: str, current: User = Depends(require_admin), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = repo.get_card(card_id, include_deleted=True)
    if not card or card.deleted_at is None:
        raise HTTPException(status_code=404, detail="Kaart niet gevonden")
    restored = repo.restore_deleted_card(card)
    service.touch_activity(service.ensure_project_access(repo.get_project(restored.project_id), current))
    AuditService(db).log("board.card.deleted_restored", actor_user_id=current.id, details_json=service.audit_details(card_id=restored.id, project_id=restored.project_id))
    return _card_response(repo, restored)


@router.patch("/cards/{card_id}/move", response_model=BoardCardResponse)
def move_card(card_id: str, payload: BoardCardMoveRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    old_column = card.column.value
    moved = repo.move_card(card, payload.column, payload.position)
    if old_column != moved.column.value:
        repo.create_update(
            moved.id,
            current.id,
            _build_move_update_message(old_column, moved.column.value),
        )
    service.touch_activity(service.ensure_project_access(repo.get_project(moved.project_id), current))
    AuditService(db).log("board.card.moved", actor_user_id=current.id, details_json=service.audit_details(card_id=card.id, column=payload.column.value, position=payload.position))
    return _card_response(repo, moved)


@router.patch("/cards/{card_id}/title", response_model=BoardCardResponse)
def update_card_title(card_id: str, payload: BoardCardTitleUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    previous_title = card.title
    updated = repo.update_card_title(card, payload.title)
    service.touch_activity(service.ensure_project_access(repo.get_project(updated.project_id), current))
    AuditService(db).log(
        "board.card.title_updated",
        actor_user_id=current.id,
        details_json=service.audit_details(card_id=updated.id, previous_title=previous_title, title=updated.title),
    )
    return _card_response(repo, updated)


@router.patch("/cards/{card_id}/description", response_model=BoardCardResponse)
def update_card_description(card_id: str, payload: BoardCardDescriptionUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    updated = repo.update_card_description(card, payload.description)
    service.touch_activity(service.ensure_project_access(repo.get_project(updated.project_id), current))
    return _card_response(repo, updated)


@router.get("/cards/{card_id}", response_model=CardDetailResponse)
def get_card_detail(card_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CardDetailResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    updates = repo.list_updates(card.id)
    recordings = repo.list_recordings(card.id)
    attachments = repo.list_attachments(card.id)
    return CardDetailResponse(
        card=_card_response(repo, card),
        updates=[
            CardUpdateResponse(
                id=row.id,
                author_user_id=row.author_user_id,
                author_username=author.username if (author := repo.get_user(row.author_user_id)) else "onbekend",
                author_display_name=_display_name(author),
                message=row.message,
                image_url=_update_image_url(row.id, row.image_path),
                edited_from_update_id=row.edited_from_update_id,
                created_at=row.created_at,
            )
            for row in updates
        ],
        recordings=[
            RecordingResponse(
                id=row.id,
                uploaded_by_user_id=row.uploaded_by_user_id,
                uploaded_by_username=recording_user.username if (recording_user := repo.get_user(row.uploaded_by_user_id)) else None,
                uploaded_by_display_name=_display_name(recording_user),
                filename=row.filename,
                file_path=row.file_path,
                duration=row.duration,
                recorded_at=row.recorded_at,
                transcription_status=row.transcription_status,
                transcription_text=row.transcription_text,
                mime_type=row.mime_type,
                size_bytes=row.size_bytes,
                created_at=row.created_at,
                download_url=f"/api/boards/recordings/{row.id}/download",
            )
            for row in recordings
        ],
        attachments=[_attachment_response(repo, row) for row in attachments],
    )


@router.post("/cards/{card_id}/updates", response_model=CardUpdateResponse)
def post_update(card_id: str, payload: CardUpdateCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CardUpdateResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    row = repo.create_update(card.id, current.id, payload.message)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log("board.card.updated", actor_user_id=current.id, details_json=service.audit_details(card_id=card.id, update_id=row.id))
    return CardUpdateResponse(
        id=row.id,
        author_user_id=row.author_user_id,
        author_username=current.username,
        author_display_name=_display_name(current),
        message=row.message,
        image_url=_update_image_url(row.id, row.image_path),
        edited_from_update_id=row.edited_from_update_id,
        created_at=row.created_at,
    )


@router.patch("/cards/{card_id}/updates/{update_id}", response_model=CardUpdateResponse)
def edit_own_update(
    card_id: str,
    update_id: str,
    message: str = Form(...),
    remove_image: bool = Form(default=False),
    image: UploadFile | None = File(default=None),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CardUpdateResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    update = repo.get_update(update_id)
    if not update or update.card_id != card.id or update.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Update niet gevonden")
    if update.author_user_id != current.id:
        raise HTTPException(status_code=403, detail="Alleen de auteur mag deze update aanpassen")

    normalized = message.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="Updatetekst mag niet leeg zijn")

    image_path = update.image_path
    if remove_image:
        image_path = None
    if image is not None:
        image_path = service.store_update_image(card, image)

    revised = repo.create_update_revision(update, normalized, image_path)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log("board.card.update_edited", actor_user_id=current.id, details_json=service.audit_details(card_id=card.id, update_id=revised.id, edited_from_update_id=update.id))
    return CardUpdateResponse(
        id=revised.id,
        author_user_id=revised.author_user_id,
        author_username=current.username,
        author_display_name=_display_name(current),
        message=revised.message,
        image_url=_update_image_url(revised.id, revised.image_path),
        edited_from_update_id=revised.edited_from_update_id,
        created_at=revised.created_at,
    )


@router.delete("/cards/{card_id}/updates/{update_id}")
def delete_own_update(
    card_id: str,
    update_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    update = repo.get_update(update_id)
    if not update or update.card_id != card.id or update.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Update niet gevonden")
    if update.author_user_id != current.id:
        raise HTTPException(status_code=403, detail="Alleen de auteur mag deze update verwijderen")

    repo.soft_delete_update(update, current.id)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log(
        "board.card.update_deleted",
        actor_user_id=current.id,
        details_json=service.audit_details(card_id=card.id, update_id=update.id),
    )
    return {"status": "deleted"}


@router.post("/cards/{card_id}/recordings", response_model=RecordingResponse)
def upload_recording(
    card_id: str,
    file: UploadFile = File(...),
    duration: int | None = Form(default=None),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecordingResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    normalized_duration = duration if (isinstance(duration, int) and duration > 0) else None
    file_path, size_bytes, mime_type, filename = service.store_recording(card, file)
    row = repo.create_recording(card.id, current.id, filename, file_path, normalized_duration, mime_type, size_bytes)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log("board.recording.created", actor_user_id=current.id, details_json=service.audit_details(card_id=card.id, recording_id=row.id))
    return RecordingResponse(
        id=row.id,
        uploaded_by_user_id=row.uploaded_by_user_id,
        uploaded_by_username=current.username,
        uploaded_by_display_name=_display_name(current),
        filename=row.filename,
        file_path=row.file_path,
        duration=row.duration,
        recorded_at=row.recorded_at,
        transcription_status=row.transcription_status,
        transcription_text=row.transcription_text,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        created_at=row.created_at,
        download_url=f"/api/boards/recordings/{row.id}/download",
    )


@router.post("/cards/{card_id}/attachments", response_model=BoardAttachmentResponse)
def upload_attachment(
    card_id: str,
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BoardAttachmentResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    file_path, size_bytes, mime_type, filename = service.store_card_attachment(card, file)
    row = repo.create_attachment(card.id, current.id, filename, file_path, mime_type, size_bytes)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log(
        "board.card.attachment_created",
        actor_user_id=current.id,
        details_json=service.audit_details(card_id=card.id, attachment_id=row.id),
    )
    return _attachment_response(repo, row)


@router.delete("/cards/{card_id}/attachments/{attachment_id}")
def delete_attachment(
    card_id: str,
    attachment_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    repo = BoardRepository(db)
    service = BoardService(repo)
    card = service.ensure_card_access(repo.get_card(card_id), current)
    attachment = repo.get_attachment(attachment_id)
    if not attachment or attachment.card_id != card.id:
        raise HTTPException(status_code=404, detail="Bijlage niet gevonden")

    file_path = Path(attachment.file_path)
    repo.delete_attachment(attachment)
    if file_path.exists() and file_path.is_file():
        file_path.unlink(missing_ok=True)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log(
        "board.card.attachment_deleted",
        actor_user_id=current.id,
        details_json=service.audit_details(card_id=card.id, attachment_id=attachment_id),
    )
    return {"status": "deleted"}


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> FileResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    attachment = repo.get_attachment(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Bijlage niet gevonden")
    card = service.ensure_card_access(repo.get_card(attachment.card_id), current)
    del card
    file_path = Path(attachment.file_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Bijlage niet gevonden")
    return FileResponse(path=str(file_path), media_type=attachment.mime_type, filename=attachment.filename)


@router.get("/recordings/{recording_id}/download")
def download_recording(recording_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> FileResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    recording = db.get(Recording, recording_id)
    if not recording:
        raise HTTPException(status_code=404, detail="Opname niet gevonden")
    card = service.ensure_card_access(repo.get_card(recording.card_id), current)
    del card
    return FileResponse(path=recording.file_path, media_type=recording.mime_type, filename=recording.filename)


@router.get("/updates/{update_id}/image")
def download_update_image(update_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> FileResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    update = repo.get_update(update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Update niet gevonden")
    card = service.ensure_card_access(repo.get_card(update.card_id), current)
    del card
    if not update.image_path:
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    file_path = Path(update.image_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    return FileResponse(path=str(file_path))
