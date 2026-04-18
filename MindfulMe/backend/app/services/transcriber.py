"""
transcriber.py — Speech-to-text transcription using OpenAI Whisper (tiny model).

Pipeline:
  1. Extract audio from video using ffmpeg (subprocess) → temp WAV file.
  2. Transcribe with whisper.load_model("tiny").
  3. Return structured JSON with full transcript + segment timestamps.

Graceful degradation:
  - No audio stream → return empty transcript dict.
  - Whisper not installed → log error + return empty dict.
  - ffmpeg not found → attempt to use moviepy as fallback.

Dependencies:
    openai-whisper, ffmpeg (on PATH) or moviepy
"""
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Whisper model size — "tiny" ≈ 39 MB disk, fastest inference
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "tiny")


def _extract_audio_ffmpeg(video_path: str, audio_path: str) -> bool:
    """
    Use ffmpeg to extract a 16 kHz mono WAV from *video_path* into *audio_path*.

    Returns True on success, False if ffmpeg is unavailable or fails.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",                    # drop video stream
        "-acodec", "pcm_s16le",  # PCM WAV
        "-ar", "16000",           # 16 kHz (Whisper requirement)
        "-ac", "1",               # mono
        audio_path,
    ]
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors="ignore")
            if "Output file does not contain any stream" in err or "Invalid data" in err:
                logger.warning("Video has no audio stream: %s", video_path)
            else:
                logger.warning("ffmpeg error: %s", err[:400])
            return False
        return True
    except FileNotFoundError:
        logger.warning("ffmpeg not found on PATH — trying moviepy fallback.")
        return False
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out extracting audio from %s", video_path)
        return False


def _extract_audio_moviepy(video_path: str, audio_path: str) -> bool:
    """Fallback: use moviepy to write audio when ffmpeg is unavailable."""
    try:
        from moviepy.editor import VideoFileClip  # type: ignore[import]

        clip = VideoFileClip(video_path)
        if clip.audio is None:
            logger.warning("moviepy: no audio track in %s", video_path)
            clip.close()
            return False
        clip.audio.write_audiofile(audio_path, fps=16000, nbytes=2, codec="pcm_s16le", logger=None)
        clip.close()
        return True
    except ImportError:
        logger.error("Neither ffmpeg nor moviepy available — cannot extract audio.")
        return False
    except Exception as exc:
        logger.error("moviepy audio extraction failed: %s", exc)
        return False


def _load_whisper():
    """Load and cache the Whisper model. Returns model or None."""
    try:
        import whisper  # type: ignore[import]
        model = whisper.load_model(WHISPER_MODEL_SIZE)
        logger.info("Whisper '%s' model loaded.", WHISPER_MODEL_SIZE)
        return model, whisper
    except ImportError:
        logger.error("openai-whisper not installed. Run: pip install openai-whisper")
        return None, None
    except Exception as exc:
        logger.error("Failed to load Whisper model: %s", exc)
        return None, None


def _empty_transcript() -> dict[str, Any]:
    """Return a consistent 'no audio' response."""
    return {
        "full_transcript": "",
        "language": "unknown",
        "segments": [],
    }


def transcribe_video(video_path: str) -> dict[str, Any]:
    """
    Transcribe the speech in a video file using Whisper tiny.

    Args:
        video_path: Path to video file (webm, mp4, etc.).

    Returns:
        {
            "full_transcript": str,
            "language": str,          # detected ISO-639-1 code, e.g. "en"
            "segments": [
                {"start_time": float, "end_time": float, "text": str}, ...
            ],
        }
    """
    path = Path(video_path)
    if not path.exists():
        logger.error("Video file not found for transcription: %s", video_path)
        return _empty_transcript()

    t0 = time.perf_counter()

    # --- Extract audio to a temp WAV ---
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_path = tmp.name

    try:
        success = _extract_audio_ffmpeg(str(path), audio_path)
        if not success:
            success = _extract_audio_moviepy(str(path), audio_path)
        if not success:
            return _empty_transcript()

        # Verify temp WAV was actually written with content
        if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 1024:
            logger.warning("Extracted audio file is empty or missing — no audio in video.")
            return _empty_transcript()

        # --- Whisper transcription ---
        model, whisper_lib = _load_whisper()
        if model is None:
            return _empty_transcript()

        logger.info("Starting Whisper transcription for %s", path.name)
        result = model.transcribe(audio_path, fp16=False)

        elapsed = time.perf_counter() - t0
        logger.info("Transcription completed in %.2fs", elapsed)

        full_text: str = (result.get("text") or "").strip()
        language: str = result.get("language") or "unknown"

        raw_segments = result.get("segments") or []
        segments = [
            {
                "start_time": round(seg.get("start", 0.0), 2),
                "end_time": round(seg.get("end", 0.0), 2),
                "text": (seg.get("text") or "").strip(),
            }
            for seg in raw_segments
            if (seg.get("text") or "").strip()
        ]

        return {
            "full_transcript": full_text,
            "language": language,
            "segments": segments,
        }

    except Exception as exc:
        logger.error("Transcription error: %s", exc)
        return _empty_transcript()
    finally:
        # Always clean up temp wav
        if os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except OSError:
                pass
