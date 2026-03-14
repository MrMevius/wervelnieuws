import csv
import io
import json
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.rate_limit import rate_limit
from app.core.settings import get_settings
from app.models.entities import (
    AuditEvent,
    SystemSetting,
    Topic,
    TopicNote,
    TopicSourceDocument,
    User,
)
from app.models.enums import ChannelName
from app.repositories.database_repository import DatabaseRepository
from app.repositories.topic_repository import TopicRepository
from app.schemas.topic import (
    AuditEventResponse,
    DocumentResponse,
    NoteCreate,
    NoteResponse,
    TopicCreate,
    TopicScheduleTemplateResponse,
    TopicThemeOptionResponse,
    TopicResponse,
    TopicUpdate,
)
from app.services.audit_service import AuditService
from app.services.ingestion_service import IngestionService, detect_doc_type

router = APIRouter(prefix="/topics", tags=["topics"])

CSV_COLUMNS = [
    "onderwerp",
    "thema",
    "project",
    "geplande_datum",
    "opmerkingen",
    "website",
    "facebook",
    "nieuwsbrief",
]

THEMES_SETTING_KEY = "admin_topic_themes_v1"
SCHEDULE_TEMPLATES_SETTING_KEY = "admin_schedule_templates_v1"
DEFAULT_ADMIN_THEMES = [
    {"id": "algemeen", "name": "Algemeen", "is_active": True},
    {"id": "planning", "name": "Planning", "is_active": True},
    {"id": "techniek", "name": "Techniek", "is_active": True},
    {"id": "omgeving", "name": "Omgeving", "is_active": True},
    {"id": "veiligheid", "name": "Veiligheid", "is_active": True},
    {"id": "participatie", "name": "Participatie", "is_active": True},
]

DEFAULT_SCHEDULE_TEMPLATES = [
    {
        "id": "weekly-update",
        "label": "Wekelijkse projectupdate",
        "subject_template": "Wekelijkse update {project}",
        "theme": "Planning",
        "editorial_notes": "Benoem voortgang, komende werkzaamheden en wat bewoners kunnen verwachten.",
        "planning_time": "09:00",
    },
    {
        "id": "monthly-overview",
        "label": "Maandoverzicht",
        "subject_template": "Maandoverzicht {project}",
        "theme": "Algemeen",
        "editorial_notes": "Vat de maand samen in rustige, feitelijke taal en benoem vervolgstappen.",
        "planning_time": "10:00",
    },
    {
        "id": "resident-info",
        "label": "Bewonersinformatie",
        "subject_template": "Informatie voor omwonenden {project}",
        "theme": "Omgeving",
        "editorial_notes": "Leg duidelijk uit wat verandert, wanneer het plaatsvindt en waar vragen gesteld kunnen worden.",
        "planning_time": "18:30",
    },
]


def _require_active_project(db: Session, project_id: str) -> None:
    project_repo = DatabaseRepository(db)
    project_repo.ensure_default_project()
    project = project_repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=400, detail="Project not found")
    if not project.is_active:
        raise HTTPException(status_code=400, detail="Project is not active")


def _parse_bool_cell(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "ja", "yes"}:
        return True
    if normalized in {"0", "false", "nee", "no"}:
        return False
    raise ValueError(f"Invalid boolean value '{value}'")


