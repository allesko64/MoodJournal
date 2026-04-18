"""Pydantic schemas for journal entries."""
from pydantic import BaseModel
from typing import List, Optional


class JournalEntryCreate(BaseModel):
    title: str
    content: str
    tags: Optional[str] = ""
    date: str  # ISO format


class JournalEntry(JournalEntryCreate):
    id: int
    media_file_path: Optional[str] = None
    transcription: Optional[str] = None


class InsightsResponse(BaseModel):
    insights: str
    cached: bool = False


class EmotionLog(BaseModel):
    source: str
    detected_emotion: str
    confidence_score: float
    timestamp_seconds: float = 0.0


class EmotionsResponse(BaseModel):
    emotions: List[EmotionLog]
