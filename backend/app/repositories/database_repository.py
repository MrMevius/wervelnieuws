from sqlalchemy import desc, select, text
from sqlalchemy.orm import Session, joinedload

from app.models.entities import KnowledgeDocument, Project
from app.models.enums import DocumentStatus, DocumentType

DEFAULT_PROJECT_NAME = "Windpark de Boldijk"


class DatabaseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_project(self, project_id: str) -> Project | None:
        return self.db.get(Project, project_id)

    def get_project_by_name(self, name: str) -> Project | None:
        return self.db.scalar(select(Project).where(Project.name == name))

    def ensure_default_project(self) -> Project:
        existing = self.get_project_by_name(DEFAULT_PROJECT_NAME)
        if existing:
            return existing

        created = Project(name=DEFAULT_PROJECT_NAME, is_active=True)
        self.db.add(created)
        self.db.commit()
        self.db.refresh(created)
        return created

    def list_projects(self, *, include_inactive: bool = False) -> list[Project]:
        self.ensure_default_project()
        stmt = select(Project)
        if not include_inactive:
            stmt = stmt.where(Project.is_active.is_(True))
        stmt = stmt.order_by(Project.name.asc())
        return list(self.db.scalars(stmt).all())

    def create_project(self, name: str) -> Project:
        project = Project(name=name, is_active=True)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def save_project(self, project: Project) -> Project:
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def add_document(
        self,
        *,
        project_id: str,
        uploaded_by_user_id: str,
        filename: str,
        file_path: str,
        content_type: str,
        doc_type: DocumentType,
        size_bytes: int,
    ) -> KnowledgeDocument:
        model = KnowledgeDocument(
            project_id=project_id,
            uploaded_by_user_id=uploaded_by_user_id,
            filename=filename,
            file_path=file_path,
            content_type=content_type,
            doc_type=doc_type,
            status=DocumentStatus.uploaded,
            extraction_error="",
            size_bytes=size_bytes,
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    def list_documents(
        self, *, project_id: str | None = None
    ) -> list[KnowledgeDocument]:
        stmt = (
            select(KnowledgeDocument)
            .options(
                joinedload(KnowledgeDocument.project),
                joinedload(KnowledgeDocument.uploaded_by),
            )
            .order_by(desc(KnowledgeDocument.created_at))
        )
        if project_id:
            stmt = stmt.where(KnowledgeDocument.project_id == project_id)
        return list(self.db.scalars(stmt).all())

    def get_document(self, document_id: str) -> KnowledgeDocument | None:
        stmt = (
            select(KnowledgeDocument)
            .options(
                joinedload(KnowledgeDocument.project),
                joinedload(KnowledgeDocument.uploaded_by),
            )
            .where(KnowledgeDocument.id == document_id)
        )
        return self.db.scalar(stmt)

    def list_documents_by_ids(self, document_ids: list[str]) -> list[KnowledgeDocument]:
        if not document_ids:
            return []
        stmt = (
            select(KnowledgeDocument)
            .options(
                joinedload(KnowledgeDocument.project),
                joinedload(KnowledgeDocument.uploaded_by),
            )
            .where(KnowledgeDocument.id.in_(document_ids))
        )
        return list(self.db.scalars(stmt).all())

    def save_document(self, document: KnowledgeDocument) -> KnowledgeDocument:
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def update_chunk_project_for_document(
        self, *, knowledge_document_id: str, project_id: str
    ) -> None:
        self.db.execute(
            text(
                "UPDATE knowledge_chunks SET project_id = :p WHERE knowledge_document_id = :d"
            ),
            {"p": project_id, "d": knowledge_document_id},
        )
        self.db.execute(
            text(
                "UPDATE knowledge_chunks_fts SET project_id = :p WHERE knowledge_document_id = :d"
            ),
            {"p": project_id, "d": knowledge_document_id},
        )
        self.db.commit()

    def delete_document(self, document: KnowledgeDocument) -> None:
        self.db.delete(document)
        self.db.commit()
