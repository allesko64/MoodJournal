"""
sentiment_analyzer.py — Sentiment analysis using DistilBERT quantized to INT8 via ONNX Runtime.

Pipeline:
  1. On first run: download distilbert-base-uncased-finetuned-sst-2-english,
     export to ONNX, quantize to INT8 via onnxruntime. Cached to models/.
  2. On subsequent runs: load cached INT8 ONNX model directly (fast, ~67 MB).
  3. Split long transcripts into overlapping windows, analyse each, aggregate.
  4. Output structured JSON with sentiment score, distribution, key phrases, arc.

Graceful degradation:
  - transformers/onnxruntime not installed → return neutral baseline.
  - Empty transcript → return neutral with empty key_phrases.

Dependencies:
    transformers, onnxruntime, optimum
"""
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Model identifiers
_HF_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"
_ONNX_MODEL_FILENAME = "distilbert_int8.onnx"

# Chunk settings for long transcripts
_MAX_TOKENS = 512
_CHUNK_WORDS = 80   # approximate words per chunk
_OVERLAP_WORDS = 10


def _get_model_cache_dir() -> Path:
    """Resolve MODEL_CACHE_DIR from config without creating a circular import."""
    try:
        from app.config import MODEL_CACHE_DIR  # type: ignore[import]
        return MODEL_CACHE_DIR
    except ImportError:
        p = Path(__file__).parent.parent.parent / "models"
        p.mkdir(parents=True, exist_ok=True)
        return p


def _neutral_result(transcript: str = "") -> dict[str, Any]:
    """Return a safe neutral baseline when analysis cannot run."""
    return {
        "overall_sentiment": "neutral",
        "sentiment_score": 0.0,
        "distribution": {"positive": 0.33, "neutral": 0.34, "negative": 0.33},
        "key_phrases": [],
        "sentiment_arc": [],
    }


def _export_and_quantize(model_dir: Path) -> Path:
    """
    Download HuggingFace DistilBERT, export to ONNX, quantize INT8.
    Returns path to the INT8 ONNX file.
    """
    onnx_path = model_dir / _ONNX_MODEL_FILENAME

    logger.info("Exporting DistilBERT to ONNX (this runs once, ~1–2 minutes)…")
    try:
        from optimum.onnxruntime import ORTModelForSequenceClassification  # type: ignore[import]
        from optimum.onnxruntime.configuration import AutoQuantizationConfig  # type: ignore[import]
        from optimum.onnxruntime import ORTQuantizer  # type: ignore[import]
        from pathlib import Path as _Path

        # Export to ONNX
        onnx_export_dir = model_dir / "distilbert_onnx_export"
        ort_model = ORTModelForSequenceClassification.from_pretrained(
            _HF_MODEL, export=True
        )
        ort_model.save_pretrained(str(onnx_export_dir))

        # Quantize to INT8
        quantizer = ORTQuantizer.from_pretrained(str(onnx_export_dir))
        qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)
        quantizer.quantize(
            save_dir=str(model_dir / "distilbert_int8_dir"),
            quantization_config=qconfig,
        )

        # The quantized model file
        quantized_file = model_dir / "distilbert_int8_dir" / "model_quantized.onnx"
        if quantized_file.exists():
            import shutil
            shutil.copy(quantized_file, onnx_path)
            logger.info("INT8 model saved to %s", onnx_path)
        else:
            # Fallback: use un-quantized ONNX if quantization artifacts differ
            unquantized = onnx_export_dir / "model.onnx"
            if unquantized.exists():
                import shutil
                shutil.copy(unquantized, onnx_path)
                logger.warning("Using un-quantized ONNX (quantization artifact not found).")

    except Exception as exc:
        logger.error("ONNX export/quantization failed: %s — falling back to pipeline.", exc)
        onnx_path = Path("")  # signal failure

    return onnx_path


