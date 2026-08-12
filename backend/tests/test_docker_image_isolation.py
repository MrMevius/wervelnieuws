from __future__ import annotations

import subprocess
import sys
import os
import tarfile
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock

import pytest

from scripts import build_isolated_release_artifact as builder
from scripts import verify_docker_image_isolation as verifier


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_runtime_image_isolation_rejects_every_excluded_category():
    paths = [
        "app/.env",
        "app/backend/.venv/bin/python",
        "app/backend/tests/test_api.py",
        "app/data/app.db",
        "app/storage/upload.txt",
        "app/database/app.sqlite",
        "app/config/settings.json",
        "app/backend/app/__pycache__/main.cpython-311.pyc",
        "app/frontend/node_modules/vite/index.js",
        "app/.cache/build-state",
        "app/opsx/changes/change.md",
        "app/backend/wervelnieuws_backend.egg-info/PKG-INFO",
    ]

    assert verifier.forbidden_paths(paths) == sorted(paths)


@pytest.mark.parametrize("path", ["app/release.db", "app/backend/state.db", "app/app.db"])
def test_runtime_image_isolation_rejects_standalone_db_files(path: str):
    assert verifier.forbidden_paths([path]) == [path]


def test_runtime_image_isolation_allows_runtime_application_paths():
    assert verifier.forbidden_paths(
        [
            "app/backend/app/main.py",
            "app/backend/alembic/versions/revision.py",
            "usr/local/lib/python3.11/site-packages/fastapi/applications.py",
            "usr/share/nginx/html/index.html",
        ]
    ) == []


