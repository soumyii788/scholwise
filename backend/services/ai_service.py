"""
Optional AI enhancement layer.

The scheduler above is the source of truth; AI only annotates or suggests.
If no AI_API_KEY is configured (or the API call fails), every function here
returns None and the app continues working normally.
"""

import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def ai_enabled():
    return bool(settings.AI_API_KEY)


def _chat(messages, max_tokens=700):
    """Call the OpenAI-compatible chat API. Returns text or None on failure."""
    if not ai_enabled():
        return None
    try:
        response = requests.post(
            settings.AI_API_URL,
            headers={
                "Authorization": f"Bearer {settings.AI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.AI_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.4,
            },
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"].strip()
    except (requests.RequestException, KeyError, IndexError, ValueError) as exc:
        logger.warning("AI request failed: %s", exc)
        return None


def _plan_context(plan_payload):
    """Compact JSON summary of the plan for prompting (keeps tokens low)."""
    return json.dumps(plan_payload, indent=1)[:4000]


def explain_plan(user, plan_payload):
    """AI explanation of why the plan looks the way it does. Returns str or None."""
    return _chat(
        [
            {
                "role": "system",
                "content": (
                    "You are a study coach. Explain the student's daily plan in at most "
                    "180 words. Cover: why the top subjects are prioritized (exam dates, "
                    "preparation levels, difficulty), then 2-3 concrete study tips. "
                    "Use short paragraphs. No bullet-point overload."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"My available time: {plan_payload.get('available_minutes', '?')} minutes.\n"
                    f"Subjects: {json.dumps(plan_payload.get('subjects', []))[:1500]}\n"
                    f"Today's plan: {_plan_context(plan_payload.get('sessions', []))}"
                ),
            },
        ]
    )


def improve_plan_suggestions(user, plan_payload):
    """
    AI suggestions for reordering/improving the plan. Returns a sanitized list
    of strings, or None. AI never mutates data directly - the frontend shows
    these as advice only.
    """
    raw = _chat(
        [
            {
                "role": "system",
                "content": (
                    "You are a study coach reviewing a generated study plan. Reply ONLY "
                    "with a JSON array of 3 to 5 short suggestion strings (max 40 words "
                    "each) about ordering, revision strategy, or study technique. "
                    "No markdown, no extra text."
                ),
            },
            {"role": "user", "content": f"Here is my plan:\n{_plan_context(plan_payload)}"},
        ],
        max_tokens=400,
    )
    if not raw:
        return None
    try:
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            suggestions = [str(item).strip()[:400] for item in parsed if str(item).strip()]
            return suggestions[:5] or None
    except (json.JSONDecodeError, ValueError):
        logger.warning("AI returned non-JSON suggestions; ignoring.")
    return None