def _load_theme_options(db: Session) -> list[dict[str, str | bool]]:
    setting = db.scalar(
        select(SystemSetting).where(SystemSetting.key == THEMES_SETTING_KEY)
    )
    if not setting:
        return DEFAULT_ADMIN_THEMES
    try:
        parsed = json.loads(setting.value)
    except json.JSONDecodeError:
        return DEFAULT_ADMIN_THEMES
    if not isinstance(parsed, list):
        return DEFAULT_ADMIN_THEMES
    normalized: list[dict[str, str | bool]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        theme_id = str(item.get("id", "")).strip()
        if not name or not theme_id:
            continue
        normalized.append(
            {
                "id": theme_id,
                "name": name,
                "is_active": bool(item.get("is_active", True)),
            }
        )
    return normalized or DEFAULT_ADMIN_THEMES


def _active_theme_names(db: Session) -> set[str]:
    return {
        str(item["name"]).strip().lower()
        for item in _load_theme_options(db)
        if item.get("is_active") is True
    }


def _require_active_theme(db: Session, theme_name: str) -> None:
    normalized = theme_name.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Theme is required")
    active_names = _active_theme_names(db)
    if active_names and normalized not in active_names:
        raise HTTPException(status_code=400, detail="Theme is not active")


def _load_schedule_templates(db: Session) -> list[dict[str, str]]:
    setting = db.scalar(
        select(SystemSetting).where(SystemSetting.key == SCHEDULE_TEMPLATES_SETTING_KEY)
    )
    if not setting:
        return DEFAULT_SCHEDULE_TEMPLATES
    try:
        parsed = json.loads(setting.value)
    except json.JSONDecodeError:
        return DEFAULT_SCHEDULE_TEMPLATES
    if not isinstance(parsed, list):
        return DEFAULT_SCHEDULE_TEMPLATES
    normalized: list[dict[str, str]] = []
    required_keys = {
        "id",
        "label",
        "subject_template",
        "theme",
        "editorial_notes",
        "planning_time",
    }
    for item in parsed:
        if not isinstance(item, dict):
            continue
        if not required_keys.issubset(item.keys()):
            continue
        normalized.append(
            {
                "id": str(item["id"]),
                "label": str(item["label"]),
                "subject_template": str(item["subject_template"]),
                "theme": str(item["theme"]),
                "editorial_notes": str(item["editorial_notes"]),
                "planning_time": str(item["planning_time"]),
            }
        )
    return normalized or DEFAULT_SCHEDULE_TEMPLATES


def _parse_planning_datetime(value: str) -> datetime:
    raw = value.strip()
    if not raw:
        raise ValueError("geplande_datum is verplicht")
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("Europe/Amsterdam"))
        return dt.astimezone(UTC)
    except ValueError:
        pass

    try:
        local_dt = datetime.strptime(raw, "%Y-%m-%d %H:%M")
    except ValueError as exc:
        raise ValueError("geplande_datum moet ISO zijn of YYYY-MM-DD HH:MM") from exc
    return local_dt.replace(tzinfo=ZoneInfo("Europe/Amsterdam")).astimezone(UTC)


@router.get("", response_model=list[TopicResponse])
def list_topics(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Topic]:
    del current
    DatabaseRepository(db).ensure_default_project()
    return TopicRepository(db).list()


@router.get("/themes", response_model=list[TopicThemeOptionResponse])
def list_topic_themes(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TopicThemeOptionResponse]:
    del current
    options = [
        item for item in _load_theme_options(db) if item.get("is_active") is True
    ]
    return [
        TopicThemeOptionResponse(
            id=str(item["id"]),
            name=str(item["name"]),
        )
        for item in options
    ]


@router.get("/schedule-templates", response_model=list[TopicScheduleTemplateResponse])
def list_topic_schedule_templates(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TopicScheduleTemplateResponse]:
    del current
    return [
        TopicScheduleTemplateResponse.model_validate(item)
        for item in _load_schedule_templates(db)
    ]


