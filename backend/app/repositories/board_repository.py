from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    BoardCard,
    BoardCardAttachment,
    CardAssignment,
    CardUpdate,
    Project,
    Recording,
    User,
)
from app.models.enums import BoardColumn


class BoardRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_projects(self) -> list[Project]:
        return list(self.db.scalars(select(Project).where(Project.is_archived.is_(False)).order_by(Project.name.asc())).all())

    def list_users(self) -> list[User]:
        return list(self.db.scalars(select(User).order_by(User.username.asc())).all())

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

    def update_project_invited_users(self, project: Project, invited_user_ids: list[str]) -> Project:
        project.invited_user_ids = invited_user_ids
        project.last_activity_at = datetime.now(UTC)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def archive_project(self, project: Project) -> Project:
        project.is_archived = True
        project.last_activity_at = datetime.now(UTC)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def list_project_cards(self, project_id: str) -> list[BoardCard]:
        return list(
            self.db.scalars(
                select(BoardCard)
                .where(
                    BoardCard.project_id == project_id,
                    BoardCard.is_archived.is_(False),
                    BoardCard.deleted_at.is_(None),
                )
                .options(joinedload(BoardCard.assignments).joinedload(CardAssignment.user))
                .order_by(BoardCard.column.asc(), BoardCard.position.asc(), BoardCard.created_at.asc())
            ).unique().all()
        )

    def list_archived_project_cards(self, project_id: str) -> list[BoardCard]:
        return list(
            self.db.scalars(
                select(BoardCard)
                .where(
                    BoardCard.project_id == project_id,
                    BoardCard.is_archived.is_(True),
                    BoardCard.deleted_at.is_(None),
                )
                .options(joinedload(BoardCard.assignments).joinedload(CardAssignment.user))
                .order_by(BoardCard.position.asc(), BoardCard.created_at.asc())
            ).unique().all()
        )

    def list_deleted_cards(self) -> list[BoardCard]:
        return list(
            self.db.scalars(
                select(BoardCard)
                .where(BoardCard.deleted_at.is_not(None))
                .options(
                    joinedload(BoardCard.project),
                    joinedload(BoardCard.deleted_by),
                    joinedload(BoardCard.assignments).joinedload(CardAssignment.user),
                )
                .order_by(BoardCard.deleted_at.desc(), BoardCard.created_at.desc())
            ).unique().all()
        )

    def count_updates(self, card_id: str) -> int:
        return int(
            self.db.scalar(
                select(func.count(CardUpdate.id)).where(
                    CardUpdate.card_id == card_id,
                    CardUpdate.deleted_at.is_(None),
                )
            )
            or 0
        )

    def count_recordings(self, card_id: str) -> int:
        return int(self.db.scalar(select(func.count(Recording.id)).where(Recording.card_id == card_id)) or 0)

    def count_attachments(self, card_id: str) -> int:
        return int(
            self.db.scalar(
                select(func.count(BoardCardAttachment.id)).where(BoardCardAttachment.card_id == card_id)
            )
            or 0
        )

    def create_card(self, project_id: str, title: str, description: str, column: BoardColumn) -> BoardCard:
        max_position = self.db.scalar(select(func.max(BoardCard.position)).where(BoardCard.project_id == project_id, BoardCard.column == column))
        card = BoardCard(project_id=project_id, title=title.strip(), description=description.strip(), column=column, position=int(max_position or -1) + 1)
        self.db.add(card)
        self.db.flush()
        return card

    def get_card(self, card_id: str, *, include_deleted: bool = False) -> BoardCard | None:
        stmt = select(BoardCard).where(BoardCard.id == card_id)
        if not include_deleted:
            stmt = stmt.where(BoardCard.deleted_at.is_(None))
        return self.db.scalar(stmt.options(joinedload(BoardCard.assignments).joinedload(CardAssignment.user)))

    def archive_card(self, card: BoardCard) -> BoardCard:
        card.is_archived = True
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def restore_card(self, card: BoardCard) -> BoardCard:
        card.is_archived = False
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def soft_delete_card(self, card: BoardCard, deleted_by_user_id: str) -> BoardCard:
        card.deleted_at = datetime.now(UTC)
        card.deleted_by_user_id = deleted_by_user_id
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

    def restore_deleted_card(self, card: BoardCard) -> BoardCard:
        card.deleted_at = None
        card.deleted_by_user_id = None
        self.db.add(card)
        self.db.commit()
        self.db.refresh(card)
        return card

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
        self.db.flush()

    def move_card(self, card: BoardCard, target_column: BoardColumn, target_position: int) -> BoardCard:
        cards = list(
            self.db.scalars(
                select(BoardCard)
                .where(
                    BoardCard.project_id == card.project_id,
                    BoardCard.column == target_column,
                    BoardCard.is_archived.is_(False),
                    BoardCard.deleted_at.is_(None),
                    BoardCard.id != card.id,
                )
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
        return list(
            self.db.scalars(
                select(CardUpdate)
                .where(CardUpdate.card_id == card_id, CardUpdate.deleted_at.is_(None))
                .order_by(CardUpdate.created_at.desc())
            ).all()
        )

    def create_update(self, card_id: str, author_user_id: str, message: str) -> CardUpdate:
        row = CardUpdate(card_id=card_id, author_user_id=author_user_id, message=message.strip())
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def get_update(self, update_id: str) -> CardUpdate | None:
        return self.db.get(CardUpdate, update_id)

    def soft_delete_update(self, update: CardUpdate, deleted_by_user_id: str) -> CardUpdate:
        update.deleted_at = datetime.now(UTC)
        update.deleted_by_user_id = deleted_by_user_id
        self.db.add(update)
        self.db.commit()
        self.db.refresh(update)
        return update

    def create_update_revision(self, source: CardUpdate, message: str, image_path: str | None) -> CardUpdate:
        row = CardUpdate(
            card_id=source.card_id,
            author_user_id=source.author_user_id,
            message=message.strip(),
            image_path=image_path,
            edited_from_update_id=source.id,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_recordings(self, card_id: str) -> list[Recording]:
        return list(self.db.scalars(select(Recording).where(Recording.card_id == card_id).order_by(Recording.created_at.desc())).all())

    def list_attachments(self, card_id: str) -> list[BoardCardAttachment]:
        return list(
            self.db.scalars(
                select(BoardCardAttachment)
                .where(BoardCardAttachment.card_id == card_id)
                .options(joinedload(BoardCardAttachment.uploaded_by))
                .order_by(BoardCardAttachment.created_at.desc())
            ).all()
        )

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

    def create_attachment(
        self,
        card_id: str,
        uploaded_by_user_id: str,
        filename: str,
        file_path: str,
        mime_type: str,
        size_bytes: int,
    ) -> BoardCardAttachment:
        row = BoardCardAttachment(
            card_id=card_id,
            uploaded_by_user_id=uploaded_by_user_id,
            filename=filename,
            file_path=file_path,
            mime_type=mime_type,
            size_bytes=size_bytes,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def get_attachment(self, attachment_id: str) -> BoardCardAttachment | None:
        return self.db.scalar(
            select(BoardCardAttachment)
            .where(BoardCardAttachment.id == attachment_id)
            .options(joinedload(BoardCardAttachment.uploaded_by))
        )

    def delete_attachment(self, attachment: BoardCardAttachment) -> None:
        self.db.delete(attachment)
        self.db.commit()

    def get_user(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)
