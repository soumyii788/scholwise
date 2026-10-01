import common.utils as common
from authentication.password_hashing import hash_password, verify_password
from notifications.services import NotificationService
from progress.service import ProgressService
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
            "Welcome to StudyFlow! Add your subjects and generate your first plan.",
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