@router.post("", response_model=TopicResponse)
def create_topic(
    payload: TopicCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Topic:
    _require_active_project(db, payload.project_id)
    _require_active_theme(db, payload.theme)
    payload_data = payload.model_dump(exclude={"target_channels"})
    topic = TopicRepository(db).create(**payload_data)
    topic.target_channels = payload.target_channels
    topic = TopicRepository(db).save(topic)
    AuditService(db).log("topic.created", topic_id=topic.id, actor_user_id=current.id)
    return topic


@router.get("/{topic_id}", response_model=TopicResponse)
def get_topic(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Topic:
    del current
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.patch("/{topic_id}", response_model=TopicResponse)
def update_topic(
    topic_id: str,
    payload: TopicUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Topic:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    updates = payload.model_dump(exclude_none=True)
    if "project_id" in updates:
        _require_active_project(db, updates["project_id"])
    if "theme" in updates:
        _require_active_theme(db, str(updates["theme"]))
    for key, value in updates.items():
        setattr(topic, key, value)
    topic = TopicRepository(db).save(topic)
    AuditService(db).log("topic.updated", topic_id=topic.id, actor_user_id=current.id)
    return topic


@router.delete("/{topic_id}")
def delete_topic(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
    AuditService(db).log("topic.deleted", topic_id=topic_id, actor_user_id=current.id)
    return {"status": "deleted"}


@router.post("/import-csv")
async def import_topics_csv(
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    settings = get_settings()
    content = await file.read(settings.upload_max_bytes + 1)
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(status_code=400, detail="File too large")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty upload is not allowed")
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="CSV must be UTF-8 encoded"
        ) from exc

    reader = csv.DictReader(io.StringIO(decoded))
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]
    if headers != CSV_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"CSV columns must be exactly: {', '.join(CSV_COLUMNS)}",
        )

    repo = TopicRepository(db)
    project_repo = DatabaseRepository(db)
    project_repo.ensure_default_project()
    errors: list[dict[str, str | int]] = []
    created = 0
    for row_index, row in enumerate(reader, start=2):
        try:
            subject = (row.get("onderwerp") or "").strip()
            theme = (row.get("thema") or "").strip()
            project_name = (row.get("project") or "").strip()
            editorial_notes = (row.get("opmerkingen") or "").strip()
            planning_at = _parse_planning_datetime(row.get("geplande_datum") or "")

            project = project_repo.get_project_by_name(project_name)
            if not project:
                raise ValueError(f"Onbekend project '{project_name}'")
            if not project.is_active:
                raise ValueError(f"Project '{project_name}' is inactief")
            if theme.lower() not in _active_theme_names(db):
                raise ValueError(f"Thema '{theme}' is onbekend of inactief")

            selected_channels: list[ChannelName] = []
            if _parse_bool_cell(row.get("website") or ""):
                selected_channels.append(ChannelName.website)
            if _parse_bool_cell(row.get("facebook") or ""):
                selected_channels.append(ChannelName.facebook)
            if _parse_bool_cell(row.get("nieuwsbrief") or ""):
                selected_channels.append(ChannelName.newsletter)
            if not selected_channels:
                raise ValueError("Minimaal een doelmedium moet aan staan")

            payload = TopicCreate(
                title=subject,
                subject=subject,
                theme=theme,
                project_id=project.id,
                editorial_notes=editorial_notes,
                planning_at=planning_at,
                target_channels=selected_channels,
            )
            topic = repo.create(**payload.model_dump(exclude={"target_channels"}))
            topic.target_channels = payload.target_channels
            repo.save(topic)
            AuditService(db).log(
                "topic.created.from_csv", topic_id=topic.id, actor_user_id=current.id
            )
            created += 1
        except (ValueError, ValidationError) as exc:
            errors.append({"line": row_index, "error": str(exc)})

    return {
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/{topic_id}/notes")
def create_note(
    topic_id: str,
    payload: NoteCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    note = TopicRepository(db).add_note(topic_id, payload.note)
    AuditService(db).log(
        "topic.note.added", topic_id=topic.id, actor_user_id=current.id
    )
    return {"id": note.id, "note": note.note}


@router.post(
    "/{topic_id}/documents",
    response_model=DocumentResponse,
    dependencies=[Depends(rate_limit)],
)
async def upload_document(
    topic_id: str,
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    settings = get_settings()
    doc_type = detect_doc_type(file.filename)
    content = await file.read(settings.upload_max_bytes + 1)
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(status_code=400, detail="File too large")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty upload is not allowed")

    allowed_prefixes = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/markdown",
    }
    if file.content_type and file.content_type not in allowed_prefixes:
        raise HTTPException(status_code=400, detail="Unsupported content type")
    storage_dir = settings.storage_root / settings.uploads_dir / topic_id
    storage_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename).name
    path = storage_dir / safe_name
    path.write_bytes(content)

    repo = TopicRepository(db)
    document = repo.add_document(
        topic_id=topic_id,
        filename=safe_name,
        file_path=str(path),
        content_type=file.content_type or "application/octet-stream",
        doc_type=doc_type,
    )
    IngestionService(db).ingest_document(document)
    AuditService(db).log(
        "topic.document.uploaded", topic_id=topic_id, actor_user_id=current.id
    )
    return document


@router.get("/{topic_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TopicSourceDocument]:
    del current
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic.source_documents


@router.get("/{topic_id}/notes", response_model=list[NoteResponse])
def list_notes(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TopicNote]:
    del current
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic.notes


@router.get("/{topic_id}/audit-events", response_model=list[AuditEventResponse])
def list_audit_events(
    topic_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AuditEvent]:
    del current
    topic = TopicRepository(db).get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.topic_id == topic_id)
        .order_by(desc(AuditEvent.created_at))
        .all()
    )
