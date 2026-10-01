"""
Priority scoring engine.

Every pending topic gets a transparent score in 0-100:

    Priority Score = (Urgency x 50) + (Preparation deficit x 30) + (Difficulty x 10)

Each factor is normalized to 0-1 before weighting, so the final score is
comparable across subjects and easy to explain to the user.
"""

URGENCY_WEIGHT = 50
PREPARATION_WEIGHT = 30
DIFFICULTY_WEIGHT = 10

DIFFICULTY_POINTS = {"Easy": 1.0, "Medium": 2.0, "Hard": 3.0}
MAX_DIFFICULTY_POINTS = max(DIFFICULTY_POINTS.values())


def urgency_score(days_until_exam):
    """1/days formula, capped at 1.0. Exam today counts as maximum urgency."""
    if days_until_exam is None:
        return 0.25  # no exam date set: low-urgency default
    return 1.0 / max(days_until_exam, 1)


def urgency_label(days_until_exam):
    if days_until_exam is None:
        return "Unknown"
    if days_until_exam <= 3:
        return "Very High"
    if days_until_exam <= 7:
        return "High"
    if days_until_exam <= 14:
        return "Medium"
    return "Normal"


def preparation_score(preparation_percentage):
    """Lower preparation -> higher score (maximum deficit = 1.0)."""
    return 1.0 - min(max(preparation_percentage or 0, 0), 100) / 100.0


def difficulty_score(difficulty):
    """Easy/Medium/Hard normalized to 0-1."""
    points = DIFFICULTY_POINTS.get(difficulty, DIFFICULTY_POINTS["Medium"])
    return points / MAX_DIFFICULTY_POINTS


def score_topic(topic, subject):
    """Score a single topic using its subject's exam date and preparation."""
    days = subject.days_until_exam()
    urgency = urgency_score(days)
    preparation = preparation_score(subject.preparation_percentage)
    difficulty = difficulty_score(topic.difficulty or subject.difficulty)

    total = (
        urgency * URGENCY_WEIGHT
        + preparation * PREPARATION_WEIGHT
        + difficulty * DIFFICULTY_WEIGHT
    )
    return {
        "score": round(total, 2),
        "urgency_score": round(urgency, 3),
        "urgency_label": urgency_label(days),
        "days_until_exam": days,
        "preparation_score": round(preparation, 3),
        "difficulty_score": round(difficulty, 3),
    }


def score_subject(subject, pending_topics):
    """Subject-level score = average of its pending topic scores."""
    if not pending_topics:
        return None
    scores = [score_topic(t, subject) for t in pending_topics]
    return {
        "score": round(sum(s["score"] for s in scores) / len(scores), 2),
        "urgency_label": scores[0]["urgency_label"],
        "days_until_exam": scores[0]["days_until_exam"],
        "topic_count": len(pending_topics),
    }
