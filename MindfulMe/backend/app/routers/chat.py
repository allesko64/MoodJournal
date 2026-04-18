"""
Chat route — POST /api/chat
Proxies multi-turn conversation history to the AI service.
"""
import sqlite3

from fastapi import APIRouter, HTTPException

from app.models.chat import ChatRequest, ChatResponse
from app.services import ai_service

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(chat_request: ChatRequest):
    try:
        reply = ai_service.get_ai_reply(chat_request.history)
        return {"reply": reply}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error communicating with AI service: {str(e)}",
        )
