"""
Daily schedule generator (rule-based, no AI required).

Pipeline:
    pending topics -> priority scores -> split into chunks -> top-N selection
    -> study blocks + breaks laid over the user's preferred window
    -> optional revision block -> persisted as StudySession documents.

Hard guarantee: total scheduled study time never exceeds the user's
available minutes for the day.
"""

from common.utils import format_clock, format_time, today
from study_sessions.models import StudySession
from subjects.models import Subject
from topics.models import Topic

from . import priority

CHUNK_MINUTES = 50          # target length of one focused study block
MIN_SESSION_MINUTES = 15    # chunks shorter than this are merged, not dropped
BREAK_AFTER_MINUTES = 50    # insert a break once study time reaches this
BREAK_MINUTES = 10          # default break length
BREAK_SHORT_MINUTES = 5     # break when the day is tight
REVISION_FRACTION = 0.15    # up to 15% of the day reserved for revision


def _chunk_topics(topics, chunk_minutes=CHUNK_MINUTES):
    """Split topics into <=chunk_minutes pieces so time fits the daily budget."""
    chunks = []
    for topic in topics:
        remaining = max(int(topic.estimated_minutes or 30), MIN_SESSION_MINUTES)
        while remaining > 0:
            piece = min(chunk_minutes, remaining)
            chunks.append({"topic": topic, "minutes": piece, "part": len(chunks)})
            remaining -= piece
    return chunks


def _select_chunks(chunks, available_minutes):
    """Pick highest-priority chunks until the daily budget is used."""
    selected = []
    used = 0
    for chunk in chunks:  # already sorted by priority score
        if used + chunk["minutes"] > available_minutes:
            remaining_budget = available_minutes - used
            if remaining_budget >= MIN_SESSION_MINUTES:
                # Split the last chunk to fit the remaining budget exactly.
                trimmed = dict(chunk)
                trimmed["minutes"] = remaining_budget
                selected.append(trimmed)
                used += remaining_budget
            break
        selected.append(chunk)
        used += chunk["minutes"]
    return selected, used


def _minutes_between(start, end):
    """Minutes inside the preferred window, wrapping past midnight if needed."""
    if end <= start:
        end += 24 * 60
    return end - start


def _consecutive_study_minutes(selected, index):
    """How long the study run has been without a break, ending at `index`."""
    total = 0
    i = index
    while i >= 0 and not selected[i].get("is_break"):
        total += selected[i]["minutes"]
        i -= 1
    return total


