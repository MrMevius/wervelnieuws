from io import BytesIO
import json
from pathlib import Path
import shutil
import subprocess

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.core.settings import get_settings
from app.integrations.openai_client import OpenAIClient
from app.models.entities import Project, Topic, TopicSourceDocument, User
from app.models.enums import AudioTranscriptionStatus, DocumentStatus, DocumentType
from app.services.retrieval_service import RetrievalService
from app.services.transcription_service import TranscriptionService
from app.services.audio_media_validator import AudioMediaMetadata, probe_topic_audio


@pytest.fixture(autouse=True)
def mock_successful_media_probe(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        "app.services.topic_source_service.probe_topic_audio",
        lambda _path: AudioMediaMetadata(duration_seconds=120.0),
    )


@pytest.fixture
def audio_db_session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Session:
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    engine = create_engine(
        f"sqlite:///{tmp_path / 'audio.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(chunk_id, topic_id, text)"
            )
        )
        conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(chunk_id, knowledge_document_id, project_id, text)"
            )
        )
        conn.commit()
    SessionLocal = sessionmaker(
        bind=engine, autocommit=False, autoflush=False, class_=Session
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()
        get_settings.cache_clear()


def _login(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "admin12345"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _default_project_id(client, headers):
    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    return projects.json()[0]["id"]


def _create_topic(client, headers, project_id: str) -> dict:
    response = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": "Audio onderwerp",
            "subject": "Onderhoud turbine A",
            "theme": "Techniek",
            "project_id": project_id,
            "editorial_notes": "Gebruik alleen de getranscribeerde bron.",
            "planning_at": None,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_audio_upload_queues_transcription_using_measured_server_duration(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)
    topic = _create_topic(client, headers, project_id)

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        data={"duration_seconds": "999999"},
        files={
            "file": (
                "opname.webm",
                BytesIO(b"audio-bytes"),
                "audio/webm",
            )
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["doc_type"] == DocumentType.audio.value
    assert payload["transcription_status"] == AudioTranscriptionStatus.queued.value
    assert payload["duration_seconds"] == 120


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("opname.webm", "audio/ogg"),
        ("opname.webm", "application/octet-stream"),
        ("opname.ogg", "audio/webm"),
        ("opname.ogg", "audio/webm;codecs=opus"),
        ("opname.ogg", "audio/ogg"),
        ("opname.txt", "audio/webm"),
    ],
)
def test_invalid_audio_upload_leaves_no_file_or_queued_job(
    client, filename, content_type
):
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        files={"file": (filename, BytesIO(b"audio-bytes"), content_type)},
    )

    assert response.status_code == 400
    assert client.get(
        f"/api/topics/{topic['id']}/documents", headers=headers
    ).json() == []
    assert not (
        get_settings().storage_root
        / get_settings().uploads_dir
        / "topic-audio"
        / topic["id"]
    ).exists()
    temp_root = get_settings().topic_audio_tmp_root
    assert not temp_root.exists() or list(temp_root.iterdir()) == []


def test_oversized_audio_upload_leaves_no_file_or_queued_job(
    client, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr("app.services.topic_source_service.TOPIC_AUDIO_UPLOAD_MAX_BYTES", 4)
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers={**headers, "Content-Length": "1"},
        data={"duration_seconds": "120"},
        files={"file": ("opname.webm", BytesIO(b"12345"), "audio/webm")},
    )

    assert response.status_code == 400
    assert client.get(
        f"/api/topics/{topic['id']}/documents", headers=headers
    ).json() == []
    assert not (
        get_settings().storage_root
        / get_settings().uploads_dir
        / "topic-audio"
        / topic["id"]
    ).exists()


