## MindfulMe – Project Root

This folder is the **root of the MindfulMe app**. It contains:

- `backend/` – FastAPI backend (API, database, AI chat).
- `js/`, `css/`, `index.html`, `pages/` – Frontend (multi‑page HTML/JS app).

> Recommended: open this `MindfulMe` folder as your project root in Cursor/VS Code so tools and paths resolve correctly.

### Backend – FastAPI

- Entry point: `backend/main.py`
- Local DB: `journal.db` (SQLite)
- Requirements: `backend/requirements.txt`

Run the backend (from this `MindfulMe` directory):

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Environment configuration (after refactor in this branch):

- `GEMINI_API_KEY` – Gemini API key (required for AI chat).
- Optional:
  - `GEMINI_MODEL` – Gemini model name (default: `gemini-3-flash-preview`).
  - `CORS_ALLOW_ORIGINS` – Comma‑separated list of allowed origins for CORS.

You can either export these as environment variables or create a `.env` file next to `backend/main.py` (FastAPI will load them via the Pydantic `Settings` class).

### Frontend

Key files:

- `index.html` – Landing page.
- `pages/journal.html` – Journal.
- `pages/mood-tracker.html` – Mood tracker.
- `pages/ai-therapist.html` – AI therapist chat.
- `pages/resources.html` – Resources & breathing exercises.
- `pages/crisis.html` – Crisis contacts.

Shared frontend assets:

- `css/bundle.css`
- `js/apiClient.js` – Shared API client for talking to the backend.
- `js/storage.js` – Simple wrapper around `localStorage`.
- `js/ui-helpers.js` – Shared UI helpers (navbar loader, etc.).

You can serve the frontend with any static file server rooted at this `MindfulMe` directory, for example:

```bash
# From MindfulMe/
python -m http.server 5500
# Then open http://localhost:5500/ in your browser
```

Make sure the FastAPI backend is running on `http://localhost:8000` so pages that use the API (journal and AI therapist) work correctly.

