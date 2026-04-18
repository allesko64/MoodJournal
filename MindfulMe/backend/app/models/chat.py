"""Pydantic schemas for AI chat."""
from pydantic import BaseModel
from typing import List


class ChatRequest(BaseModel):
    history: List[dict]


class ChatResponse(BaseModel):
    reply: str
