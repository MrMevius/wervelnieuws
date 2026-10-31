import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.openai_client import OpenAIClient
from app.models.entities import Recording
from app.services.genai_config_service import GenAIConfigService

logger = logging.getLogger(__name__)

RECORDING_TRANSCRIPTION_PENDING = "pending"
RECORDING_TRANSCRIPTION_DONE = "done"
RECORDING_TRANSCRIPTION_FAILED = "failed"

# The browser asks for a transcript right after uploading. The worker only picks
# up recordings that stayed pending longer than this, e.g. because the tab was
# closed or the backend restarted mid-request.
WORKER_PICKUP_DELAY = timedelta(minutes=5)


class BoardRecordingTranscriptionService:
    """Transcribes stored meeting-board recordings and keeps the text on the recording."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.config = GenAIConfigService(db).get_effective_config()

    @property
    def is_configured(self) -> bool:
        return bool(self.config.openai_api_key)

    def transcribe(self, recording: Recording) -> Recording:
        # The status stays as-is while transcribing, so an interrupted request
        # leaves a pending recording that the worker retries.
        try:
            openai = OpenAIClient(
                api_key=self.config.openai_api_key,
                text_model=self.config.text_model,
                image_model=self.config.image_model,
            )
            result = openai.transcribe_audio(
                recording.file_path,
                model=self.config.whisper_model,
                language=self.config.whisper_language,
            )
            text = str(result.get("text") or "").strip()
            if not text:
                raise ValueError("OpenAI transcription returned an empty transcript.")
            recording.transcription_text = text
            recording.transcription_status = RECORDING_TRANSCRIPTION_DONE
        except Exception as exc:
            logger.warning(
                "Board recording transcription failed",
                extra={"recording_id": recording.id, "error_type": type(exc).__name__},
            )
            recording.transcription_status = RECORDING_TRANSCRIPTION_FAILED
        self.db.add(recording)
        self.db.commit()
        self.db.refresh(recording)
        return recording

    def process_pending(self, limit: int = 5) -> int:
        if not self.is_configured:
            return 0
        cutoff = datetime.now(UTC) - WORKER_PICKUP_DELAY
        rows = self.db.scalars(
            select(Recording)
            .where(
                Recording.transcription_status == RECORDING_TRANSCRIPTION_PENDING,
                Recording.created_at < cutoff,
            )
            .order_by(Recording.created_at.asc())
            .limit(limit)
        ).all()
        for row in rows:
            self.transcribe(row)
        return len(rows)
