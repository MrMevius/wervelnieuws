"""Build runtime artifacts from an immutable Git ref, never from a worktree."""

from __future__ import annotations

import argparse
import io
import shutil
import subprocess
import tarfile
import tempfile
from datetime import UTC, datetime
from pathlib import Path

if __package__:
    from .verify_docker_image_isolation import verify_image
else:
    # Support the documented invocation from the backend directory:
    # ``python scripts/build_isolated_release_artifact.py <full-sha>``.
    from verify_docker_image_isolation import verify_image


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = {
    "backend": "backend/Dockerfile",
    "worker": "worker/Dockerfile",
    "frontend": "frontend/Dockerfile",
}


def run(*command: str, cwd: Path = REPOSITORY_ROOT) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True).strip()


def export_ref(ref: str, destination: Path) -> str:
    commit = run("git", "rev-parse", "--verify", f"{ref}^{{commit}}")
    if ref != commit:
        raise ValueError("Release artifacts require a full immutable commit SHA, not a movable ref.")
    archive = subprocess.run(
        ["git", "archive", "--format=tar", commit],
        cwd=REPOSITORY_ROOT,
        check=True,
        stdout=subprocess.PIPE,
    ).stdout
    with tarfile.open(fileobj=io.BytesIO(archive)) as source:
        source.extractall(destination, filter="data")
    return commit


def remove_tags(tags: list[str]) -> None:
    """Make an incomplete artifact unusable if any build or verification fails."""
    for tag in tags:
        subprocess.run(["docker", "image", "rm", "--force", tag], check=False)


def build_artifacts(commit: str, context: Path, tag_prefix: str, built_at: str) -> None:
    tags: list[str] = []
    records: list[tuple[str, str, str]] = []
    try:
        for name, dockerfile in ARTIFACTS.items():
            tag = f"{tag_prefix}-{name}:{commit[:12]}"
            tags.append(tag)
            subprocess.run(
                ["docker", "build", "--pull", "--target", "runtime", "-f", dockerfile, "-t", tag, "."],
                cwd=context,
                check=True,
            )
            verify_image(tag)
            records.append((name, tag, run("docker", "image", "inspect", "--format={{.Id}}", tag)))
    except Exception:
        remove_tags(tags)
        raise

    for name, tag, digest in records:
        print(f"artifact={name} commit={commit} image={tag} id={digest} built_at={built_at}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build release images from a committed Git ref in a temporary context."
    )
    parser.add_argument("ref", help="full immutable Git commit SHA")
    parser.add_argument("--tag-prefix", default="wervelnieuws")
    args = parser.parse_args()

    if not shutil.which("docker"):
        raise SystemExit("Docker is required to build a release artifact.")

    with tempfile.TemporaryDirectory(prefix="wervelnieuws-release-context-") as temp_dir:
        context = Path(temp_dir)
        commit = export_ref(args.ref, context)
        built_at = datetime.now(UTC).isoformat()
        build_artifacts(commit, context, args.tag_prefix, built_at)


if __name__ == "__main__":
    main()