def build_daily_plan(user, date_str=None):
    """
    Generate the day's schedule. Returns (sessions, meta).

    sessions are unsaved dicts; the caller persists them.
    """
    date_str = date_str or today().strftime("%Y-%m-%d")
    user_id = str(user.id)

    subjects = {str(s.id): s for s in Subject.objects(user_id=user_id)}
    if not subjects:
        raise ValueError("Add at least one subject before generating a plan.")

    all_topics = Topic.objects(subject_id__in=list(subjects.keys()))

    if not all_topics:
        raise ValueError(
           "Add at least one topic before generating a study plan."
    )

    pending = [t for t in all_topics if t.status != "completed"]

    if not pending:
      raise ValueError(
        "All your topics are complete. Add new topics to keep the streak going!" 
                        )  

    daily_minutes = int(round(float(user.daily_study_hours or 4) * 60))
    start_minutes = _parse_clock(user.preferred_start_time or "18:00")
    end_minutes = _parse_clock(user.preferred_end_time or "22:00")
    window = _minutes_between(start_minutes, end_minutes)
    available_minutes = min(daily_minutes, window)

    if available_minutes < MIN_SESSION_MINUTES:
        raise ValueError(
            "Your preferred study window is too short. Widen it in your profile."
        )

    # --- Score and order topics -------------------------------------------------
    scored = []
    for topic in pending:
        subject = subjects.get(topic.subject_id)
        if not subject:
            continue
        breakdown = priority.score_topic(topic, subject)
        scored.append({"topic": topic, "subject": subject, **breakdown})
    scored.sort(key=lambda item: item["score"], reverse=True)

    # --- Chunk, select, and lay out the day --------------------------------------
    chunks = _chunk_topics([item["topic"] for item in scored])
    order = {item["topic"].id: item for item in scored}
    selected, used_study_minutes = _select_chunks(chunks, available_minutes)

    revision_budget = int(available_minutes * REVISION_FRACTION)
    # Reserve revision time up front so it is never squeezed out.
    study_budget = available_minutes - revision_budget
    if used_study_minutes > study_budget:
        selected, used_study_minutes = _select_chunks(chunks, study_budget)

    blocks = []
    for chunk in selected:
        info = order[chunk["topic"].id]
        blocks.append(
            {
                "subject": info["subject"],
                "topic": chunk["topic"],
                "minutes": chunk["minutes"],
                "priority_score": info["score"],
                "is_break": False,
                "is_revision": False,
            }
        )

    # Interleave breaks after roughly 50 minutes of continuous study.
    laid_out = []
    since_break = 0
    for index, block in enumerate(blocks):
        laid_out.append(block)
        since_break += block["minutes"]
        is_last = index == len(blocks) - 1
        remaining_study = sum(b["minutes"] for b in blocks[index + 1:])
        if not is_last and since_break >= BREAK_AFTER_MINUTES:
            break_minutes = (
                BREAK_MINUTES
                if used_study_minutes + BREAK_MINUTES <= available_minutes
                else BREAK_SHORT_MINUTES
            )
            laid_out.append(
                {"is_break": True, "minutes": break_minutes, "topic": None, "subject": None}
            )
            since_break = 0

    # --- Optional revision block -------------------------------------------------
    revision_used = _maybe_add_revision(laid_out, available_minutes, subjects, scored)

    # --- Convert blocks into timed sessions ---------------------------------------
    sessions = []
    clock = start_minutes
    for block in laid_out:
        end = clock + block["minutes"]
        sessions.append(
            {
                "user_id": user_id,
                "date": date_str,
                "start_time": format_time(clock),
                "end_time": format_time(end),
                "duration": block["minutes"],
                "is_break": block.get("is_break", False),
                "session_type": "break" if block.get("is_break") else ("revision" if block.get("is_revision") else "study"),
                "status": "pending",
                "subject_id": str(block["subject"].id) if block.get("subject") else None,
                "topic_id": str(block["topic"].id) if block.get("topic") else None,
                "subject_name": block["subject"].name if block.get("subject") else None,
                "topic_name": block["topic"].name if block.get("topic") else None,
                "priority_score": block.get("priority_score"),
            }
        )
        clock = end

    total_scheduled = sum(s["duration"] for s in sessions if not s["is_break"])
    if total_scheduled > available_minutes:  # safety net; should never trigger
        raise ValueError("Scheduling error: plan exceeded available time. Please retry.")

    meta = {
        "date": date_str,
        "window": f"{format_clock(start_minutes)} - {format_clock(clock)}",
        "available_minutes": available_minutes,
        "study_minutes": total_scheduled,
        "break_minutes": sum(s["duration"] for s in sessions if s["is_break"]),
        "revision_minutes": revision_used,
        "subject_count": len({s["subject_id"] for s in sessions if s["subject_id"]}),
        "topic_count": len({s["topic_id"] for s in sessions if s["topic_id"]}),
    }
    return sessions, meta


def _maybe_add_revision(laid_out, available_minutes, subjects, scored):
    """Append a revision block for the most urgent subject if time remains."""
    study_scheduled = sum(b["minutes"] for b in laid_out if not b.get("is_break"))
    remaining = available_minutes - study_scheduled - sum(
        b["minutes"] for b in laid_out if b.get("is_break")
    )
    if remaining < MIN_SESSION_MINUTES or not scored:
        return 0

    revision_budget = min(int(available_minutes * REVISION_FRACTION), remaining)
    if revision_budget < MIN_SESSION_MINUTES:
        return 0

    top = scored[0]
    laid_out.append(
        {
            "subject": top["subject"],
            "topic": None,
            "minutes": revision_budget,
            "is_break": False,
            "is_revision": True,
        }
    )
    return revision_budget


def _parse_clock(value):
    try:
        hours, minutes = str(value).strip().split(":")[:2]
        return int(hours) * 60 + int(minutes)
    except (ValueError, TypeError, AttributeError):
        return 18 * 60


def persist_plan(user, sessions, meta, replace_existing=True):
    """Save the generated plan (optionally replacing today's unfinished plan)."""
    from notifications.services import NotificationService

    date_str = meta["date"]
    if replace_existing:
        StudySession.objects(user_id=str(user.id), date=date_str).delete()

    docs = [StudySession(**session) for session in sessions]
    StudySession.objects.insert(docs)

    subjects_covered = sorted({s["subject_name"] for s in sessions if s.get("subject_name")})
    NotificationService.create(
        user,
        f"Your plan for {date_str} is ready: "
        f"{meta['study_minutes']} min across {len(subjects_covered)} subject(s).",
        notification_type="reminder",
    )
    return docs


def today_sessions(user):
    """The user's saved sessions for today, ordered by start time."""
    return list(
        StudySession.objects(user_id=str(user.id), date=today().strftime("%Y-%m-%d"))
        .order_by("start_time")
    )