def test_verify_image_raises_for_violations(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(verifier, "image_paths", lambda _: ["app/release.db"])

    with pytest.raises(RuntimeError, match="release.db"):
        verifier.verify_image("example:bad")


def test_verify_image_accepts_clean_image(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(verifier, "image_paths", lambda _: ["app/backend/app/main.py"])

    verifier.verify_image("example:clean")


def test_export_ref_rejects_a_movable_ref(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setattr(builder, "run", lambda *_args, **_kwargs: "a" * 40)

    with pytest.raises(ValueError, match="full immutable commit SHA"):
        builder.export_ref("main", tmp_path)


def test_builder_supports_the_documented_backend_script_invocation(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "python").symlink_to(sys.executable)
    result = subprocess.run(
        ["python", "scripts/build_isolated_release_artifact.py", "--help"],
        cwd=REPOSITORY_ROOT / "backend",
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"},
    )

    assert result.returncode == 0, result.stderr
    assert "full immutable Git commit SHA" in result.stdout


def test_export_ref_archives_the_verified_full_sha(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    commit = "a" * 40
    archive_stream = BytesIO()
    with tarfile.open(fileobj=archive_stream, mode="w") as archive:
        payload = b"immutable source"
        member = tarfile.TarInfo("source.txt")
        member.size = len(payload)
        archive.addfile(member, BytesIO(payload))
    archive = Mock(stdout=archive_stream.getvalue())
    run = Mock(return_value=commit)
    monkeypatch.setattr(builder, "run", run)
    monkeypatch.setattr(builder.subprocess, "run", Mock(return_value=archive))

    assert builder.export_ref(commit, tmp_path) == commit
    assert (tmp_path / "source.txt").read_text() == "immutable source"
    assert builder.subprocess.run.call_args.args[0] == ["git", "archive", "--format=tar", commit]


def test_build_artifacts_builds_and_verifies_all_targets_before_recording(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
):
    commands: list[list[str]] = []
    verified: list[str] = []
    monkeypatch.setattr(builder.subprocess, "run", lambda command, **_kwargs: commands.append(command))
    monkeypatch.setattr(builder, "verify_image", lambda tag: verified.append(tag))
    monkeypatch.setattr(builder, "run", lambda *_args, **_kwargs: "sha256:image")
    commit = "a" * 40

    builder.build_artifacts(commit, tmp_path, "release", "2026-08-12T00:00:00+00:00")

    expected_tags = [f"release-{name}:{commit[:12]}" for name in builder.ARTIFACTS]
    assert verified == expected_tags
    build_commands = [command for command in commands if command[:2] == ["docker", "build"]]
    assert [command[command.index("-t") + 1] for command in build_commands] == expected_tags
    output = capsys.readouterr().out
    assert output.count("artifact=") == len(builder.ARTIFACTS)


@pytest.mark.parametrize("failure", ["build", "verify"])
def test_build_artifacts_removes_partial_tags_and_never_records_success(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    failure: str,
):
    docker_commands: list[list[str]] = []

    build_count = 0

    def fake_run(command: list[str], **_kwargs: object) -> Mock:
        nonlocal build_count
        docker_commands.append(command)
        if command[:2] == ["docker", "build"]:
            build_count += 1
            if failure == "build" and build_count == 2:
                raise subprocess.CalledProcessError(1, command)
        return Mock()

    monkeypatch.setattr(builder.subprocess, "run", fake_run)
    monkeypatch.setattr(builder, "run", lambda *_args, **_kwargs: "sha256:image")
    if failure == "verify":
        verified = Mock(side_effect=[None, RuntimeError("unsafe image")])
        monkeypatch.setattr(builder, "verify_image", verified)
    else:
        monkeypatch.setattr(builder, "verify_image", Mock())

    with pytest.raises((subprocess.CalledProcessError, RuntimeError)):
        builder.build_artifacts("b" * 40, tmp_path, "release", "2026-08-12T00:00:00+00:00")

    assert capsys.readouterr().out == ""
    removed = [command[-1] for command in docker_commands if command[:3] == ["docker", "image", "rm"]]
    assert removed == [
        "release-backend:bbbbbbbbbbbb",
        "release-worker:bbbbbbbbbbbb",
    ]


def test_dockerignore_covers_all_excluded_categories():
    entries = set((REPOSITORY_ROOT / ".dockerignore").read_text().splitlines())
    expected = {
        ".env",
        ".env.*",
        "data/",
        "**/data/",
        "storage/",
        "**/storage/",
        "database/",
        "**/database/",
        "config/",
        "**/config/",
        "*.db",
        ".venv/",
        "**/.venv/",
        "*.egg-info/",
        "**/*.egg-info/",
        "node_modules/",
        "**/node_modules/",
        ".pytest_cache/",
        "**/__pycache__/",
        "tests/",
        "**/tests/",
        "opsx/",
        ".git/",
    }
    assert expected <= entries


def test_runtime_dockerfile_contracts_are_static_and_explicit():
    backend = (REPOSITORY_ROOT / "backend/Dockerfile").read_text()
    worker = (REPOSITORY_ROOT / "worker/Dockerfile").read_text()
    frontend = (REPOSITORY_ROOT / "frontend/Dockerfile").read_text()

    assert "FROM ffmpeg-base AS runtime" in backend
    assert "COPY backend /app/backend" in backend
    assert "pip install --no-cache-dir --no-compile /app/backend" in backend
    assert "pip install --no-cache-dir --no-compile -e /app/backend" not in backend
    assert "rm -rf /app/backend/*.egg-info" in backend
    assert "USER app:app" in backend
    assert "FROM python:3.11-slim AS runtime" in worker
    assert "COPY backend /app/backend" in worker
    assert "COPY worker /app/worker" in worker
    assert "pip install --no-cache-dir --no-compile /app/backend" in worker
    assert "pip install --no-cache-dir --no-compile -e /app/backend" not in worker
    assert "rm -rf /app/backend/*.egg-info" in worker
    assert "FROM nginx:1.27-alpine AS runtime" in frontend
    assert "COPY --from=build /app/dist /usr/share/nginx/html" in frontend
    assert "COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf" in frontend


def test_compose_clean_checkout_does_not_require_a_root_env_file():
    compose = (REPOSITORY_ROOT / "docker-compose.yml").read_text()
    assert compose.count("path: .env\n        required: false") == 3