def test_audio_stream_accepts_exact_byte_limit_and_cleans_temp_root(
    client, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr("app.services.topic_source_service.TOPIC_AUDIO_UPLOAD_MAX_BYTES", 4)
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        files={
            "file": (
                "opname.WEBM",
                BytesIO(b"1234"),
                "audio/webm;codecs=opus",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["duration_seconds"] == 120
    temp_root = get_settings().topic_audio_tmp_root
    assert temp_root.exists()
    assert list(temp_root.iterdir()) == []


def test_probe_rejection_leaves_no_database_storage_or_temp_artifact(
    client, monkeypatch: pytest.MonkeyPatch
):
    def reject_probe(_path):
        raise HTTPException(status_code=400, detail="invalid media")

    monkeypatch.setattr("app.services.topic_source_service.probe_topic_audio", reject_probe)
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        files={"file": ("misleidend.webm", BytesIO(b"not-webm"), "audio/webm")},
    )

    assert response.status_code == 400
    assert client.get(f"/api/topics/{topic['id']}/documents", headers=headers).json() == []
    assert list(get_settings().topic_audio_tmp_root.iterdir()) == []
    durable_dir = (
        get_settings().storage_root
        / get_settings().uploads_dir
        / "topic-audio"
        / topic["id"]
    )
    assert not durable_dir.exists()


def test_database_failure_removes_promoted_audio_and_queue_row(
    client, monkeypatch: pytest.MonkeyPatch
):
    def fail_add_document(*args, **kwargs):
        raise RuntimeError("database write failed")

    monkeypatch.setattr(
        "app.services.topic_source_service.TopicRepository.add_document",
        fail_add_document,
    )
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    with pytest.raises(RuntimeError, match="database write failed"):
        client.post(
            f"/api/topics/{topic['id']}/documents",
            headers=headers,
            files={"file": ("opname.webm", BytesIO(b"media"), "audio/webm")},
        )

    durable_dir = (
        get_settings().storage_root
        / get_settings().uploads_dir
        / "topic-audio"
        / topic["id"]
    )
    assert not durable_dir.exists() or list(durable_dir.iterdir()) == []
    assert list(get_settings().topic_audio_tmp_root.iterdir()) == []


@pytest.mark.parametrize(
    "probe_payload",
    [
        {"format": {"format_name": "matroska", "duration": "1"}, "streams": [{"codec_type": "audio", "codec_name": "opus"}]},
        {"format": {"format_name": "matroska,webm", "duration": "1"}, "streams": [{"codec_type": "audio", "codec_name": "vorbis"}]},
        {"format": {"format_name": "matroska,webm", "duration": "nan"}, "streams": [{"codec_type": "audio", "codec_name": "opus"}]},
        {"format": {"format_name": "matroska,webm", "duration": "0"}, "streams": [{"codec_type": "audio", "codec_name": "opus"}]},
        {"format": {"format_name": "matroska,webm", "duration": "10800.001"}, "streams": [{"codec_type": "audio", "codec_name": "opus"}]},
    ],
)
def test_probe_contract_rejects_invalid_container_codec_or_duration(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, probe_payload
):
    media = tmp_path / "suggested.webm"
    media.write_bytes(b"not-trusted")
    monkeypatch.setattr(
        "app.services.audio_media_validator.subprocess.run",
        lambda *args, **kwargs: subprocess.CompletedProcess(args[0], 0, json.dumps(probe_payload), ""),
    )

    with pytest.raises(HTTPException) as exc_info:
        probe_topic_audio(media)

    assert exc_info.value.status_code == 400


@pytest.mark.parametrize("failure", ["missing", "timeout", "exit", "json"])
def test_probe_contract_fails_closed_for_process_errors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: str
):
    media = tmp_path / "audio.webm"
    media.write_bytes(b"bytes")

    def fail_run(command, **kwargs):
        if failure == "missing":
            raise FileNotFoundError("ffprobe")
        if failure == "timeout":
            raise subprocess.TimeoutExpired(command, 30)
        if failure == "exit":
            return subprocess.CompletedProcess(command, 1, "", "invalid")
        return subprocess.CompletedProcess(command, 0, "not-json", "")

    monkeypatch.setattr("app.services.audio_media_validator.subprocess.run", fail_run)
    with pytest.raises(HTTPException) as exc_info:
        probe_topic_audio(media)
    assert exc_info.value.status_code == 400


def test_real_ffprobe_fixtures_enforce_container_and_codec(
    client, monkeypatch: pytest.MonkeyPatch
):
    ffprobe = shutil.which(get_settings().ffprobe_bin)
    fixture = Path(__file__).parent / "fixtures" / "audio" / "valid-webm-opus.webm"
    if not ffprobe:
        pytest.skip("ffprobe is not installed in the host test environment")
    fixture_dir = fixture.parent
    fixtures = [fixture, fixture_dir / "webm-vorbis.webm", fixture_dir / "not-webm.wav"]
    assert all(path.stat().st_size < 20_000 for path in fixtures)
    valid_metadata = probe_topic_audio(fixture)
    assert 0 < valid_metadata.duration_seconds <= 10_800
    for invalid_fixture in fixtures[1:]:
        with pytest.raises(HTTPException):
            probe_topic_audio(invalid_fixture)

    monkeypatch.setattr("app.services.topic_source_service.probe_topic_audio", probe_topic_audio)
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    response = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        data={"duration_seconds": "999999"},
        files={"file": ("fixture.webm", BytesIO(fixture.read_bytes()), "audio/webm")},
    )

    assert response.status_code == 200
    assert 0 < response.json()["duration_seconds"] <= 10_800


