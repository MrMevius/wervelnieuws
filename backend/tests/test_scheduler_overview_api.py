from datetime import UTC, datetime, timedelta

from app.api.deps import get_db
from app.models.entities import PublicationSchedule, RetryJob
from app.models.enums import RetryStatus, WorkflowState


def _login(client, username: str = "admin", password: str = "admin12345"):
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _default_project_id(client, headers):
    projects = client.get("/api/database/projects", headers=headers)
    assert projects.status_code == 200
    return projects.json()[0]["id"]


def _create_topic(client, headers, project_id: str, title: str) -> str:
    topic = client.post(
        "/api/topics",
        headers=headers,
        json={
            "title": title,
            "subject": title,
            "theme": "Planning",
            "project_id": project_id,
            "editorial_notes": "",
            "planning_at": None,
            "target_channels": ["website"],
        },
    )
    assert topic.status_code == 200
    return topic.json()["id"]


def test_scheduler_overview_requires_admin(client):
    headers = _login(client, username="editor", password="editor12345")
    response = client.get("/api/content/scheduler/overview", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


def test_scheduler_overview_returns_recent_upcoming_and_retries(client):
    headers = _login(client)
    project_id = _default_project_id(client, headers)

    topic_recent_id = _create_topic(client, headers, project_id, "Recent run topic")
    topic_upcoming_id = _create_topic(client, headers, project_id, "Upcoming run topic")

    generated_recent = client.post(
        f"/api/content/{topic_recent_id}/generate", headers=headers
    )
    assert generated_recent.status_code == 200
    schedule_recent = client.post(
        f"/api/content/{topic_recent_id}/schedule",
        headers=headers,
        json={"publish_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat()},
    )
    assert schedule_recent.status_code == 200

    generated_upcoming = client.post(
        f"/api/content/{topic_upcoming_id}/generate", headers=headers
    )
    assert generated_upcoming.status_code == 200
    schedule_upcoming = client.post(
        f"/api/content/{topic_upcoming_id}/schedule",
        headers=headers,
        json={"publish_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat()},
    )
    assert schedule_upcoming.status_code == 200

    db_gen = client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        recent_schedule = db.get(
            PublicationSchedule, schedule_recent.json()["schedule_id"]
        )
        assert recent_schedule is not None
        recent_schedule.status = WorkflowState.published
        db.add(recent_schedule)

        db.add(
            RetryJob(
                topic_id=topic_recent_id,
                flow_name="publish_schedule",
                error_type="RuntimeError",
                error_message="temporary downstream issue",
                attempt=1,
                max_attempts=5,
                status=RetryStatus.queued,
                next_run_at=datetime.now(UTC) + timedelta(minutes=15),
            )
        )
        db.commit()
    finally:
        db.close()
        db_gen.close()

    overview = client.get("/api/content/scheduler/overview", headers=headers)
    assert overview.status_code == 200
    payload = overview.json()

    assert "generated_at" in payload
    assert "recent_runs" in payload
    assert "upcoming_runs" in payload
    assert "retry_jobs" in payload

    recent_topic_ids = {row["topic_id"] for row in payload["recent_runs"]}
    assert topic_recent_id in recent_topic_ids
    recent_row = next(
        row for row in payload["recent_runs"] if row["topic_id"] == topic_recent_id
    )
    assert recent_row["status"] == "published"

    upcoming_topic_ids = {row["topic_id"] for row in payload["upcoming_runs"]}
    assert topic_upcoming_id in upcoming_topic_ids

    retry_topic_ids = {row["topic_id"] for row in payload["retry_jobs"]}
    assert topic_recent_id in retry_topic_ids
    retry_row = next(
        row for row in payload["retry_jobs"] if row["topic_id"] == topic_recent_id
    )
    assert retry_row["flow_name"] == "publish_schedule"
    assert retry_row["status"] == "queued"
