import json
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


def test_board_project_list_composes_visibility_with_existing_access(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    editor = next(item for item in client.get("/api/admin/users", headers=admin_headers).json() if item["username"] == "editor")
    visible = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Zichtbaar bord", "description": "", "invited_user_ids": [editor["id"]]},
    ).json()
    hidden = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Verborgen bord", "description": "", "invited_user_ids": [editor["id"]]},
    ).json()
    assert client.patch(
        f"/api/admin/projects/{hidden['id']}",
        headers=admin_headers,
        json={"is_visible_in_boards": False},
    ).status_code == 200

    assert [item["id"] for item in client.get("/api/boards/projects", headers=admin_headers).json()] == [visible["id"]]
    assert [item["id"] for item in client.get("/api/boards/projects", headers=editor_headers).json()] == [visible["id"]]
    # Hiding removes future selection only; existing board detail remains available.
    assert client.get(f"/api/boards/projects/{hidden['id']}", headers=admin_headers).status_code == 200


def test_board_rights_keeps_active_hidden_projects_while_board_list_excludes_them(client):
    admin_headers = _login(client)
    visible = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Selecteerbaar bord", "description": "", "invited_user_ids": []},
    ).json()
    hidden = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Rechten verborgen bord", "description": "", "invited_user_ids": []},
    ).json()
    assert client.patch(
        f"/api/admin/projects/{hidden['id']}",
        headers=admin_headers,
        json={"is_visible_in_boards": False},
    ).status_code == 200

    board_project_ids = {item["id"] for item in client.get("/api/boards/projects", headers=admin_headers).json()}
    rights_project_ids = {item["id"] for item in client.get("/api/boards/admin/rights", headers=admin_headers).json()["projects"]}

    assert visible["id"] in board_project_ids
    assert hidden["id"] not in board_project_ids
    assert {visible["id"], hidden["id"]}.issubset(rights_project_ids)


