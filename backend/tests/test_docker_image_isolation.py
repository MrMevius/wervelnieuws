from scripts.verify_docker_image_isolation import forbidden_paths


def test_runtime_image_isolation_rejects_every_excluded_category():
    paths = [
        "app/.env",
        "app/backend/.venv/bin/python",
        "app/backend/tests/test_api.py",
        "app/data/app.db",
        "app/storage/upload.txt",
        "app/config/settings.json",
        "app/backend/app/__pycache__/main.cpython-311.pyc",
        "app/frontend/node_modules/vite/index.js",
        "app/.cache/build-state",
        "app/opsx/changes/change.md",
    ]

    assert forbidden_paths(paths) == sorted(paths)


def test_runtime_image_isolation_allows_runtime_application_paths():
    assert forbidden_paths(
        [
            "app/backend/app/main.py",
            "app/backend/alembic/versions/revision.py",
            "usr/local/lib/python3.11/site-packages/fastapi/applications.py",
            "usr/share/nginx/html/index.html",
        ]
    ) == []
