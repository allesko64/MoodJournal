# MindfulMe — Mental Wellness Companion

> A full-stack web application that combines journaling, mood analytics, multimodal emotion detection, and AI-powered reflections to support mental well-being.

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JavaScript-blue" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20(Python)-green" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini%20%7C%20Whisper%20%7C%20FER-orange" />
  <img src="https://img.shields.io/badge/Database-SQLite-lightgrey" />
</p>

---

## What Is MindfulMe?

MindfulMe is a private, browser-based mental health companion designed to help individuals track their moods, journal their thoughts through text and multimedia, and receive AI-driven insights — all while maintaining an offline-first, privacy-conscious approach.

It is built for **two audiences**: individuals seeking self-awareness between therapy sessions, and psychologists who (with patient consent) can review mood trends and journal themes to make sessions more productive.

---

## Key Features

| Feature | Description |
|---|---|
| **Multimedia Journaling** | Create entries with text, video, or audio recordings. Supports in-browser recording via the MediaRecorder API. |
| **Speech-to-Text Transcription** | Automatic transcription of audio/video entries using OpenAI Whisper with support for 10 languages (English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Spanish, French). |
| **Multimodal Emotion Detection** | Frame-by-frame facial emotion analysis (FER) on video entries and audio-based sentiment analysis via `multimodal-emotion-engine`. |
| **AI-Powered Insights** | Google Gemini generates reflective insights from journal content, transcriptions, and detected emotions. |
| **AI Therapist Chat** | Multi-turn conversational interface with Gemini acting as a supportive reflection partner — with contextual awareness of the latest journal entry. |
| **Mood Tracker** | Log daily mood (5-point scale) with contributing factors (sleep, exercise, nutrition, stress, social). Visualized with a 7-day line chart and 4-week calendar grid. |
| **Analytics Dashboard** | Wellness score (0–100), streaks, 30-day mood trend (Canvas chart), mood distribution, factor correlations, and week-over-week comparisons. |
| **Breathing Exercise** | Animated guided breathing (5s inhale / 5s exhale) with persistent breath counter. |
| **Crisis Resources** | One-tap access to emergency numbers and Indian mental health helplines (AASRA, iCall, Vandrevala, NIMHANS). |
| **Dark Mode** | System-aware theme toggle persisted via `localStorage`. |
| **Offline-First** | Journal and mood data fall back to `localStorage` when the backend is unreachable — no data lost. |
| **Responsive Design** | Mobile-friendly layout with breakpoints at 768px and 1024px, hamburger navigation on small screens. |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Browser (Frontend)                 │
│  Vanilla HTML/CSS/JS  ·  Multi-page  ·  localStorage │
└──────────────┬──────────────────┬────────────────────┘
               │  REST API        │  Offline fallback
               ▼                  ▼
┌──────────────────────┐   ┌──────────────┐
│   FastAPI Backend     │   │ localStorage │
│  ┌────────────────┐   │   └──────────────┘
│  │   SQLite DB     │   │
│  │ journal_entries │   │
│  │ emotion_logs    │   │
│  │ users/patients  │   │
│  └────────────────┘   │
│                        │
│  ┌────────────────┐   │
│  │  AI / ML Layer  │   │
│  │ Gemini API      │   │
│  │ Whisper (STT)   │   │
│  │ FER (video)     │   │
│  │ Emotion Engine  │   │
│  └────────────────┘   │
└────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Vanilla HTML5, CSS3, ES6+ JavaScript | Demonstrates strong fundamentals without framework abstractions |
| **Backend** | Python, FastAPI | Async-first, automatic OpenAPI docs, Pydantic validation |
| **Database** | SQLite | Zero-config, portable, sufficient for single-user workloads |
| **AI Chat & Insights** | Google Gemini 2.5 Flash | Low-latency generative AI with multi-turn conversation support |
| **Speech-to-Text** | OpenAI Whisper | State-of-the-art multilingual transcription model |
| **Emotion Detection** | FER (Facial Emotion Recognition), multimodal-emotion-engine | Real-time emotion analysis from video frames and audio |
| **Testing** | Pytest + FastAPI TestClient | Unit and integration tests for backend API |

---

## What This Project Demonstrates

### Software Engineering

