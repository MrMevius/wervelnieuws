from io import BytesIO


def _login(client, username: str = "admin", password: str = "admin12345"):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_board_project_card_update_and_recording_flow(client):
    headers = _login(client)
    users = client.get("/api/admin/users", headers=headers).json()
    editor = next(item for item in users if item["username"] == "editor")

    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Vergaderbord A", "description": "Test", "invited_user_ids": [editor["id"]]},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Actiepunt", "description": "Bel de aannemer", "column": "todo", "assignment_user_ids": [editor["id"]]},
    )
    assert create_card.status_code == 200
    card_id = create_card.json()["id"]

    move = client.patch(f"/api/boards/cards/{card_id}/move", headers=headers, json={"column": "doing", "position": 0})
    assert move.status_code == 200
    assert move.json()["column"] == "doing"

    update = client.post(f"/api/boards/cards/{card_id}/updates", headers=headers, json={"message": "Update geplaatst"})
    assert update.status_code == 200

    audio = BytesIO(b"RIFF....WEBM")
    record = client.post(
        f"/api/boards/cards/{card_id}/recordings",
        headers=headers,
        data={"duration": "7"},
        files={"file": ("opname.webm", audio, "audio/webm")},
    )
    assert record.status_code == 200
    rec_payload = record.json()
    assert rec_payload["filename"] == "opname.webm"
    assert rec_payload["duration"] == 7
    assert rec_payload["transcription_status"] == "pending"
    assert rec_payload["recorded_at"]

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["updates"][0]["message"] == "Update geplaatst"
    assert len(detail.json()["recordings"]) == 1
    assert detail.json()["recordings"][0]["filename"] == "opname.webm"


def test_board_access_for_invited_user_only(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")

    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Verborgen project", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    board_for_editor = client.get(f"/api/boards/projects/{project_id}", headers=editor_headers)
    assert board_for_editor.status_code == 403


def test_upload_recording_only_allowed_for_doing_column(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Doing check", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Niet doing", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    audio = BytesIO(b"RIFF....WEBM")
    record = client.post(
        f"/api/boards/cards/{card_id}/recordings",
        headers=headers,
        files={"file": ("opname.webm", audio, "audio/webm")},
    )
    assert record.status_code == 400
    assert "Doing" in record.json()["detail"]


def test_move_card_rejects_negative_position(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Move validatie", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    move = client.patch(
        f"/api/boards/cards/{card_id}/move",
        headers=headers,
        json={"column": "doing", "position": -1},
    )
    assert move.status_code == 422


def test_move_card_returns_404_for_unknown_card(client):
    headers = _login(client)
    move = client.patch(
        "/api/boards/cards/00000000-0000-0000-0000-000000000000/move",
        headers=headers,
        json={"column": "doing", "position": 0},
    )
    assert move.status_code == 404


def test_update_card_title_persists_and_appears_in_board(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Titel update", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Oude titel", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    update = client.patch(
        f"/api/boards/cards/{card_id}/title",
        headers=headers,
        json={"title": "  Nieuwe titel  "},
    )

    assert update.status_code == 200
    assert update.json()["title"] == "Nieuwe titel"

    board = client.get(f"/api/boards/projects/{project_id}", headers=headers)
    assert board.status_code == 200
    assert board.json()["cards"][0]["title"] == "Nieuwe titel"


def test_update_card_title_rejects_empty_and_extra_fields(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Titel validatie", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    empty = client.patch(f"/api/boards/cards/{card_id}/title", headers=headers, json={"title": "   "})
    assert empty.status_code == 422
    assert "Vul een kaarttitel in" in str(empty.json()["detail"])

    scoped = client.patch(
        f"/api/boards/cards/{card_id}/title",
        headers=headers,
        json={"title": "Nieuwe titel", "description": "Niet toegestaan"},
    )
    assert scoped.status_code == 422


def test_update_card_title_returns_404_for_unknown_card(client):
    headers = _login(client)
    update = client.patch(
        "/api/boards/cards/00000000-0000-0000-0000-000000000000/title",
        headers=headers,
        json={"title": "Nieuwe titel"},
    )
    assert update.status_code == 404


def test_move_card_creates_system_update_for_column_change(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Move updates", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kolommove", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    move = client.patch(
        f"/api/boards/cards/{card_id}/move",
        headers=headers,
        json={"column": "doing", "position": 0},
    )
    assert move.status_code == 200

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    updates = detail.json()["updates"]
    assert len(updates) == 1
    assert "Kaart verplaatst van Te doen naar Bezig" in updates[0]["message"]
    assert "door admin op" in updates[0]["message"]


def test_move_card_same_column_creates_no_system_update(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Noop updates", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Geen update", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    move = client.patch(
        f"/api/boards/cards/{card_id}/move",
        headers=headers,
        json={"column": "todo", "position": 0},
    )
    assert move.status_code == 200

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["updates"] == []


def test_move_card_creates_system_update_for_doing_to_done(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Move updates 2", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kolommove 2", "description": "", "column": "doing", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    move = client.patch(
        f"/api/boards/cards/{card_id}/move",
        headers=headers,
        json={"column": "done", "position": 0},
    )
    assert move.status_code == 200

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    updates = detail.json()["updates"]
    assert len(updates) == 1
    assert "Kaart verplaatst van Bezig naar Klaar" in updates[0]["message"]
    assert "door admin op" in updates[0]["message"]
