import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.integrations.openai_client import OpenAIClient
from app.models.entities import TopicSourceDocument
from app.models.enums import AudioTranscriptionStatus, DocumentStatus, DocumentType
from app.repositories.topic_repository import TopicRepository
from app.services.genai_config_service import GenAIConfigService
from app.services.ingestion_service import IngestionService


class TranscriptionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = TopicRepository(db)
        self.ingestion = IngestionService(db)
        self.settings = get_settings()
        self.config = GenAIConfigService(db).get_effective_config()
        self.openai = OpenAIClient(
            api_key=self.config.openai_api_key,
            text_model=self.config.text_model,
            image_model=self.config.image_model,
        )

    def process_pending_transcriptions(self, limit: int = 10) -> int:
        rows = list(
            self.db.scalars(
                select(TopicSourceDocument)
                .where(
                    TopicSourceDocument.doc_type == DocumentType.audio,
                    TopicSourceDocument.transcription_status
                    == AudioTranscriptionStatus.queued,
                )
                .order_by(TopicSourceDocument.created_at.asc())
                .limit(limit)
            ).all()
        )
        processed = 0
        for row in rows:
            self.process_document(row)
            processed += 1
        return processed

    def process_document(self, document: TopicSourceDocument) -> None:
        if document.doc_type != DocumentType.audio:
            return
        document.transcription_status = AudioTranscriptionStatus.transcribing
        document.transcription_error = ""
        document.transcription_attempts += 1
        self.repo.save_document(document)

        try:
            result = self.openai.transcribe_audio(
                document.file_path,
                model=self.config.whisper_model,
                language=self.config.whisper_language,
            )
            text = self._normalize_transcript_text(result)
            if not text:
                raise ValueError("OpenAI transcription returned an empty transcript.")
            speaker_labels = self._extract_speaker_labels(result)
            transcript_document = self._save_transcript_document(document, text)
            document.transcript_document_id = transcript_document.id
            self.ingestion.ingest_document(transcript_document)
            if transcript_document.status != DocumentStatus.indexed:
                raise RuntimeError(
                    "Transcript ingestion failed: "
                    f"{transcript_document.extraction_error or 'document was not indexed'}"
                )
            document.transcription_status = AudioTranscriptionStatus.completed
            document.transcription_text = text
            document.transcription_model = self.config.whisper_model
            document.transcription_language = self.config.whisper_language
            document.speaker_labels_json = json.dumps(speaker_labels, ensure_ascii=False)
            document.transcription_error = ""
            self.repo.save_document(document)
        except Exception as exc:
            document.transcription_status = AudioTranscriptionStatus.failed
            document.transcription_error = str(exc)
            self.repo.save_document(document)

    def retry_document(self, document_id: str) -> TopicSourceDocument:
        document = self.repo.get_document(document_id)
        if not document:
            raise ValueError("Document not found")
        if document.doc_type != DocumentType.audio:
            raise ValueError("Document is not an audio source")
        document.transcription_status = AudioTranscriptionStatus.queued
        document.transcription_error = ""
        self.repo.save_document(document)
        return document

    def _save_transcript_document(
        self, document: TopicSourceDocument, transcript_text: str
    ) -> TopicSourceDocument:
        transcript_dir = (
            self.settings.storage_root
            / self.settings.uploads_dir
            / "topic-audio-transcripts"
            / document.topic_id
        )
        transcript_dir.mkdir(parents=True, exist_ok=True)
        transcript_name = f"{Path(document.filename).stem}.transcript.txt"
        transcript_path = transcript_dir / f"{document.id}.transcript.txt"
        transcript_path.write_text(transcript_text, encoding="utf-8")

        transcript_document = None
        if document.transcript_document_id:
            transcript_document = self.repo.get_document(document.transcript_document_id)

        if transcript_document:
            transcript_document.filename = transcript_name
            transcript_document.file_path = str(transcript_path)
            transcript_document.content_type = "text/plain"
            transcript_document.doc_type = DocumentType.txt
            transcript_document.status = DocumentStatus.uploaded
            transcript_document.extraction_error = ""
            transcript_document.parent_source_document_id = document.id
            transcript_document.duration_seconds = None
            transcript_document.transcription_status = AudioTranscriptionStatus.not_applicable
            transcript_document.transcription_attempts = 0
            transcript_document.transcription_error = ""
            transcript_document.transcription_text = transcript_text
            transcript_document.transcription_model = ""
            transcript_document.transcription_language = ""
            transcript_document.speaker_labels_json = json.dumps([], ensure_ascii=False)
            self.repo.save_document(transcript_document)
            return transcript_document

        return self.repo.add_document(
            topic_id=document.topic_id,
            parent_source_document_id=document.id,
            filename=transcript_name,
            file_path=str(transcript_path),
            content_type="text/plain",
            doc_type=DocumentType.txt,
            status=DocumentStatus.uploaded,
            duration_seconds=None,
            transcription_status=AudioTranscriptionStatus.not_applicable,
            transcription_attempts=0,
            transcription_error="",
            transcription_text=transcript_text,
            transcription_model="",
            transcription_language="",
            speaker_labels_json=json.dumps([], ensure_ascii=False),
        )

    def _normalize_transcript_text(self, result: dict) -> str:
        text = str(result.get("text") or "").strip()
        if text:
            return text
        segments = result.get("segments") or []
        if isinstance(segments, list):
            lines: list[str] = []
            for segment in segments:
                if not isinstance(segment, dict):
                    continue
                speaker = str(segment.get("speaker") or "").strip()
                segment_text = str(segment.get("text") or "").strip()
                if not segment_text:
                    continue
                if speaker:
                    lines.append(f"{speaker}: {segment_text}")
                else:
                    lines.append(segment_text)
            return "\n".join(lines).strip()
        return ""

    def _extract_speaker_labels(self, result: dict) -> list[dict[str, str]]:
        segments = result.get("segments") or []
        labels: list[dict[str, str]] = []
        if not isinstance(segments, list):
            return labels
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            speaker = str(segment.get("speaker") or "").strip()
            text = str(segment.get("text") or "").strip()
            if speaker or text:
                labels.append({"speaker": speaker, "text": text})
        return labels
