from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.user_repo = UserRepository(db)

    def login(self, username: str, password: str) -> str | None:
        user = self.user_repo.get_by_username(username)
        if (
            not user
            or not verify_password(password, user.password_hash)
            or not user.is_active
        ):
            return None
        return create_access_token(user.id)
