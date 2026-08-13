"""Fail a release preflight when a runtime image contains local build inputs."""

from __future__ import annotations

import argparse
import subprocess
from collections.abc import Iterable

FORBIDDEN_PATH_PARTS = (
    ".env",
    ".venv/",
    "node_modules/",
    "__pycache__/",
    ".pytest_cache/",
    ".mypy_cache/",
    ".ruff_cache/",
    ".cache/",
    "tests/",
    "opsx/",
    ".git/",
    "data/",
    "storage/",
    "database/",
    "config/",
)
FORBIDDEN_SUFFIXES = (".pyc", ".pyo", ".sqlite", ".sqlite3")


def forbidden_paths(paths: Iterable[str]) -> list[str]:
    return sorted(
        path
        for path in paths
        if path.startswith("app/")
        and (
            any(part in path.removeprefix("app/") for part in FORBIDDEN_PATH_PARTS)
            or path.endswith(FORBIDDEN_SUFFIXES)
        )
    )


def image_paths(image_name: str) -> list[str]:
    container = subprocess.check_output(
        ["docker", "container", "create", image_name], text=True
    ).strip()
    try:
        listing = subprocess.check_output(
            ["docker", "container", "export", container],
            text=False,
        )
    finally:
        subprocess.run(["docker", "container", "rm", "--force", container], check=True)

    import io
    import tarfile

    with tarfile.open(fileobj=io.BytesIO(listing)) as exported:
        return [member.name.rstrip("/") for member in exported.getmembers()]


def verify_image(image_name: str) -> None:
    violations = forbidden_paths(image_paths(image_name))
    if violations:
        raise RuntimeError(
            f"Runtime image {image_name!r} contains excluded build inputs: "
            + ", ".join(violations)
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", help="runtime image tags or IDs")
    args = parser.parse_args()
    for image in args.images:
        verify_image(image)
        print(f"Docker runtime image isolation passed: {image}")


if __name__ == "__main__":
    main()
