from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import ThemePreference
from app.models.entities import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_username(self, username: str) -> User | None:
        return self.db.scalar(select(User).where(User.username == username))

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def list_users(self) -> list[User]:
        return list(self.db.scalars(select(User).order_by(User.username.asc())).all())

    def count_admins(self) -> int:
        count = self.db.scalar(
            select(func.count()).select_from(User).where(User.is_admin)
        )
        return int(count or 0)

    def update_current_user(
        self,
        user: User,
        *,
        full_name: str | None,
        email: str | None,
        theme_preference: ThemePreference,
    ) -> User:
        user.full_name = full_name
        user.email = email
        user.theme_preference = theme_preference
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def create(self, username: str, password_hash: str) -> User:
        user = User(username=username, password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_admin_status(self, user: User, *, is_admin: bool) -> User:
        user.is_admin = is_admin
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_password(self, user: User, password_hash: str) -> None:
        user.password_hash = password_hash
        self.db.add(user)
        self.db.commit()

    def update_active_status(self, user: User, *, is_active: bool) -> User:
        user.is_active = is_active
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()
