import os
import sqlite3
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

import main
import database


TEST_DB_FILE = "test_journal.db"


def setup_module(module: Any) -> None:
    """Prepare an isolated SQLite database for tests."""
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    # Point both modules at the same test database
    main.DB_FILE = TEST_DB_FILE
    database.DB_FILE = TEST_DB_FILE

    # Initialize schema
    database.init_db()


def teardown_module(module: Any) -> None:
    """Clean up the test database after all tests."""
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


class DummyResponse:
    def __init__(self, status_code: int = 200, payload: Dict[str, Any] | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "This is a test reply from the mocked Gemini API."}
                        ]
                    }
                }
            ]
        }

    def json(self) -> Dict[str, Any]:
        return self._payload


def test_chat_successful_reply(monkeypatch: pytest.MonkeyPatch, client: TestClient) -> None:
    async def fake_call_gemini_api(payload: Dict[str, Any]) -> DummyResponse:
        return DummyResponse()

    # Ensure an API key is set for the duration of this test
    original_key = main.settings.gemini_api_key
    main.settings.gemini_api_key = "test-key"

    monkeypatch.setattr(main, "call_gemini_api", fake_call_gemini_api)

    try:
        response = client.post(
            "/api/chat",
            json={
                "history": [
                    {"role": "user", "parts": [{"text": "Hello"}]},
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert isinstance(data["reply"], str)
        assert "test reply" in data["reply"]
    finally:
        main.settings.gemini_api_key = original_key


def test_chat_empty_history_returns_400(client: TestClient) -> None:
    response = client.post("/api/chat", json={"history": []})
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "Chat history cannot be empty."


def test_chat_missing_api_key_returns_500(monkeypatch: pytest.MonkeyPatch, client: TestClient) -> None:
    original_key = main.settings.gemini_api_key
    main.settings.gemini_api_key = None

    try:
        response = client.post(
            "/api/chat",
            json={
                "history": [
                    {"role": "user", "parts": [{"text": "Hello"}]},
                ]
            },
        )

        assert response.status_code == 500
        assert response.json()["detail"] == "Gemini API key is not configured on the server."
    finally:
        main.settings.gemini_api_key = original_key


def test_create_and_list_journal_entries(client: TestClient) -> None:
    # Create a journal entry without media
    create_resp = client.post(
        "/api/journal",
        data={
            "title": "Test Entry",
            "content": "This is a test journal entry.",
            "tags": "test,entry",
        },
    )
    assert create_resp.status_code == 200
    created = create_resp.json()
    entry_id = created["id"]
    assert isinstance(entry_id, int)

    # Ensure it appears in the list endpoint
    list_resp = client.get("/api/journals")
    assert list_resp.status_code == 200
    entries = list_resp.json()["entries"]
    assert any(e["id"] == entry_id for e in entries)


def test_delete_journal_entry_removes_row(client: TestClient) -> None:
    # Insert a minimal journal entry directly into the DB for deletion
    conn = sqlite3.connect(TEST_DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO journal_entries (patient_id, title, text_content)
        VALUES (?, ?, ?)
        """,
        (1, "To be deleted", "Delete me"),
    )
    entry_id = cursor.lastrowid
    conn.commit()
    conn.close()

    resp = client.delete(f"/api/journal/{entry_id}")
    assert resp.status_code == 200

    # Validate it's gone
    conn = sqlite3.connect(TEST_DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM journal_entries WHERE id = ?", (entry_id,))
    count = cursor.fetchone()[0]
    conn.close()

    assert count == 0

