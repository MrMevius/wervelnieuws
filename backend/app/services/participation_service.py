import json
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select, update

from app.models.entities import AuditEvent, Project, User
from app.models.participation import ParticipationMoment as Moment, ParticipationParticipant, ParticipationProject
from app.repositories.participation_repository import ParticipationRepository
from app.schemas.participation import (
    ParticipationArchive, ParticipationFilters, ParticipationList, ParticipationMeta,
    ParticipationOption, ParticipationResponse, ParticipationUpdate, ParticipationWrite,
)


def display_name(user: User) -> str:
    return (user.full_name or "").strip() or user.username


class ParticipationService:
    def __init__(self, repo: ParticipationRepository):
        self.repo = repo
        self.db = repo.db

    def metadata(self, current: User) -> ParticipationMeta:
        users = self.db.scalars(select(User).order_by(User.full_name, User.username)).all()
        return ParticipationMeta(
            current_user_id=current.id,
            participants=[ParticipationOption(id=user.id, name=display_name(user), selectable=user.is_active) for user in users],
            projects=[ParticipationOption(id=project.id, name=project.name, selectable=project.is_active and not project.is_archived)
                      for project in self.repo.accessible_projects(current)],
        )

    @staticmethod
    def can_edit(row: Moment, current: User) -> bool:
        return current.is_admin or current.id == row.created_by_user_id or any(
            person.user_id == current.id for person in row.participants
        )

    def response(self, row: Moment, current: User) -> ParticipationResponse:
        fields = {name: getattr(row, name) for name in (
            "id", "title", "occurred_on", "contact_type", "conversation_partners", "location",
            "duration_minutes", "report", "agreements", "created_by_name", "created_at",
            "updated_at", "archived_at", "row_version",
        )}
        return ParticipationResponse(
            **fields,
            participants=[ParticipationOption(id=person.source_user_id, name=person.display_name, selectable=person.user_id is not None)
                          for person in sorted(row.participants, key=lambda item: item.display_name.casefold())],
            projects=[ParticipationOption(id=project.source_project_id, name=project.name, selectable=project.project_id is not None)
                      for project in sorted(row.projects, key=lambda item: item.name.casefold())],
            can_edit=self.can_edit(row, current),
        )

    def get(self, current: User, moment_id: str, *, writable=False) -> Moment:
        row = self.repo.get(current, moment_id)
        if not row:
            raise HTTPException(404, "Participatiemoment niet gevonden of geen toegang.")
        if writable and not self.can_edit(row, current):
            raise HTTPException(403, "Alleen de vastlegger, uitvoerders en beheerders mogen dit verslag wijzigen.")
        return row

    def list(self, current: User, filters: ParticipationFilters, page: int, page_size: int) -> ParticipationList:
        rows, total = self.repo.list(current, filters, offset=(page - 1) * page_size, limit=page_size)
        return ParticipationList(items=[self.response(row, current) for row in rows], total=total, page=page, page_size=page_size)

    def _references(self, current: User, payload: ParticipationWrite, previous: Moment | None):
        old_people = {person.source_user_id: person for person in previous.participants} if previous else {}
        old_projects = {project.source_project_id: project for project in previous.projects} if previous else {}
        users = {user.id: user for user in self.db.scalars(select(User).where(User.id.in_(payload.participant_ids)))}
        projects = {project.id: project for project in self.repo.accessible_projects(current)}
        people_rows, project_rows = [], []
        for user_id in payload.participant_ids:
            if user_id in old_people:
                people_rows.append(old_people[user_id])
                continue
            user = users.get(user_id)
            if not user or not user.is_active:
                raise HTTPException(422, "Selecteer alleen bestaande, actieve uitvoerders.")
            people_rows.append(ParticipationParticipant(source_user_id=user.id, user_id=user.id, display_name=display_name(user)))
        for project_id in payload.project_ids:
            if project_id in old_projects:
                project_rows.append(old_projects[project_id])
                continue
            project = projects.get(project_id)
            if not project or not project.is_active or project.is_archived:
                raise HTTPException(422, "Selecteer alleen actieve projecten waartoe je toegang hebt.")
            project_rows.append(ParticipationProject(source_project_id=project.id, project_id=project.id, name=project.name))
        return people_rows, project_rows

    def _audit(self, action: str, current: User, row: Moment, before=None) -> None:
        # Record the report revision in the same transaction, not a second commit.
        self.db.add(AuditEvent(
            event_type=f"participation.{action}", actor_user_id=current.id,
            details_json=json.dumps({
                "moment_id": row.id, "before": before,
                "after": self.response(row, current).model_dump(mode="json"),
            }, ensure_ascii=False),
        ))

    def create(self, current: User, payload: ParticipationWrite) -> ParticipationResponse:
        people, projects = self._references(current, payload, None)
        row = Moment(
            **payload.model_dump(exclude={"participant_ids", "project_ids"}),
            created_by_user_id=current.id, updated_by_user_id=current.id,
            created_by_name=display_name(current), participants=people, projects=projects,
        )
        try:
            self.db.add(row)
            self.db.flush()
            self._audit("created", current, row)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return self.response(row, current)

    def _claim_version(self, row: Moment, expected: int, current: User) -> None:
        changed = self.db.execute(update(Moment).where(
            Moment.id == row.id, Moment.row_version == expected,
        ).values(row_version=expected + 1, updated_at=datetime.now(UTC), updated_by_user_id=current.id)
            .execution_options(synchronize_session=False))
        if changed.rowcount != 1:
            self.db.rollback()
            raise HTTPException(409, "Dit verslag is intussen gewijzigd. Sluit het paneel en open het opnieuw; je invoer is niet overschreven.")
        self.db.refresh(row)

    def update(self, current: User, moment_id: str, payload: ParticipationUpdate) -> ParticipationResponse:
        row = self.get(current, moment_id, writable=True)
        if row.archived_at:
            raise HTTPException(409, "Herstel dit participatiemoment voordat je het wijzigt.")
        before = self.response(row, current).model_dump(mode="json")
        people, projects = self._references(current, payload, row)
        try:
            self._claim_version(row, payload.expected_row_version, current)
            for name, value in payload.model_dump(exclude={"participant_ids", "project_ids", "expected_row_version"}).items():
                setattr(row, name, value)
            row.participants, row.projects = people, projects
            self.db.flush()
            self._audit("updated", current, row, before)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return self.response(row, current)

    def archive(self, current: User, moment_id: str, payload: ParticipationArchive) -> ParticipationResponse:
        row = self.get(current, moment_id, writable=True)
        before = self.response(row, current).model_dump(mode="json")
        try:
            self._claim_version(row, payload.expected_row_version, current)
            row.archived_at = datetime.now(UTC) if payload.archived else None
            self.db.flush()
            self._audit("archived" if payload.archived else "restored", current, row, before)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return self.response(row, current)

    def export(self, current: User, filters: ParticipationFilters):
        rows, total = self.repo.list(current, filters, offset=0, limit=5000)
        if total > 5000:
            raise HTTPException(413, "De selectie bevat meer dan 5.000 gesprekken. Verklein de periode of filter op een project.")
        return [self.response(row, current) for row in rows]
