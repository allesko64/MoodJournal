"""
Journal service — all DB queries for journals, emotions, and AI insights.
No HTTP concerns here: routers call these functions and handle responses.
"""
import json
import sqlite3
from typing import List, Optional


def row_to_journal(row: sqlite3.Row) -> dict:
    tags = row["tags"] or ""
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "tags": tags,
        "date": row["date"],
        "media_file_path": row["media_file_path"],
        "transcription": row["transcription"],
    }


def get_all_journals(db: sqlite3.Connection) -> List[dict]:
    c = db.cursor()
    c.execute(
        "SELECT id, title, content, tags, date, media_file_path, transcription "
        "FROM journals ORDER BY date DESC"
    )
    return [row_to_journal(r) for r in c.fetchall()]


def get_journal_by_id(db: sqlite3.Connection, entry_id: int) -> Optional[dict]:
    c = db.cursor()
    c.execute(
        "SELECT id, title, content, tags, date, media_file_path, transcription "
        "FROM journals WHERE id = ?",
        (entry_id,),
    )
    row = c.fetchone()
    return row_to_journal(row) if row else None


def create_journal(
    db: sqlite3.Connection,
    title: str,
    content: str,
    tags: str,
    date: str,
    media_file_path: Optional[str] = None,
    transcription: Optional[str] = None,
    language: str = "auto",
) -> dict:
    c = db.cursor()
    c.execute(
        "INSERT INTO journals (title, content, tags, date, media_file_path, transcription, language) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (title, content, tags, date, media_file_path, transcription, language),
    )
    db.commit()
    entry_id = c.lastrowid
    return get_journal_by_id(db, entry_id)


def delete_journal(db: sqlite3.Connection, entry_id: int) -> bool:
    c = db.cursor()
    c.execute("DELETE FROM journals WHERE id = ?", (entry_id,))
    db.commit()
    return c.rowcount > 0


def get_emotions_for_journal(db: sqlite3.Connection, entry_id: int) -> List[dict]:
    c = db.cursor()
    c.execute(
        "SELECT source, detected_emotion, confidence_score, timestamp_seconds "
        "FROM emotion_logs WHERE journal_id = ? ORDER BY id ASC",
        (entry_id,),
    )
    return [
        {
            "source": r["source"],
            "detected_emotion": r["detected_emotion"],
            "confidence_score": r["confidence_score"],
            "timestamp_seconds": r["timestamp_seconds"],
        }
        for r in c.fetchall()
    ]


def get_cached_insights(db: sqlite3.Connection, entry_id: int) -> Optional[str]:
    c = db.cursor()
    c.execute("SELECT insights FROM ai_insights WHERE journal_id = ?", (entry_id,))
    row = c.fetchone()
    return row["insights"] if row else None


def save_insights(db: sqlite3.Connection, entry_id: int, insights: str) -> None:
    c = db.cursor()
    c.execute(
        "INSERT INTO ai_insights (journal_id, insights) VALUES (?, ?) "
        "ON CONFLICT(journal_id) DO UPDATE SET insights=excluded.insights, created_at=CURRENT_TIMESTAMP",
        (entry_id, insights),
    )
    db.commit()
