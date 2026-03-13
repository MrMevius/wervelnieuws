from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.entities import Topic


class RetrievalService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def retrieve_context(self, topic: Topic, limit: int = 10) -> list[dict[str, str]]:
        query = self._build_query(topic)
        topic_limit = max(1, limit // 2)
        database_limit = max(1, limit - topic_limit)

        topic_hits = self._search_topic_chunks(topic.id, query, topic_limit)
        database_hits = self._search_database_chunks(
            query, database_limit, topic.project_id
        )
        return topic_hits + database_hits

    def _build_query(self, topic: Topic) -> str:
        base = topic.subject.strip() if topic.subject else ""
        if base:
            return base
        if topic.title:
            return topic.title.strip()
        return "windpark"

    def _search_topic_chunks(
        self, topic_id: str, query: str, limit: int
    ) -> list[dict[str, str]]:
        rows = self.db.execute(
            text(
                """
                SELECT f.chunk_id, f.text, c.document_id, d.filename, c.chunk_index
                FROM document_chunks_fts f
                JOIN document_chunks c ON c.id = f.chunk_id
                JOIN topic_source_documents d ON d.id = c.document_id
                WHERE f.topic_id = :topic_id AND f.text MATCH :q
                LIMIT :limit
                """
            ),
            {"topic_id": topic_id, "q": query, "limit": limit},
        )
        return [
            {
                "source": "topic",
                "source_type": "topic",
                "chunk_id": row[0],
                "text": row[1],
                "document_id": row[2],
                "document_name": row[3],
                "chunk_index": row[4],
                "topic_id": topic_id,
            }
            for row in rows.fetchall()
        ]

    def _search_database_chunks(
        self, query: str, limit: int, project_id: str
    ) -> list[dict[str, str]]:
        rows = self.db.execute(
            text(
                """
                SELECT
                    f.chunk_id,
                    f.text,
                    f.knowledge_document_id,
                    f.project_id,
                    d.filename,
                    p.name,
                    c.chunk_index
                FROM knowledge_chunks_fts f
                JOIN knowledge_documents d ON d.id = f.knowledge_document_id
                JOIN projects p ON p.id = f.project_id
                JOIN knowledge_chunks c ON c.id = f.chunk_id
                WHERE f.text MATCH :q AND f.project_id = :project_id
                LIMIT :limit
                """
            ),
            {"q": query, "limit": limit, "project_id": project_id},
        )
        return [
            {
                "source": "database",
                "source_type": "database",
                "chunk_id": row[0],
                "text": row[1],
                "knowledge_document_id": row[2],
                "project_id": row[3],
                "document_name": row[4],
                "project_name": row[5],
                "chunk_index": row[6],
            }
            for row in rows.fetchall()
        ]
