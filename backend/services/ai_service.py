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


def _normalize_api_url():
    raw = (getattr(settings, "AI_API_URL", "") or "").strip().rstrip("/")
    if not raw:
        return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    if not raw.endswith("/chat/completions"):
        return f"{raw}/chat/completions"
    return raw


def _chat(messages, max_tokens=1000):
    """Call the OpenAI-compatible chat API. Returns text or None on failure."""
    if not ai_enabled():
        return None

    api_url = _normalize_api_url()
    primary_model = getattr(settings, "AI_MODEL", "gemini-3.8-flash")
    models_to_try = [primary_model]
    if primary_model != "gemini-3.8-flash":
        models_to_try.append("gemini-3.8-flash")

    headers = {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in models_to_try:
        try:
            response = requests.post(
                api_url,
                headers=headers,
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max(max_tokens, 800),
                    "temperature": 0.5,
                },
                timeout=settings.AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            choices = payload.get("choices")
            if choices and isinstance(choices, list) and len(choices) > 0:
                msg = choices[0].get("message", {})
                content = msg.get("content")
                if content and isinstance(content, str) and content.strip():
                    return content.strip()
        except (requests.RequestException, KeyError, IndexError, ValueError, AttributeError, TypeError) as exc:
            logger.warning("AI request with model %s failed: %s", model, exc)
            continue

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


def get_user_study_context(user):
    """Gather relevant study data for AI prompt context and offline fallback."""
    import common.utils as common
    from progress.service import ProgressService
    from services.scheduler import today_sessions
    from subjects.models import Subject
    from topics.models import Topic

    user_id = str(user.id)
    subjects = list(Subject.objects(user_id=user_id))

    subject_details = []
    total_topics = 0
    total_completed = 0
    total_pending = 0
    earliest_exam = None

    for s in subjects:
        topics = list(Topic.objects(subject_id=str(s.id)))
        completed = sum(1 for t in topics if t.status == "completed")
        pending = [t.name for t in topics if t.status != "completed"]
        total_topics += len(topics)
        total_completed += completed
        total_pending += len(pending)

        days = s.days_until_exam()
        if s.exam_date and (earliest_exam is None or s.exam_date < earliest_exam["date"]):
            earliest_exam = {
                "subject": s.name,
                "days": days,
                "date": s.exam_date,
                "date_str": common.format_date(s.exam_date),
            }

        exam_str = f"exam in {days}d" if days is not None else "no exam date"
        pending_str = f"pending: {', '.join(pending[:4])}" if pending else "all done"
        subject_details.append(
            f"{s.name} ({s.difficulty}, {exam_str}, {s.round_preparation()}% prep, "
            f"{completed}/{len(topics)} done, {pending_str})"
        )

    sessions = today_sessions(user)
    study_sessions = [sess for sess in sessions if not sess.is_break]
    done_sessions = [sess for sess in study_sessions if sess.status == "completed"]
    overall_pct = ProgressService.overall_progress(user_id)

    return {
        "user_name": user.name,
        "daily_hours": user.daily_study_hours or 4,
        "study_window": f"{user.preferred_start_time or '18:00'} - {user.preferred_end_time or '22:00'}",
        "subject_count": len(subjects),
        "subject_details": subject_details,
        "total_topics": total_topics,
        "total_completed": total_completed,
        "total_pending": total_pending,
        "earliest_exam": earliest_exam,
        "planned_sessions": len(study_sessions),
        "completed_sessions": len(done_sessions),
        "overall_progress": overall_pct,
    }


def _build_offline_reply(context, is_error=False):
    name = context["user_name"].split()[0] if context.get("user_name") else "there"
    parts = [f"Hi {name}! Here is your current study status and recommended focus:\n"]

    if context["subject_count"] == 0:
        parts.append(
            "You haven't added any subjects yet. Head over to the Subjects tab to add your subjects and topics, "
            "then generate your study plan on the dashboard to get started!"
        )
    else:
        parts.append(
            f"• Subjects & Topics: {context['subject_count']} subject(s) with {context['total_topics']} total topic(s) "
            f"({context['total_completed']} completed, {context['total_pending']} pending)."
        )
        parts.append(f"• Overall Progress: {context['overall_progress']}% completed.")

        if context["earliest_exam"]:
            exam = context["earliest_exam"]
            days_str = "today!" if exam["days"] == 0 else f"in {exam['days']} day(s) ({exam['date_str']})"
            parts.append(f"• Priority Exam: {exam['subject']} is {days_str}.")

        if context["planned_sessions"] > 0:
            parts.append(
                f"• Today's Plan: {context['completed_sessions']}/{context['planned_sessions']} sessions completed."
            )
        else:
            parts.append("• Today's Plan: No sessions generated yet. Click 'Generate study plan' to set today's schedule.")

        if context.get("earliest_exam") and context["total_pending"] > 0:
            parts.append(f"\n💡 Focus Tip: Dedicate your next study session to your upcoming {context['earliest_exam']['subject']} exam. Knock out 1-2 pending topics today to stay on track!")
        else:
            parts.append("\n💡 Focus Tip: Stay consistent with daily study blocks to maintain your momentum!")

    return "\n".join(parts)


def chat_with_assistant(user, message):
    """
    Handle an AI assistant chat query from the student.
    
    If AI is configured, queries the LLM with relevant academic context.
    If AI is disabled or fails, provides a rich, data-driven fallback response.
    """
    context = get_user_study_context(user)

    if not ai_enabled():
        return {
            "reply": _build_offline_reply(context, is_error=False),
            "ai_available": False,
        }

    exam_line = (
        f"Earliest exam: {context['earliest_exam']['subject']} in {context['earliest_exam']['days']} days ({context['earliest_exam']['date_str']})"
        if context["earliest_exam"]
        else "No upcoming exams scheduled."
    )
    subjects_text = (
        "\n".join(f"- {s}" for s in context["subject_details"])
        if context["subject_details"]
        else "None yet"
    )

    system_prompt = (
        f"You are Scholarwise AI, an encouraging, supportive, and knowledgeable study coach for college students.\n"
        f"You have access to the student's current study status:\n"
        f"Student: {context['user_name']}\n"
        f"Daily target: {context['daily_hours']} hours (window: {context['study_window']})\n"
        f"Overall progress: {context['overall_progress']}%\n"
        f"{exam_line}\n"
        f"Subjects & Topics:\n{subjects_text}\n"
        f"Today's schedule: {context['planned_sessions']} sessions planned ({context['completed_sessions']} done)\n\n"
        "Guidelines:\n"
        "- Answer the student's question directly, clearly, and concisely.\n"
        "- When advising on what to study, prioritize upcoming exams, preparation deficits, and harder topics.\n"
        "- If the student asks for explanations of academic concepts, explain them clearly with concise examples.\n"
        "- Keep responses within 200 words. Be encouraging and actionable."
    )

    ai_reply = _chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        max_tokens=600,
    )

    if not ai_reply:
        return {
            "reply": _build_offline_reply(context, is_error=True),
            "ai_available": False,
        }

    return {
        "reply": ai_reply,
        "ai_available": True,
    }