def _load_pipeline_fallback():
    """
    Use transformers pipeline directly as a fallback (no ONNX quantization).
    Returns a callable(text) -> {"label": str, "score": float} or None.
    """
    try:
        from transformers import pipeline  # type: ignore[import]
        pipe = pipeline("sentiment-analysis", model=_HF_MODEL)
        logger.info("Loaded DistilBERT via transformers pipeline (non-ONNX fallback).")
        return pipe
    except ImportError:
        logger.error("transformers not installed. Run: pip install transformers")
        return None
    except Exception as exc:
        logger.error("Could not load sentiment pipeline: %s", exc)
        return None


class _SentimentModel:
    """Lazy singleton that caches the ONNX session + tokenizer."""

    _instance = None

    def __init__(self):
        self._ort_session = None
        self._tokenizer = None
        self._pipeline = None
        self._id2label: dict[int, str] = {0: "NEGATIVE", 1: "POSITIVE"}

    @classmethod
    def get(cls) -> "_SentimentModel":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance._load()
        return cls._instance

    def _load(self) -> None:
        """Try ONNX first, then transformers pipeline fallback."""
        model_dir = _get_model_cache_dir()
        onnx_path = model_dir / _ONNX_MODEL_FILENAME

        # Attempt ONNX path
        if not onnx_path.exists():
            onnx_path = _export_and_quantize(model_dir)

        if onnx_path.exists() and onnx_path.stat().st_size > 0:
            try:
                import onnxruntime as ort  # type: ignore[import]
                from transformers import AutoTokenizer  # type: ignore[import]

                self._ort_session = ort.InferenceSession(
                    str(onnx_path),
                    providers=["CPUExecutionProvider"],
                )
                self._tokenizer = AutoTokenizer.from_pretrained(_HF_MODEL)
                logger.info("ONNX INT8 DistilBERT loaded from %s", onnx_path)
                return
            except Exception as exc:
                logger.warning("ONNX session failed (%s) — using pipeline fallback.", exc)

        # Fallback
        self._pipeline = _load_pipeline_fallback()

    def predict(self, text: str) -> dict[str, float]:
        """
        Returns {"positive": float, "negative": float} probabilities for *text*.
        Probabilities sum to 1.0.
        """
        if not text or not text.strip():
            return {"positive": 0.5, "negative": 0.5}

        try:
            if self._ort_session and self._tokenizer:
                return self._predict_onnx(text)
            elif self._pipeline:
                return self._predict_pipeline(text)
        except Exception as exc:
            logger.warning("Prediction error: %s", exc)
        return {"positive": 0.5, "negative": 0.5}

    def _predict_onnx(self, text: str) -> dict[str, float]:
        """Run ONNX inference."""
        import numpy as np
        inputs = self._tokenizer(
            text,
            return_tensors="np",
            max_length=512,
            truncation=True,
            padding=True,
        )
        ort_inputs = {k: v for k, v in inputs.items() if k in
                      [inp.name for inp in self._ort_session.get_inputs()]}
        logits = self._ort_session.run(None, ort_inputs)[0][0]
        # Softmax
        exp_l = np.exp(logits - logits.max())
        probs = exp_l / exp_l.sum()
        labels = [i.name.lower() for i in self._ort_session.get_outputs()]
        # DistilBERT SST-2: index 0=NEGATIVE, 1=POSITIVE
        return {"negative": float(probs[0]), "positive": float(probs[1])}

    def _predict_pipeline(self, text: str) -> dict[str, float]:
        """Run HuggingFace pipeline inference."""
        result = self._pipeline(text[:512])[0]
        label = result["label"].lower()
        score = float(result["score"])
        if label == "positive":
            return {"positive": score, "negative": 1.0 - score}
        else:
            return {"positive": 1.0 - score, "negative": score}


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

def _chunk_text(text: str, chunk_words: int = _CHUNK_WORDS, overlap: int = _OVERLAP_WORDS) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    if not words:
        return []
    chunks = []
    step = max(1, chunk_words - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i: i + chunk_words])
        if chunk.strip():
            chunks.append(chunk.strip())
    return chunks


