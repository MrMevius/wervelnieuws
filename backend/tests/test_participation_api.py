import csv
import json
from contextlib import contextmanager
from io import StringIO

import pytest
from sqlalchemy import delete, select, text

from app.core.db import get_db
from app.models.entities import AuditEvent, Project, User
from app.models.participation import ParticipationMoment
from app.repositories.participation_repository import ParticipationRepository
from app.services.participation_service import ParticipationService


@contextmanager
def session(client):
    generator = client.app.dependency_overrides[get_db]()
    try:
        yield next(generator)
    finally:
        generator.close()


def login(client, user="admin"):
    response = client.post("/api/auth/login", json={"username": user, "password": f"{user}12345"})
    assert response.status_code == 200
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def setup(client):
    headers = login(client)
    with session(client) as db:
        users = {user.username: user.id for user in db.scalars(select(User))}
        first = Project(name="Wind rondom Daarle", invited_user_ids_json=json.dumps([users["editor"]]))
        second = Project(name="Energiek Daarle", invited_user_ids_json="[]")
        db.add_all([first, second])
        db.commit()
        projects = [first.id, second.id]
    payload = {
        "title": "Gesprek met omwonenden", "occurred_on": "2026-09-09",
        "participant_ids": list(users.values()), "project_ids": projects,
        "report": "Bewoners vroegen naar de planning.\nDe informatieavond is besproken.",
        "agreements": "Stuur het verslag na.", "conversation_partners": "Bewoners van de Dorpsstraat",
    }
    return headers, users, projects, payload


