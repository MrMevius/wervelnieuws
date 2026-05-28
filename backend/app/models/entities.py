import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import (
    BoardColumn,
    ChannelName,
    ChannelPublishState,
    ContentApprovalState,
    DocumentStatus,
    DocumentType,
    RetryStatus,
    ThemePreference,
    WorkflowState,
)


def _uuid() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    avatar_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    theme_preference: Mapped[ThemePreference] = mapped_column(
        Enum(ThemePreference), default=ThemePreference.system, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    knowledge_documents: Mapped[list["KnowledgeDocument"]] = relationship(
        back_populates="uploaded_by"
    )


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invited_user_ids_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    documents: Mapped[list["KnowledgeDocument"]] = relationship(
        back_populates="project", cascade="all,delete"
    )
    topics: Mapped[list["Topic"]] = relationship(back_populates="project")
    board_cards: Mapped[list["BoardCard"]] = relationship(
        back_populates="project", cascade="all,delete"
    )

    @property
    def invited_user_ids(self) -> list[str]:
        try:
            parsed = json.loads(self.invited_user_ids_json or "[]")
        except (TypeError, ValueError):
            return []
        if not isinstance(parsed, list):
            return []
        return [str(item) for item in parsed if isinstance(item, str)]

    @invited_user_ids.setter
    def invited_user_ids(self, value: Sequence[str]) -> None:
        self.invited_user_ids_json = json.dumps(list(dict.fromkeys(value)))


class BoardCard(Base, TimestampMixin):
    __tablename__ = "board_cards"
    __table_args__ = (
        Index("ix_board_cards_project_column_position", "project_id", "column", "position"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    column: Mapped[BoardColumn] = mapped_column(
        Enum(BoardColumn), default=BoardColumn.todo, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    project: Mapped[Project] = relationship(back_populates="board_cards")
    assignments: Mapped[list["CardAssignment"]] = relationship(
        back_populates="card", cascade="all,delete"
    )
    updates: Mapped[list["CardUpdate"]] = relationship(
        back_populates="card", cascade="all,delete"
    )
    recordings: Mapped[list["Recording"]] = relationship(
        back_populates="card", cascade="all,delete"
    )


class CardAssignment(Base, TimestampMixin):
    __tablename__ = "card_assignments"
    __table_args__ = (
        UniqueConstraint("card_id", "user_id", name="uq_card_assignments_card_user"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    card_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("board_cards.id"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    card: Mapped[BoardCard] = relationship(back_populates="assignments")
    user: Mapped[User] = relationship()


class CardUpdate(Base):
    __tablename__ = "card_updates"
    __table_args__ = (Index("ix_card_updates_card_created", "card_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    card_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("board_cards.id"), nullable=False
    )
    author_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    edited_from_update_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("card_updates.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    card: Mapped[BoardCard] = relationship(back_populates="updates")
    author: Mapped[User] = relationship()


class Recording(Base):
    __tablename__ = "recordings"
    __table_args__ = (Index("ix_recordings_card_created", "card_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    card_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("board_cards.id"), nullable=False
    )
    uploaded_by_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    transcription_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    transcription_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    card: Mapped[BoardCard] = relationship(back_populates="recordings")
    uploaded_by: Mapped[User] = relationship()


class KnowledgeDocument(Base, TimestampMixin):
    __tablename__ = "knowledge_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    uploaded_by_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    doc_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.uploaded, nullable=False
    )
    extraction_error: Mapped[str] = mapped_column(Text, default="", nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    project: Mapped[Project] = relationship(back_populates="documents")
    uploaded_by: Mapped[User] = relationship(back_populates="knowledge_documents")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all,delete"
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    knowledge_document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("knowledge_documents.id"), nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    theme: Mapped[str] = mapped_column(String(255), nullable=False)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    editorial_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    text_feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)
    planning_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    workflow_state: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.draft, nullable=False
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    target_channels_json: Mapped[str] = mapped_column(
        Text,
        default='["website","facebook","newsletter"]',
        nullable=False,
    )

    source_documents: Mapped[list["TopicSourceDocument"]] = relationship(
        back_populates="topic", cascade="all,delete"
    )
    notes: Mapped[list["TopicNote"]] = relationship(
        back_populates="topic", cascade="all,delete"
    )
    versions: Mapped[list["ContentVersion"]] = relationship(
        back_populates="topic", cascade="all,delete"
    )
    project: Mapped[Project] = relationship(back_populates="topics")

    @property
    def project_name(self) -> str:
        return self.project.name if self.project else ""

    @property
    def target_channels(self) -> list[ChannelName]:
        default_channels = [
            ChannelName.website,
            ChannelName.facebook,
            ChannelName.newsletter,
        ]
        try:
            parsed = json.loads(self.target_channels_json or "[]")
        except (TypeError, ValueError):
            return default_channels
        if not isinstance(parsed, list):
            return default_channels
        result: list[ChannelName] = []
        for item in parsed:
            try:
                channel = ChannelName(str(item))
            except ValueError:
                continue
            if channel not in result:
                result.append(channel)
        return result or default_channels

    @target_channels.setter
    def target_channels(self, channels: Sequence[ChannelName | str]) -> None:
        normalized: list[str] = []
        for item in channels:
            if isinstance(item, ChannelName):
                channel = item.value
            else:
                channel = ChannelName(item).value
            if channel not in normalized:
                normalized.append(channel)
        self.target_channels_json = json.dumps(normalized)


class TopicSourceDocument(Base, TimestampMixin):
    __tablename__ = "topic_source_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    doc_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.uploaded, nullable=False
    )
    extraction_error: Mapped[str] = mapped_column(Text, default="", nullable=False)

    topic: Mapped[Topic] = relationship(back_populates="source_documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all,delete"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topic_source_documents.id"), nullable=False
    )
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    document: Mapped[TopicSourceDocument] = relationship(back_populates="chunks")


class TopicNote(Base, TimestampMixin):
    __tablename__ = "topic_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)

    topic: Mapped[Topic] = relationship(back_populates="notes")


class GeneratedImage(Base, TimestampMixin):
    __tablename__ = "generated_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)


class ContentVersion(Base, TimestampMixin):
    __tablename__ = "content_versions"
    __table_args__ = (
        UniqueConstraint("topic_id", "version_number", name="uq_topic_version_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    article_body: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_trace_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    generated_image_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("generated_images.id"), nullable=True
    )
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    topic: Mapped[Topic] = relationship(back_populates="versions")
    generated_image: Mapped[GeneratedImage | None] = relationship()
    schedules: Mapped[list["PublicationSchedule"]] = relationship(
        back_populates="content_version", cascade="all,delete"
    )
    channel_variants: Mapped[list["ContentChannelVariant"]] = relationship(
        back_populates="content_version", cascade="all,delete"
    )


class ContentChannelVariant(Base, TimestampMixin):
    __tablename__ = "content_channel_variants"
    __table_args__ = (
        UniqueConstraint(
            "content_version_id",
            "channel",
            name="uq_content_channel_variants_version_channel",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    content_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("content_versions.id"), nullable=False
    )
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    channel: Mapped[ChannelName] = mapped_column(Enum(ChannelName), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    article_body: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    generated_image_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("generated_images.id"), nullable=True
    )
    approval_state: Mapped[ContentApprovalState] = mapped_column(
        Enum(ContentApprovalState), default=ContentApprovalState.pending, nullable=False
    )
    text_approval_state: Mapped[ContentApprovalState] = mapped_column(
        Enum(ContentApprovalState), default=ContentApprovalState.pending, nullable=False
    )
    image_approval_state: Mapped[ContentApprovalState] = mapped_column(
        Enum(ContentApprovalState), default=ContentApprovalState.pending, nullable=False
    )
    approved_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    content_version: Mapped[ContentVersion] = relationship(
        back_populates="channel_variants"
    )
    generated_image: Mapped[GeneratedImage | None] = relationship()


class PublicationSchedule(Base, TimestampMixin):
    __tablename__ = "publication_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    content_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("content_versions.id"), nullable=False
    )
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[WorkflowState] = mapped_column(
        Enum(WorkflowState), default=WorkflowState.scheduled, nullable=False
    )

    content_version: Mapped[ContentVersion] = relationship(back_populates="schedules")
    records: Mapped[list["PublicationRecord"]] = relationship(
        back_populates="schedule", cascade="all,delete"
    )


class PublicationRecord(Base, TimestampMixin):
    __tablename__ = "publication_records"
    __table_args__ = (
        UniqueConstraint("schedule_id", name="uq_publication_records_schedule_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    schedule_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("publication_schedules.id"), nullable=False
    )
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    content_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("content_versions.id"), nullable=False
    )

    schedule: Mapped[PublicationSchedule] = relationship(back_populates="records")
    channel_states: Mapped[list["ChannelPublicationState"]] = relationship(
        back_populates="record", cascade="all,delete"
    )


class ChannelPublicationState(Base, TimestampMixin):
    __tablename__ = "channel_publication_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    publication_record_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("publication_records.id"), nullable=False
    )
    channel: Mapped[ChannelName] = mapped_column(Enum(ChannelName), nullable=False)
    state: Mapped[ChannelPublishState] = mapped_column(
        Enum(ChannelPublishState), default=ChannelPublishState.pending, nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    error_message: Mapped[str] = mapped_column(Text, default="", nullable=False)

    record: Mapped[PublicationRecord] = relationship(back_populates="channel_states")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    details_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="success", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    delivery_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class RetryJob(Base, TimestampMixin):
    __tablename__ = "retry_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=False
    )
    flow_name: Mapped[str] = mapped_column(String(100), nullable=False)
    error_type: Mapped[str] = mapped_column(String(100), nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    status: Mapped[RetryStatus] = mapped_column(
        Enum(RetryStatus), default=RetryStatus.queued, nullable=False
    )
    next_run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class RateLimitEvent(Base):
    __tablename__ = "rate_limit_events"
    __table_args__ = (
        Index("ix_rate_limit_events_rate_key_created_at", "rate_key", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rate_key: Mapped[str] = mapped_column(String(300), nullable=False)
    actor_key: Mapped[str] = mapped_column(String(120), nullable=False)
    route_path: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class WorkerLease(Base):
    __tablename__ = "worker_leases"

    lock_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(120), nullable=False)
    lease_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
