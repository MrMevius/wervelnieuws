from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.entities import ContentVersion, Topic, TopicNote, TopicSourceDocument


class TopicRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Topic]:
        return list(
            self.db.scalars(select(Topic).order_by(desc(Topic.created_at))).all()
        )

    def get(self, topic_id: str) -> Topic | None:
        return self.db.get(Topic, topic_id)

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

    def add_document(
        self, topic_id: str, filename: str, file_path: str, content_type: str, doc_type
    ) -> TopicSourceDocument:
        model = TopicSourceDocument(
            topic_id=topic_id,
            filename=filename,
            file_path=file_path,
            content_type=content_type,
            doc_type=doc_type,
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model


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
