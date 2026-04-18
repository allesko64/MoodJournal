"""
Journal routes — GET /api/journals, GET/POST/DELETE /api/journal(s),
GET /api/journal/{id}/emotions, GET /api/journal/{id}/insights.
"""
import os
import sqlite3
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.database import get_db
from app.models.journal import JournalEntry, InsightsResponse, EmotionsResponse
from app.services import journal_service, ai_service

router = APIRouter(prefix="/api", tags=["journals"])

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@router.get("/journals")
async def get_journals(db: sqlite3.Connection = Depends(get_db)):
    entries = journal_service.get_all_journals(db)
    return {"entries": entries}


@router.get("/journal/{entry_id}")
async def get_journal(entry_id: int, db: sqlite3.Connection = Depends(get_db)):
    entry = journal_service.get_journal_by_id(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.post("/journal")
async def create_journal(
    title: str = Form(...),
    content: str = Form(...),
    tags: str = Form(""),
    language: str = Form("auto"),
    media_file: UploadFile = File(None),
    db: sqlite3.Connection = Depends(get_db),
):
    media_path = None
    transcription = None

    if media_file and media_file.filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{media_file.filename}"
        save_path = os.path.join(UPLOADS_DIR, filename)
        with open(save_path, "wb") as f:
            f.write(await media_file.read())
        media_path = f"uploads/{filename}"

    entry = journal_service.create_journal(
        db=db,
        title=title,
        content=content,
        tags=tags,
        date=datetime.now().isoformat(),
        media_file_path=media_path,
        transcription=transcription,
        language=language,
    )
    return entry


@router.delete("/journal/{entry_id}")
async def delete_journal(entry_id: int, db: sqlite3.Connection = Depends(get_db)):
    deleted = journal_service.delete_journal(db, entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return {"message": "Journal entry deleted successfully"}


@router.get("/journal/{entry_id}/emotions", response_model=EmotionsResponse)
async def get_emotions(entry_id: int, db: sqlite3.Connection = Depends(get_db)):
    entry = journal_service.get_journal_by_id(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    emotions = journal_service.get_emotions_for_journal(db, entry_id)
    return {"emotions": emotions}


@router.get("/journal/{entry_id}/insights", response_model=InsightsResponse)
async def get_insights(
    entry_id: int,
    refresh: bool = False,
    db: sqlite3.Connection = Depends(get_db),
):
    entry = journal_service.get_journal_by_id(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    if not refresh:
        cached = journal_service.get_cached_insights(db, entry_id)
        if cached:
            return {"insights": cached, "cached": True}

    try:
        insights = ai_service.generate_insights(entry["content"])
        journal_service.save_insights(db, entry_id, insights)
        return {"insights": insights, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.get("/mood-tracker")
async def get_mood_tracker(db: sqlite3.Connection = Depends(get_db)):
    """Returns mood data extracted from journal entries for charting."""
    entries = journal_service.get_all_journals(db)
    return [{"date": e["date"], "mood": e.get("mood", "okay")} for e in entries]