def test_transcription_service_creates_read_only_transcript_and_searchable_chunks(
    audio_db_session: Session, tmp_path: Path
):
    db = audio_db_session
    db.add(User(username="admin", password_hash="hash", is_active=True, is_admin=True))
    project = Project(name="Windpark de Boldijk", is_active=True)
    db.add(project)
    db.flush()
    topic = Topic(
        title="Audio onderwerp",
        subject="Onderhoud turbine A",
        theme="Techniek",
        project_id=project.id,
        editorial_notes="Gebruik alleen de getranscribeerde bron.",
    )
    db.add(topic)
    db.flush()

    audio = TopicSourceDocument(
        topic_id=topic.id,
        filename="opname.webm",
        file_path="/tmp/opname.webm",
        content_type="audio/webm",
        doc_type=DocumentType.audio,
        status=DocumentStatus.uploaded,
        duration_seconds=120,
        transcription_status=AudioTranscriptionStatus.queued,
        transcription_attempts=0,
        transcription_error="",
        transcription_text="",
        transcription_model="",
        transcription_language="",
        speaker_labels_json="[]",
    )
    db.add(audio)
    db.commit()

    audio_path = tmp_path / "opname.webm"
    audio_path.write_bytes(b"fake-webm")

    service = TranscriptionService(db)
    service.openai.transcribe_audio = lambda *args, **kwargs: {  # type: ignore[assignment]
        "text": "Onderhoud turbine A staat gepland voor volgende week.",
        "segments": [{"speaker": "spreker 1", "text": "Onderhoud turbine A staat gepland."}],
    }
    audio.file_path = str(audio_path)
    db.add(audio)
    db.commit()

    processed = service.process_pending_transcriptions()
    assert processed == 1

    refreshed_audio = db.get(TopicSourceDocument, audio.id)
    assert refreshed_audio is not None
    assert refreshed_audio.transcription_status == AudioTranscriptionStatus.completed
    assert refreshed_audio.transcript_document_id is not None
    assert "spreker 1" in refreshed_audio.speaker_labels_json

    transcript = db.get(TopicSourceDocument, refreshed_audio.transcript_document_id)
    assert transcript is not None
    assert transcript.parent_source_document_id == refreshed_audio.id
    assert transcript.doc_type == DocumentType.txt
    assert transcript.status == DocumentStatus.indexed
    assert transcript.transcription_text == "Onderhoud turbine A staat gepland voor volgende week."

    hits = RetrievalService(db).retrieve_context(topic, limit=5)
    assert any("Onderhoud turbine A staat gepland" in hit["text"] for hit in hits)


@pytest.mark.parametrize(
    ("provider_result", "expected_error"),
    [
        ({"text": "", "segments": []}, "empty transcript"),
        ({"text": "   ", "segments": [{"text": "  "}]}, "empty transcript"),
    ],
)
def test_transcription_rejects_empty_provider_result(
    audio_db_session: Session, tmp_path: Path, provider_result, expected_error
):
    db = audio_db_session
    project = Project(name="Windpark de Boldijk", is_active=True)
    db.add(project)
    db.flush()
    topic = Topic(title="Audio", subject="Test", theme="Test", project_id=project.id)
    db.add(topic)
    db.flush()
    audio_path = tmp_path / "empty.webm"
    audio_path.write_bytes(b"audio")
    audio = TopicSourceDocument(
        topic_id=topic.id,
        filename="empty.webm",
        file_path=str(audio_path),
        content_type="audio/webm",
        doc_type=DocumentType.audio,
        status=DocumentStatus.uploaded,
        duration_seconds=10,
        transcription_status=AudioTranscriptionStatus.queued,
    )
    db.add(audio)
    db.commit()

    service = TranscriptionService(db)
    service.openai.transcribe_audio = lambda *args, **kwargs: provider_result  # type: ignore[assignment]
    service.process_document(audio)

    db.refresh(audio)
    assert audio.transcription_status == AudioTranscriptionStatus.failed
    assert expected_error in audio.transcription_error
    assert audio.transcript_document_id is None


