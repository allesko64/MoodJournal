"""
config.py — Centralized application settings.

All tunable values live here. Import from this module; never hard-code
paths or thresholds inside service files.
"""
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths — all relative to the *backend* directory
# ---------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).parent.parent  # …/MindfulMe/backend

# SQLite database (existing journal.db stays in backend/)
DATABASE_URL: str = str(BASE_DIR / "journal.db")

# Temporary video storage (cleaned after analysis)
VIDEO_TEMP_DIR: Path = BASE_DIR / "temp_videos"
VIDEO_TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Cached ML model weights
MODEL_CACHE_DIR: Path = BASE_DIR / "models"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Log output directory
LOG_DIR: Path = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Upload & processing limits
# ---------------------------------------------------------------------------
MAX_VIDEO_SIZE_MB: int = 120
MAX_VIDEO_SIZE_BYTES: int = MAX_VIDEO_SIZE_MB * 1024 * 1024

PROCESSING_TIMEOUT_SECONDS: int = 300  # 5 minutes; mark as failed beyond this

# ---------------------------------------------------------------------------
# Model settings
# ---------------------------------------------------------------------------
WHISPER_MODEL_SIZE: str = "tiny"          # ~39 MB on disk
DISTILBERT_MODEL_NAME: str = "distilbert-base-uncased-finetuned-sst-2-english"
ONNX_MODEL_PATH: Path = MODEL_CACHE_DIR / "distilbert_int8.onnx"

# Frames per second to sample from video for emotion analysis
EMOTION_SAMPLE_FPS: int = 1

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE: Path = LOG_DIR / "mindfulme.log"
