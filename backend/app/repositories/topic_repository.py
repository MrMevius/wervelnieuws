from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import ContentVersion, Topic, TopicNote, TopicSourceDocument


class TopicRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Topic]:
        return list(
            self.db.scalars(
                select(Topic)
                .options(joinedload(Topic.project))
                .order_by(desc(Topic.created_at))
            ).all()
        )

    def get(self, topic_id: str) -> Topic | None:
        return self.db.scalar(
            select(Topic).options(joinedload(Topic.project)).where(Topic.id == topic_id)
        )

    def create(self, **kwargs) -> Topic:
        topic = Topic(**kwargs)
        self.db.add(topic)
        self.db.commit()
        self.db.refresh(topic)
        return topic

    def save(self, topic: Topic) -> Topic:
        self.db.add(topic)
        self.db.commit()
        self.db.refresh(topic)
        return topic

    def add_note(self, topic_id: str, note: str) -> TopicNote:
        model = TopicNote(topic_id=topic_id, note=note)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    def add_document(self, **kwargs) -> TopicSourceDocument:
        model = TopicSourceDocument(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    def get_document(self, document_id: str) -> TopicSourceDocument | None:
        return self.db.get(TopicSourceDocument, document_id)

    def list_documents(self, topic_id: str) -> list[TopicSourceDocument]:
        return list(
            self.db.scalars(
                select(TopicSourceDocument)
                .where(TopicSourceDocument.topic_id == topic_id)
                .order_by(desc(TopicSourceDocument.created_at))
            ).all()
        )

    def save_document(self, document: TopicSourceDocument) -> TopicSourceDocument:
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document


class ContentVersionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def latest_for_topic(self, topic_id: str) -> ContentVersion | None:
        return self.db.scalar(
            select(ContentVersion)
            .where(ContentVersion.topic_id == topic_id)
            .order_by(desc(ContentVersion.version_number))
            .limit(1)
        )

    def list_for_topic(self, topic_id: str) -> list[ContentVersion]:
        return list(
            self.db.scalars(
                select(ContentVersion)
                .where(ContentVersion.topic_id == topic_id)
                .order_by(desc(ContentVersion.version_number))
            ).all()
        )

    def create(self, **kwargs) -> ContentVersion:
        for row in self.list_for_topic(kwargs["topic_id"]):
            if row.is_current:
                row.is_current = False
        version = ContentVersion(**kwargs)
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version

    def get(self, version_id: str) -> ContentVersion | None:
        return self.db.get(ContentVersion, version_id)

    def save(self, version: ContentVersion) -> ContentVersion:
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version
