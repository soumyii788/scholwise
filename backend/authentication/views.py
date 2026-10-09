import common.utils as common
from authentication.password_hashing import hash_password, verify_password
from notifications.services import NotificationService
from progress.service import ProgressService
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from services import ai_service
from services.priority import score_topic
from study_sessions.models import StudySession
from subjects.models import Subject
from topics.models import Topic

from .models import User
from .serializers import LoginSerializer, ProfileSerializer, RegisterSerializer
from .services import create_access_token


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if User.objects(email=data["email"]).first():
            return Response(
                {"errors": {"email": ["An account with this email already exists."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.create(
            name=data["name"],
            email=data["email"],
            password=hash_password(data["password"]),
        )

        NotificationService.create(
            user,
            "Welcome to Scholarwise! Add your subjects and generate your first plan.",
            notification_type="system",
        )

        token = create_access_token(user)
        return Response(
            {"user": user.to_public_dict(), "token": token},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects(email=data["email"]).first()
        if user is None or not verify_password(data["password"], user.password):
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not user.is_active:
            return Response(
                {"detail": "This account is disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({"user": user.to_public_dict(), "token": create_access_token(user)})


class LogoutView(APIView):
    """Stateless JWT logout - the client discards the token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"detail": "Logged out."})


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": request.user.to_public_dict()})

    def put(self, request):
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.update(request.user, serializer.validated_data)
        return Response({"user": user.to_public_dict()})


class DashboardStatsView(APIView):
    """Aggregated statistics for the dashboard header cards."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects = Subject.objects(user_id=str(request.user.id))
        subject_ids = [str(s.id) for s in subjects]
        topics = Topic.objects(subject_id__in=subject_ids)

        completed = sum(1 for t in topics if t.status == "completed")
        in_progress = sum(1 for t in topics if t.status == "in_progress")
        pending = len(topics) - completed

        upcoming_exams = [
            s for s in subjects if s.exam_date and common.days_until(s.exam_date) <= 30
        ]
        upcoming_exams.sort(key=lambda s: s.exam_date)

        today_plan = StudySession.objects(
            user_id=str(request.user.id), date=common.today().strftime("%Y-%m-%d")
        )
        study_sessions_today = [s for s in today_plan if not s.is_break]

        return Response(
            {
                "subjects": len(subjects),
                "upcoming_exams": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "exam_date": common.format_date(s.exam_date),
                        "days_until": common.days_until(s.exam_date),
                    }
                    for s in upcoming_exams[:5]
                ],
                "topics": {
                    "total": len(topics),
                    "completed": completed,
                    "in_progress": in_progress,
                    "pending": pending,
                },
                "today_sessions": len(study_sessions_today),
                "today_minutes": sum(s.duration for s in study_sessions_today),
                "overall_progress": ProgressService.overall_progress(str(request.user.id)),
                "daily_study_hours": request.user.daily_study_hours,
            }
        )


class SmartInsightsView(APIView):
    """
    Compute 3-4 data-driven study insights for the dashboard.

    Uses the existing priority engine and (optionally) the AI service.
    Never errors hard — returns partial data with an `empty` flag when
    the student has no subjects/topics yet.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = str(request.user.id)
        subjects = list(Subject.objects(user_id=user_id))

        if not subjects:
            return Response({"empty": True, "insights": []})

        # Build a flat list of (topic, subject) pairs for pending topics
        pending_pairs = []
        subject_pending_counts = {}  # subject_id -> (subject, count, total_minutes)

        for subject in subjects:
            pending_topics = list(
                Topic.objects(subject_id=str(subject.id), status__ne="completed")
            )
            count = len(pending_topics)
            total_minutes = sum(t.estimated_minutes or 30 for t in pending_topics)
            subject_pending_counts[str(subject.id)] = {
                "subject": subject,
                "pending_count": count,
                "total_minutes": total_minutes,
            }
            for topic in pending_topics:
                pending_pairs.append((topic, subject))

        if not pending_pairs:
            return Response({"empty": True, "insights": []})

        # ── Insight 1: highest-priority topic ────────────────────────────
        scored = [
            (topic, subject, score_topic(topic, subject))
            for topic, subject in pending_pairs
        ]
        scored.sort(key=lambda x: x[2]["score"], reverse=True)
        top_topic, top_subject, top_score = scored[0]

        # ── Insight 2: subject with most unfinished work ──────────────────
        busiest = max(
            subject_pending_counts.values(),
            key=lambda v: v["pending_count"],
        )

        # ── Insight 3: total pending time ─────────────────────────────────
        total_pending_minutes = sum(
            v["total_minutes"] for v in subject_pending_counts.values()
        )

        # ── Insight 4: AI recommendation (optional) ───────────────────────
        ai_tip = None
        if ai_service.ai_enabled():
            subject_lines = "; ".join(
                f"{v['subject'].name}: {v['pending_count']} topics, "
                f"{v['total_minutes']}min remaining"
                for v in subject_pending_counts.values()
                if v["pending_count"] > 0
            )
            prompt = (
                f"Student has these pending subjects: {subject_lines}. "
                f"Top priority topic: '{top_topic.name}' in {top_subject.name} "
                f"(score {top_score['score']}, urgency: {top_score['urgency_label']}). "
                "Give one concrete, actionable study tip in 30 words or less. "
                "No bullet points, no markdown."
            )
            ai_tip = ai_service._chat(
                [
                    {
                        "role": "system",
                        "content": "You are a concise study coach. Reply with one tip only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=80,
            )

        insights = [
            {
                "id": "top_topic",
                "icon": "🔥",
                "label": "Study next",
                "value": top_topic.name,
                "sub": f"{top_subject.name} · {top_score['urgency_label']} urgency",
            },
            {
                "id": "busiest_subject",
                "icon": "⚠️",
                "label": "Most work remaining",
                "value": busiest["subject"].name,
                "sub": f"{busiest['pending_count']} topic{'s' if busiest['pending_count'] != 1 else ''} pending",
            },
            {
                "id": "time_needed",
                "icon": "⏱️",
                "label": "Estimated time to finish",
                "value": _format_minutes(total_pending_minutes),
                "sub": f"across {len([v for v in subject_pending_counts.values() if v['pending_count'] > 0])} subject(s)",
            },
        ]

        if ai_tip:
            insights.append(
                {
                    "id": "ai_tip",
                    "icon": "💡",
                    "label": "Study tip",
                    "value": ai_tip,
                    "sub": "AI recommendation",
                }
            )

        return Response({"empty": False, "insights": insights})


def _format_minutes(minutes):
    """Human-readable duration, e.g. '3h 20min' or '45min'."""
    minutes = int(minutes)
    if minutes < 60:
        return f"{minutes}min"
    hours, remaining = divmod(minutes, 60)
    if remaining == 0:
        return f"{hours}h"
    return f"{hours}h {remaining}min"
