import calendar as pycalendar
from datetime import date, timedelta

import common.utils as common
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.errors import ValidationError
from services import ai_service
from services.scheduler import build_daily_plan, persist_plan, today_sessions
from subjects.models import Subject
from topics.models import Topic

from study_sessions.models import StudySession


def _plan_payload(user, sessions):
    """Compact plan summary shared by the AI endpoints."""
    subjects = Subject.objects(user_id=str(user.id))
    subject_summary = [
        {
            "name": s.name,
            "exam_date": common.format_date(s.exam_date),
            "days_until_exam": s.days_until_exam(),
            "preparation_percentage": s.round_preparation(),
            "difficulty": s.difficulty,
            "pending_topics": [
                t.name
                for t in Topic.objects(subject_id=str(s.id), status__ne="completed")
            ][:8],
        }
        for s in subjects
    ]
    return {
        "available_minutes": int(round(float(user.daily_study_hours or 4) * 60)),
        "subjects": subject_summary,
        "sessions": [s.to_dict() for s in sessions],
    }


class GeneratePlanView(APIView):
    """Generate (and save) today's study plan from the user's data."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            sessions, meta = build_daily_plan(request.user)
        except ValueError as exc:
            raise ValidationError(str(exc))

        docs = persist_plan(request.user, sessions, meta)
        NotificationService_exam_check(request)

        return Response(
            {
                "plan": [s.to_dict() for s in docs],
                "meta": meta,
                "message": "Your study plan for today is ready!",
            }
        )


def NotificationService_exam_check(request):
    from notifications.services import NotificationService

    subjects = Subject.objects(user_id=str(request.user.id))
    NotificationService.notify_exam_alerts(request.user, subjects)


class TodayPlanView(APIView):
    """The saved plan for today (empty list if not generated yet)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = today_sessions(request.user)
        study_minutes = sum(s.duration for s in sessions if not s.is_break)
        completed_minutes = sum(
            s.duration for s in sessions if not s.is_break and s.status == "completed"
        )
        return Response(
            {
                "date": common.today().strftime("%Y-%m-%d"),
                "plan": [s.to_dict() for s in sessions],
                "summary": {
                    "study_minutes": study_minutes,
                    "completed_minutes": completed_minutes,
                    "break_minutes": sum(s.duration for s in sessions if s.is_break),
                    "planned": bool(sessions),
                },
            }
        )


class CalendarView(APIView):
    """Sessions and exam dates for a month (query: ?month=YYYY-MM)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        month_param = request.query_params.get("month")
        try:
            if month_param:
                year, month = (int(part) for part in month_param.split("-"))
            else:
                now = common.today()
                year, month = now.year, now.month
        except (TypeError, ValueError):
            raise ValidationError("month must look like YYYY-MM.")

        first_day = date(year, month, 1)
        last_day = date(year, month, pycalendar.monthrange(year, month)[1])

        sessions = StudySession.objects(
            user_id=str(request.user.id),
            date__gte=first_day.isoformat(),
            date__lte=last_day.isoformat(),
        ).order_by("date", "start_time")

        subjects = Subject.objects(user_id=str(request.user.id))
        exams = [
            {
                "subject_id": s.id,
                "name": s.name,
                "date": common.format_date(s.exam_date),
                "days_until_exam": s.days_until_exam(),
            }
            for s in subjects
            if s.exam_date and first_day <= s.exam_date.date() <= last_day
        ]

        by_date = {}
        for session in sessions:
            by_date.setdefault(session.date, []).append(session.to_dict())

        return Response(
            {
                "month": f"{year:04d}-{month:02d}",
                "sessions_by_date": by_date,
                "exams": exams,
            }
        )


class PlanExplainView(APIView):
    """Optional AI explanation of today's plan. Degrades gracefully."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        sessions = today_sessions(request.user)
        if not sessions:
            raise ValidationError("Generate a plan first, then ask AI to explain it.")

        if not ai_service.ai_enabled():
            return Response(
                {
                    "ai_available": False,
                    "detail": "AI is not configured on this server. Your rule-based plan "
                    "still works exactly the same. Add AI_API_KEY to .env to enable "
                    "AI insights.",
                }
            )

        explanation = ai_service.explain_plan(request.user, _plan_payload(request.user, sessions))
        if not explanation:
            return Response(
                {
                    "ai_available": True,
                    "detail": "The AI service could not be reached right now. "
                    "Your plan below is unchanged and fully usable.",
                }
            )

        return Response({"ai_available": True, "explanation": explanation})


class PlanSuggestionsView(APIView):
    """Optional AI suggestions for improving today's plan (advice only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        sessions = today_sessions(request.user)
        if not sessions:
            raise ValidationError("Generate a plan first, then ask AI for suggestions.")

        if not ai_service.ai_enabled():
            return Response(
                {
                    "ai_available": False,
                    "detail": "AI is not configured on this server. Add AI_API_KEY to .env "
                    "to enable AI suggestions.",
                }
            )

        suggestions = ai_service.improve_plan_suggestions(
            request.user, _plan_payload(request.user, sessions)
        )
        if not suggestions:
            return Response(
                {
                    "ai_available": True,
                    "detail": "The AI service could not be reached right now. "
                    "Your plan below is unchanged and fully usable.",
                }
            )

        return Response({"ai_available": True, "suggestions": suggestions})


class AIAssistantChatView(APIView):
    """Interactive AI study assistant chat endpoint.

    Uses configured AI service with the student's study context (subjects,
    topics, upcoming exams, today's schedule, progress).
    Degrades gracefully when AI is not configured or fails.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or request.data.get("content") or "").strip()
        if not message:
            raise ValidationError("Please provide a message for the study assistant.")

        reply_data = ai_service.chat_with_assistant(request.user, message)
        return Response(reply_data)
