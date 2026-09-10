from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.core.settings import get_settings
from app.services.board_service import BoardService


class BoundedReadOnly(BytesIO):
    def read(self, size=-1):
        assert size == 33, "Uploads must be read with the configured limit, not loaded unboundedly"
        return super().read(size)


@pytest.mark.parametrize("method,filename,content_type", [
    ("store_recording", "audio.webm", "audio/webm"),
    ("store_card_attachment", "file.txt", "text/plain"),
    ("store_update_image", "image.png", "image/png"),
])
@pytest.mark.parametrize("payload", [b"", b"x" * 33])
def test_board_uploads_reject_empty_or_oversize_without_writing_files(client, tmp_path, monkeypatch, method, filename, content_type, payload):
    settings = get_settings()
    monkeypatch.setattr(settings, "upload_max_bytes", 32)
    monkeypatch.setattr(settings, "storage_root", tmp_path / "upload-test")
    file = UploadFile(filename=filename, file=BoundedReadOnly(payload), headers=Headers({"content-type": content_type}))
    service = BoardService(SimpleNamespace())
    card = SimpleNamespace(id="test-card", project_id="test-project")
    with pytest.raises(HTTPException) as error:
        getattr(service, method)(card, file)
    assert error.value.status_code == 400
    assert not [path for path in settings.storage_root.rglob("*") if path.is_file()]
