"""
FastAPI application factory.

This file's only job:
  1. Create the app
  2. Configure middleware
  3. Register routers
  4. Mount the frontend static files (enables single-command startup)

Business logic, DB queries, and AI calls all live in services/ and routers/.
"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import journals, chat, emotion_journal

# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MindfulMe API",
    description="Backend for MindfulMe journaling app",
    version="2.0.0",
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
init_db()

# ---------------------------------------------------------------------------
# API routers  (must be registered BEFORE the static file catch-all)
# ---------------------------------------------------------------------------
app.include_router(journals.router)
app.include_router(chat.router)
app.include_router(emotion_journal.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "MindfulMe API"}


# ---------------------------------------------------------------------------
# Ensure runtime directories exist
# ---------------------------------------------------------------------------
from app.config import VIDEO_TEMP_DIR, MODEL_CACHE_DIR, LOG_DIR  # noqa: E402  # type: ignore[import]
logger = __import__('logging').getLogger(__name__)
logger.info("Runtime dirs: temp_videos=%s  models=%s  logs=%s",
            VIDEO_TEMP_DIR, MODEL_CACHE_DIR, LOG_DIR)

# ---------------------------------------------------------------------------
# Serve frontend static files
# Mount LAST so the API routes above take priority.
# Visiting http://localhost:8000/ will load frontend/index.html automatically.
# ---------------------------------------------------------------------------
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"

# Serve uploaded media files at /uploads/<filename>
UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Serve frontend — MUST be last so API routes take priority
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
else:
    print(f"[WARN] Frontend directory not found at {FRONTEND_DIR}. Static files not mounted.")
