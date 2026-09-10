import os

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.repositories.user_repository import UserRepository


def run(username: str | None = None, password: str | None = None) -> None:
    username = username or os.environ.get("BOOTSTRAP_ADMIN_USERNAME", "admin")
    db = SessionLocal()
    try:
        repo = UserRepository(db)
        existing = repo.get_by_username(username)
        if existing:
            if not existing.is_admin:
                raise RuntimeError(
                    "Bootstrap account already exists without admin rights; "
                    "change rights through an existing administrator."
                )
            return
        password = password or os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
        if len(password) < 12 or len(password) > 128:
            raise RuntimeError(
                "Set BOOTSTRAP_ADMIN_PASSWORD to a unique password of 12–128 characters "
                "before creating the first administrator."
            )
        created = repo.create(username=username, password_hash=hash_password(password))
        repo.update_admin_status(created, is_admin=True)
    finally:
        db.close()


if __name__ == "__main__":
    run()
