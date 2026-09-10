from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.entities import Project, User
from app.models.participation import ParticipationMoment as Moment, ParticipationParticipant, ParticipationProject
from app.schemas.participation import ParticipationFilters


class ParticipationRepository:
    def __init__(self, db: Session):
        self.db = db

    def accessible_projects(self, user: User) -> list[Project]:
        projects = list(self.db.scalars(select(Project).order_by(Project.name)).all())
        return [project for project in projects if user.is_admin or user.id in project.invited_user_ids]

    def visible(self, user: User):
        statement = select(Moment)
        if not user.is_admin:
            allowed = [project.id for project in self.accessible_projects(user)]
            # A conversation spanning multiple projects is visible only when all
            # its projects are accessible, not merely one of them.
            statement = statement.where(~Moment.projects.any(or_(
                ParticipationProject.project_id.is_(None),
                ParticipationProject.project_id.not_in(allowed),
            )))
        return statement

    def get(self, user: User, moment_id: str) -> Moment | None:
        return self.db.scalar(self.visible(user).where(Moment.id == moment_id).execution_options(populate_existing=True))

    def filtered(self, user: User, filters: ParticipationFilters):
        statement = self.visible(user).where(
            Moment.archived_at.is_not(None) if filters.archived else Moment.archived_at.is_(None)
        )
        if filters.date_from:
            statement = statement.where(Moment.occurred_on >= filters.date_from)
        if filters.date_to:
            statement = statement.where(Moment.occurred_on <= filters.date_to)
        if filters.project_id:
            statement = statement.where(Moment.projects.any(ParticipationProject.source_project_id == filters.project_id))
        if filters.participant_id:
            statement = statement.where(Moment.participants.any(ParticipationParticipant.source_user_id == filters.participant_id))
        if filters.query.strip():
            term = filters.query.strip()
            statement = statement.where(or_(*[
                field.contains(term, autoescape=True)
                for field in (Moment.title, Moment.report, Moment.agreements, Moment.conversation_partners, Moment.location)
            ]))
        return statement

    def list(self, user: User, filters: ParticipationFilters, *, offset: int, limit: int):
        statement = self.filtered(user, filters)
        total = self.db.scalar(select(func.count()).select_from(statement.subquery())) or 0
        items = list(self.db.scalars(statement.order_by(Moment.occurred_on.desc(), Moment.created_at.desc(), Moment.id).offset(offset).limit(limit)))
        return items, total
