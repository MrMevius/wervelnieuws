import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.db import get_db
from app.core.security import hash_password
from app.core.settings import get_settings
from app.models.entities import AuditEvent, Project, SystemSetting, Topic, User
from app.repositories.database_repository import DatabaseRepository
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    AdminActivityResponse,
    AdminScheduleTemplateResponse,
    AdminThemeResponse,
    AdminUiSettingsResponse,
    AdminUserResponse,
    CreateAdminThemeRequest,
    CreateAdminUserRequest,
    UpdateAdminUiSettingsRequest,
    UpdateAdminThemeRequest,
    UpdateAdminUserActiveRequest,
    UpdateAdminUserPasswordRequest,
    UpdateAdminUserRequest,
)
from app.schemas.database import (
    CreateProjectRequest,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.schemas.genai import (
    GenAIConfigResponse,
    GenAIModelOptionsResponse,
    UpdateGenAIConfigRequest,
)
from app.services.genai_config_service import GenAIConfigService

router = APIRouter(prefix="/admin", tags=["admin"])

THEMES_SETTING_KEY = "admin_topic_themes_v1"
SCHEDULE_TEMPLATES_SETTING_KEY = "admin_schedule_templates_v1"
UI_SETTINGS_KEY = "admin_ui_settings_v1"

DEFAULT_ADMIN_THEMES = [
    {"id": "algemeen", "name": "Algemeen", "is_active": True},
    {"id": "planning", "name": "Planning", "is_active": True},
    {"id": "techniek", "name": "Techniek", "is_active": True},
    {"id": "omgeving", "name": "Omgeving", "is_active": True},
    {"id": "veiligheid", "name": "Veiligheid", "is_active": True},
    {"id": "participatie", "name": "Participatie", "is_active": True},
]

DEFAULT_SCHEDULE_TEMPLATES = [
    {
        "id": "weekly-update",
        "label": "Wekelijkse projectupdate",
        "subject_template": "Wekelijkse update {project}",
        "theme": "Planning",
        "editorial_notes": "Benoem voortgang, komende werkzaamheden en wat bewoners kunnen verwachten.",
        "planning_time": "09:00",
    },
    {
        "id": "monthly-overview",
        "label": "Maandoverzicht",
        "subject_template": "Maandoverzicht {project}",
        "theme": "Algemeen",
        "editorial_notes": "Vat de maand samen in rustige, feitelijke taal en benoem vervolgstappen.",
        "planning_time": "10:00",
    },
    {
        "id": "resident-info",
        "label": "Bewonersinformatie",
        "subject_template": "Informatie voor omwonenden {project}",
        "theme": "Omgeving",
        "editorial_notes": "Leg duidelijk uit wat verandert, wanneer het plaatsvindt en waar vragen gesteld kunnen worden.",
        "planning_time": "18:30",
    },
]

DEFAULT_UI_SETTINGS = {"wind_theme_enabled": True}

AVATAR_CONTENT_TYPES = {
    "image/png": {"extension": ".png", "magic": (b"\x89PNG\r\n\x1a\n",)},
    "image/jpeg": {"extension": ".jpg", "magic": (b"\xff\xd8\xff",)},
    "image/gif": {"extension": ".gif", "magic": (b"GIF87a", b"GIF89a")},
    "image/webp": {"extension": ".webp", "magic": (b"RIFF",)},
}


def _validate_avatar_upload(content: bytes, content_type: str | None) -> str:
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty upload is not allowed")

    avatar_type = AVATAR_CONTENT_TYPES.get(content_type or "")
    if avatar_type is None:
        raise HTTPException(
            status_code=400,
            detail="Avatar must be a PNG, JPEG, GIF or WebP image",
        )

    magic_values = avatar_type["magic"]
    has_matching_magic = any(content.startswith(magic) for magic in magic_values)
    if content_type == "image/webp":
        has_matching_magic = len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    if not has_matching_magic:
        raise HTTPException(
            status_code=400,
            detail="Avatar content does not match the selected image type",
        )
    return str(avatar_type["extension"])


def _avatar_media_type(path: Path) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "image/png")


def _slugify_theme_id(name: str) -> str:
    normalized = []
    for char in name.lower().strip():
        if char.isalnum():
            normalized.append(char)
        elif char in {" ", "-", "_"}:
            normalized.append("-")
    slug = "".join(normalized).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "theme"


