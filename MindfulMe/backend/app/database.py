"""
Database connection and initialization.
All DB concerns live here — swap SQLite for PostgreSQL in one place.
"""
import sqlite3
import os

DATABASE_URL = os.path.join(os.path.dirname(__file__), "..", "journal.db")


def get_db():
    """FastAPI dependency: yields an open SQLite connection, closes on teardown."""
    conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Create tables on startup if they don't already exist."""
    conn = sqlite3.connect(DATABASE_URL)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS journals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT,
            language TEXT DEFAULT 'auto',
            media_file_path TEXT,
            transcription TEXT,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS emotion_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_id INTEGER NOT NULL,
            source TEXT NOT NULL,
            detected_emotion TEXT NOT NULL,
            confidence_score REAL NOT NULL,
            timestamp_seconds REAL DEFAULT 0,
            FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS ai_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_id INTEGER UNIQUE NOT NULL,
            insights TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
        )
    """)
    # --- Emotion analysis async job queue ---
    c.execute("""
        CREATE TABLE IF NOT EXISTS emotion_analysis_jobs (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'anonymous',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            video_file_path TEXT,
            status TEXT DEFAULT 'processing',
            emotion_analysis TEXT,
            sentiment_analysis TEXT,
            transcription TEXT,
            wellness_summary TEXT,
            processing_time_ms INTEGER,
            error_message TEXT
        )
    """)
    conn.commit()
    conn.close()