- **Full-stack ownership** — Designed and built both the frontend and backend from scratch, including database schema, REST API, and UI.
- **Clean separation of concerns** — Modular JS files (`apiClient.js`, `storage.js`, `ui-helpers.js`) keep shared logic reusable; backend uses Pydantic models and settings classes for configuration.
- **Graceful degradation** — The app detects backend unavailability and seamlessly falls back to `localStorage`, ensuring users never lose data.
- **Progressive enhancement** — Optional ML dependencies (emotion engine, Whisper) are loaded with `try/except` guards; the app works with or without them.
- **Database migrations** — `ALTER TABLE` migration in `database.py` ensures schema evolution without data loss on existing databases.
- **CORS and security** — API keys stay server-side; CORS is locked to specific origins; Pydantic validates all API inputs.

### AI / ML Integration

- **Multi-model orchestration** — A single journal entry can trigger Whisper (transcription), FER (video emotion), audio emotion analysis, and Gemini (AI insights) in a coordinated pipeline.
- **Prompt engineering** — Carefully crafted system prompts ensure the AI therapist stays empathetic, non-prescriptive, and crisis-aware.
- **Context-aware conversations** — The chat interface injects the latest journal entry (title, snippet, AI insights) as context for more meaningful AI responses.
- **Multilingual support** — Whisper transcription covers 10 languages, making the app accessible to a broader user base.

### Frontend & UX

- **No framework, full polish** — Built with vanilla HTML/CSS/JS to demonstrate mastery of web fundamentals while delivering a modern, animated UI.
- **Canvas-based data visualization** — Dashboard charts (mood trends, distributions) are rendered directly on `<canvas>` without chart libraries.
- **Component-like architecture** — Shared navbar loaded via `fetch()` from an HTML partial, simulating component reuse without a framework.
- **Accessibility and responsiveness** — Semantic HTML, responsive breakpoints, and mobile-first hamburger navigation.
- **Microinteractions** — Toast notifications, typing indicators, breathing animations, slide-in chat messages, and smooth scroll transitions.

### Domain Understanding

- **Ethical AI design** — Clear disclaimers that MindfulMe does not replace professional therapy; crisis situations always redirect to helplines.
- **Dual-user design** — Architected for both individuals and psychologists, with a database schema that supports patient-clinician relationships.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/journal` | Create a journal entry (text + optional media upload) |
| `GET` | `/api/journals` | List all journal entries |
| `GET` | `/api/journal/{id}/emotions` | Retrieve emotion analysis for an entry |
| `GET` | `/api/journal/{id}/insights` | Get or generate AI insights (cached in DB) |
| `DELETE` | `/api/journal/{id}` | Delete a journal entry |
| `POST` | `/api/chat` | Send a message to the AI therapist (multi-turn) |

---

## Getting Started

### Prerequisites

- Python 3.10+
- A Google Gemini API key ([get one here](https://aistudio.google.com/apikey))

### Backend

```bash
cd MindfulMe/backend
pip install -r requirements.txt

# Create a .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd MindfulMe
python -m http.server 5500
# Open http://localhost:5500 in your browser
```

---

## Project Structure

```
MindfulMe/
├── index.html                 # Landing page
├── pages/
│   ├── dashboard.html         # Analytics dashboard
│   ├── mood-tracker.html      # Mood logging & visualization
│   ├── journal.html           # Multimedia journaling
│   ├── ai-therapist.html      # AI chat interface
│   ├── resources.html         # Guided exercises & articles
│   └── crisis.html            # Emergency contacts & helplines
├── js/
│   ├── apiClient.js           # Centralized API communication layer
│   ├── storage.js             # localStorage abstraction
│   ├── ui-helpers.js          # Shared UI utilities (navbar, theme)
│   ├── dashboard.js           # Canvas charts & analytics logic
│   ├── journal.js             # Journal CRUD, recording, emotion display
│   ├── mood-tracker.js        # Mood entry, calendar, charts
│   ├── ai-therapist.js        # Multi-turn chat with Gemini
│   └── breathing.js           # Breathing exercise animation
├── css/
│   └── bundle.css             # Complete stylesheet (~3500 lines)
├── partials/
│   └── navbar.html            # Reusable navigation component
└── backend/
    ├── main.py                # FastAPI application (routes, ML pipeline)
    ├── database.py            # SQLite schema & initialization
    ├── requirements.txt       # Python dependencies
    └── test_chat.py           # API test suite
```

---

## Future Roadmap

- User authentication and encrypted data storage
- Export journal & mood data as PDF reports for therapy sessions
- Push notification reminders for mood check-ins
- Progressive Web App (PWA) support for offline mobile use
- Psychologist dashboard with aggregated patient insights

---

## License

This project is for educational and portfolio purposes.
