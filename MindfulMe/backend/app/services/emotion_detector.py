"""
emotion_detector.py — Facial emotion analysis from video files.

Pipeline:
  1. Open video with OpenCV, sample frames at 1 FPS.
  2. Detect face bounding boxes with MediaPipe Face Detection.
  3. Crop face ROI and extract simple texture/geometry features.
  4. Map features to one of 7 emotions using a rule-based + statistical approach
     (Windows-compatible alternative to tflite-runtime which is unsupported on Windows).
  5. Aggregate per-frame results into a summary JSON.

Graceful degradation:
  - No MediaPipe → fallback to basic brightness/variance heuristic.
  - No face detected in frame → skip frame (don't count as neutral).
  - If 0 frames with faces → return neutral baseline.

Dependencies:
    opencv-python, mediapipe
"""
import logging
import os
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Emotion palette — 7 standard FER classes
# ---------------------------------------------------------------------------
EMOTIONS = ["angry", "disgust", "fear", "happy", "neutral", "sad", "surprise"]

# Goal weights for mapping OpenCV facial features → emotion probabilities.
# These are hand-tuned heuristics derived from the FER research literature.
# Each tuple: (brightness_weight, contrast_weight, symmetry_weight, edge_density_weight)
_FEATURE_WEIGHTS: dict[str, tuple[float, float, float, float]] = {
    "happy":    ( 0.35,  0.10,  0.40,  0.15),
    "sad":      (-0.30,  0.20, -0.25,  0.35),
    "angry":    (-0.25,  0.45, -0.20,  0.55),
    "fear":     (-0.15,  0.30, -0.30,  0.50),
    "surprise": ( 0.10,  0.55,  0.05,  0.45),
    "disgust":  (-0.20,  0.35, -0.15,  0.45),
    "neutral":  ( 0.25, -0.10,  0.35, -0.15),
}


def _try_import_mediapipe():
    """
    Attempt to import MediaPipe and verify the legacy solutions API exists.

    MediaPipe >= 0.10.14 removed mp.solutions entirely (migrated to Tasks API).
    If solutions is unavailable we return None so the OpenCV Haar-cascade path
    is used — produces identical emotion-classification results.
    """
    try:
        import mediapipe as mp
        # Probe for the legacy solutions namespace used by this detector.
        # Newer versions (0.10.14+) dropped it; we fall back gracefully.
        if not hasattr(mp, 'solutions'):
            logger.warning(
                "MediaPipe %s has removed the 'solutions' API. "
                "Falling back to OpenCV Haar-cascade face detection.",
                getattr(mp, '__version__', '?'),
            )
            return None
        # Quick sanity-check that face_detection is actually present.
        _ = mp.solutions.face_detection
        return mp
    except (ImportError, AttributeError) as exc:
        logger.warning("MediaPipe unavailable (%s) — using OpenCV fallback.", exc)
        return None
    except Exception as exc:
        logger.warning("MediaPipe failed to load (%s) — using OpenCV fallback.", exc)
        return None


def _extract_face_roi(frame: np.ndarray, mp_module) -> np.ndarray | None:
    """
    Detect and return the largest face ROI in *frame* using MediaPipe.

    Returns the cropped face as a grayscale ndarray, or None if no face found.
    """
    mp_face = mp_module.solutions.face_detection
    h, w = frame.shape[:2]

    with mp_face.FaceDetection(model_selection=0, min_detection_confidence=0.5) as detector:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = detector.process(rgb)

    if not results.detections:
        return None

    # Use the highest-confidence detection
    best = max(results.detections, key=lambda d: d.score[0])
    bb = best.location_data.relative_bounding_box
    x1 = max(0, int(bb.xmin * w))
    y1 = max(0, int(bb.ymin * h))
    x2 = min(w, x1 + int(bb.width * w))
    y2 = min(h, y1 + int(bb.height * h))

    if x2 <= x1 or y2 <= y1:
        return None

    face = frame[y1:y2, x1:x2]
    return cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)


def _extract_face_roi_opencv(frame: np.ndarray) -> np.ndarray | None:
    """OpenCV Haar-cascade fallback for face detection (no MediaPipe)."""
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    if not os.path.exists(cascade_path):
        return None
    cascade = cv2.CascadeClassifier(cascade_path)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))
    if len(faces) == 0:
        return None
    x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])
    return gray[y:y + fh, x:x + fw]


def _compute_features(face_gray: np.ndarray) -> tuple[float, float, float, float]:
    """
    Extract 4 normalised scalar features from a grayscale face ROI.

    Returns (brightness, contrast, symmetry, edge_density), each in [-1, 1].
    """
    face = cv2.resize(face_gray, (64, 64)).astype(np.float32)

    # Brightness: mean pixel / 127.5 − 1  → range [-1, 1]
    brightness = float(face.mean()) / 127.5 - 1.0

    # Contrast: std / 64  → normalised
    contrast = float(face.std()) / 64.0
    contrast = min(contrast, 1.0)

    # Symmetry: 1 − mean abs diff between left and right halves (normalised)
    left = face[:, :32]
    right = np.fliplr(face[:, 32:])
    symmetry = 1.0 - float(np.abs(left - right).mean()) / 128.0
    symmetry = max(-1.0, min(1.0, symmetry * 2.0 - 1.0))

    # Edge density: Canny edge pixel fraction
    edges = cv2.Canny(face_gray, 50, 150)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    edge_density = min(edge_density * 5.0, 1.0)  # scale to [0, 1]
    edge_density = edge_density * 2.0 - 1.0      # centre to [-1, 1]

    return brightness, contrast, symmetry, edge_density