def create(client, headers, payload):
    response = client.post("/api/participatiemomenten", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_multiple_people_and_projects_and_keep_complete_report(client, setup):
    headers, users, projects, payload = setup
    row = create(client, headers, payload)
    assert {person["id"] for person in row["participants"]} == set(users.values())
    assert {project["id"] for project in row["projects"]} == set(projects)
    assert row["duration_minutes"] is None
    assert row["report"] == payload["report"]
    assert row["agreements"] == payload["agreements"]
    assert row["row_version"] == 1
    assert client.get(f"/api/participatiemomenten/{row['id']}", headers=headers).json() == row
    with session(client) as db:
        audit = db.scalar(select(AuditEvent).where(AuditEvent.event_type == "participation.created"))
        assert json.loads(audit.details_json)["after"]["report"] == payload["report"]


@pytest.mark.parametrize("change", [
    {"participant_ids": []}, {"project_ids": []}, {"report": "   "}, {"title": "   "},
    {"duration_minutes": 0}, {"duration_minutes": -1}, {"duration_minutes": 1441},
    {"participant_ids": ["missing"]}, {"project_ids": ["missing"]},
    {"contact_type": "invalid"}, {"extra": "not allowed"},
])
def test_invalid_moment_is_not_persisted(client, setup, change):
    headers, _, _, payload = setup
    response = client.post("/api/participatiemomenten", headers=headers, json={**payload, **change})
    assert response.status_code == 422
    assert client.get("/api/participatiemomenten", headers=headers).json()["total"] == 0


def test_requires_authentication(client):
    for path in ["", "/meta", "/export", "/missing"]:
        assert client.get(f"/api/participatiemomenten{path}").status_code == 401


def test_all_projects_must_be_accessible_for_detail_list_and_export(client, setup):
    headers, users, projects, payload = setup
    hidden = create(client, headers, payload)
    visible = create(client, headers, {**payload, "project_ids": [projects[0]], "title": "Zichtbaar gesprek"})
    editor = login(client, "editor")
    listing = client.get("/api/participatiemomenten", headers=editor).json()
    assert [row["id"] for row in listing["items"]] == [visible["id"]]
    assert client.get(f"/api/participatiemomenten/{hidden['id']}", headers=editor).status_code == 404
    exported = client.get("/api/participatiemomenten/export?format=json", headers=editor).json()
    assert [row["id"] for row in exported["moments"]] == [visible["id"]]
    assert client.post("/api/participatiemomenten", headers=editor, json=payload).status_code == 422
    meta = client.get("/api/participatiemomenten/meta", headers=editor).json()
    assert [project["id"] for project in meta["projects"]] == [projects[0]]


def test_reader_cannot_edit_someone_elses_report(client, setup):
    headers, users, projects, payload = setup
    row = create(client, headers, {**payload, "project_ids": [projects[0]], "participant_ids": [users["admin"]]})
    editor = login(client, "editor")
    assert not client.get(f"/api/participatiemomenten/{row['id']}", headers=editor).json()["can_edit"]
    assert client.put(f"/api/participatiemomenten/{row['id']}", headers=editor, json={**payload, "expected_row_version": 1}).status_code == 403


def test_edit_is_atomic_and_prevents_stale_overwrites(client, setup):
    headers, users, projects, payload = setup
    row = create(client, headers, payload)
    update = {**payload, "expected_row_version": 1, "title": "Aangepast", "participant_ids": [users["editor"]], "project_ids": [projects[0]]}
    response = client.put(f"/api/participatiemomenten/{row['id']}", headers=headers, json=update)
    assert response.status_code == 200, response.text
    assert response.json()["row_version"] == 2
    stale = client.put(f"/api/participatiemomenten/{row['id']}", headers=headers, json={**update, "title": "Niet overschrijven"})
    assert stale.status_code == 409
    actual = client.get(f"/api/participatiemomenten/{row['id']}", headers=headers).json()
    assert actual["title"] == "Aangepast"
    assert [person["id"] for person in actual["participants"]] == [users["editor"]]
    assert [project["id"] for project in actual["projects"]] == [projects[0]]


def test_archive_and_restore_preserve_report(client, setup):
    headers, _, _, payload = setup
    row = create(client, headers, payload)
    url = f"/api/participatiemomenten/{row['id']}/archive"
    response = client.patch(url, headers=headers, json={"archived": True, "expected_row_version": 1})
    assert response.status_code == 200
    assert client.get("/api/participatiemomenten", headers=headers).json()["total"] == 0
    archived = client.get("/api/participatiemomenten?archived=true", headers=headers).json()
    assert archived["items"][0]["report"] == payload["report"]
    assert client.patch(url, headers=headers, json={"archived": False, "expected_row_version": 2}).status_code == 200
    assert client.get("/api/participatiemomenten", headers=headers).json()["total"] == 1


def test_filters_pagination_and_full_selection_export(client, setup):
    headers, _, projects, payload = setup
    for day in ["2026-09-01", "2026-09-05", "2026-08-01"]:
        create(client, headers, {**payload, "occurred_on": day})
    filters = f"date_from=2026-09-01&date_to=2026-09-30&project_id={projects[0]}&query=planning&page_size=1"
    listing = client.get(f"/api/participatiemomenten?{filters}", headers=headers).json()
    assert listing["total"] == 2 and len(listing["items"]) == 1
    exported = client.get(f"/api/participatiemomenten/export?{filters}&format=json", headers=headers).json()
    assert len(exported["moments"]) == 2
    assert client.get("/api/participatiemomenten?date_from=2026-09-30&date_to=2026-09-01", headers=headers).status_code == 422


def test_csv_and_markdown_include_all_content_and_escape_formula_injection(client, setup):
    headers, _, _, payload = setup
    create(client, headers, {**payload, "title": '=HYPERLINK("bad")'})
    csv_response = client.get("/api/participatiemomenten/export?format=csv", headers=headers)
    assert csv_response.status_code == 200
    rows = list(csv.DictReader(StringIO(csv_response.content.decode("utf-8-sig")), delimiter=";"))
    assert rows[0]["Onderwerp"].startswith("'=")
    assert rows[0]["Verslag"] == payload["report"]
    assert rows[0]["Afspraken"] == payload["agreements"]
    markdown = client.get("/api/participatiemomenten/export?format=markdown", headers=headers)
    assert payload["report"] in markdown.text
    assert "Wind rondom Daarle" in markdown.text and "Energiek Daarle" in markdown.text
    assert "admin" in markdown.text and "editor" in markdown.text


def test_archived_projects_and_inactive_people_can_be_retained_but_not_newly_added(client, setup):
    headers, users, projects, payload = setup
    row = create(client, headers, payload)
    with session(client) as db:
        db.get(User, users["editor"]).is_active = False
        db.get(Project, projects[0]).is_archived = True
        db.commit()
    assert client.put(f"/api/participatiemomenten/{row['id']}", headers=headers, json={**payload, "expected_row_version": 1}).status_code == 200
    assert client.post("/api/participatiemomenten", headers=headers, json=payload).status_code == 422


def test_failed_audit_rolls_back_report_version_and_associations(client, setup, monkeypatch):
    headers, users, projects, payload = setup
    row = create(client, headers, payload)

    def fail_audit(*args, **kwargs):
        raise RuntimeError("Simulated audit failure")

    monkeypatch.setattr(ParticipationService, "_audit", fail_audit)
    with pytest.raises(RuntimeError, match="Simulated audit failure"):
        client.put(f"/api/participatiemomenten/{row['id']}", headers=headers, json={
            **payload, "expected_row_version": 1, "title": "Must roll back",
            "participant_ids": [users["admin"]], "project_ids": [projects[0]],
        })
    assert client.get(f"/api/participatiemomenten/{row['id']}", headers=headers).json() == row


@pytest.mark.parametrize("removed", ["person", "project"])
def test_deleted_references_keep_historical_report_and_names(client, setup, removed):
    headers, users, projects, payload = setup
    payload = {**payload, "project_ids": [projects[0]]}
    row = create(client, headers, payload)
    with session(client) as db:
        db.execute(text("PRAGMA foreign_keys=ON"))
        entity, entity_id = (User, users["editor"]) if removed == "person" else (Project, projects[0])
        db.execute(delete(entity).where(entity.id == entity_id))
        db.commit()
    actual = client.get(f"/api/participatiemomenten/{row['id']}", headers=headers).json()
    assert actual["report"] == row["report"]
    key = "participants" if removed == "person" else "projects"
    assert [(item["id"], item["name"]) for item in actual[key]] == [(item["id"], item["name"]) for item in row[key]]
    assert not next(item for item in actual[key] if item["id"] == entity_id)["selectable"]
    assert client.put(f"/api/participatiemomenten/{row['id']}", headers=headers, json={**payload, "expected_row_version": 1}).status_code == 200
    if removed == "project":
        editor = login(client, "editor")
        assert client.get(f"/api/participatiemomenten/{row['id']}", headers=editor).status_code == 404


def test_large_exports_require_a_smaller_selection(client, setup, monkeypatch):
    headers, _, _, _ = setup
    monkeypatch.setattr(ParticipationRepository, "list", lambda *args, **kwargs: ([], 5001))
    response = client.get("/api/participatiemomenten/export?format=markdown", headers=headers)
    assert response.status_code == 413
    assert "5.000" in response.json()["detail"]
