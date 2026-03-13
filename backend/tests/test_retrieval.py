from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.models.entities import (
    DocumentChunk,
    KnowledgeChunk,
    KnowledgeDocument,
    Project,
    Topic,
    TopicSourceDocument,
    User,
)
from app.models.enums import DocumentStatus, DocumentType
from app.services.retrieval_service import RetrievalService


@pytest.fixture
def db_session(tmp_path: Path) -> Session:
    db_path = tmp_path / "retrieval.db"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autocommit=False, autoflush=False, class_=Session
    )

    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(chunk_id, topic_id, text)"
            )
        )
        conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(chunk_id, knowledge_document_id, project_id, text)"
            )
        )
        conn.commit()

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_retrieval_combines_topic_and_database_hits(db_session: Session):
    user = User(username="admin", password_hash="x", is_active=True, is_admin=True)
    project = Project(name="Windpark de Boldijk", is_active=True)
    db_session.add_all([user, project])
    db_session.flush()
    topic = Topic(
        title="Onderhoud",
        subject="Onderhoud",
        theme="Techniek",
        project_id=project.id,
    )
    db_session.add(topic)
    db_session.flush()

    topic_doc = TopicSourceDocument(
        topic_id=topic.id,
        filename="topic-bron.txt",
        file_path="/tmp/topic-bron.txt",
        content_type="text/plain",
        doc_type=DocumentType.txt,
        status=DocumentStatus.indexed,
    )
    db_doc = KnowledgeDocument(
        project_id=project.id,
        uploaded_by_user_id=user.id,
        filename="database-bron.txt",
        file_path="/tmp/database-bron.txt",
        content_type="text/plain",
        doc_type=DocumentType.txt,
        status=DocumentStatus.indexed,
        extraction_error="",
        size_bytes=120,
    )
    db_session.add_all([topic_doc, db_doc])
    db_session.flush()

    topic_chunk = DocumentChunk(
        document_id=topic_doc.id,
        topic_id=topic.id,
        chunk_index=0,
        text="Onderhoud van turbine A is volgende week.",
        metadata_json="{}",
    )
    knowledge_chunk = KnowledgeChunk(
        knowledge_document_id=db_doc.id,
        project_id=project.id,
        chunk_index=1,
        text="Onderhoud gebeurt met extra veiligheidsinspectie.",
        metadata_json="{}",
    )
    db_session.add_all([topic_chunk, knowledge_chunk])
    db_session.flush()

    db_session.execute(
        text(
            "INSERT INTO document_chunks_fts(chunk_id, topic_id, text) VALUES (:c, :t, :x)"
        ),
        {"c": topic_chunk.id, "t": topic.id, "x": topic_chunk.text},
    )
    db_session.execute(
        text(
            "INSERT INTO knowledge_chunks_fts(chunk_id, knowledge_document_id, project_id, text) VALUES (:c, :d, :p, :x)"
        ),
        {
            "c": knowledge_chunk.id,
            "d": db_doc.id,
            "p": project.id,
            "x": knowledge_chunk.text,
        },
    )
    db_session.commit()

    hits = RetrievalService(db_session).retrieve_context(topic, limit=6)
    sources = {hit["source_type"] for hit in hits}
    assert "topic" in sources
    assert "database" in sources
    assert any(hit.get("document_name") == "topic-bron.txt" for hit in hits)
    assert any(hit.get("document_name") == "database-bron.txt" for hit in hits)


def test_retrieval_keeps_topic_only_flow_when_database_has_no_hits(db_session: Session):
    project = Project(name="Windpark de Boldijk", is_active=True)
    db_session.add(project)
    db_session.flush()
    topic = Topic(
        title="Planning",
        subject="Planning",
        theme="Communicatie",
        project_id=project.id,
    )
    db_session.add(topic)
    db_session.flush()

    topic_doc = TopicSourceDocument(
        topic_id=topic.id,
        filename="planning-bron.txt",
        file_path="/tmp/planning-bron.txt",
        content_type="text/plain",
        doc_type=DocumentType.txt,
        status=DocumentStatus.indexed,
    )
    db_session.add(topic_doc)
    db_session.flush()

    topic_chunk = DocumentChunk(
        document_id=topic_doc.id,
        topic_id=topic.id,
        chunk_index=0,
        text="Planning voor bewonersavond is op donderdag.",
        metadata_json="{}",
    )
    db_session.add(topic_chunk)
    db_session.flush()

    db_session.execute(
        text(
            "INSERT INTO document_chunks_fts(chunk_id, topic_id, text) VALUES (:c, :t, :x)"
        ),
        {"c": topic_chunk.id, "t": topic.id, "x": topic_chunk.text},
    )
    db_session.commit()

    hits = RetrievalService(db_session).retrieve_context(topic, limit=4)
    assert hits
    assert all(hit["source_type"] == "topic" for hit in hits)


