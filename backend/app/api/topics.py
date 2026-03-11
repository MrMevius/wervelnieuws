from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.rate_limit import rate_limit
from app.core.settings import get_settings
from app.models.entities import AuditEvent, Topic, TopicNote, TopicSourceDocument, User
from app.repositories.topic_repository import TopicRepository
from app.schemas.topic import (
    AuditEventResponse,
    DocumentResponse,
    NoteCreate,
    NoteResponse,
    TopicCreate,
    TopicResponse,
    TopicUpdate,
)
from app.services.audit_service import AuditService
from app.services.ingestion_service import IngestionService, detect_doc_type

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=list[TopicResponse])
def list_topics(
    current: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Topic]:
    del current
    return TopicRepository(db).list()


@router.post("", response_model=TopicResponse)
def create_topic(
    payload: TopicCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Topic:
    topic = TopicRepository(db).create(**payload.model_dump())
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
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(topic, key, value)
    topic = TopicRepository(db).save(topic)
    AuditService(db).log("topic.updated", topic_id=topic.id, actor_user_id=current.id)
    return topic


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
