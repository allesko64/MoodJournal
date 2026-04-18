"""
wellness_service.py — Combine facial emotion + text sentiment into a wellness summary.

Single responsibility: given the outputs of emotion_detector and sentiment_analyzer,
produce a human-readable wellness state + actionable recommendations.
"""
from typing import Any


# ---------------------------------------------------------------------------
# Recommendation bank
# ---------------------------------------------------------------------------
_RECS_DISTRESSED = [
    "Try a 5-minute box-breathing exercise: inhale 4s → hold 4s → exhale 4s → hold 4s.",
    "Reach out to someone you trust — even a brief chat can lighten the load.",
    "Step outside for a short walk; sunlight and movement help regulate mood.",
    "Consider journaling your thoughts in writing to externalize what you're feeling.",
]

_RECS_POSITIVE = [
    "Great emotional check-in! Keep nurturing what's making you feel good today.",
    "Share your positivity — telling someone about a win compounds the good feeling.",
    "Reflect on what contributed to this mood and note it for tougher days ahead.",
]

_RECS_NEUTRAL = [
    "A consistent journaling habit builds emotional self-awareness over time.",
    "A short mindfulness or breathing break can help maintain balance.",
    "Notice one thing you're grateful for today — even something small counts.",
    "Light physical activity can uplift a neutral mood with minimal effort.",
]


def generate_wellness_summary(
    emotion_analysis: dict[str, Any],
    sentiment_analysis: dict[str, Any],
) -> dict[str, Any]:
    """
    Combine emotion + sentiment signals into a structured wellness summary.

    Args:
        emotion_analysis: Output dict from emotion_detector.analyze_video().
        sentiment_analysis: Output dict from sentiment_analyzer.analyze_sentiment().

    Returns:
        {
            "state": "Distressed" | "Positive" | "Neutral",
            "indicator": str,        # emoji + short description
            "recommendations": list[str],
            "emotional_intensity": float,
            "sentiment_score": float,
        }
    """
    dominant_emotion: str = (emotion_analysis.get("dominant_emotion") or "neutral").lower()
    emotional_intensity: float = float(emotion_analysis.get("emotional_intensity") or 0.0)
    sentiment_score: float = float(sentiment_analysis.get("sentiment_score") or 0.0)

    # --- Classify wellness state ---
    if emotional_intensity > 0.7 and sentiment_score < -0.5:
        state = "Distressed"
        indicator = "⚠️ High emotional intensity with negative sentiment detected."
        recs = _RECS_DISTRESSED[:3]

    elif dominant_emotion == "happy" and sentiment_score > 0.5:
        state = "Positive"
        indicator = "✅ Good emotional well-being — your mood and words align positively."
        recs = _RECS_POSITIVE

    elif emotional_intensity < 0.4 and abs(sentiment_score) < 0.3:
        state = "Neutral"
        indicator = "ℹ️ Balanced emotional state — calm and measured."
        recs = _RECS_NEUTRAL[:2]

    elif sentiment_score < -0.3:
        state = "Low Mood"
        indicator = "🔵 Some negative sentiment detected — gentle self-care recommended."
        recs = _RECS_DISTRESSED[0:2] + _RECS_NEUTRAL[:1]

    else:
        state = "Neutral"
        indicator = "ℹ️ Mixed or balanced emotional signals detected."
        recs = _RECS_NEUTRAL[:3]

    return {
        "state": state,
        "indicator": indicator,
        "recommendations": recs,
        "emotional_intensity": round(emotional_intensity, 3),
        "sentiment_score": round(sentiment_score, 3),
    }
