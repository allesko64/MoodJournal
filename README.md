# MindfulMe
A full-stack mental wellness web app for mood tracking, journaling, and AI-assisted reflection.

## What I built
- Mood tracker with daily check-ins, factor tagging, trend visualization, and weekly summaries.
- Journal module with text entries, optional audio/video recording, search/sort, and entry management.
- AI insights for journal entries with cached responses and refresh support.
- Video Emotion Journal pipeline that provides:
  - facial emotion distribution and timeline from video
  - speech transcription from recorded/uploaded media
  - sentiment scoring from transcript text
  - combined wellness summary with actionable recommendations
- Multi-turn AI therapist chat, including contextual discussion of the latest journal entry.
- Supportive wellness pages (guided breathing, curated resources, and crisis-help information).

## Tech used
- **Backend:** Python, FastAPI, Uvicorn, SQLite
- **AI/ML:** MediaPipe, OpenCV, Whisper, DistilBERT, ONNX Runtime
- **Frontend:** Vanilla HTML, CSS, JavaScript (modular feature-based structure)
- **Integrations:** Gemini/OpenRouter APIs for conversation and journal reflections

## Good engineering practices
- Modular backend architecture with clear separation between `routers/`, `services/`, and `models/`.
- Centralized configuration and runtime path management in `backend/app/config.py`.
- Async job-style video analysis flow with polling, status tracking, and cleanup.
- Graceful fallbacks across the stack (offline storage, model/provider fallback paths, media-processing alternatives).
- Reusable shared frontend utilities for API calls, storage, and UI helpers.
- Defensive UI handling with text escaping before DOM injection.
- Repository hygiene via `.gitignore` for secrets, logs, temp files, local DBs, and large model artifacts.

## Run locally
1. Install Python 3.10+.
2. Install dependencies:
   - `pip install -r MindfulMe/backend/requirements.txt`
3. (Optional, for AI chat + insight generation) create `MindfulMe/backend/.env` with either:
   - `GEMINI_API_KEY=...`
   - or `OPENROUTER_API_KEY=...`
4. Start the app:
   - `python MindfulMe/backend/run.py`
5. Open:
   - `http://localhost:8000`

## Project structure
```text
MindfulMe/
├─ backend/
│  ├─ app/
│  │  ├─ routers/
│  │  ├─ services/
│  │  └─ models/
│  └─ run.py
└─ frontend/
   ├─ features/
   ├─ shared/
   └─ index.html
```
