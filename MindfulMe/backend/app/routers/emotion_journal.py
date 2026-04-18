"""
emotion_journal.py — FastAPI router for video emotion analysis.

Endpoints:
  POST /api/journal/analyze
    Accept a multipart video upload, create a DB job record, launch background task.
    Returns: { "entry_id": uuid, "status": "processing" }

  GET /api/journal/results/{entry_id}
    Poll for the result of a previously submitted analysis.
    Returns: { "status": "...", "emotion_analysis": {...}, ... } when complete.

Background pipeline (runs in asyncio thread pool):
  1. emotion_detector.analyze_video()
  2. transcriber.transcribe_video()
  3. sentiment_analyzer.analyze_sentiment(transcript)
  4. wellness_service.generate_wellness_summary()
  5. Persist all four analyses to DB; delete temp video file.
"""
import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/journal", tags=["emotion-analysis"])

# ---------------------------------------------------------------------------
# Lazy config import (avoids import order issues)
# ---------------------------------------------------------------------------
def _cfg():
    from app.config import (  # noqa: PLC0415
        MAX_VIDEO_SIZE_BYTES, VIDEO_TEMP_DIR, DATABASE_URL
    )
    return MAX_VIDEO_SIZE_BYTES, VIDEO_TEMP_DIR, DATABASE_URL


