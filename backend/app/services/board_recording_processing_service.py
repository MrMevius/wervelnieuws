"""Durable, resumable processing owned by the worker, never by a browser request."""
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models.entities import AuditEvent, BoardCard, CardUpdate, Project, Recording, User
from app.repositories.board_repository import BoardRepository
from app.services.board_service import BoardService
from app.services.board_recording_transcription_service import BoardRecordingTranscriptionService

logger = logging.getLogger(__name__)
ACTIVE_STATUSES = ("queued", "transcribing", "summarizing", "posting")
# External requests use a 120s SDK timeout, with at most one SDK retry.
# A claim is renewed before each step; expired owners cannot persist results.
LEASE_SECONDS = 600


class BoardRecordingProcessingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _available(self) -> ColumnElement[bool]:
        return or_(Recording.processing_lease_until.is_(None), Recording.processing_lease_until < datetime.now(UTC))

    def retry(self, recording_id: str) -> None:
        self.db.execute(
            update(Recording).execution_options(synchronize_session=False)
            .where(Recording.id == recording_id, Recording.processing_status == "failed", self._available())
            .values(processing_status="queued", processing_error=None, processing_token=None, processing_lease_until=None)
        )
        self.db.commit()

    def _save(self, recording_id: str, token: str, **values: Any) -> bool:
        result = self.db.execute(
            update(Recording).execution_options(synchronize_session=False)
            .where(Recording.id == recording_id, Recording.processing_token == token,
                   Recording.processing_lease_until > datetime.now(UTC))
            .values(**values)
        )
        if result.rowcount != 1:
            self.db.rollback()
            return False
        self.db.commit()
        return True

    def process(self, recording_id: str) -> bool:
        token = str(uuid4())
        claimed = self.db.execute(
            update(Recording).execution_options(synchronize_session=False)
            .where(Recording.id == recording_id, Recording.processing_status.in_(ACTIVE_STATUSES), self._available())
            .values(processing_token=token, processing_lease_until=datetime.now(UTC) + timedelta(seconds=LEASE_SECONDS))
        )
        self.db.commit()
        if claimed.rowcount != 1:
            return False
        stage = "transcribing"
        try:
            self.db.expire_all()
            row = self.db.get(Recording, recording_id)
            card = self.db.get(BoardCard, row.card_id)
            project = self.db.get(Project, card.project_id) if card else None
            user = self.db.get(User, row.uploaded_by_user_id)
            # Do not generate new activity for cards/projects removed during processing.
            if not card or card.deleted_at or card.is_archived or not project or project.is_archived or not user or not user.is_active:
                raise ValueError("Recording target is no longer writable")
            BoardService(BoardRepository(self.db)).ensure_card_writable(card, user)
            transcription = BoardRecordingTranscriptionService(self.db, request_timeout=120)
            if not transcription.is_configured:
                raise ValueError("Transcription is not configured")
            if row.transcription_status != "done":
                if not self._save(recording_id, token, processing_status=stage,
                                  processing_lease_until=datetime.now(UTC) + timedelta(seconds=LEASE_SECONDS)):
                    return False
                text = transcription.transcribe_text(row)
                if not self._save(recording_id, token, transcription_text=text, transcription_status="done"):
                    return False
            stage = "summarizing"
            if not row.summary_text:
                if not self._save(recording_id, token, processing_status=stage,
                                  processing_lease_until=datetime.now(UTC) + timedelta(seconds=LEASE_SECONDS)):
                    return False
                summary = transcription.summarize(row, card, BoardRepository(self.db))
                if not self._save(recording_id, token, summary_text=summary):
                    return False
            stage = "posting"
            if not self._save(recording_id, token, processing_status=stage,
                              processing_lease_until=datetime.now(UTC) + timedelta(seconds=LEASE_SECONDS)):
                return False
            self._post(recording_id, token)
        except Exception as exc:
            self.db.rollback()
            values = {"processing_status": "failed", "processing_error": stage,
                      "processing_token": None, "processing_lease_until": None}
            if stage == "transcribing":
                values["transcription_status"] = "failed"
            self._save(recording_id, token, **values)
            logger.warning("Board recording processing failed", extra={"recording_id": recording_id, "stage": stage, "error_type": type(exc).__name__})
        return True

    def _post(self, recording_id: str, token: str) -> None:
        # Take the database write lock through a conditional update before creating
        # activity. Status, activity and audit commit atomically, including on SQLite.
        result = self.db.execute(
            update(Recording).execution_options(synchronize_session=False)
            .where(Recording.id == recording_id, Recording.processing_token == token,
                   Recording.processing_lease_until > datetime.now(UTC))
            .values(processing_status="done", processing_error=None, processing_token=None, processing_lease_until=None)
        )
        if result.rowcount != 1:
            self.db.rollback()
            return
        self.db.expire_all()
        row = self.db.get(Recording, recording_id)
        card = self.db.get(BoardCard, row.card_id)
        project = self.db.get(Project, card.project_id)
        if card.deleted_at or card.is_archived or project.is_archived:
            raise ValueError("Recording target is no longer writable")
        user = self.db.get(User, row.uploaded_by_user_id)
        if not user or not user.is_active:
            raise ValueError("Recording uploader is no longer active")
        BoardService(BoardRepository(self.db)).ensure_card_writable(card, user)
        # Include edited/deleted activity: recovery must never resurrect or overwrite it.
        existing = self.db.scalar(select(CardUpdate.id).where(CardUpdate.recording_id == recording_id).limit(1))
        if not existing:
            activity = CardUpdate(card_id=row.card_id, author_user_id=row.uploaded_by_user_id,
                                  recording_id=row.id, message=row.summary_text)
            self.db.add(activity)
            self.db.flush()
            project.last_activity_at = datetime.now(UTC)
            self.db.add(AuditEvent(event_type="board.card.updated", actor_user_id=row.uploaded_by_user_id,
                                   details_json=json.dumps({"card_id": row.card_id, "update_id": activity.id, "recording_id": row.id})))
        self.db.commit()

    def process_pending(self, limit: int = 5) -> int:
        ids = self.db.scalars(select(Recording.id).where(Recording.processing_status.in_(ACTIVE_STATUSES), self._available())
                              .order_by(Recording.created_at).limit(limit)).all()
        return sum(self.process(recording_id) for recording_id in ids)
