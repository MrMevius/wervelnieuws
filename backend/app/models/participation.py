from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.entities import TimestampMixin


class ParticipationMoment(Base, TimestampMixin):
    __tablename__ = "participation_moments"
    __table_args__ = (
        Index("ix_participation_moments_date", "occurred_on", "id"),
        CheckConstraint("duration_minutes IS NULL OR duration_minutes > 0", name="ck_participation_duration"),
        CheckConstraint("row_version > 0", name="ck_participation_version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    contact_type: Mapped[str] = mapped_column(String(24), nullable=False, default="in_person")
    conversation_partners: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    report: Mapped[str] = mapped_column(Text, nullable=False)
    agreements: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by_name: Mapped[str] = mapped_column(String(160), nullable=False)
    updated_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    row_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    participants: Mapped[list["ParticipationParticipant"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    projects: Mapped[list["ParticipationProject"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class ParticipationParticipant(Base):
    __tablename__ = "participation_participants"
    moment_id: Mapped[str] = mapped_column(ForeignKey("participation_moments.id", ondelete="CASCADE"), primary_key=True)
    source_user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)


class ParticipationProject(Base):
    __tablename__ = "participation_projects"
    moment_id: Mapped[str] = mapped_column(ForeignKey("participation_moments.id", ondelete="CASCADE"), primary_key=True)
    source_project_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
