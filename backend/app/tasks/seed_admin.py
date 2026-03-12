from app.core.db import SessionLocal
from app.core.security import hash_password
from app.repositories.user_repository import UserRepository


def run(username: str = "admin", password: str = "admin12345") -> None:
    db = SessionLocal()
    try:
        repo = UserRepository(db)
        existing = repo.get_by_username(username)
        if existing:
            if not existing.is_admin:
                repo.update_admin_status(existing, is_admin=True)
            return
        created = repo.create(username=username, password_hash=hash_password(password))
        repo.update_admin_status(created, is_admin=True)
    finally:
        db.close()


if __name__ == "__main__":
    run()
