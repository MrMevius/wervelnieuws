from collections.abc import Generator
import os
from pathlib import Path
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault(
    "STORAGE_ROOT", str(Path(tempfile.gettempdir()) / "wervelnieuws-test-storage")
)

from app.api.deps import get_db
from app.core.db import Base
from app.core.security import hash_password
from app.main import app
from app.models.entities import User


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autocommit=False, autoflush=False, class_=Session
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

    db = TestingSessionLocal()
    db.add(
        User(
            username="admin",
            password_hash=hash_password("admin12345"),
            is_active=True,
            is_admin=True,
        )
    )
    db.add(
        User(
            username="editor",
            password_hash=hash_password("editor12345"),
            is_active=True,
            email="editor@example.com",
        )
    )
    db.commit()
    db.close()

    def override_get_db() -> Generator[Session, None, None]:
        test_db = TestingSessionLocal()
        try:
            yield test_db
        finally:
            test_db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()