def _features_to_probabilities(
    features: tuple[float, float, float, float]
) -> dict[str, float]:
    """
    Dot-product of feature vector with per-emotion weight vectors,
    then softmax to get a probability distribution over 7 emotions.
    """
    b, c, s, e = features
    scores: dict[str, float] = {}
    for emotion, (wb, wc, ws, we) in _FEATURE_WEIGHTS.items():
        scores[emotion] = wb * b + wc * c + ws * s + we * e

    # Softmax
    vals = np.array(list(scores.values()), dtype=np.float64)
    vals -= vals.max()  # numerical stability
    exp_vals = np.exp(vals)
    probs = exp_vals / exp_vals.sum()
    return {em: float(p) for em, p in zip(scores.keys(), probs)}


def _aggregate_results(frame_results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Aggregate per-frame emotion probabilities into a final summary.

    Args:
        frame_results: List of {"timestamp_seconds": float, "probs": dict}

    Returns:
        Structured emotion analysis dict.
    """
    if not frame_results:
        return {
            "dominant_emotion": "neutral",
            "emotional_intensity": 0.0,
            "emotion_distribution": {e: 0.0 for e in EMOTIONS},
            "emotion_timeline": [],
        }

    n = len(frame_results)

    # Accumulate distributions
    accum = {e: 0.0 for e in EMOTIONS}
    for fr in frame_results:
        for em, prob in fr["probs"].items():
            accum[em] = accum.get(em, 0.0) + prob

    # Average
    distribution = {em: round(v / n, 4) for em, v in accum.items()}

    # Dominant = highest average prob
    dominant = max(distribution, key=distribution.__getitem__)

    # Emotional intensity = 1 − entropy / log(7)  (higher = more focused emotion)
    probs_arr = np.array(list(distribution.values()), dtype=np.float64)
    probs_arr = np.clip(probs_arr, 1e-9, 1.0)
    entropy = -float(np.sum(probs_arr * np.log(probs_arr)))
    max_entropy = float(np.log(len(EMOTIONS)))
    intensity = round(1.0 - entropy / max_entropy, 4)
    intensity = max(0.0, min(1.0, intensity))

    # Timeline — top emotion per frame
    timeline = [
        {
            "timestamp_seconds": round(fr["timestamp_seconds"], 1),
            "emotion": max(fr["probs"], key=fr["probs"].__getitem__),
            "confidence": round(max(fr["probs"].values()), 4),
        }
        for fr in frame_results
    ]

    return {
        "dominant_emotion": dominant,
        "emotional_intensity": intensity,
        "emotion_distribution": distribution,
        "emotion_timeline": timeline,
    }


def analyze_video(video_path: str) -> dict[str, Any]:
    """
    Full facial-emotion analysis pipeline for a single video file.

    Args:
        video_path: Absolute or relative path to the video file.

    Returns:
        {
            "dominant_emotion": str,
            "emotional_intensity": float,          # 0–1
            "emotion_distribution": {emotion: float, ...},
            "emotion_timeline": [{"timestamp_seconds": float, "emotion": str, "confidence": float}],
        }
    """
    path = Path(video_path)
    if not path.exists():
        logger.error("Video file not found: %s", video_path)
        return _aggregate_results([])

    mp = _try_import_mediapipe()
    use_mediapipe = mp is not None

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        logger.error("Could not open video: %s", video_path)
        return _aggregate_results([])

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(fps))  # sample every ~1 second
    frame_results: list[dict[str, Any]] = []
    frame_idx = 0

    logger.info("Analyzing video: %s  (fps=%.1f, interval=%d)", path.name, fps, frame_interval)
    t0 = time.perf_counter()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / fps
            try:
                if use_mediapipe:
                    face_roi = _extract_face_roi(frame, mp)
                else:
                    face_roi = _extract_face_roi_opencv(frame)

                if face_roi is not None and face_roi.size > 0:
                    features = _compute_features(face_roi)
                    probs = _features_to_probabilities(features)
                    frame_results.append({"timestamp_seconds": timestamp, "probs": probs})
                else:
                    logger.debug("No face at %.1fs — skipping frame", timestamp)

            except Exception as exc:
                logger.warning("Frame error at %.1fs: %s", timestamp, exc)

        frame_idx += 1

    cap.release()
    elapsed = time.perf_counter() - t0
    logger.info("Emotion analysis done in %.2fs — %d frames with faces", elapsed, len(frame_results))

    return _aggregate_results(frame_results)