def _extract_key_phrases(text: str, n: int = 5) -> list[str]:
    """
    Simple heuristic key-phrase extraction: return n most emotionally salient bigrams/trigrams.
    No external NLP library required.
    """
    NEGATIVE_SEEDS = {
        "feel", "lonely", "alone", "down", "sad", "tired", "anxious", "worried",
        "stress", "stressed", "depressed", "hopeless", "lost", "afraid", "scared",
        "angry", "upset", "hurt", "disappointed", "overwhelmed", "frustrated",
    }
    POSITIVE_SEEDS = {
        "happy", "great", "good", "excited", "wonderful", "amazing", "grateful",
        "thankful", "proud", "joyful", "calm", "peaceful", "better", "love",
    }

    words = re.findall(r"[a-zA-Z']+", text.lower())
    phrases: list[tuple[str, int]] = []

    for i, w in enumerate(words):
        if w in NEGATIVE_SEEDS or w in POSITIVE_SEEDS:
            # Grab up to 3-word window centred on the seed word
            start = max(0, i - 1)
            end = min(len(words), i + 2)
            phrase = " ".join(words[start:end])
            phrases.append((phrase, 1))

    # Deduplicate preserving order
    seen: set[str] = set()
    result: list[str] = []
    for phrase, _ in phrases:
        if phrase not in seen:
            seen.add(phrase)
            result.append(phrase)
        if len(result) >= n:
            break
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_sentiment(text: str) -> dict[str, Any]:
    """
    Analyse the sentiment of a transcript string.

    Args:
        text: Full transcript text from transcriber.

    Returns:
        {
            "overall_sentiment": "positive" | "neutral" | "negative",
            "sentiment_score": float,        # −1.0 (most negative) … +1.0 (most positive)
            "distribution": {"positive": float, "neutral": float, "negative": float},
            "key_phrases": list[str],
            "sentiment_arc": [[position_0_to_1, score], ...],
        }
    """
    if not text or not text.strip():
        logger.info("Empty transcript — returning neutral sentiment.")
        return _neutral_result()

    t0 = time.perf_counter()
    model = None
    try:
        model = _SentimentModel.get()
    except Exception as exc:
        logger.error("Could not initialise sentiment model: %s", exc)
        return _neutral_result()

    chunks = _chunk_text(text)
    if not chunks:
        return _neutral_result()

    chunk_probs: list[dict[str, float]] = []
    for chunk in chunks:
        try:
            probs = model.predict(chunk)
            chunk_probs.append(probs)
        except Exception as exc:
            logger.warning("Chunk prediction error: %s", exc)

    if not chunk_probs:
        return _neutral_result()

    # Average positive/negative probabilities
    avg_pos = sum(p["positive"] for p in chunk_probs) / len(chunk_probs)
    avg_neg = sum(p["negative"] for p in chunk_probs) / len(chunk_probs)

    # Sentiment score: +1 = fully positive, -1 = fully negative
    sentiment_score = round(float(avg_pos - avg_neg), 4)

    # Threshold-based label
    if sentiment_score > 0.2:
        overall = "positive"
    elif sentiment_score < -0.2:
        overall = "negative"
    else:
        overall = "neutral"

    # Distribution (pos/neu/neg summing to 1)
    neutral_mass = max(0.0, 1.0 - avg_pos - avg_neg)
    distribution = {
        "positive": round(avg_pos, 4),
        "neutral":  round(neutral_mass, 4),
        "negative": round(avg_neg, 4),
    }

    # Sentiment arc: list of [position (0–1), score] per chunk
    arc = [
        [round(i / max(1, len(chunk_probs) - 1), 3),
         round(p["positive"] - p["negative"], 4)]
        for i, p in enumerate(chunk_probs)
    ]

    key_phrases = _extract_key_phrases(text, n=6)

    elapsed = time.perf_counter() - t0
    logger.info(
        "Sentiment analysis done in %.2fs — score=%.3f (%s)",
        elapsed, sentiment_score, overall,
    )

    return {
        "overall_sentiment": overall,
        "sentiment_score": sentiment_score,
        "distribution": distribution,
        "key_phrases": key_phrases,
        "sentiment_arc": arc,
    }