def _load_json_setting(db: Session, key: str, default_value: list[dict]) -> list[dict]:
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not setting:
        setting = SystemSetting(key=key, value=json.dumps(default_value))
        db.add(setting)
        db.commit()
        return default_value
    try:
        parsed = json.loads(setting.value)
    except json.JSONDecodeError:
        parsed = default_value
    if not isinstance(parsed, list):
        parsed = default_value
    return parsed


def _save_json_setting(db: Session, key: str, value: list[dict]) -> None:
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not setting:
        setting = SystemSetting(key=key, value=json.dumps(value))
    else:
        setting.value = json.dumps(value)
    db.add(setting)
    db.commit()


def _load_object_setting(db: Session, key: str, default_value: dict) -> dict:
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not setting:
        setting = SystemSetting(key=key, value=json.dumps(default_value))
        db.add(setting)
        db.commit()
        return default_value
    try:
        parsed = json.loads(setting.value)
    except json.JSONDecodeError:
        parsed = default_value
    if not isinstance(parsed, dict):
        parsed = default_value
    return parsed


def _save_object_setting(db: Session, key: str, value: dict) -> None:
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if not setting:
        setting = SystemSetting(key=key, value=json.dumps(value))
    else:
        setting.value = json.dumps(value)
    db.add(setting)
    db.commit()


