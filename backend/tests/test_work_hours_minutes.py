import csv
from io import StringIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from app.core.settings import get_settings
from tests.test_work_hours_api import _login


@pytest.fixture
def minute_setup(client):
    headers = _login(client)
    project = client.post("/api/admin/projects", headers=headers, json={"name": "Minutenproject", "is_visible_in_work_hours": True}).json()
    users = client.get("/api/urenverantwoording/meta", headers=headers).json()["eligible_users"]
    payload = {"work_date": "2026-09-01", "start_time": "09:07", "project_id": project["id"], "duration_minutes": 7, "description": "Kort overleg", "participants": [
        {"participant_kind": "live_user", "user_id": user["id"], "display_name_snapshot": user["display_name"], "display_type_snapshot": "WindWilly-gebruiker"} for user in users
    ]}
    return headers, payload


def test_exact_minutes_without_post_with_people_time_totals_and_csv(client, minute_setup):
    headers, payload = minute_setup
    response = client.post("/api/urenverantwoording/groepen", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    row = response.json()
    assert row["duration_minutes"] == 7 and row["duration_half_hours"] is None
    assert row["start_time"] == "09:07" and row["post_id"] is None
    assert row["person_count"] == 2 and row["person_hours"] == pytest.approx(14 / 60)
    for query in ["", "?query=Kort", "?sort_key=project", "?sort_key=post", "?sort_key=duration_half_hours"]:
        result = client.get(f"/api/urenverantwoording/groepen{query}", headers=headers).json()
        assert result["total"] == 1 and result["items"][0]["id"] == row["id"]
        assert result["totals"]["total_duration_hours"] == pytest.approx(7 / 60)
        assert result["totals"]["total_person_hours"] == pytest.approx(14 / 60)
        assert result["project_totals"][0]["person_hours"] == pytest.approx(14 / 60)
    export = client.get("/api/urenverantwoording/export.csv", headers=headers)
    rows = list(csv.DictReader(StringIO(export.content.decode("utf-8-sig")), delimiter=";"))
    assert len(rows) == 2
    assert all(item["duur in minuten"] == "7" and item["begintijd (Europe/Amsterdam)"] == "09:07" and item["post"] == "" for item in rows)


@pytest.mark.parametrize("minutes", [1, 59, 60, 75, 480, 1440])
def test_minute_precision_small_and_large_values(client, minute_setup, minutes):
    headers, payload = minute_setup
    response = client.post("/api/urenverantwoording/groepen", headers=headers, json={**payload, "duration_minutes": minutes})
    assert response.status_code == 201, response.text
    assert response.json()["duration_minutes"] == minutes


@pytest.mark.parametrize("change", [
    {"duration_minutes": 0}, {"duration_minutes": 1441}, {"duration_minutes": 1.5},
    {"duration_minutes": True}, {"duration_minutes": None}, {"duration_half_hours": 2},
    {"start_time": "24:00"}, {"start_time": "09:01:01"}, {"start_time": "9:7"},
    {"post_id": "missing"}, {"participants": []},
])
def test_invalid_minute_registration_is_rejected(client, minute_setup, change):
    headers, payload = minute_setup
    response = client.post("/api/urenverantwoording/groepen", headers=headers, json={**payload, **change})
    assert response.status_code == 422
    assert client.get("/api/urenverantwoording/groepen", headers=headers).json()["total"] == 0


def test_post_can_be_set_then_cleared_and_stale_change_does_not_overwrite(client, minute_setup):
    headers, payload = minute_setup
    post = client.post("/api/urenverantwoording/posten", headers=headers, json={"name": "Overleg"}).json()
    row = client.post("/api/urenverantwoording/groepen", headers=headers, json={**payload, "post_id": post["id"]}).json()
    url = f"/api/urenverantwoording/groepen/{row['id']}"
    changed = client.patch(url, headers=headers, json={"post_id": None, "duration_minutes": 91, "start_time": "13:26", "expected_row_version": row["row_version"]})
    assert changed.status_code == 200, changed.text
    assert changed.json()["post_id"] is None
    assert changed.json()["duration_minutes"] == 91 and changed.json()["start_time"] == "13:26"
    assert client.patch(url, headers=headers, json={"duration_minutes": 7, "expected_row_version": row["row_version"]}).status_code == 409
    actual = client.get(url, headers=headers).json()
    assert actual["duration_minutes"] == 91


def test_minute_migration_preserves_legacy_rows_and_roundtrips(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'minutes.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path / "storage"))
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "20260909_0031")
    engine = create_engine(database_url)
    with engine.begin() as con:
        con.execute(text("INSERT INTO projects (id,name,description,is_active,is_archived,invited_user_ids_json,is_visible_in_boards,is_visible_in_work_hours,created_at,updated_at) VALUES ('p','Project','',1,0,'[]',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
        con.execute(text("INSERT INTO work_posts (id,name,normalized_name,description,is_active,is_archived,created_at,updated_at,row_version) VALUES ('post','Post','post','',1,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)"))
        for duration in [1, 20, 48]:
            con.execute(text("INSERT INTO work_hour_groups (id,work_date,project_id,post_id,description,duration_half_hours,created_at,updated_at,row_version) VALUES (:id,'2026-08-01','p','post','Historisch verslag',:duration,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,7)"), {"id": str(duration), "duration": duration})
        before = [dict(row) for row in con.execute(text("SELECT * FROM work_hour_groups ORDER BY id")).mappings()]
    command.upgrade(config, "head")
    with engine.connect() as con:
        after = [dict(row) for row in con.execute(text("SELECT * FROM work_hour_groups ORDER BY id")).mappings()]
        for old, new in zip(before, after):
            assert new.pop("start_time") is None
            assert new.pop("duration_minutes") == old["duration_half_hours"] * 30
            assert new == {key: value for key, value in old.items() if key != "duration_half_hours"}
        assert not con.execute(text("PRAGMA foreign_key_check")).all()
    command.downgrade(config, "20260909_0031")
    with engine.connect() as con:
        assert [dict(row) for row in con.execute(text("SELECT * FROM work_hour_groups ORDER BY id")).mappings()] == before
    command.upgrade(config, "head")
    with engine.begin() as con:
        con.execute(text("UPDATE work_hour_groups SET duration_minutes=7, post_id=NULL, start_time='09:07' WHERE id='1'"))
    with pytest.raises(RuntimeError, match="Downgrade"):
        command.downgrade(config, "20260909_0031")
    with engine.connect() as con:
        assert con.execute(text("SELECT duration_minutes,post_id,start_time FROM work_hour_groups WHERE id='1'")).one() == (7, None, "09:07")
    engine.dispose()
    get_settings.cache_clear()
