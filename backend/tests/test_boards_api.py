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


def test_upload_recording_allowed_for_all_columns(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Doing check", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    for column in ["todo", "doing", "done"]:
        create_card = client.post(
            f"/api/boards/projects/{project_id}/cards",
            headers=headers,
            json={"title": f"Kaart {column}", "description": "", "column": column, "assignment_user_ids": []},
        )
        card_id = create_card.json()["id"]

        audio = BytesIO(b"RIFF....WEBM")
        record = client.post(
            f"/api/boards/cards/{card_id}/recordings",
            headers=headers,
            files={"file": ("opname.webm", audio, "audio/webm")},
        )
        assert record.status_code == 200


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


def test_update_card_description_persists_and_allows_empty(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Beschrijving update", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "Oude beschrijving", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    update = client.patch(
        f"/api/boards/cards/{card_id}/description",
        headers=headers,
        json={"description": "  Nieuwe beschrijving  "},
    )
    assert update.status_code == 200
    assert update.json()["description"] == "Nieuwe beschrijving"

    clear = client.patch(
        f"/api/boards/cards/{card_id}/description",
        headers=headers,
        json={"description": "   "},
    )
    assert clear.status_code == 200
    assert clear.json()["description"] == ""

    board = client.get(f"/api/boards/projects/{project_id}", headers=headers)
    assert board.status_code == 200
    assert board.json()["cards"][0]["description"] == ""


def test_update_card_description_rejects_extra_fields(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Beschrijving validatie", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]

    scoped = client.patch(
        f"/api/boards/cards/{card_id}/description",
        headers=headers,
        json={"description": "Nieuwe beschrijving", "title": "Niet toegestaan"},
    )
    assert scoped.status_code == 422


def test_update_card_description_returns_404_for_unknown_card(client):
    headers = _login(client)
    update = client.patch(
        "/api/boards/cards/00000000-0000-0000-0000-000000000000/description",
        headers=headers,
        json={"description": "Nieuwe beschrijving"},
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
    assert updates[0]["message"] == "Verplaatst van Te doen naar Bezig door admin."
    assert updates[0]["author_display_name"] == "admin"


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
    assert updates[0]["message"] == "Verplaatst van Bezig naar Klaar door admin."


def test_board_uses_full_name_with_trimmed_fallback_for_display_labels(client):
    headers = _login(client)
    users = client.get("/api/admin/users", headers=headers)
    assert users.status_code == 200
    admin = next(user for user in users.json() if user["username"] == "admin")
    patch = client.patch(
        f"/api/admin/users/{admin['id']}",
        headers=headers,
        json={"full_name": "  Beheerder Bord  ", "email": None, "is_active": True, "is_admin": True},
    )
    assert patch.status_code == 200

    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Naamweergave", "description": "", "invited_user_ids": [admin["id"]]},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Naamkaart", "description": "", "column": "todo", "assignment_user_ids": [admin["id"]]},
    )
    card = create_card.json()
    assert card["assignments"][0]["user_display_name"] == "Beheerder Bord"

    posted = client.post(
        f"/api/boards/cards/{card['id']}/updates",
        headers=headers,
        json={"message": "Korte update"},
    )
    assert posted.status_code == 200
    assert posted.json()["author_display_name"] == "Beheerder Bord"