def test_hidden_board_direct_url_is_authorized_historical_read_only(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    editor = next(item for item in client.get("/api/admin/users", headers=admin_headers).json() if item["username"] == "editor")
    project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Historisch bord", "description": "", "invited_user_ids": [editor["id"]]},
    ).json()
    card = client.post(
        f"/api/boards/projects/{project['id']}/cards",
        headers=admin_headers,
        json={"title": "Bestaande kaart", "description": "Historie", "column": "todo", "assignment_user_ids": []},
    ).json()
    archived_card = client.post(
        f"/api/boards/projects/{project['id']}/cards",
        headers=admin_headers,
        json={"title": "Gearchiveerde kaart", "description": "Historie", "column": "todo", "assignment_user_ids": []},
    ).json()
    deleted_card = client.post(
        f"/api/boards/projects/{project['id']}/cards",
        headers=admin_headers,
        json={"title": "Verwijderde kaart", "description": "Historie", "column": "todo", "assignment_user_ids": []},
    ).json()
    assert client.patch(f"/api/boards/cards/{archived_card['id']}/archive", headers=admin_headers).status_code == 200
    assert client.delete(f"/api/boards/cards/{deleted_card['id']}", headers=admin_headers).status_code == 200
    update = client.post(
        f"/api/boards/cards/{card['id']}/updates", headers=admin_headers, json={"message": "Bestaande update"}
    ).json()
    recording = client.post(
        f"/api/boards/cards/{card['id']}/recordings",
        headers=admin_headers,
        data={"duration": "7"},
        files={"file": ("historisch.webm", BytesIO(b"RIFF....WEBM"), "audio/webm")},
    ).json()
    attachment = client.post(
        f"/api/boards/cards/{card['id']}/attachments",
        headers=admin_headers,
        files={"file": ("historisch.txt", BytesIO(b"historie"), "text/plain")},
    ).json()
    assert client.patch(
        f"/api/admin/projects/{project['id']}", headers=admin_headers, json={"is_visible_in_boards": False}
    ).status_code == 200

    board = client.get(f"/api/boards/projects/{project['id']}", headers=editor_headers)
    assert board.status_code == 200
    assert board.json()["is_read_only"] is True
    assert board.json()["cards"][0]["id"] == card["id"]
    detail = client.get(f"/api/boards/cards/{card['id']}", headers=editor_headers)
    assert detail.status_code == 200
    assert detail.json()["updates"][0]["id"] == update["id"]
    assert detail.json()["recordings"][0]["id"] == recording["id"]
    assert detail.json()["attachments"][0]["id"] == attachment["id"]
    assert client.get(recording["download_url"], headers=editor_headers).status_code == 200
    assert client.get(attachment["download_url"], headers=editor_headers).status_code == 200

    rejected = [
        client.patch(f"/api/boards/cards/{card['id']}/archive", headers=admin_headers),
        client.patch(f"/api/boards/cards/{archived_card['id']}/restore", headers=admin_headers),
        client.delete(f"/api/boards/cards/{card['id']}", headers=admin_headers),
        client.patch(f"/api/boards/admin/recycle-bin/{deleted_card['id']}/restore", headers=admin_headers),
    ]

    rejected.extend([
        client.post(f"/api/boards/projects/{project['id']}/cards", headers=editor_headers, json={"title": "Nieuw", "description": "", "column": "todo", "assignment_user_ids": []}),
        client.patch(f"/api/boards/cards/{card['id']}/title", headers=admin_headers, json={"title": "Gewijzigd"}),
        client.patch(f"/api/boards/cards/{card['id']}/description", headers=admin_headers, json={"description": "Gewijzigd"}),
        client.patch(f"/api/boards/cards/{card['id']}/move", headers=admin_headers, json={"column": "doing", "position": 0}),
        client.patch(f"/api/boards/cards/{card['id']}/archive", headers=admin_headers),
        client.post(f"/api/boards/cards/{card['id']}/updates", headers=admin_headers, json={"message": "Nieuw"}),
        client.patch(f"/api/boards/cards/{card['id']}/updates/{update['id']}", headers=admin_headers, data={"message": "Gewijzigd"}),
        client.delete(f"/api/boards/cards/{card['id']}/updates/{update['id']}", headers=admin_headers),
        client.post(
            f"/api/boards/cards/{card['id']}/recordings",
            headers=admin_headers,
            data={"duration": "7"},
            files={"file": ("nieuw.webm", BytesIO(b"RIFF....WEBM"), "audio/webm")},
        ),
        client.post(
            f"/api/boards/cards/{card['id']}/attachments",
            headers=admin_headers,
            files={"file": ("nieuw.txt", BytesIO(b"nieuw"), "text/plain")},
        ),
        client.delete(f"/api/boards/cards/{card['id']}/attachments/{attachment['id']}", headers=admin_headers),
    ])
    assert all(response.status_code == 409 for response in rejected)
    assert all("alleen-lezen" in response.json()["detail"] for response in rejected)


