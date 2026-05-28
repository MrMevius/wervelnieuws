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
    assert rec_payload["uploaded_by_user_id"]
    assert rec_payload["uploaded_by_username"] == "admin"
    assert rec_payload["uploaded_by_display_name"]

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["updates"][0]["message"] == "Update geplaatst"
    assert len(detail.json()["recordings"]) == 1
    assert detail.json()["recordings"][0]["filename"] == "opname.webm"
    assert detail.json()["recordings"][0]["uploaded_by_username"] == "admin"

    download = client.get(rec_payload["download_url"], headers=headers)
    assert download.status_code == 200


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


def test_upload_recording_normalizes_zero_duration_to_none(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Duur normalisatie", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    assert create_card.status_code == 200
    card_id = create_card.json()["id"]

    audio = BytesIO(b"RIFF....WEBM")
    record = client.post(
        f"/api/boards/cards/{card_id}/recordings",
        headers=headers,
        data={"duration": "0"},
        files={"file": ("opname.webm", audio, "audio/webm")},
    )
    assert record.status_code == 200
    assert record.json()["duration"] is None

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["recordings"][0]["duration"] is None


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
    assert updates[0]["message"] == "Kaart verplaatst van Te doen naar Bezig."
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
    assert updates[0]["message"] == "Kaart verplaatst van Bezig naar Klaar."


def test_delete_update_owner_only_and_disappears_from_detail(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    users = client.get("/api/admin/users", headers=admin_headers).json()
    editor = next(item for item in users if item["username"] == "editor")

    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Delete update", "description": "", "invited_user_ids": [editor["id"]]},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]
    update = client.post(
        f"/api/boards/cards/{card_id}/updates",
        headers=admin_headers,
        json={"message": "Te verwijderen"},
    )
    update_id = update.json()["id"]

    forbidden = client.delete(f"/api/boards/cards/{card_id}/updates/{update_id}", headers=editor_headers)
    assert forbidden.status_code == 403

    deleted = client.delete(f"/api/boards/cards/{card_id}/updates/{update_id}", headers=admin_headers)
    assert deleted.status_code == 200

    detail = client.get(f"/api/boards/cards/{card_id}", headers=admin_headers)
    assert detail.status_code == 200
    assert detail.json()["updates"] == []


def test_delete_update_returns_404_for_wrong_card_update_combination(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Delete mismatch", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    card_one = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart 1", "description": "", "column": "todo", "assignment_user_ids": []},
    ).json()["id"]
    card_two = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart 2", "description": "", "column": "todo", "assignment_user_ids": []},
    ).json()["id"]
    update_id = client.post(
        f"/api/boards/cards/{card_one}/updates",
        headers=headers,
        json={"message": "Update"},
    ).json()["id"]

    resp = client.delete(f"/api/boards/cards/{card_two}/updates/{update_id}", headers=headers)
    assert resp.status_code == 404


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


def test_edit_own_update_creates_revision_and_keeps_history(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Edit update", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]
    created = client.post(f"/api/boards/cards/{card_id}/updates", headers=headers, json={"message": "Origineel"})
    assert created.status_code == 200
    update_id = created.json()["id"]

    edited = client.patch(
        f"/api/boards/cards/{card_id}/updates/{update_id}",
        headers=headers,
        data={"message": "Aangepast"},
    )
    assert edited.status_code == 200
    assert edited.json()["message"] == "Aangepast"
    assert edited.json()["edited_from_update_id"] == update_id

    detail = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail.status_code == 200
    messages = [item["message"] for item in detail.json()["updates"]]
    assert "Origineel" in messages
    assert "Aangepast" in messages


def test_edit_update_forbidden_for_non_owner(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    users = client.get("/api/admin/users", headers=admin_headers).json()
    editor = next(item for item in users if item["username"] == "editor")
    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Edit forbidden", "description": "", "invited_user_ids": [editor["id"]]},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]
    created = client.post(f"/api/boards/cards/{card_id}/updates", headers=admin_headers, json={"message": "Origineel"})
    update_id = created.json()["id"]

    forbidden = client.patch(
        f"/api/boards/cards/{card_id}/updates/{update_id}",
        headers=editor_headers,
        data={"message": "Niet toegestaan"},
    )
    assert forbidden.status_code == 403


def test_edit_update_supports_image_upload_and_remove(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Edit image", "description": "", "invited_user_ids": []},
    )
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    card_id = create_card.json()["id"]
    created = client.post(f"/api/boards/cards/{card_id}/updates", headers=headers, json={"message": "Met image"})
    update_id = created.json()["id"]

    upload = client.patch(
        f"/api/boards/cards/{card_id}/updates/{update_id}",
        headers=headers,
        data={"message": "Met image aangepast"},
        files={"image": ("update.png", BytesIO(b"fakepng"), "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["image_url"]

    remove = client.patch(
        f"/api/boards/cards/{card_id}/updates/{upload.json()['id']}",
        headers=headers,
        data={"message": "Image verwijderd", "remove_image": "true"},
    )
    assert remove.status_code == 200
    assert remove.json()["image_url"] is None
