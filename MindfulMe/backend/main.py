from fastapi import FastAPI, UploadFile, Form, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic_settings import BaseSettings
import sqlite3
from typing import Optional, List, Dict, Any
import os
import shutil
import uuid
import datetime
import httpx

from database import init_db

from fer.fer import FER  # Video-based emotion detection
from fer.classes import Video

# Audio-based emotion detection (optional; may not be available on all systems)
try:
    from multimodal_emotion_engine.engine import EmotionEngine  # type: ignore
except Exception as e:  # pragma: no cover - best-effort optional import
    EmotionEngine = None  # type: ignore[assignment]
    print(
        "[startup] multimodal_emotion_engine not available; "
        "audio emotion analysis will be disabled:",
        e,
    )

import whisper  # Speech-to-text transcription


class Settings(BaseSettings):
    """Application configuration loaded from environment / .env."""

    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-flash"
    cors_allow_origins: List[str] = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

app = FastAPI()

GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{settings.gemini_model}:generateContent"
)

SYSTEM_INSTRUCTION = """You are an AI assistant designed to provide emotional support and a safe space for users. Listen attentively, respond empathetically, and offer thoughtful responses. You are not a substitute for professional therapy — encourage users to seek professional help if necessary. Use calming, non-judgmental language. Suggest self-care strategies like mindfulness or journaling without being prescriptive. For crisis situations, always direct the user to a licensed professional."""

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "journal.db"


# Global model instances, initialized at startup
whisper_model = None
video_emotion_detector: Optional[FER] = None
audio_emotion_engine: Optional[EmotionEngine] = None


