import logging
import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.openai_client import OpenAIClient
from app.models.entities import BoardCard, Recording
from app.repositories.board_repository import BoardRepository
from app.services.genai_config_service import GenAIConfigService

logger = logging.getLogger(__name__)

RECORDING_TRANSCRIPTION_PENDING = "pending"
RECORDING_TRANSCRIPTION_DONE = "done"
RECORDING_TRANSCRIPTION_FAILED = "failed"

# The browser asks for a transcript right after uploading. The worker only picks
# up recordings that stayed pending longer than this, e.g. because the tab was
# closed or the backend restarted mid-request.
WORKER_PICKUP_DELAY = timedelta(minutes=5)

# Context budget for the summary prompt, in characters.
CONTEXT_DESCRIPTION_CHARS = 1500
CONTEXT_UPDATE_CHARS = 600
CONTEXT_UPDATES_TOTAL_CHARS = 6000
CONTEXT_OTHER_CARD_CHARS = 160
CONTEXT_OTHER_CARDS_TOTAL_CHARS = 5000
COLUMN_LABELS = {"todo": "Te doen", "doing": "Bezig", "done": "Klaar"}
BULLET_PREFIX = re.compile(r"^\s*(?:[-*•–]|\d+[.)])\s*")

SUMMARY_INSTRUCTIONS = """Je bent notulist van een vergaderbord voor een lokaal windenergieproject. Vat de transcriptie van een gesproken update samen in korte, zakelijke Nederlandse bullets.

Regels:
- Gebruik uitsluitend informatie die in de transcriptie staat. Voeg geen feiten toe uit de context.
- Gebruik de context alleen om namen, termen en verwijzingen correct te schrijven en om te bepalen wat nieuw of relevant is ten opzichte van eerdere updates.
- Noem afspraken, besluiten en actiepunten expliciet, met wie en wanneer als dat gezegd wordt.
- Laat herhalingen, aarzelingen en irrelevante zijpaden weg.
- Verwijst de spreker naar een ander kaartje, gebruik dan de titel van dat kaartje.
- Geef uitsluitend de bullets terug, elk op een eigen regel beginnend met "- ". Gebruik hooguit 8 bullets; bij een korte opname volstaat één bullet."""


def _clip(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _as_bullets(text: str) -> str:
    lines = [BULLET_PREFIX.sub("", line).strip() for line in text.splitlines() if not line.strip().startswith("```")]
    return "\n".join(f"- {line}" for line in lines if line)


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

    def summarize(self, recording: Recording, card: BoardCard, repo: BoardRepository) -> str:
        prompt = f"{SUMMARY_INSTRUCTIONS}\n\n{self._summary_context(card, repo)}\n\nTranscriptie:\n{recording.transcription_text}"
        openai = OpenAIClient(
            api_key=self.config.openai_api_key,
            text_model=self.config.text_model,
            image_model=self.config.image_model,
        )
        generated, _ = openai.generate_text(prompt)
        summary = _as_bullets(generated)
        if not summary:
            raise ValueError("The summary was empty.")
        return summary

    def _summary_context(self, card: BoardCard, repo: BoardRepository) -> str:
        sections = [f"Kaartje: {card.title}"]
        if card.description.strip():
            sections.append(f"Beschrijving: {_clip(card.description, CONTEXT_DESCRIPTION_CHARS)}")

        # Newest updates first until the budget is spent, then shown oldest to newest.
        update_lines: list[str] = []
        budget = CONTEXT_UPDATES_TOTAL_CHARS
        for update in repo.list_updates(card.id):
            line = f"- {update.created_at:%Y-%m-%d}: {_clip(update.message, CONTEXT_UPDATE_CHARS)}"
            if len(line) > budget:
                break
            update_lines.append(line)
            budget -= len(line)
        if update_lines:
            sections.append("Eerdere updates op dit kaartje (oud naar nieuw):\n" + "\n".join(reversed(update_lines)))

        other_lines: list[str] = []
        budget = CONTEXT_OTHER_CARDS_TOTAL_CHARS
        for other in repo.list_project_cards(card.project_id):
            if other.id == card.id:
                continue
            line = f"- [{COLUMN_LABELS.get(other.column.value, other.column.value)}] {other.title}"
            if other.description.strip():
                line += f": {_clip(other.description, CONTEXT_OTHER_CARD_CHARS)}"
            if len(line) > budget:
                break
            other_lines.append(line)
            budget -= len(line)
        if other_lines:
            sections.append("Andere kaartjes op dit bord:\n" + "\n".join(other_lines))
        return "Context (alleen ter verduidelijking, geen bron van feiten):\n" + "\n\n".join(sections)

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
