from pathlib import Path

from fastapi import HTTPException, status
from fastapi.responses import FileResponse

from app.models.entities import User

AVATAR_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def avatar_media_type(path: Path) -> str:
    return AVATAR_MEDIA_TYPES.get(path.suffix.lower(), "image/png")


def avatar_file_response(user: User | None) -> FileResponse:
    if not user or not user.avatar_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    avatar = Path(user.avatar_path)
    if not avatar.exists() or not avatar.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return FileResponse(path=avatar, media_type=avatar_media_type(avatar))