def is_video_file(path: str) -> bool:
    _, ext = os.path.splitext(path.lower())
    return ext in {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def is_audio_file(path: str) -> bool:
    _, ext = os.path.splitext(path.lower())
    return ext in {".wav", ".mp3", ".m4a", ".flac", ".ogg"}


LANGUAGE_NAMES: Dict[str, str] = {
    "hi": "Hindi", "kn": "Kannada", "ta": "Tamil", "te": "Telugu",
    "mr": "Marathi", "bn": "Bengali", "gu": "Gujarati",
    "es": "Spanish", "fr": "French",
}


def transcribe_media(path: str, language: Optional[str] = None) -> Optional[str]:
    """
    Transcribe audio/video to English text using Whisper.
    Non-English sources are automatically translated to English.
    Returns the transcript prefixed with '[Translated from <lang>]' when applicable.
    """
    global whisper_model
    if whisper_model is None:
        return None

    try:
        kwargs: Dict[str, Any] = {}
        is_non_english = language and language not in ("auto", "en")

        if is_non_english:
            kwargs["language"] = language
            kwargs["task"] = "translate"

        result: Dict[str, Any] = whisper_model.transcribe(path, **kwargs)
        text = (result.get("text") or "").strip()
        if not text:
            return None

        if is_non_english:
            lang_name = LANGUAGE_NAMES.get(language, language)
            text = f"[Translated from {lang_name}] {text}"

        return text
    except Exception as e:
        print(f"[transcribe_media] Error while transcribing {path}: {e}")
        return None


def analyze_audio_emotion(path: str) -> Optional[Dict[str, float]]:
    """
    Run audio-based emotion recognition on the given media file.
    Returns a dict of emotion -> probability, or None on failure.
    """
    global audio_emotion_engine
    if audio_emotion_engine is None:
        return None

    try:
        result = audio_emotion_engine.analyze_file(path)
        if not isinstance(result, dict):
            return None
        return {str(k): float(v) for k, v in result.items()}
    except Exception as e:
        print(f"[analyze_audio_emotion] Error while analyzing {path}: {e}")
        return None


def analyze_video_emotion(path: str) -> List[Dict[str, Any]]:
    """
    Run frame-by-frame facial emotion recognition on a video file.
    Returns a list of dicts with timestamp_seconds, detected_emotion, confidence_score.
    """
    global video_emotion_detector
    if video_emotion_detector is None:
        return []

    try:
        video = Video(path)
        raw_data = video.analyze(video_emotion_detector, display=False)
        df = video.to_pandas(raw_data)
    except Exception as e:
        print(f"[analyze_video_emotion] Error while processing {path}: {e}")
        return []

    if df is None or df.empty:
        return []

    results: List[Dict[str, Any]] = []
    emotion_columns = [
        "angry",
        "disgust",
        "fear",
        "happy",
        "sad",
        "surprise",
        "neutral",
    ]

    for _, row in df.iterrows():
        try:
            timestamp = float(row.get("time", 0.0))
            emotions = {
                name: float(row[name])
                for name in emotion_columns
                if name in row and row[name] is not None
            }
            if not emotions:
                continue
            top_emotion, score = max(emotions.items(), key=lambda kv: kv[1])
            results.append(
                {
                    "timestamp_seconds": timestamp,
                    "detected_emotion": top_emotion.capitalize(),
                    "confidence_score": float(score),
                }
            )
        except Exception as e:
            print(f"[analyze_video_emotion] Error for frame row: {e}")
            continue

    return results


def _run_migrations():
    """Apply schema migrations to an existing database."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE journal_entries ADD COLUMN ai_insights TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.close()


def init_mock_data():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    # Check if we have mock user and patient, if not create them
    cursor.execute("SELECT id FROM users WHERE id = 1")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users (id, username, email, password_hash) VALUES (1, 'dr_smith', 'smith@test.com', 'hash')")
        cursor.execute("INSERT INTO patients (id, psychologist_id, first_name, last_name, notes) VALUES (1, 1, 'John', 'Doe', 'Mock patient')")
        conn.commit()

    # Seed 5 sample journal entries (skip if entries already exist)
    cursor.execute("SELECT COUNT(*) FROM journal_entries")
    if cursor.fetchone()[0] == 0:
        sample_entries = [
            {
                "title": "Feeling Overwhelmed at Work",
                "text_content": (
                    "Today was really tough. Back-to-back meetings, tight deadlines, "
                    "and I barely had time to eat lunch. I keep telling myself it will "
                    "get better but some days it feels like the workload just keeps growing. "
                    "I need to find a way to set better boundaries."
                ),
                "transcription": (
                    "I just feel so drained honestly. Like every day I wake up already "
                    "thinking about the mountain of tasks. I know I should take breaks "
                    "but there is always something urgent."
                ),
                "created_at": "2026-02-25 09:30:00",
            },
            {
                "title": "Morning Run Clarity",
                "text_content": (
                    "Went for an early morning run along the river trail. The air was "
                    "crisp and cool. About halfway through I felt this wave of calm wash "
                    "over me. My mind stopped racing for the first time in weeks. I need "
                    "to do this more often - movement really does help."
                ),
                "transcription": None,
                "created_at": "2026-02-27 07:15:00",
            },
            {
                "title": "Argument with a Close Friend",
                "text_content": (
                    "Had a big disagreement with Sam today over something that probably "
                    "wasn't worth it. We both said things we didn't mean. I feel guilty "
                    "and a little angry at the same time. I know I should apologize first "
                    "but my pride keeps getting in the way."
                ),
                "transcription": (
                    "I don't even know why it escalated so fast. One second we were "
                    "joking around and then suddenly everything turned serious. I hate "
                    "this feeling in my stomach."
                ),
                "created_at": "2026-02-28 18:45:00",
            },
            {
                "title": "Grateful for Small Things",
                "text_content": (
                    "Today I'm writing down three things I'm grateful for: 1) My mom "
                    "called just to check on me, 2) I finished reading a book I've "
                    "been putting off for months, 3) The sunset from my balcony was "
                    "absolutely beautiful. It's easy to forget these moments when life "
                    "gets hectic."
                ),
                "transcription": None,
                "created_at": "2026-03-01 20:00:00",
            },
            {
                "title": "Sleepless Night & Anxiety",
                "text_content": (
                    "Couldn't sleep at all last night. My mind kept replaying worst-case "
                    "scenarios about the presentation next week. I tried breathing exercises "
                    "but my thoughts kept spiraling. Eventually gave up and watched a movie "
                    "until 3 AM. I feel exhausted today and I know the cycle will probably "
                    "repeat tonight."
                ),
                "transcription": (
                    "My heart was pounding even though nothing was actually happening. "
                    "I kept thinking what if I mess up, what if everyone judges me. "
                    "It feels so irrational in the morning but at night it feels so real."
                ),
                "created_at": "2026-03-02 23:30:00",
            },
        ]

        for entry in sample_entries:
            cursor.execute(
                """
                INSERT INTO journal_entries
                    (patient_id, title, text_content, transcription, created_at)
                VALUES (1, ?, ?, ?, ?)
                """,
                (
                    entry["title"],
                    entry["text_content"],
                    entry["transcription"],
                    entry["created_at"],
                ),
            )
        conn.commit()

        # Add sample emotion logs for entries that have transcriptions
        # Entry 1 (Overwhelmed) — audio: Sad, video: mix of sad/neutral/fear
        cursor.execute(
            "SELECT id FROM journal_entries WHERE title = 'Feeling Overwhelmed at Work'"
        )
        eid = cursor.fetchone()
        if eid:
            eid = eid[0]
            cursor.execute(
                "INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source) VALUES (?,?,?,?,?)",
                (eid, 0.0, "Sad", 0.78, "Audio"),
            )
            for ts, em, sc in [
                (0.0, "Neutral", 0.65), (1.0, "Neutral", 0.60),
                (2.0, "Sad", 0.72), (3.0, "Sad", 0.80),
                (4.0, "Sad", 0.75), (5.0, "Fear", 0.55),
                (6.0, "Sad", 0.70), (7.0, "Fear", 0.62),
            ]:
                cursor.execute(
                    "INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source) VALUES (?,?,?,?,?)",
                    (eid, ts, em, sc, "Video"),
                )

        # Entry 3 (Argument) — audio: Angry, video: mix of angry/sad/surprise
        cursor.execute(
            "SELECT id FROM journal_entries WHERE title = 'Argument with a Close Friend'"
        )
        eid = cursor.fetchone()
        if eid:
            eid = eid[0]
            cursor.execute(
                "INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source) VALUES (?,?,?,?,?)",
                (eid, 0.0, "Angry", 0.68, "Audio"),
            )
            for ts, em, sc in [
                (0.0, "Neutral", 0.50), (1.0, "Surprise", 0.58),
                (2.0, "Angry", 0.74), (3.0, "Angry", 0.82),
                (4.0, "Sad", 0.60), (5.0, "Sad", 0.71),
                (6.0, "Angry", 0.66), (7.0, "Sad", 0.69),
            ]:
                cursor.execute(
                    "INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source) VALUES (?,?,?,?,?)",
                    (eid, ts, em, sc, "Video"),
                )

        # Entry 5 (Sleepless) — audio: Fear, video: fear/sad/neutral
        cursor.execute(
            "SELECT id FROM journal_entries WHERE title = 'Sleepless Night & Anxiety'"
        )
        eid = cursor.fetchone()
        if eid:
            eid = eid[0]
            cursor.execute(
                "INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source) VALUES (?,?,?,?,?)",
                (eid, 0.0, "Fear", 0.73, "Audio"),
            )
            for ts, em, sc in [
                (0.0, "Fear", 0.68), (1.0, "Fear", 0.72),
                (2.0, "Sad", 0.55), (3.0, "Fear", 0.80),
                (4.0, "Fear", 0.77), (5.0, "Neutral", 0.50),
                (6.0, "Sad", 0.62), (7.0, "Fear", 0.70),
            ]:
                cursor.execute(
                    "INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source) VALUES (?,?,?,?,?)",
                    (eid, ts, em, sc, "Video"),
                )

        conn.commit()

    conn.close()

@app.on_event("startup")
async def startup_event():
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    # Serve the 'uploads' folder statically so the frontend can load the media files
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    init_db()
    _run_migrations()
    init_mock_data()

    # Initialize ML models once at startup so requests are faster.
    global whisper_model, video_emotion_detector, audio_emotion_engine

    try:
        whisper_model = whisper.load_model("base")
        print("[startup] Whisper model loaded successfully.")
    except Exception as e:
        whisper_model = None
        print(f"[startup] Failed to load Whisper model: {e}")

    try:
        video_emotion_detector = FER(mtcnn=True)
        print("[startup] FER video emotion detector initialized.")
    except Exception as e:
        video_emotion_detector = None
        print(f"[startup] Failed to initialize FER detector: {e}")

    try:
        audio_emotion_engine = EmotionEngine()
        print("[startup] Audio emotion engine initialized.")
    except Exception as e:
        audio_emotion_engine = None
        print(f"[startup] Failed to initialize audio emotion engine: {e}")

@app.post("/api/journal")
async def create_journal_entry(
    title: str = Form(...),
    content: str = Form(...),
    tags: str = Form(""),
    language: str = Form("auto"),
    media_file: Optional[UploadFile] = File(None)
):
    media_file_path = None
    transcription_text: Optional[str] = None
    emotion_rows: List[Dict[str, Any]] = []
    
    if media_file and media_file.filename:
        # Create a unique filename to prevent collisions
        file_extension = os.path.splitext(media_file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        media_file_path = f"uploads/{unique_filename}"
        
        with open(media_file_path, "wb") as buffer:
            shutil.copyfileobj(media_file.file, buffer)

    # If we have a media file, attempt transcription and emotion analysis
    if media_file_path:
        try:
            # Transcription (audio track from audio/video)
            transcription_text = transcribe_media(media_file_path, language=language)
        except Exception as e:
            print(f"[create_journal_entry] Transcription failed: {e}")
            transcription_text = None

        # Audio-based emotion (aggregated over the whole clip)
        try:
            audio_emotions = analyze_audio_emotion(media_file_path)
            if audio_emotions:
                top_emotion, score = max(audio_emotions.items(), key=lambda kv: kv[1])
                emotion_rows.append(
                    {
                        "timestamp_seconds": 0.0,
                        "detected_emotion": top_emotion.capitalize(),
                        "confidence_score": float(score),
                        "source": "Audio",
                    }
                )
        except Exception as e:
            print(f"[create_journal_entry] Audio emotion analysis failed: {e}")

        # Video-based emotion (frame-by-frame over time)
        if is_video_file(media_file_path):
            try:
                video_emotions = analyze_video_emotion(media_file_path)
                for item in video_emotions:
                    emotion_rows.append(
                        {
                            "timestamp_seconds": item["timestamp_seconds"],
                            "detected_emotion": item["detected_emotion"],
                            "confidence_score": item["confidence_score"],
                            "source": "Video",
                        }
                    )
            except Exception as e:
                print(f"[create_journal_entry] Video emotion analysis failed: {e}")

    # Save to database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # We are mocking patient_id = 1 for now since we don't have complete auth flow
        cursor.execute("""
            INSERT INTO journal_entries (patient_id, title, text_content, media_file_path, transcription)
            VALUES (?, ?, ?, ?, ?)
        """, (1, title, content, media_file_path, transcription_text))
        
        entry_id = cursor.lastrowid
        
        # Persist any detected emotions (audio and/or video)
        for row in emotion_rows:
            cursor.execute(
                """
                INSERT INTO emotion_logs (journal_entry_id, timestamp_seconds, detected_emotion, confidence_score, source)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    row["timestamp_seconds"],
                    row["detected_emotion"],
                    row["confidence_score"],
                    row["source"],
                ),
            )
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    
    return {"message": "Journal entry created successfully", "id": entry_id, "media_path": media_file_path}

