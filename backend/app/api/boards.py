from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import Recording, User
from app.repositories.board_repository import BoardRepository
from app.schemas.boards import (
    BoardCardCreateRequest,
    BoardCardMoveRequest,
    BoardCardDescriptionUpdateRequest,
    BoardCardResponse,
    BoardCardTitleUpdateRequest,
    BoardProjectCreateRequest,
    BoardProjectSummaryResponse,
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


def _build_move_update_message(old_column: str, new_column: str, actor_display_name: str) -> str:
    return (
        f"Verplaatst van {_column_label_nl(old_column)} naar {_column_label_nl(new_column)} "
        f"door {actor_display_name}."
    )


def _card_response(repo: BoardRepository, card) -> BoardCardResponse:
    return BoardCardResponse(
        id=card.id,
        project_id=card.project_id,
        title=card.title,
        description=card.description,
        column=card.column,
        position=card.position,
        assignments=[
            CardAssignmentResponse(
                id=row.id,
                user_id=row.user_id,
                username=row.user.username,
                user_display_name=_display_name(row.user),
            )
            for row in card.assignments
        ],
        updates_count=repo.count_updates(card.id),
        recordings_count=repo.count_recordings(card.id),
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


@router.post("/projects", response_model=BoardProjectSummaryResponse)
def create_project(payload: BoardProjectCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardProjectSummaryResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    invited = service.ensure_invited_users_exist(payload.invited_user_ids)
    if current.id not in invited:
        invited.append(current.id)
    project = repo.create_project(payload.name, payload.description, invited)
    AuditService(db).log("board.project.created", actor_user_id=current.id, details_json=service.audit_details(project_id=project.id))
    return BoardProjectSummaryResponse(id=project.id, name=project.name, description=project.description, invited_user_ids=project.invited_user_ids, card_count=0, last_activity_at=project.last_activity_at)


@router.get("/projects/{project_id}", response_model=ProjectBoardResponse)
def get_project_board(project_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectBoardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    project = service.ensure_project_access(repo.get_project(project_id), current)
    cards = repo.list_project_cards(project.id)
    return ProjectBoardResponse(project_id=project.id, project_name=project.name, invited_user_ids=project.invited_user_ids, cards=[_card_response(repo, card) for card in cards])


@router.post("/projects/{project_id}/cards", response_model=BoardCardResponse)
def create_card(project_id: str, payload: BoardCardCreateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BoardCardResponse:
    repo = BoardRepository(db)
    service = BoardService(repo)
    project = service.ensure_project_access(repo.get_project(project_id), current)
    card = repo.create_card(project.id, payload.title, payload.description, payload.column)
    repo.replace_assignments(card, service.ensure_invited_users_exist(payload.assignment_user_ids))
    card = service.ensure_card_access(repo.get_card(card.id), current)
    service.touch_activity(project)
    AuditService(db).log("board.card.created", actor_user_id=current.id, details_json=service.audit_details(project_id=project.id, card_id=card.id))
    return _card_response(repo, card)


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
            _build_move_update_message(old_column, moved.column.value, _display_name(current)),
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
    return CardDetailResponse(
        card=_card_response(repo, card),
        updates=[
            CardUpdateResponse(
                id=row.id,
                author_user_id=row.author_user_id,
                author_username=author.username if (author := repo.get_user(row.author_user_id)) else "onbekend",
                author_display_name=_display_name(author),
                message=row.message,
                created_at=row.created_at,
            )
            for row in updates
        ],
        recordings=[
            RecordingResponse(
                id=row.id,
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
        created_at=row.created_at,
    )


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
    file_path, size_bytes, mime_type, filename = service.store_recording(card, file)
    row = repo.create_recording(card.id, current.id, filename, file_path, duration, mime_type, size_bytes)
    service.touch_activity(service.ensure_project_access(repo.get_project(card.project_id), current))
    AuditService(db).log("board.recording.created", actor_user_id=current.id, details_json=service.audit_details(card_id=card.id, recording_id=row.id))
    return RecordingResponse(
        id=row.id,
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
