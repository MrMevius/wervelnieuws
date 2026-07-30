import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.settings import get_settings
from app.models.entities import BoardCard, Project, User
from app.repositories.board_repository import BoardRepository


class BoardService:
    def __init__(self, repo: BoardRepository) -> None:
        self.repo = repo

    def ensure_project_access(self, project: Project | None, user: User) -> Project:
        if not project or project.is_archived:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        if user.is_admin:
            return project
        if user.id not in project.invited_user_ids:
            raise HTTPException(status_code=403, detail="Geen toegang tot dit project")
        return project

    def ensure_card_access(self, card: BoardCard | None, user: User) -> BoardCard:
        if not card or card.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Kaart niet gevonden")
        self.ensure_project_access(self.repo.get_project(card.project_id), user)
        return card

    def list_visible_projects(self, user: User) -> list[Project]:
        all_projects = self.repo.list_projects()
        if user.is_admin:
            return all_projects
        return [p for p in all_projects if user.id in p.invited_user_ids]

    def touch_activity(self, project: Project) -> None:
        project.last_activity_at = datetime.now(UTC)
        self.repo.db.add(project)
        self.repo.db.commit()

    def ensure_invited_users_exist(self, invited_user_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        for user_id in invited_user_ids:
            found = self.repo.get_user(user_id)
            if not found:
                raise HTTPException(status_code=400, detail=f"Onbekende gebruiker: {user_id}")
            if user_id not in normalized:
                normalized.append(user_id)
        return normalized

    def ensure_active_board_assignment_users(self, project: Project, assignment_user_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        allowed_user_ids = set(project.invited_user_ids)
        for user_id in assignment_user_ids:
            found = self.repo.get_user(user_id)
            if not found or not found.is_active:
                raise HTTPException(status_code=400, detail=f"Onbekende of inactieve gebruiker: {user_id}")
            if not (found.is_admin or user_id in allowed_user_ids):
                raise HTTPException(status_code=400, detail=f"Gebruiker mag niet worden toegewezen aan dit bord: {user_id}")
            if user_id not in normalized:
                normalized.append(user_id)
        return normalized

    def ensure_active_non_admin_users_exist(self, invited_user_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        for user_id in invited_user_ids:
            found = self.repo.get_user(user_id)
            if not found or not found.is_active:
                raise HTTPException(status_code=400, detail=f"Onbekende of inactieve gebruiker: {user_id}")
            if found.is_admin:
                continue
            if user_id not in normalized:
                normalized.append(user_id)
        return normalized

    def update_project_access_rights(self, project_id: str, invited_user_ids: list[str]) -> Project:
        project = self.repo.get_project(project_id)
        if not project or project.is_archived:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        invited = self.ensure_active_non_admin_users_exist(invited_user_ids)
        return self.repo.update_project_invited_users(project, invited)

    def archive_project(self, project_id: str) -> Project:
        project = self.repo.get_project(project_id)
        if not project or project.is_archived:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        return self.repo.archive_project(project)

    def store_recording(self, card: BoardCard, file: UploadFile) -> tuple[str, int, str, str]:
        mime_type = (file.content_type or "").lower().strip()
        if mime_type not in {"audio/webm", "audio/ogg", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"}:
            raise HTTPException(status_code=400, detail="Ongeldig audioformaat. Gebruik WebM/Opus.")

        settings = get_settings()
        root = settings.storage_root / settings.recordings_dir / card.project_id / card.id
        root.mkdir(parents=True, exist_ok=True)
        suffix = Path(file.filename or "opname.webm").suffix or ".webm"
        file_name = f"{uuid4()}{suffix}"
        target = root / file_name
        content = file.file.read()
        target.write_bytes(content)
        original_name = (file.filename or "opname.webm").strip() or "opname.webm"
        return str(target), len(content), mime_type, original_name

    def store_card_attachment(self, card: BoardCard, file: UploadFile) -> tuple[str, int, str, str]:
        settings = get_settings()
        root = settings.storage_root / settings.uploads_dir / "board-attachments" / card.project_id / card.id
        root.mkdir(parents=True, exist_ok=True)

        content = file.file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Lege upload is niet toegestaan.")
        if len(content) > settings.upload_max_bytes:
            raise HTTPException(status_code=400, detail="Bestand is te groot.")

        mime_type = (file.content_type or "application/octet-stream").strip().lower() or "application/octet-stream"
        source_name = Path(file.filename or "bijlage").name.strip() or "bijlage"
        if source_name in {".", ".."}:
            source_name = "bijlage"
        suffix = Path(source_name).suffix or ""
        file_name = f"{uuid4()}{suffix}"
        target = root / file_name
        target.write_bytes(content)
        return str(target), len(content), mime_type, source_name

    def store_update_image(self, card: BoardCard, file: UploadFile) -> str:
        mime_type = (file.content_type or "").lower().strip()
        allowed = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
        }
        if mime_type not in allowed:
            raise HTTPException(status_code=400, detail="Ongeldig afbeeldingsformaat. Gebruik PNG, JPG of WEBP.")

        settings = get_settings()
        root = settings.storage_root / settings.uploads_dir / "board-updates" / card.project_id / card.id
        root.mkdir(parents=True, exist_ok=True)
        target = root / f"{uuid4()}{allowed[mime_type]}"
        content = file.file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Lege upload is niet toegestaan.")
        target.write_bytes(content)
        return str(target)

    @staticmethod
    def audit_details(**kwargs: str | int | None) -> str:
        return json.dumps(kwargs)
