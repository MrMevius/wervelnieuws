import json
import math
from dataclasses import dataclass
from pathlib import Path
import subprocess

from fastapi import HTTPException

from app.core.settings import get_settings


@dataclass(frozen=True)
class AudioMediaMetadata:
    duration_seconds: float


def probe_topic_audio(path: Path) -> AudioMediaMetadata:
    settings = get_settings()
    command = [
        settings.ffprobe_bin,
        "-v",
        "error",
        "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name",
        "-of",
        "json",
        str(path),
    ]
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=settings.ffprobe_timeout_seconds,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        raise _invalid_audio("Audio inspection is unavailable or timed out.") from exc

    if result.returncode != 0:
        raise _invalid_audio("The uploaded file is not valid WebM/Opus audio.")

    try:
        payload = json.loads(result.stdout)
        format_data = payload["format"]
        format_names = {
            name.strip().lower()
            for name in str(format_data["format_name"]).split(",")
        }
        streams = payload["streams"]
        duration = float(format_data["duration"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise _invalid_audio("Audio inspection returned incomplete metadata.") from exc

    if "webm" not in format_names:
        raise _invalid_audio("The uploaded audio must use a WebM container.")
    if not isinstance(streams, list) or not any(
        isinstance(stream, dict)
        and str(stream.get("codec_type", "")).lower() == "audio"
        and str(stream.get("codec_name", "")).lower() == "opus"
        for stream in streams
    ):
        raise _invalid_audio("The uploaded WebM file must contain Opus audio.")
    if not math.isfinite(duration) or duration <= 0:
        raise _invalid_audio("The measured audio duration must be finite and positive.")
    if duration > 10_800:
        raise _invalid_audio("Audio file is too long. Maximum duration is 180 minutes.")
    return AudioMediaMetadata(duration_seconds=duration)


def _invalid_audio(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)
