import sqlite3
import os

DB_FILE = "journal.db"

def init_db():
    """Initializes the SQLite database and creates the necessary tables."""
    
    # Connect to the database (creates 'journal.db' in the current folder if it doesn't exist)
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. Users Table (Psychologists)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Patients Table (Linked to Psychologists)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            psychologist_id INTEGER NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (psychologist_id) REFERENCES users(id)
        )
    """)

    # 3. Journal Entries Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS journal_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            title TEXT,
            text_content TEXT,
            media_file_path TEXT, -- Local path to the uploaded video/audio (e.g., 'uploads/video1.mp4')
            transcription TEXT,   -- Extracted text from audio/video
            ai_insights TEXT,     -- Cached AI-generated insights for this entry
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)

    # Migration: add ai_insights column to existing databases
    try:
        cursor.execute("ALTER TABLE journal_entries ADD COLUMN ai_insights TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists

    # 4. Emotion Logs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emotion_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_entry_id INTEGER NOT NULL,
            timestamp_seconds REAL NOT NULL, -- The time in the video where the emotion was detected
            detected_emotion TEXT NOT NULL,  -- e.g., 'Sad', 'Happy', 'Anxious'
            confidence_score REAL,           -- e.g., 0.95 for 95% confident
            source TEXT NOT NULL,            -- 'Audio' or 'Video'
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
        )
    """)

    # Commit the changes and close the connection
    conn.commit()
    conn.close()
    
    print(f"Database initialized successfully. Tables created in {DB_FILE}.")

if __name__ == "__main__":
    
    # Create an 'uploads' folder for local video storage
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
        print("Created 'uploads' folder for local media storage.")
        
    init_db()