def test_transcription_does_not_complete_when_indexing_fails(
    audio_db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    db = audio_db_session
    project = Project(name="Windpark de Boldijk", is_active=True)
    db.add(project)
    db.flush()
    topic = Topic(title="Audio", subject="Test", theme="Test", project_id=project.id)
    db.add(topic)
    db.flush()
    audio_path = tmp_path / "index-failure.webm"
    audio_path.write_bytes(b"audio")
    audio = TopicSourceDocument(
        topic_id=topic.id,
        filename="index-failure.webm",
        file_path=str(audio_path),
        content_type="audio/webm",
        doc_type=DocumentType.audio,
        status=DocumentStatus.uploaded,
        duration_seconds=10,
        transcription_status=AudioTranscriptionStatus.queued,
    )
    db.add(audio)
    db.commit()

    service = TranscriptionService(db)
    service.openai.transcribe_audio = lambda *args, **kwargs: {"text": "Geldige tekst"}  # type: ignore[assignment]

    def fail_ingestion(document: TopicSourceDocument) -> None:
        document.status = DocumentStatus.failed
        document.extraction_error = "mock indexing failure"
        db.add(document)
        db.commit()

    monkeypatch.setattr(service.ingestion, "ingest_document", fail_ingestion)
    service.process_document(audio)

    db.refresh(audio)
    assert audio.transcription_status == AudioTranscriptionStatus.failed
    assert "mock indexing failure" in audio.transcription_error
    transcript = db.get(TopicSourceDocument, audio.transcript_document_id)
    assert transcript is not None
    assert transcript.status == DocumentStatus.failed


def test_retry_document_moves_failed_audio_back_to_queue(audio_db_session: Session):
    db = audio_db_session
    project = Project(name="Windpark de Boldijk", is_active=True)
    db.add(project)
    db.flush()
    topic = Topic(
        title="Audio onderwerp",
        subject="Onderhoud turbine A",
        theme="Techniek",
        project_id=project.id,
        editorial_notes="",
    )
    db.add(topic)
    db.flush()
    audio = TopicSourceDocument(
        topic_id=topic.id,
        filename="opname.webm",
        file_path="/tmp/opname.webm",
        content_type="audio/webm",
        doc_type=DocumentType.audio,
        status=DocumentStatus.uploaded,
        duration_seconds=120,
        transcription_status=AudioTranscriptionStatus.failed,
        transcription_attempts=1,
        transcription_error="temporary error",
        transcription_text="",
        transcription_model="",
        transcription_language="",
        speaker_labels_json="[]",
    )
    db.add(audio)
    db.commit()

    queued = TranscriptionService(db).retry_document(audio.id)
    assert queued.transcription_status == AudioTranscriptionStatus.queued
    assert queued.transcription_error == ""


def test_mock_only_audio_flow_uploads_indexes_fails_and_retries(
    client, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()
    calls: list[str] = []
    failed_once = False

    def fake_transcribe(
        _client: OpenAIClient, file_path: str, *, model: str, language: str | None = None
    ) -> dict:
        nonlocal failed_once
        calls.append(Path(file_path).name)
        assert model == "whisper-1"
        assert language == "nl"
        if Path(file_path).read_bytes() == b"second-audio" and not failed_once:
            failed_once = True
            raise RuntimeError("mock provider failure")
        return {
            "text": "Onderhoud turbine A staat gepland voor volgende week.",
            "segments": [{"speaker": "spreker 1", "text": "Onderhoud turbine A staat gepland."}],
        }

    monkeypatch.setattr(OpenAIClient, "transcribe_audio", fake_transcribe)
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    successful_upload = client.post(
        f"/api/topics/{topic['id']}/documents",
        headers=headers,
        data={"duration_seconds": "120"},
        files={"file": ("geslaagd.webm", BytesIO(b"first-audio"), "audio/webm")},
    )
    assert successful_upload.status_code == 200
    successful_audio = successful_upload.json()
    assert successful_audio["transcription_status"] == "queued"
    assert calls == []
    successful_path = next(
        (Path(get_settings().storage_root) / get_settings().uploads_dir / "topic-audio" / topic["id"]).iterdir()
    )
    assert successful_path.read_bytes() == b"first-audio"

    engine = create_engine(get_settings().database_url)
    SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    try:
        with SessionLocal() as db:
            assert TranscriptionService(db).process_pending_transcriptions() == 1
            audio = db.get(TopicSourceDocument, successful_audio["id"])
            assert audio is not None
            assert audio.transcription_status == AudioTranscriptionStatus.completed
            transcripts = list(
                db.query(TopicSourceDocument)
                .filter(TopicSourceDocument.parent_source_document_id == audio.id)
                .all()
            )
            assert len(transcripts) == 1
            assert transcripts[0].status == DocumentStatus.indexed
            db_topic = db.get(Topic, topic["id"])
            assert db_topic is not None
            assert any(
                "Onderhoud turbine A staat gepland" in hit["text"]
                for hit in RetrievalService(db).retrieve_context(db_topic, limit=5)
            )

        failed_upload = client.post(
            f"/api/topics/{topic['id']}/documents",
            headers=headers,
            data={"duration_seconds": "60"},
            files={"file": ("mislukt.webm", BytesIO(b"second-audio"), "audio/webm")},
        )
        assert failed_upload.status_code == 200
        failed_audio = failed_upload.json()
        with SessionLocal() as db:
            failed_row = db.get(TopicSourceDocument, failed_audio["id"])
            assert failed_row is not None
            failed_path = Path(failed_row.file_path)

        with SessionLocal() as db:
            assert TranscriptionService(db).process_pending_transcriptions() == 1
            audio = db.get(TopicSourceDocument, failed_audio["id"])
            assert audio is not None
            assert audio.transcription_status == AudioTranscriptionStatus.failed
            assert audio.transcription_attempts == 1
            assert "mock provider failure" in audio.transcription_error
            assert failed_path.read_bytes() == b"second-audio"
            assert db.query(TopicSourceDocument).filter(
                TopicSourceDocument.parent_source_document_id == audio.id
            ).count() == 0

        retry = client.post(
            f"/api/topics/{topic['id']}/documents/{failed_audio['id']}/retry-transcription",
            headers=headers,
        )
        assert retry.status_code == 200
        assert retry.json()["transcription_status"] == "queued"

        with SessionLocal() as db:
            assert TranscriptionService(db).process_pending_transcriptions() == 1
            audio = db.get(TopicSourceDocument, failed_audio["id"])
            assert audio is not None
            assert audio.transcription_status == AudioTranscriptionStatus.completed
            assert audio.transcription_attempts == 2
            assert db.query(TopicSourceDocument).filter(
                TopicSourceDocument.parent_source_document_id == audio.id
            ).count() == 1
    finally:
        engine.dispose()
        get_settings.cache_clear()


def test_same_name_audio_uploads_and_transcripts_use_distinct_storage_paths(
    client, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(
        OpenAIClient,
        "transcribe_audio",
        lambda _client, file_path, **kwargs: {
            "text": f"Transcript van {Path(file_path).read_bytes().decode()}"
        },
    )
    headers = _login(client)
    topic = _create_topic(client, headers, _default_project_id(client, headers))

    uploads = [
        client.post(
            f"/api/topics/{topic['id']}/documents",
            headers=headers,
            data={"duration_seconds": "30"},
            files={"file": ("zelfde.webm", BytesIO(content), "audio/webm")},
        ).json()
        for content in (b"eerste", b"tweede")
    ]
    assert [upload["filename"] for upload in uploads] == ["zelfde.webm", "zelfde.webm"]

    engine = create_engine(get_settings().database_url)
    SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    try:
        with SessionLocal() as db:
            audio_rows = [db.get(TopicSourceDocument, upload["id"]) for upload in uploads]
            assert all(row is not None for row in audio_rows)
            audio_paths = [Path(row.file_path) for row in audio_rows if row is not None]
            assert len(set(audio_paths)) == 2
            assert {path.read_bytes() for path in audio_paths} == {b"eerste", b"tweede"}

            assert TranscriptionService(db).process_pending_transcriptions() == 2
            db.expire_all()
            completed = [db.get(TopicSourceDocument, upload["id"]) for upload in uploads]
            transcripts = [
                db.get(TopicSourceDocument, row.transcript_document_id)
                for row in completed
                if row is not None
            ]
            assert all(row is not None for row in transcripts)
            transcript_paths = [Path(row.file_path) for row in transcripts if row is not None]
            assert len(set(transcript_paths)) == 2
            assert {row.filename for row in transcripts if row is not None} == {
                "zelfde.transcript.txt"
            }
            assert {path.read_text() for path in transcript_paths} == {
                "Transcript van eerste",
                "Transcript van tweede",
            }
    finally:
        engine.dispose()
