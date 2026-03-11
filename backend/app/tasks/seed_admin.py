from app.core.db import SessionLocal
from app.core.security import hash_password
from app.repositories.user_repository import UserRepository


def run(username: str = "admin", password: str = "admin12345") -> None:
    db = SessionLocal()
    try:
        repo = UserRepository(db)
        if repo.get_by_username(username):
            return
        repo.create(username=username, password_hash=hash_password(password))
    finally:
        db.close()


if __name__ == "__main__":
    run()