def test_retrieval_filters_database_hits_by_topic_project(db_session: Session):
    user = User(username="admin2", password_hash="x", is_active=True, is_admin=True)
    project_a = Project(name="Project A", is_active=True)
    project_b = Project(name="Project B", is_active=True)
    db_session.add_all([user, project_a, project_b])
    db_session.flush()

    topic = Topic(
        title="Netwerk",
        subject="Onderhoud",
        theme="Techniek",
        project_id=project_a.id,
    )
    db_session.add(topic)
    db_session.flush()

    doc_a = KnowledgeDocument(
        project_id=project_a.id,
        uploaded_by_user_id=user.id,
        filename="bron-a.txt",
        file_path="/tmp/bron-a.txt",
        content_type="text/plain",
        doc_type=DocumentType.txt,
        status=DocumentStatus.indexed,
        extraction_error="",
        size_bytes=100,
    )
    doc_b = KnowledgeDocument(
        project_id=project_b.id,
        uploaded_by_user_id=user.id,
        filename="bron-b.txt",
        file_path="/tmp/bron-b.txt",
        content_type="text/plain",
        doc_type=DocumentType.txt,
        status=DocumentStatus.indexed,
        extraction_error="",
        size_bytes=100,
    )
    db_session.add_all([doc_a, doc_b])
    db_session.flush()

    chunk_a = KnowledgeChunk(
        knowledge_document_id=doc_a.id,
        project_id=project_a.id,
        chunk_index=0,
        text="Onderhoud met veiligheidsscan project a.",
        metadata_json="{}",
    )
    chunk_b = KnowledgeChunk(
        knowledge_document_id=doc_b.id,
        project_id=project_b.id,
        chunk_index=0,
        text="Onderhoud met veiligheidsscan project b.",
        metadata_json="{}",
    )
    db_session.add_all([chunk_a, chunk_b])
    db_session.flush()

    db_session.execute(
        text(
            "INSERT INTO knowledge_chunks_fts(chunk_id, knowledge_document_id, project_id, text) VALUES (:c, :d, :p, :x)"
        ),
        {"c": chunk_a.id, "d": doc_a.id, "p": project_a.id, "x": chunk_a.text},
    )
    db_session.execute(
        text(
            "INSERT INTO knowledge_chunks_fts(chunk_id, knowledge_document_id, project_id, text) VALUES (:c, :d, :p, :x)"
        ),
        {"c": chunk_b.id, "d": doc_b.id, "p": project_b.id, "x": chunk_b.text},
    )
    db_session.commit()

    hits = RetrievalService(db_session).retrieve_context(topic, limit=6)
    database_hits = [hit for hit in hits if hit.get("source_type") == "database"]
    assert database_hits
    assert all(hit.get("project_id") == project_a.id for hit in database_hits)


def test_retrieval_handles_colon_in_subject_without_fts_crash(db_session: Session):
    project = Project(name="Windpark de Boldijk", is_active=True)
    db_session.add(project)
    db_session.flush()

    topic = Topic(
        title="Onderhoud nacelle",
        subject="nacelle: onderhoud",
        theme="Techniek",
        project_id=project.id,
    )
    db_session.add(topic)
    db_session.flush()

    topic_doc = TopicSourceDocument(
        topic_id=topic.id,
        filename="nacelle-bron.txt",
        file_path="/tmp/nacelle-bron.txt",
        content_type="text/plain",
        doc_type=DocumentType.txt,
        status=DocumentStatus.indexed,
    )
    db_session.add(topic_doc)
    db_session.flush()

    topic_chunk = DocumentChunk(
        document_id=topic_doc.id,
        topic_id=topic.id,
        chunk_index=0,
        text="Nacelle onderhoud staat gepland voor volgende week.",
        metadata_json="{}",
    )
    db_session.add(topic_chunk)
    db_session.flush()

    db_session.execute(
        text(
            "INSERT INTO document_chunks_fts(chunk_id, topic_id, text) VALUES (:c, :t, :x)"
        ),
        {"c": topic_chunk.id, "t": topic.id, "x": topic_chunk.text},
    )
    db_session.commit()

    hits = RetrievalService(db_session).retrieve_context(topic, limit=4)
    assert hits
    assert any(hit.get("source_type") == "topic" for hit in hits)