@app.get("/api/journals")
async def get_journals():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM journal_entries ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    
    entries = []
    for row in rows:
        entry = dict(row)
        entries.append({
            "id": entry["id"],
            "title": entry["title"],
            "content": entry["text_content"],
            "date": entry["created_at"],
            "media_file_path": entry["media_file_path"],
            "transcription": entry.get("transcription"),
            "tags": [],
        })
        
    conn.close()
    return {"entries": entries}


@app.get("/api/journal/{entry_id}/emotions")
async def get_journal_emotions(entry_id: int):
    """
    Return all stored emotion logs (audio + video) for a given journal entry.
    """
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, timestamp_seconds, detected_emotion, confidence_score, source
        FROM emotion_logs
        WHERE journal_entry_id = ?
        ORDER BY timestamp_seconds ASC, id ASC
        """,
        (entry_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    emotions = [
        {
            "id": row["id"],
            "timestamp_seconds": row["timestamp_seconds"],
            "detected_emotion": row["detected_emotion"],
            "confidence_score": row["confidence_score"],
            "source": row["source"],
        }
        for row in rows
    ]

    return {"journal_entry_id": entry_id, "emotions": emotions}


@app.delete("/api/journal/{entry_id}")
async def delete_journal_entry(entry_id: int):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        # Get the media path before deleting so we can remove the file
        cursor.execute("SELECT media_file_path FROM journal_entries WHERE id = ?", (entry_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        media_path = row[0]
        cursor.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))
        conn.commit()

        # Delete associated media file from disk if it exists
        if media_path and os.path.exists(media_path):
            os.remove(media_path)

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return {"message": "Entry deleted successfully", "id": entry_id}


# =============================================
#  AI Journal Insights
#  Compresses transcript + emotions, single-shot
# =============================================

INSIGHTS_SYSTEM_INSTRUCTION = (
    "You are a mental wellness advisor. Given a journal entry's content, "
    "transcript, and detected emotions, provide 3-4 brief, actionable insights. "
    "Be empathetic. Keep response under 150 words."
)


def build_insight_prompt(
    entry: dict, emotions: List[dict]
) -> Optional[str]:
    """Compress journal entry data into a token-efficient prompt string."""
    parts = []

    if entry.get("title"):
        parts.append(f"Title: {entry['title']}")

    content = (entry.get("text_content") or "").strip()
    if content:
        parts.append(f"Content: {content[:200]}")

    transcript = (entry.get("transcription") or "").strip()
    if transcript:
        parts.append(f"Transcript: {transcript[:300]}")

    if not parts:
        return None

    audio_logs = [e for e in emotions if e.get("source") == "Audio"]
    video_logs = [e for e in emotions if e.get("source") == "Video"]

    if audio_logs:
        top = audio_logs[0]
        parts.append(
            f"Voice emotion: {top['detected_emotion']} "
            f"({top['confidence_score'] * 100:.0f}% conf)"
        )

    if video_logs:
        counts: Dict[str, int] = {}
        for log in video_logs:
            em = log["detected_emotion"]
            counts[em] = counts.get(em, 0) + 1
        total = len(video_logs)
        dist = ", ".join(
            f"{em} {cnt * 100 // total}%"
            for em, cnt in sorted(counts.items(), key=lambda kv: -kv[1])
        )
        parts.append(f"Face emotions: {dist}")

        third = max(len(video_logs) // 3, 1)
        segments = [video_logs[:third], video_logs[third:2 * third], video_logs[2 * third:]]
        arc_labels = []
        for seg in segments:
            seg_counts: Dict[str, int] = {}
            for log in seg:
                em = log["detected_emotion"]
                seg_counts[em] = seg_counts.get(em, 0) + 1
            arc_labels.append(max(seg_counts, key=seg_counts.get) if seg_counts else "?")
        parts.append(f"Emotional arc: {' -> '.join(arc_labels)}")

    return "\n".join(parts)


@app.get("/api/journal/{entry_id}/insights")
async def get_journal_insights(entry_id: int, refresh: bool = False):
    """Return cached AI insights or generate new ones from transcript + emotions."""
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API key is not configured.")

    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")

    entry = dict(row)

    cached = entry.get("ai_insights")
    if cached and not refresh:
        conn.close()
        return {"entry_id": entry_id, "insights": cached, "cached": True}

    cursor.execute(
        "SELECT detected_emotion, confidence_score, source, timestamp_seconds "
        "FROM emotion_logs WHERE journal_entry_id = ? ORDER BY timestamp_seconds",
        (entry_id,),
    )
    emotions = [dict(r) for r in cursor.fetchall()]

    prompt_text = build_insight_prompt(entry, emotions)
    if not prompt_text:
        conn.close()
        raise HTTPException(
            status_code=422,
            detail="Not enough data (no content, transcript, or emotions) to generate insights.",
        )

    payload = {
        "system_instruction": {"parts": [{"text": INSIGHTS_SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "temperature": 0.7,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 512,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        ],
    }

    response = await call_gemini_api(payload)

    if response.status_code in (429, 503):
        conn.close()
        return {
            "entry_id": entry_id,
            "insights": "The AI service is temporarily unavailable. Please try again shortly.",
            "cached": False,
        }

    if response.status_code != 200:
        conn.close()
        raise HTTPException(status_code=502, detail="Upstream AI service error.")

    data = response.json()
    try:
        insights_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        conn.close()
        raise HTTPException(status_code=502, detail="Unexpected AI response format.")

    cursor.execute(
        "UPDATE journal_entries SET ai_insights = ? WHERE id = ?",
        (insights_text, entry_id),
    )
    conn.commit()
    conn.close()

    return {"entry_id": entry_id, "insights": insights_text, "cached": False}


# =============================================
#  AI Chat Proxy Endpoint
#  Keeps the Gemini API key safe on the server
# =============================================
class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    parts: List[dict]  # [{ "text": "..." }]

class ChatRequest(BaseModel):
    history: List[ChatMessage]


async def call_gemini_api(payload: dict) -> httpx.Response:
    """Send a chat completion request to the Gemini API."""
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.post(
            GEMINI_API_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": settings.gemini_api_key or "",
            },
        )


@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    if not request.history:
        raise HTTPException(
            status_code=400,
            detail="Chat history cannot be empty.",
        )

    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API key is not configured on the server.")

    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}]
        },
        "contents": [msg.dict() for msg in request.history],
        "generationConfig": {
            "temperature": 0.75,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 1024,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT",        "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH",       "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        ]
    }

    response = await call_gemini_api(payload)

    # Gracefully handle common upstream issues so the UI still gets a reply.
    if response.status_code in (429, 503):
        # Log upstream error for debugging
        try:
            error_detail = response.json().get("error", {}).get("message", "")
        except Exception:
            error_detail = ""
        print(f"Gemini API transient error {response.status_code}: {error_detail}")

        return {
            "reply": (
                "I'm having trouble reaching the AI service right now (it may be temporarily unavailable "
                "or rate-limited). Please try again in a little while."
            )
        }

    if response.status_code != 200:
        try:
            error_detail = response.json().get("error", {}).get("message", "Unknown Gemini API error")
        except Exception:
            error_detail = "Unknown Gemini API error"
        # Log and surface a generic upstream error
        print(f"Gemini API error {response.status_code}: {error_detail}")
        raise HTTPException(status_code=502, detail="Upstream AI service error. Please try again later.")

    data = response.json()
    reply_text = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"reply": reply_text}
