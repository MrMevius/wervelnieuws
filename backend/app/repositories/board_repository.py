from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import BoardCard, CardAssignment, CardUpdate, Project, Recording, User
from app.models.enums import BoardColumn


class BoardRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_projects(self) -> list[Project]:
        return list(self.db.scalars(select(Project).where(Project.is_archived.is_(False)).order_by(Project.name.asc())).all())

    def create_project(self, name: str, description: str, invited_user_ids: list[str]) -> Project:
        project = Project(name=name.strip(), description=description.strip())
        project.invited_user_ids = invited_user_ids
        project.last_activity_at = datetime.now(UTC)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def get_project(self, project_id: str) -> Project | None:
        return self.db.get(Project, project_id)

    def list_project_cards(self, project_id: str) -> list[BoardCard]:
        return list(
            self.db.scalars(
                select(BoardCard)
                .where(BoardCard.project_id == project_id, BoardCard.is_archived.is_(False))
                .options(joinedload(BoardCard.assignments).joinedload(CardAssignment.user))
                .order_by(BoardCard.column.asc(), BoardCard.position.asc(), BoardCard.created_at.asc())
            ).unique().all()
        )

    def count_updates(self, card_id: str) -> int:
        return int(self.db.scalar(select(func.count(CardUpdate.id)).where(CardUpdate.card_id == card_id)) or 0)

    def count_recordings(self, card_id: str) -> int:
        return int(self.db.scalar(select(func.count(Recording.id)).where(Recording.card_id == card_id)) or 0)

    def create_card(self, project_id: str, title: str, description: str, column: BoardColumn) -> BoardCard:
        max_position = self.db.scalar(select(func.max(BoardCard.position)).where(BoardCard.project_id == project_id, BoardCard.column == column))
        card = BoardCard(project_id=project_id, title=title.strip(), description=description.strip(), column=column, position=int(max_position or -1) + 1)
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def get_card(self, card_id: str) -> BoardCard | None:
        return self.db.scalar(select(BoardCard).where(BoardCard.id == card_id).options(joinedload(BoardCard.assignments).joinedload(CardAssignment.user)))

    def update_card_title(self, card: BoardCard, title: str) -> BoardCard:
        card.title = title.strip()
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def update_card_description(self, card: BoardCard, description: str) -> BoardCard:
        card.description = description.strip()
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def replace_assignments(self, card: BoardCard, user_ids: list[str]) -> None:
        self.db.query(CardAssignment).filter(CardAssignment.card_id == card.id).delete()
        for user_id in dict.fromkeys(user_ids):
            self.db.add(CardAssignment(card_id=card.id, user_id=user_id))
        self.db.commit()

    def move_card(self, card: BoardCard, target_column: BoardColumn, target_position: int) -> BoardCard:
        cards = list(
            self.db.scalars(
                select(BoardCard)
                .where(BoardCard.project_id == card.project_id, BoardCard.column == target_column, BoardCard.is_archived.is_(False), BoardCard.id != card.id)
                .order_by(BoardCard.position.asc(), BoardCard.created_at.asc())
            ).all()
        )
        insert_at = min(max(target_position, 0), len(cards))
        cards.insert(insert_at, card)
        for index, item in enumerate(cards):
            item.column = target_column
            item.position = index
            self.db.add(item)
        self.db.commit()
        self.db.refresh(card)
        return card

    def list_updates(self, card_id: str) -> list[CardUpdate]:
        return list(self.db.scalars(select(CardUpdate).where(CardUpdate.card_id == card_id).order_by(CardUpdate.created_at.desc())).all())

    def create_update(self, card_id: str, author_user_id: str, message: str) -> CardUpdate:
        row = CardUpdate(card_id=card_id, author_user_id=author_user_id, message=message.strip())
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_recordings(self, card_id: str) -> list[Recording]:
        return list(self.db.scalars(select(Recording).where(Recording.card_id == card_id).order_by(Recording.created_at.desc())).all())

    def create_recording(
        self,
        card_id: str,
        uploaded_by_user_id: str,
        filename: str,
        file_path: str,
        duration: int | None,
        mime_type: str,
        size_bytes: int,
    ) -> Recording:
        row = Recording(
            card_id=card_id,
            uploaded_by_user_id=uploaded_by_user_id,
            filename=filename,
            file_path=file_path,
            duration=duration,
            mime_type=mime_type,
            size_bytes=size_bytes,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def get_user(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)
