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
    topic = Topic(title="Onderhoud", subject="Onderhoud", theme="Techniek")
    project = Project(name="Windpark de Boldijk", is_active=True)
    db_session.add_all([user, topic, project])
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
    topic = Topic(title="Planning", subject="Planning", theme="Communicatie")
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
