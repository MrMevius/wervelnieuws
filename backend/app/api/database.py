from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.db import get_db
from app.core.rate_limit import rate_limit
from app.core.settings import get_settings
from app.models.entities import KnowledgeDocument, User
from app.repositories.database_repository import DatabaseRepository
from app.schemas.database import (
    DatabaseBulkActionRequest,
    DatabaseBulkActionResponse,
    DatabaseDocumentResponse,
    ProjectResponse,
)
from app.services.audit_service import AuditService
from app.services.ingestion_service import IngestionService, detect_doc_type

router = APIRouter(prefix="/database", tags=["database"])


def _to_document_response(document: KnowledgeDocument) -> DatabaseDocumentResponse:
    project = document.project
    uploaded_by = document.uploaded_by
    if not project or not uploaded_by:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document metadata is incomplete",
        )
    return DatabaseDocumentResponse(
        id=document.id,
        filename=document.filename,
        doc_type=document.doc_type.value,
        status=document.status,
        extraction_error=document.extraction_error,
        size_bytes=document.size_bytes,
        project_id=project.id,
        project_name=project.name,
        uploaded_by_user_id=uploaded_by.id,
        uploaded_by_username=uploaded_by.username,
        created_at=document.created_at,
    )


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    del current
    repo = DatabaseRepository(db)
    projects = repo.list_projects(include_inactive=False)
    return [ProjectResponse.model_validate(project) for project in projects]


@router.post(
    "/documents",
    response_model=DatabaseDocumentResponse,
    dependencies=[Depends(rate_limit)],
)
async def upload_document(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatabaseDocumentResponse:
    repo = DatabaseRepository(db)
    repo.ensure_default_project()
    project = repo.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.is_active:
        raise HTTPException(status_code=400, detail="Project is not active")

    settings = get_settings()
    try:
        doc_type = detect_doc_type(file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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

    safe_name = Path(file.filename).name
    stored_name = f"{uuid4().hex}_{safe_name}"
    storage_dir = settings.storage_root / settings.uploads_dir / "database" / project_id
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / stored_name
    file_path.write_bytes(content)

    created = repo.add_document(
        project_id=project_id,
        uploaded_by_user_id=current.id,
        filename=safe_name,
        file_path=str(file_path),
        content_type=file.content_type or "application/octet-stream",
        doc_type=doc_type,
        size_bytes=len(content),
    )
    IngestionService(db).ingest_knowledge_document(created)

    AuditService(db).log(
        "database.document.uploaded",
        actor_user_id=current.id,
    )
    loaded = repo.list_documents(project_id=project_id)
    created_loaded = next((row for row in loaded if row.id == created.id), None)
    if not created_loaded:
        raise HTTPException(status_code=500, detail="Document could not be loaded")
    return _to_document_response(created_loaded)


@router.get("/documents", response_model=list[DatabaseDocumentResponse])
def list_documents(
    project_id: str | None = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DatabaseDocumentResponse]:
    del current
    repo = DatabaseRepository(db)
    repo.ensure_default_project()
    documents = repo.list_documents(project_id=project_id)
    return [_to_document_response(document) for document in documents]


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    repo = DatabaseRepository(db)
    document = repo.get_document(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(document.file_path)
    repo.delete_document(document)
    if file_path.exists():
        file_path.unlink()

    AuditService(db).log(
        "database.document.deleted",
        actor_user_id=current.id,
    )
    return {"status": "ok"}


@router.post("/documents/bulk/delete", response_model=DatabaseBulkActionResponse)
def bulk_delete_documents(
    payload: DatabaseBulkActionRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DatabaseBulkActionResponse:
    repo = DatabaseRepository(db)
    documents = repo.list_documents_by_ids(payload.document_ids)
    if len(documents) != len(payload.document_ids):
        raise HTTPException(status_code=404, detail="One or more documents not found")

    affected = 0
    for document in documents:
        file_path = Path(document.file_path)
        repo.delete_document(document)
        if file_path.exists():
            file_path.unlink()
        affected += 1

    AuditService(db).log(
        "database.document.bulk_deleted",
        actor_user_id=current.id,
    )
    return DatabaseBulkActionResponse(status="ok", affected=affected)


@router.post("/documents/bulk/move", response_model=DatabaseBulkActionResponse)
def bulk_move_documents(
    payload: DatabaseBulkActionRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatabaseBulkActionResponse:
    if not payload.target_project_id:
        raise HTTPException(status_code=400, detail="target_project_id is required")

    repo = DatabaseRepository(db)
    target = repo.get_project(payload.target_project_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target project not found")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Target project is not active")

    documents = repo.list_documents_by_ids(payload.document_ids)
    if len(documents) != len(payload.document_ids):
        raise HTTPException(status_code=404, detail="One or more documents not found")

    affected = 0
    for document in documents:
        document.project_id = target.id
        repo.save_document(document)
        repo.update_chunk_project_for_document(
            knowledge_document_id=document.id,
            project_id=target.id,
        )
        affected += 1

    AuditService(db).log(
        "database.document.bulk_moved",
        actor_user_id=current.id,
    )
    return DatabaseBulkActionResponse(status="ok", affected=affected)


@router.post("/documents/bulk/copy", response_model=DatabaseBulkActionResponse)
def bulk_copy_documents(
    payload: DatabaseBulkActionRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatabaseBulkActionResponse:
    if not payload.target_project_id:
        raise HTTPException(status_code=400, detail="target_project_id is required")

    repo = DatabaseRepository(db)
    target = repo.get_project(payload.target_project_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target project not found")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Target project is not active")

    documents = repo.list_documents_by_ids(payload.document_ids)
    if len(documents) != len(payload.document_ids):
        raise HTTPException(status_code=404, detail="One or more documents not found")

    settings = get_settings()
    affected = 0
    for document in documents:
        source_path = Path(document.file_path)
        if not source_path.exists():
            continue

        safe_name = Path(document.filename).name
        stored_name = f"{uuid4().hex}_{safe_name}"
        storage_dir = (
            settings.storage_root / settings.uploads_dir / "database" / target.id
        )
        storage_dir.mkdir(parents=True, exist_ok=True)
        target_path = storage_dir / stored_name
        target_path.write_bytes(source_path.read_bytes())

        created = repo.add_document(
            project_id=target.id,
            uploaded_by_user_id=current.id,
            filename=safe_name,
            file_path=str(target_path),
            content_type=document.content_type,
            doc_type=document.doc_type,
            size_bytes=document.size_bytes,
        )
        IngestionService(db).ingest_knowledge_document(created)
        affected += 1

    AuditService(db).log(
        "database.document.bulk_copied",
        actor_user_id=current.id,
    )
    return DatabaseBulkActionResponse(status="ok", affected=affected)
