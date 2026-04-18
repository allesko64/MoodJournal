"""
AI service — wraps OpenRouter API calls.
No FastAPI imports. Easy to swap the provider later.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()


def get_ai_reply(history: list) -> str:
    """
    Send a multi-turn chat history to an AI service (Gemini or OpenRouter) and return the assistant reply.
    Raises RuntimeError on configuration or API errors.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")

    if gemini_key:
        contents = []
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            text = msg.get("parts", [{}])[0].get("text", "")
            contents.append({"role": role, "parts": [{"text": text}]})
            
        payload = {"contents": contents}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
        
        # Google's API can occasionally throw transient 503s, so we attempt up to 3 times
        import time
        for attempt in range(3):
            response = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            if response.status_code in (500, 502, 503, 504) and attempt < 2:
                time.sleep(1.5)  # wait before retry
                continue
                
            response.raise_for_status()
            result = response.json()
            return result["candidates"][0]["content"]["parts"][0]["text"]

    # Fallback to OpenRouter
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "openrouter/free")

    if not api_key:
        raise RuntimeError("Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured in .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "MindfulMe",
        "Content-Type": "application/json",
    }

    messages = []
    for msg in history:
        role = msg.get("role")
        text = msg.get("parts", [{}])[0].get("text", "")
        if role == "user":
            messages.append({"role": "user", "content": text})
        elif role == "model":
            messages.append({"role": "assistant", "content": text})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1000,
    }

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()
    return result["choices"][0]["message"]["content"]


def generate_insights(content: str) -> str:
    """
    Generate AI insights for a journal entry content using OpenRouter.
    Falls back to a simple rule-based insight if the API is unavailable.
    """
    try:
        history = [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "You are a compassionate mental health reflection assistant. "
                            "Read the following journal entry and provide 2-3 short, empathetic insights "
                            "that help the person reflect on their emotions and patterns. "
                            "Be warm, non-judgmental, and concise.\n\n"
                            f"Journal entry:\n{content}"
                        )
                    }
                ],
            }
        ]
        return get_ai_reply(history)
    except Exception:
        # Rule-based fallback
        low = content.lower()
        if any(w in low for w in ["happy", "joy", "great", "amazing"]):
            return "Your entry reflects positive emotions. Consider what contributed to this good mood and how to nurture it."
        if any(w in low for w in ["sad", "upset", "terrible", "awful"]):
            return "Your entry shows some difficult emotions. It's okay to feel this way — consider reaching out for support if needed."
        if any(w in low for w in ["anxious", "worried", "stress", "overwhelmed"]):
            return "You mentioned anxiety or worry. Try some deep breathing exercises or grounding techniques to help manage these feelings."
        return "Take a moment to reflect on your entry. Writing helps process emotions and gain clarity."