# ---------------------------------------------------------------------------
# Database helpers — thin sqlite3 wrappers scoped to this router
# ---------------------------------------------------------------------------
def _db_conn():
    import sqlite3
    _, _, db_url = _cfg()
    conn = sqlite3.connect(db_url, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _create_job(entry_id: str, video_path: str) -> None:
    conn = _db_conn()
    conn.execute(
        """
        INSERT INTO emotion_analysis_jobs
            (id, user_id, created_at, video_file_path, status)
        VALUES (?, 'anonymous', ?, ?, 'processing')
        """,
        (entry_id, datetime.now(timezone.utc).isoformat(), video_path),
    )
    conn.commit()
    conn.close()


def _update_job(
    entry_id: str,
    status: str,
    emotion_analysis: dict | None = None,
    sentiment_analysis: dict | None = None,
    transcription: dict | None = None,
    wellness_summary: dict | None = None,
    processing_time_ms: int | None = None,
    error_message: str | None = None,
) -> None:
    conn = _db_conn()
    conn.execute(
        """
        UPDATE emotion_analysis_jobs
        SET status=?, emotion_analysis=?, sentiment_analysis=?,
            transcription=?, wellness_summary=?, processing_time_ms=?,
            error_message=?
        WHERE id=?
        """,
        (
            status,
            json.dumps(emotion_analysis) if emotion_analysis is not None else None,
            json.dumps(sentiment_analysis) if sentiment_analysis is not None else None,
            json.dumps(transcription) if transcription is not None else None,
            json.dumps(wellness_summary) if wellness_summary is not None else None,
            processing_time_ms,
            error_message,
            entry_id,
        ),
    )
    conn.commit()
    conn.close()


def _get_job(entry_id: str) -> dict | None:
    conn = _db_conn()
    row = conn.execute(
        "SELECT * FROM emotion_analysis_jobs WHERE id=?", (entry_id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


# ---------------------------------------------------------------------------
# Background analysis pipeline
# ---------------------------------------------------------------------------
def _run_pipeline(entry_id: str, video_path: str) -> None:
    """
    Synchronous pipeline executed in the thread pool by asyncio.
    Imports are deferred so the server starts fast even if heavy libs are missing.
    """
    t0 = time.perf_counter()
    logger.info("[%s] Pipeline started — video: %s", entry_id, video_path)

    try:
        # Step 1 — Facial emotion detection
        from app.services import emotion_detector  # noqa: PLC0415
        logger.info("[%s] Running emotion detection…", entry_id)
        emotion_data = emotion_detector.analyze_video(video_path)

        # Step 2 — Speech transcription
        from app.services import transcriber  # noqa: PLC0415
        logger.info("[%s] Running transcription…", entry_id)
        transcription_data = transcriber.transcribe_video(video_path)

        # Step 3 — Sentiment analysis
        from app.services import sentiment_analyzer  # noqa: PLC0415
        transcript_text = transcription_data.get("full_transcript", "")
        logger.info("[%s] Running sentiment analysis on %d chars…", entry_id, len(transcript_text))
        sentiment_data = sentiment_analyzer.analyze_sentiment(transcript_text)

        # Step 4 — Wellness summary
        from app.services import wellness_service  # noqa: PLC0415
        logger.info("[%s] Generating wellness summary…", entry_id)
        wellness_data = wellness_service.generate_wellness_summary(emotion_data, sentiment_data)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info("[%s] Pipeline complete in %d ms.", entry_id, elapsed_ms)

        _update_job(
            entry_id=entry_id,
            status="completed",
            emotion_analysis=emotion_data,
            sentiment_analysis=sentiment_data,
            transcription=transcription_data,
            wellness_summary=wellness_data,
            processing_time_ms=elapsed_ms,
        )

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.exception("[%s] Pipeline failed after %d ms: %s", entry_id, elapsed_ms, exc)
        _update_job(
            entry_id=entry_id,
            status="failed",
            processing_time_ms=elapsed_ms,
            error_message=str(exc),
        )
    finally:
        # Clean up temp video
        try:
            if os.path.exists(video_path):
                os.remove(video_path)
                logger.info("[%s] Temp video deleted: %s", entry_id, video_path)
        except OSError as rm_err:
            logger.warning("[%s] Could not delete temp video: %s", entry_id, rm_err)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/analyze")
async def analyze_journal_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(..., description="Video file (webm/mp4/mov, max 120 MB)"),
) -> JSONResponse:
    """
    Accept a video upload and kick off async emotion analysis.

    Returns immediately with an entry_id to poll via GET /api/journal/results/{id}.
    """
    max_bytes, temp_dir, _ = _cfg()

    # --- Validate content ---
    content = await video.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {max_bytes // (1024*1024)} MB.",
        )
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # --- Save to temp dir ---
    entry_id = str(uuid.uuid4())
    ext = Path(video.filename or "recording.webm").suffix or ".webm"
    filename = f"{entry_id}{ext}"
    video_path = str(Path(temp_dir) / filename)

    with open(video_path, "wb") as f:
        f.write(content)

    logger.info("Video saved: %s (%d bytes)", video_path, len(content))

    # --- Create DB job record ---
    try:
        _create_job(entry_id, video_path)
    except Exception as exc:
        logger.error("DB insert failed: %s", exc)
        raise HTTPException(status_code=500, detail="Database error. Please retry.")

    # --- Launch background pipeline ---
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_pipeline, entry_id, video_path)

    return JSONResponse(
        status_code=202,
        content={"entry_id": entry_id, "status": "processing"},
    )


@router.get("/results/{entry_id}")
async def get_analysis_results(entry_id: str) -> JSONResponse:
    """
    Poll for the result of a video analysis job.

    Returns:
        status='processing' while running.
        status='completed' with all four analysis dicts when done.
        status='failed' with error_message when something went wrong.
    """
    job = _get_job(entry_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Entry '{entry_id}' not found.")

    def _parse(field: str) -> Any:
        raw = job.get(field)
        if raw and isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None
        return raw

    response: dict[str, Any] = {
        "entry_id": entry_id,
        "status": job["status"],
        "created_at": job.get("created_at"),
        "processing_time_ms": job.get("processing_time_ms"),
    }

    if job["status"] == "completed":
        response["emotion_analysis"] = _parse("emotion_analysis")
        response["sentiment_analysis"] = _parse("sentiment_analysis")
        response["transcription"] = _parse("transcription")
        response["wellness_summary"] = _parse("wellness_summary")

    elif job["status"] == "failed":
        response["error"] = job.get("error_message", "Unknown error")

    return JSONResponse(content=response)
