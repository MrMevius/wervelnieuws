import json
import os
from pathlib import Path
import shutil
import tempfile
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.entities import Topic, TopicSourceDocument
from app.models.enums import AudioTranscriptionStatus, DocumentStatus, DocumentType
from app.repositories.topic_repository import TopicRepository
from app.services.audio_media_validator import probe_topic_audio
from app.services.ingestion_service import IngestionService, detect_doc_type

TOPIC_AUDIO_CONTENT_TYPES = {
    "audio/webm",
    "audio/webm;codecs=opus",
}
TOPIC_AUDIO_UPLOAD_MAX_BYTES = 250_000_000
TOPIC_AUDIO_UPLOAD_MAX_SECONDS = 180 * 60
TOPIC_AUDIO_UPLOAD_CHUNK_BYTES = 1024 * 1024


def _normalize_audio_filename(filename: str | None) -> str:
    safe_name = Path(filename or "opname.webm").name.strip()
    if not safe_name or safe_name in {".", ".."}:
        return "opname.webm"
    return safe_name


class TopicSourceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = TopicRepository(db)
        self.ingestion = IngestionService(db)

    def ensure_topic(self, topic_id: str) -> Topic:
        topic = self.repo.get(topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        return topic

    async def upload_source(self, topic_id: str, file: UploadFile, duration_seconds: int | None) -> TopicSourceDocument:
        topic = self.ensure_topic(topic_id)
        if self._is_audio_candidate(file):
            return await self._validate_and_store_audio_source(topic, file)

        content = await file.read(get_settings().upload_max_bytes + 1)
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty upload is not allowed")

        try:
            doc_type = detect_doc_type(file.filename or "")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Unsupported file extension") from exc
        self._validate_text_upload(file, content)
        return self._store_text_source(topic, file, content, doc_type)

    def list_sources(self, topic_id: str) -> list[TopicSourceDocument]:
        self.ensure_topic(topic_id)
        return self.repo.list_documents(topic_id)

    def retry_audio_transcription(self, topic_id: str, document_id: str) -> TopicSourceDocument:
        topic = self.ensure_topic(topic_id)
        document = self.repo.get_document(document_id)
        if not document or document.topic_id != topic.id:
            raise HTTPException(status_code=404, detail="Document not found")
        if document.doc_type != DocumentType.audio:
            raise HTTPException(status_code=400, detail="Document is not an audio source")

        document.transcription_status = AudioTranscriptionStatus.queued
        document.transcription_error = ""
        self.repo.save_document(document)
        return document

    def _is_audio_candidate(self, file: UploadFile) -> bool:
        content_type = (file.content_type or "").lower().strip()
        filename = (file.filename or "").lower()
        return filename.endswith(".webm") and content_type in TOPIC_AUDIO_CONTENT_TYPES

    def _validate_text_upload(self, file: UploadFile, content: bytes) -> None:
        settings = get_settings()
        if len(content) > settings.upload_max_bytes:
            raise HTTPException(status_code=400, detail="File too large")
        allowed_prefixes = {
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "text/markdown",
        }
        if file.content_type and file.content_type not in allowed_prefixes:
            raise HTTPException(status_code=400, detail="Unsupported content type")

    def _store_text_source(
        self,
        topic: Topic,
        file: UploadFile,
        content: bytes,
        doc_type: DocumentType,
    ) -> TopicSourceDocument:
        settings = get_settings()
        storage_dir = settings.storage_root / settings.uploads_dir / topic.id
        storage_dir.mkdir(parents=True, exist_ok=True)
        safe_name = Path(file.filename or "bron.txt").name
        path = storage_dir / f"{uuid4().hex}_{safe_name}"
        path.write_bytes(content)

        document = self.repo.add_document(
            topic_id=topic.id,
            filename=safe_name,
            file_path=str(path),
            content_type=file.content_type or "application/octet-stream",
            doc_type=doc_type,
            status=DocumentStatus.uploaded,
            transcription_status=AudioTranscriptionStatus.not_applicable,
        )
        self.ingestion.ingest_document(document)
        return document

    async def _validate_and_store_audio_source(
        self,
        topic: Topic,
        file: UploadFile,
    ) -> TopicSourceDocument:
        settings = get_settings()
        temp_root = settings.topic_audio_tmp_root
        if _is_within(temp_root, settings.storage_root):
            raise RuntimeError("TOPIC_AUDIO_TMP_ROOT must be outside STORAGE_ROOT")
        temp_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        temp_dir = Path(tempfile.mkdtemp(prefix="upload-", dir=temp_root))
        temp_path = temp_dir / "upload.bin"
        storage_dir = settings.storage_root / settings.uploads_dir / "topic-audio" / topic.id
        safe_name = _normalize_audio_filename(file.filename)
        unique_name = f"{uuid4().hex}_{safe_name}"
        final_path = storage_dir / unique_name
        staging_path = storage_dir / f".{unique_name}.uploading"
        promoted = False
        try:
            byte_count = await self._stream_audio_to_temp(file, temp_path)
            if byte_count == 0:
                raise HTTPException(status_code=400, detail="Empty upload is not allowed")
            metadata = probe_topic_audio(temp_path)

            storage_dir.mkdir(parents=True, exist_ok=True)
            with temp_path.open("rb") as source, staging_path.open("xb") as destination:
                shutil.copyfileobj(source, destination, length=TOPIC_AUDIO_UPLOAD_CHUNK_BYTES)
                destination.flush()
                os.fsync(destination.fileno())
            os.replace(staging_path, final_path)
            promoted = True

            try:
                return self.repo.add_document(
                    topic_id=topic.id,
                    filename=safe_name,
                    file_path=str(final_path),
                    content_type=file.content_type or "application/octet-stream",
                    doc_type=DocumentType.audio,
                    status=DocumentStatus.uploaded,
                    duration_seconds=max(1, round(metadata.duration_seconds)),
                    transcription_status=AudioTranscriptionStatus.queued,
                    transcription_attempts=0,
                    transcription_error="",
                    transcription_text="",
                    transcription_model="",
                    transcription_language="",
                    speaker_labels_json=json.dumps([]),
                )
            except Exception:
                self.db.rollback()
                raise
        except Exception:
            staging_path.unlink(missing_ok=True)
            if promoted:
                final_path.unlink(missing_ok=True)
            raise
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def _stream_audio_to_temp(self, file: UploadFile, path: Path) -> int:
        total = 0
        with path.open("xb") as destination:
            while True:
                remaining = TOPIC_AUDIO_UPLOAD_MAX_BYTES - total
                chunk = await file.read(min(TOPIC_AUDIO_UPLOAD_CHUNK_BYTES, remaining + 1))
                if not chunk:
                    break
                if len(chunk) > remaining:
                    raise HTTPException(
                        status_code=400,
                        detail="Audio file too large. Maximum size is 250 MB.",
                    )
                destination.write(chunk)
                total += len(chunk)
        return total


def _is_within(candidate: Path, parent: Path) -> bool:
    try:
        candidate.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False
