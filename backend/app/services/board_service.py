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
        if not project:
            raise HTTPException(status_code=404, detail="Project niet gevonden")
        if user.is_admin:
            return project
        if user.id not in project.invited_user_ids:
            raise HTTPException(status_code=403, detail="Geen toegang tot dit project")
        return project

    def ensure_card_access(self, card: BoardCard | None, user: User) -> BoardCard:
        if not card:
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