def test_board_card_archive_restore_and_archive_tab(client):
    headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Archiefbord", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Archiefkaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    assert create_card.status_code == 200
    card_id = create_card.json()["id"]

    assert client.patch(f"/api/boards/cards/{card_id}/archive", headers=editor_headers).status_code == 403

    archived = client.patch(f"/api/boards/cards/{card_id}/archive", headers=headers)
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True

    archived_activity = client.get(
        "/api/content/activity",
        headers=headers,
        params={"event_type": "board.card.archived", "period": "all", "limit": 10},
    )
    assert archived_activity.status_code == 200
    archived_events = archived_activity.json()
    assert len(archived_events) == 1
    assert archived_events[0]["actor_username"] == "admin"
    assert json.loads(archived_events[0]["details_json"]) == {"card_id": card_id, "project_id": project_id}

    board_after_archive = client.get(f"/api/boards/projects/{project_id}", headers=headers)
    assert board_after_archive.status_code == 200
    assert board_after_archive.json()["cards"] == []
    assert [card["id"] for card in board_after_archive.json()["archived_cards"]] == [card_id]

    assert client.patch(f"/api/boards/cards/{card_id}/restore", headers=editor_headers).status_code == 403

    projects = client.get("/api/boards/projects", headers=headers)
    assert projects.status_code == 200
    assert projects.json()[0]["card_count"] == 0

    restored = client.patch(f"/api/boards/cards/{card_id}/restore", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["is_archived"] is False

    restored_activity = client.get(
        "/api/content/activity",
        headers=headers,
        params={"event_type": "board.card.restored", "period": "all", "limit": 10},
    )
    assert restored_activity.status_code == 200
    restored_events = restored_activity.json()
    assert len(restored_events) == 1
    assert restored_events[0]["actor_username"] == "admin"
    assert json.loads(restored_events[0]["details_json"]) == {"card_id": card_id, "project_id": project_id}

    board_after_restore = client.get(f"/api/boards/projects/{project_id}", headers=headers)
    assert board_after_restore.status_code == 200
    assert [card["id"] for card in board_after_restore.json()["cards"]] == [card_id]
    assert board_after_restore.json()["archived_cards"] == []


def test_board_card_soft_delete_and_admin_recycle_bin_restore(client):
    headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Prullenbakbord", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": "Verwijderkaart", "description": "", "column": "doing", "assignment_user_ids": []},
    )
    assert create_card.status_code == 200
    card_id = create_card.json()["id"]

    assert client.delete(f"/api/boards/cards/{card_id}", headers=editor_headers).status_code == 403

    deleted = client.delete(f"/api/boards/cards/{card_id}", headers=headers)
    assert deleted.status_code == 200

    deleted_activity = client.get(
        "/api/content/activity",
        headers=headers,
        params={"event_type": "board.card.deleted", "period": "all", "limit": 10},
    )
    assert deleted_activity.status_code == 200
    deleted_events = deleted_activity.json()
    assert len(deleted_events) == 1
    assert deleted_events[0]["actor_username"] == "admin"
    assert json.loads(deleted_events[0]["details_json"]) == {"card_id": card_id, "project_id": project_id}

    board_after_delete = client.get(f"/api/boards/projects/{project_id}", headers=headers)
    assert board_after_delete.status_code == 200
    assert board_after_delete.json()["cards"] == []
    assert board_after_delete.json()["archived_cards"] == []

    detail_after_delete = client.get(f"/api/boards/cards/{card_id}", headers=headers)
    assert detail_after_delete.status_code == 404

    recycle_bin = client.get("/api/boards/admin/recycle-bin", headers=headers)
    assert recycle_bin.status_code == 200
    assert recycle_bin.json()[0]["id"] == card_id
    assert recycle_bin.json()[0]["project_name"] == "Prullenbakbord"
    assert recycle_bin.json()[0]["deleted_by_username"] == "admin"

    assert client.patch(f"/api/boards/admin/recycle-bin/{card_id}/restore", headers=editor_headers).status_code == 403

    restored = client.patch(f"/api/boards/admin/recycle-bin/{card_id}/restore", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["is_archived"] is False

    restored_activity = client.get(
        "/api/content/activity",
        headers=headers,
        params={"event_type": "board.card.deleted_restored", "period": "all", "limit": 10},
    )
    assert restored_activity.status_code == 200
    restored_events = restored_activity.json()
    assert len(restored_events) == 1
    assert restored_events[0]["actor_username"] == "admin"
    assert json.loads(restored_events[0]["details_json"]) == {"card_id": card_id, "project_id": project_id}

    board_after_restore = client.get(f"/api/boards/projects/{project_id}", headers=headers)
    assert board_after_restore.status_code == 200
    assert [card["id"] for card in board_after_restore.json()["cards"]] == [card_id]


def test_board_card_attachment_flow_and_permissions(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    users = client.get("/api/admin/users", headers=admin_headers).json()
    editor = next(item for item in users if item["username"] == "editor")

    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Bijlagenbord", "description": "", "invited_user_ids": [editor["id"]]},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={"title": "Bijlagekaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    assert create_card.status_code == 200
    card_id = create_card.json()["id"]

    attachment_bytes = BytesIO(b"attachment data")
    uploaded = client.post(
        f"/api/boards/cards/{card_id}/attachments",
        headers=admin_headers,
        files={"file": ("notitie.pdf", attachment_bytes, "application/pdf")},
    )
    assert uploaded.status_code == 200
    attachment = uploaded.json()
    assert attachment["filename"] == "notitie.pdf"
    assert attachment["mime_type"] == "application/pdf"
    assert attachment["download_url"].endswith(f"/api/boards/attachments/{attachment['id']}/download")

    detail = client.get(f"/api/boards/cards/{card_id}", headers=admin_headers)
    assert detail.status_code == 200
    assert detail.json()["card"]["attachments_count"] == 1
    assert detail.json()["attachments"][0]["filename"] == "notitie.pdf"

    download = client.get(attachment["download_url"], headers=editor_headers)
    assert download.status_code == 200
    assert "notitie.pdf" in download.headers["content-disposition"]

    removed = client.delete(f"/api/boards/cards/{card_id}/attachments/{attachment['id']}", headers=admin_headers)
    assert removed.status_code == 200

    after_delete = client.get(f"/api/boards/cards/{card_id}", headers=admin_headers)
    assert after_delete.status_code == 200
    assert after_delete.json()["attachments"] == []

    hidden_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Verborgen bijlagenbord", "description": "", "invited_user_ids": []},
    )
    assert hidden_project.status_code == 200
    hidden_project_id = hidden_project.json()["id"]
    hidden_card = client.post(
        f"/api/boards/projects/{hidden_project_id}/cards",
        headers=admin_headers,
        json={"title": "Verborgen kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    assert hidden_card.status_code == 200
    hidden_card_id = hidden_card.json()["id"]
    hidden_upload = client.post(
        f"/api/boards/cards/{hidden_card_id}/attachments",
        headers=admin_headers,
        files={"file": ("intern.txt", BytesIO(b"intern"), "text/plain")},
    )
    assert hidden_upload.status_code == 200
    hidden_attachment_id = hidden_upload.json()["id"]

    assert client.get(f"/api/boards/cards/{hidden_card_id}", headers=editor_headers).status_code == 403
    assert client.get(f"/api/boards/attachments/{hidden_attachment_id}/download", headers=editor_headers).status_code == 403
    assert client.post(
        f"/api/boards/cards/{hidden_card_id}/attachments",
        headers=editor_headers,
        files={"file": ("x.txt", BytesIO(b"x"), "text/plain")},
    ).status_code == 403
    assert client.delete(f"/api/boards/cards/{hidden_card_id}/attachments/{hidden_attachment_id}", headers=editor_headers).status_code == 403


def test_board_card_attachment_rejects_empty_upload(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Lege upload", "description": "", "invited_user_ids": []},
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

    uploaded = client.post(
        f"/api/boards/cards/{card_id}/attachments",
        headers=headers,
        files={"file": ("leeg.txt", BytesIO(b""), "text/plain")},
    )
    assert uploaded.status_code == 400


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


def test_board_detail_exposes_access_users_for_invited_non_admin(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    users = client.get("/api/admin/users", headers=admin_headers).json()
    editor = next(item for item in users if item["username"] == "editor")

    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Zichtbaar bord", "description": "", "invited_user_ids": [editor["id"]]},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    board = client.get(f"/api/boards/projects/{project_id}", headers=editor_headers)
    assert board.status_code == 200
    payload = board.json()

    assert payload["invited_user_ids"] == [editor["id"]]
    assert [user["username"] for user in payload["access_users"]] == ["admin", "editor"]
    assert payload["access_users"][0]["is_admin"] is True
    assert payload["access_users"][0]["is_active"] is True
    assert "has_avatar" in payload["access_users"][0]
    assert payload["access_users"][1]["is_admin"] is False
    assert payload["access_users"][1]["is_active"] is True
    assert "email" not in payload["access_users"][0]


def test_board_card_assignment_rejects_inactive_or_disallowed_users(client):
    admin_headers = _login(client)
    users = client.get("/api/admin/users", headers=admin_headers).json()
    admin = next(item for item in users if item["username"] == "admin")
    editor = next(item for item in users if item["username"] == "editor")

    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Toewijzingsbord", "description": "", "invited_user_ids": [editor["id"]]},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    allowed_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={
            "title": "Toegewezen kaart",
            "description": "",
            "column": "todo",
            "assignment_user_ids": [editor["id"], admin["id"]],
        },
    )
    assert allowed_card.status_code == 200

    board_after_allowed = client.get(f"/api/boards/projects/{project_id}", headers=admin_headers)
    assert board_after_allowed.status_code == 200
    assert [card["title"] for card in board_after_allowed.json()["cards"]] == ["Toegewezen kaart"]

    create_user = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": "reviewer", "password": "reviewer12345"},
    )
    assert create_user.status_code == 200
    reviewer_id = create_user.json()["id"]

    disallowed_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={
            "title": "Niet toegestaan",
            "description": "",
            "column": "todo",
            "assignment_user_ids": [reviewer_id],
        },
    )
    assert disallowed_card.status_code == 400
    assert reviewer_id in disallowed_card.json()["detail"]

    board_after_disallowed = client.get(f"/api/boards/projects/{project_id}", headers=admin_headers)
    assert board_after_disallowed.status_code == 200
    assert [card["title"] for card in board_after_disallowed.json()["cards"]] == ["Toegewezen kaart"]

    deactivate_editor = client.patch(
        f"/api/admin/users/{editor['id']}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deactivate_editor.status_code == 200

    inactive_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={
            "title": "Inactief",
            "description": "",
            "column": "todo",
            "assignment_user_ids": [editor["id"]],
        },
    )
    assert inactive_card.status_code == 400
    assert editor["id"] in inactive_card.json()["detail"]

    board_after_inactive = client.get(f"/api/boards/projects/{project_id}", headers=admin_headers)
    assert board_after_inactive.status_code == 200
    assert [card["title"] for card in board_after_inactive.json()["cards"]] == ["Toegewezen kaart"]


def test_admin_can_manage_board_rights_and_visibility(client):
    admin_headers = _login(client)
    editor_headers = _login(client, "editor", "editor12345")
    users = client.get("/api/admin/users", headers=admin_headers).json()
    editor = next(item for item in users if item["username"] == "editor")

    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Rechtenbord", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    blocked_list = client.get("/api/boards/projects", headers=editor_headers)
    assert all(item["id"] != project_id for item in blocked_list.json())
    blocked_direct = client.get(f"/api/boards/projects/{project_id}", headers=editor_headers)
    assert blocked_direct.status_code == 403

    overview = client.get("/api/boards/admin/rights", headers=admin_headers)
    assert overview.status_code == 200
    assert any(item["id"] == project_id for item in overview.json()["projects"])

    update = client.patch(
        f"/api/boards/admin/projects/{project_id}/rights",
        headers=admin_headers,
        json={"invited_user_ids": [editor["id"]]},
    )
    assert update.status_code == 200
    assert update.json()["invited_user_ids"] == [editor["id"]]

    visible_list = client.get("/api/boards/projects", headers=editor_headers)
    assert any(item["id"] == project_id for item in visible_list.json())
    visible_direct = client.get(f"/api/boards/projects/{project_id}", headers=editor_headers)
    assert visible_direct.status_code == 200

    remove = client.patch(
        f"/api/boards/admin/projects/{project_id}/rights",
        headers=admin_headers,
        json={"invited_user_ids": []},
    )
    assert remove.status_code == 200
    assert remove.json()["invited_user_ids"] == []
    blocked_again = client.get(f"/api/boards/projects/{project_id}", headers=editor_headers)
    assert blocked_again.status_code == 403


def test_board_rights_overview_includes_inactive_non_admin_users(client):
    admin_headers = _login(client)

    create_user = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": "reviewer", "password": "reviewer12345"},
    )
    assert create_user.status_code == 200
    reviewer_id = create_user.json()["id"]

    deactivate_user = client.patch(
        f"/api/admin/users/{reviewer_id}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deactivate_user.status_code == 200
    assert deactivate_user.json()["is_active"] is False

    overview = client.get("/api/boards/admin/rights", headers=admin_headers)
    assert overview.status_code == 200

    users = overview.json()["users"]
    admin = next(item for item in users if item["username"] == "admin")
    reviewer = next(item for item in users if item["username"] == "reviewer")

    assert admin["is_admin"] is True
    assert reviewer["is_admin"] is False
    assert reviewer["is_active"] is False


def test_non_admin_cannot_create_or_manage_board_rights(client):
    editor_headers = _login(client, "editor", "editor12345")

    create_project = client.post(
        "/api/boards/projects",
        headers=editor_headers,
        json={"name": "Niet toegestaan", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 403

    rights = client.get("/api/boards/admin/rights", headers=editor_headers)
    assert rights.status_code == 403


def test_admin_can_soft_delete_board_project(client):
    admin_headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=admin_headers,
        json={"name": "Archiefbord", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=admin_headers,
        json={"title": "Blijvende kaart", "description": "", "column": "todo", "assignment_user_ids": []},
    )
    assert create_card.status_code == 200

    archive = client.delete(f"/api/boards/admin/projects/{project_id}", headers=admin_headers)
    assert archive.status_code == 200
    assert archive.json()["id"] == project_id

    listed = client.get("/api/boards/projects", headers=admin_headers)
    assert all(item["id"] != project_id for item in listed.json())
    direct = client.get(f"/api/boards/projects/{project_id}", headers=admin_headers)
    assert direct.status_code == 404


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


def test_create_card_rejects_title_over_80_chars(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Titel lengte", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    too_long_title = "A" * 81
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": too_long_title, "description": "", "column": "todo", "assignment_user_ids": []},
    )

    assert create_card.status_code == 422


def test_create_card_accepts_title_of_80_chars(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Titel exact", "description": "", "invited_user_ids": []},
    )
    assert create_project.status_code == 200
    project_id = create_project.json()["id"]

    exact_limit_title = "A" * 80
    create_card = client.post(
        f"/api/boards/projects/{project_id}/cards",
        headers=headers,
        json={"title": exact_limit_title, "description": "", "column": "todo", "assignment_user_ids": []},
    )

    assert create_card.status_code == 200
    assert create_card.json()["title"] == exact_limit_title


def test_update_card_title_rejects_title_over_80_chars(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Titel update lengte", "description": "", "invited_user_ids": []},
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

    too_long_title = "A" * 81
    update = client.patch(f"/api/boards/cards/{card_id}/title", headers=headers, json={"title": too_long_title})

    assert update.status_code == 422


def test_update_card_title_accepts_title_of_80_chars(client):
    headers = _login(client)
    create_project = client.post(
        "/api/boards/projects",
        headers=headers,
        json={"name": "Titel update exact", "description": "", "invited_user_ids": []},
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

    exact_limit_title = "A" * 80
    update = client.patch(f"/api/boards/cards/{card_id}/title", headers=headers, json={"title": exact_limit_title})

    assert update.status_code == 200
    assert update.json()["title"] == exact_limit_title


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