def _normalize_themes(raw_themes: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for item in raw_themes:
        if not isinstance(item, dict):
            continue
        raw_name = str(item.get("name", "")).strip()
        if not raw_name:
            continue
        raw_id = str(item.get("id", "")).strip() or _slugify_theme_id(raw_name)
        is_active = bool(item.get("is_active", True))
        lower_name = raw_name.lower()
        if raw_id in seen_ids or lower_name in seen_names:
            continue
        seen_ids.add(raw_id)
        seen_names.add(lower_name)
        normalized.append({"id": raw_id, "name": raw_name, "is_active": is_active})
    return normalized


def _read_themes(db: Session) -> list[dict]:
    raw_themes = _load_json_setting(db, THEMES_SETTING_KEY, DEFAULT_ADMIN_THEMES)
    themes = _normalize_themes(raw_themes)
    if not themes:
        themes = DEFAULT_ADMIN_THEMES
    _save_json_setting(db, THEMES_SETTING_KEY, themes)
    return themes


def _read_schedule_templates(db: Session) -> list[dict]:
    raw_templates = _load_json_setting(
        db,
        SCHEDULE_TEMPLATES_SETTING_KEY,
        DEFAULT_SCHEDULE_TEMPLATES,
    )
    normalized: list[dict] = []
    for item in raw_templates:
        if not isinstance(item, dict):
            continue
        if not all(
            key in item
            for key in [
                "id",
                "label",
                "subject_template",
                "theme",
                "editorial_notes",
                "planning_time",
            ]
        ):
            continue
        normalized.append(item)
    if not normalized:
        normalized = DEFAULT_SCHEDULE_TEMPLATES
    _save_json_setting(db, SCHEDULE_TEMPLATES_SETTING_KEY, normalized)
    return normalized


def _read_ui_settings(db: Session) -> dict:
    raw = _load_object_setting(db, UI_SETTINGS_KEY, DEFAULT_UI_SETTINGS)
    normalized = {
        "wind_theme_enabled": bool(raw.get("wind_theme_enabled", True)),
    }
    _save_object_setting(db, UI_SETTINGS_KEY, normalized)
    return normalized


@router.get("/genai-config", response_model=GenAIConfigResponse)
def get_genai_config(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GenAIConfigResponse:
    del current
    return GenAIConfigService(db).get_admin_config()


@router.patch("/genai-config", response_model=GenAIConfigResponse)
def update_genai_config(
    payload: UpdateGenAIConfigRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GenAIConfigResponse:
    del current
    return GenAIConfigService(db).update_config(payload)


@router.get("/genai-model-options", response_model=GenAIModelOptionsResponse)
def get_genai_model_options(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GenAIModelOptionsResponse:
    del current
    return GenAIConfigService(db).get_model_options()


@router.get("/ui-settings", response_model=AdminUiSettingsResponse)
def get_ui_settings(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUiSettingsResponse:
    del current
    settings = _read_ui_settings(db)
    return AdminUiSettingsResponse.model_validate(settings)


@router.patch("/ui-settings", response_model=AdminUiSettingsResponse)
def update_ui_settings(
    payload: UpdateAdminUiSettingsRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUiSettingsResponse:
    del current
    updated = {"wind_theme_enabled": payload.wind_theme_enabled}
    _save_object_setting(db, UI_SETTINGS_KEY, updated)
    return AdminUiSettingsResponse.model_validate(updated)


@router.get("/themes", response_model=list[AdminThemeResponse])
def list_themes(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminThemeResponse]:
    del current
    themes = _read_themes(db)
    return [AdminThemeResponse.model_validate(item) for item in themes]


@router.post("/themes", response_model=AdminThemeResponse)
def create_theme(
    payload: CreateAdminThemeRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminThemeResponse:
    themes = _read_themes(db)
    name = payload.name.strip()
    if any(theme["name"].lower() == name.lower() for theme in themes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Theme name already exists",
        )
    item = {"id": _slugify_theme_id(name), "name": name, "is_active": True}
    suffix = 2
    existing_ids = {theme["id"] for theme in themes}
    while item["id"] in existing_ids:
        item["id"] = f"{_slugify_theme_id(name)}-{suffix}"
        suffix += 1
    themes.append(item)
    _save_json_setting(db, THEMES_SETTING_KEY, themes)
    return AdminThemeResponse.model_validate(item)


@router.patch("/themes/{theme_id}", response_model=AdminThemeResponse)
def update_theme(
    theme_id: str,
    payload: UpdateAdminThemeRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminThemeResponse:
    del current
    themes = _read_themes(db)
    index = next((i for i, item in enumerate(themes) if item["id"] == theme_id), -1)
    if index < 0:
        raise HTTPException(status_code=404, detail="Theme not found")
    current_item = themes[index]
    if payload.name is not None:
        new_name = payload.name.strip()
        if any(
            item["id"] != theme_id and item["name"].lower() == new_name.lower()
            for item in themes
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Theme name already exists",
            )
        current_item["name"] = new_name
    if payload.is_active is not None:
        current_item["is_active"] = payload.is_active
    themes[index] = current_item
    _save_json_setting(db, THEMES_SETTING_KEY, themes)
    return AdminThemeResponse.model_validate(current_item)


@router.get("/schedule-templates", response_model=list[AdminScheduleTemplateResponse])
def list_schedule_templates(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminScheduleTemplateResponse]:
    del current
    templates = _read_schedule_templates(db)
    return [AdminScheduleTemplateResponse.model_validate(item) for item in templates]


@router.get("/activity", response_model=list[AdminActivityResponse])
def list_admin_activity(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminActivityResponse]:
    del current
    rows = (
        db.query(AuditEvent, User.username, Topic.subject)
        .outerjoin(User, User.id == AuditEvent.actor_user_id)
        .outerjoin(Topic, Topic.id == AuditEvent.topic_id)
        .order_by(desc(AuditEvent.created_at))
        .limit(40)
        .all()
    )
    return [
        AdminActivityResponse(
            id=event.id,
            event_type=event.event_type,
            topic_id=event.topic_id,
            topic_subject=subject,
            actor_user_id=event.actor_user_id,
            actor_username=username or "Systeem",
            created_at=event.created_at.isoformat(),
        )
        for event, username, subject in rows
    ]


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    del current
    repo = DatabaseRepository(db)
    projects = repo.list_projects(include_inactive=True)
    return [ProjectResponse.model_validate(project) for project in projects]


@router.post("/projects", response_model=ProjectResponse)
def create_project(
    payload: CreateProjectRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    del current
    repo = DatabaseRepository(db)
    name = payload.name.strip()
    if repo.get_project_by_name(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project name already exists",
        )
    created = repo.create_project(name)
    return ProjectResponse.model_validate(created)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: UpdateProjectRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    del current
    repo = DatabaseRepository(db)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if payload.name is not None:
        normalized = payload.name.strip()
        existing = repo.get_project_by_name(normalized)
        if existing and existing.id != project.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project name already exists",
            )
        project.name = normalized

    if payload.is_active is not None:
        project.is_active = payload.is_active

    updated = repo.save_project(project)
    return ProjectResponse.model_validate(updated)


@router.post("/users", response_model=AdminUserResponse)
def create_user(
    payload: CreateAdminUserRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    del current
    user_repo = UserRepository(db)
    existing = user_repo.get_by_username(payload.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    created = user_repo.create(
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    return AdminUserResponse(
        id=created.id,
        username=created.username,
        full_name=created.full_name,
        email=created.email,
        is_admin=created.is_admin,
        is_active=created.is_active,
        has_avatar=bool(created.avatar_path),
    )


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    del current
    users = UserRepository(db).list_users()
    return [
        AdminUserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_admin=user.is_admin,
            is_active=user.is_active,
            has_avatar=bool(user.avatar_path),
        )
        for user in users
    ]


@router.get("/users/{user_id}/avatar")
def get_admin_user_avatar(
    user_id: str,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FileResponse:
    del current
    user = db.get(User, user_id)
    if not user or not user.avatar_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    avatar = Path(user.avatar_path)
    if not avatar.exists() or not avatar.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return FileResponse(path=avatar, media_type=_avatar_media_type(avatar))


@router.post("/users/{user_id}/avatar", response_model=AdminUserResponse)
async def upload_admin_user_avatar(
    user_id: str,
    file: UploadFile = File(...),
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    del current
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    settings = get_settings()
    content = await file.read(settings.avatar_max_bytes + 1)
    if len(content) > settings.avatar_max_bytes:
        raise HTTPException(status_code=400, detail="Avatar file too large")
    extension = _validate_avatar_upload(content, file.content_type)

    avatars_dir = settings.storage_root / settings.uploads_dir / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    for existing_path in avatars_dir.glob(f"{user.id}.*"):
        if existing_path.is_file():
            existing_path.unlink()
    avatar_path = avatars_dir / f"{user.id}{extension}"
    avatar_path.write_bytes(content)

    user.avatar_path = str(avatar_path)
    updated = UserRepository(db).save_user(user)
    return AdminUserResponse(
        id=updated.id,
        username=updated.username,
        full_name=updated.full_name,
        email=updated.email,
        is_admin=updated.is_admin,
        is_active=updated.is_active,
        has_avatar=True,
    )


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user_admin_status(
    user_id: str,
    payload: UpdateAdminUserRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    user_repo = UserRepository(db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if payload.is_admin is not None and user.is_admin and not payload.is_admin and user_repo.count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove admin rights from the last admin user",
        )
    if current.id == user.id and payload.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin users cannot remove their own admin rights",
        )
    if current.id == user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin users cannot disable their own account",
        )

    if payload.email:
        user_with_email = user_repo.get_by_email(payload.email)
        if user_with_email and user_with_email.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )

    if "full_name" in payload.model_fields_set:
        user.full_name = payload.full_name
    if "email" in payload.model_fields_set:
        user.email = payload.email
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    updated = user_repo.save_user(user)
    return AdminUserResponse(
        id=updated.id,
        username=updated.username,
        full_name=updated.full_name,
        email=updated.email,
        is_admin=updated.is_admin,
        is_active=updated.is_active,
        has_avatar=bool(updated.avatar_path),
    )


@router.patch("/users/{user_id}/active", response_model=AdminUserResponse)
def update_user_active_status(
    user_id: str,
    payload: UpdateAdminUserActiveRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    user_repo = UserRepository(db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_admin and not payload.is_active and user_repo.count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable the last admin user",
        )
    if current.id == user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin users cannot disable their own account",
        )

    updated = user_repo.update_active_status(user, is_active=payload.is_active)
    return AdminUserResponse(
        id=updated.id,
        username=updated.username,
        full_name=updated.full_name,
        email=updated.email,
        is_admin=updated.is_admin,
        is_active=updated.is_active,
        has_avatar=bool(updated.avatar_path),
    )


@router.patch("/users/{user_id}/password")
def update_user_password(
    user_id: str,
    payload: UpdateAdminUserPasswordRequest,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    del current
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    UserRepository(db).update_password(user, hash_password(payload.new_password))
    return {"status": "ok"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user_repo = UserRepository(db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_admin and user_repo.count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last admin user",
        )
    if current.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin users cannot delete themselves",
        )

    user_repo.delete_user(user)
    return {"status": "ok"}
