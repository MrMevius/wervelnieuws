import pytest
from sqlalchemy import select

from app.core.db import get_db
from app.core.security import verify_password
from app.models.entities import User
from app.tasks import seed_admin


@pytest.fixture
def seed_db(client, monkeypatch):
    generator = client.app.dependency_overrides[get_db]()
    db = next(generator)
    monkeypatch.setattr(seed_admin, "SessionLocal", lambda: db)
    monkeypatch.delenv("BOOTSTRAP_ADMIN_PASSWORD", raising=False)
    try:
        yield db
    finally:
        generator.close()


@pytest.mark.parametrize("password", [None, "admin12345", "short", "x" * 129])
def test_bootstrap_requires_an_explicit_password(seed_db, password):
    with pytest.raises(RuntimeError, match="BOOTSTRAP_ADMIN_PASSWORD"):
        seed_admin.run(username="new-admin", password=password)
    assert seed_db.scalar(select(User).where(User.username == "new-admin")) is None


def test_bootstrap_does_not_promote_existing_normal_user(seed_db):
    with pytest.raises(RuntimeError, match="without admin rights"):
        seed_admin.run(username="editor", password="safe-test-password")
    assert not seed_db.scalar(select(User).where(User.username == "editor")).is_admin


def test_bootstrap_existing_admin_is_noop_without_password(seed_db):
    seed_admin.run(username="admin")
    user = seed_db.scalar(select(User).where(User.username == "admin"))
    assert verify_password("admin12345", user.password_hash)


def test_bootstrap_creates_admin_from_environment(seed_db, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_ADMIN_USERNAME", "new-admin")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "unique-test-password")
    seed_admin.run()
    user = seed_db.scalar(select(User).where(User.username == "new-admin"))
    assert user.is_admin
    assert verify_password("unique-test-password", user.password_hash)
