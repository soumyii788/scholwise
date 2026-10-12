from datetime import datetime, timedelta

from notifications.services import NotificationService
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from subjects.views import get_user_subject_or_404
from topics.models import Topic

from .models import StudySession


class RecordSessionView(APIView):
    """Record a completed study session from Study Mode."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        duration = int(request.data.get("duration", 0))  # in minutes
        if duration <= 0:
            return Response({"error": "Duration must be at least 1 minute."}, status=400)

        subject_id = request.data.get("subject_id")
        topic_id = request.data.get("topic_id")
        label = (request.data.get("label") or "").strip()
        mark_completed = bool(request.data.get("mark_topic_completed", False))

        subject_name = "Self Study"
        if subject_id:
            from subjects.models import Subject

            subj = Subject.objects(id=str(subject_id), user_id=str(request.user.id)).first()
            if subj:
                subject_name = subj.name

        topic_name = label or "Focused Study"
        if topic_id:
            topic = Topic.objects(id=str(topic_id)).first()
            if topic:
                topic_name = topic.name
                if mark_completed and topic.status != "completed":
                    topic.status = "completed"
                    topic.save()

        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        end_time_str = now.strftime("%H:%M")
        start_dt = now - timedelta(minutes=duration)
        start_time_str = start_dt.strftime("%H:%M")

        session = StudySession(
            user_id=str(request.user.id),
            subject_id=str(subject_id) if subject_id else None,
            topic_id=str(topic_id) if topic_id else None,
            subject_name=subject_name,
            topic_name=topic_name,
            date=date_str,
            start_time=start_time_str,
            end_time=end_time_str,
            duration=duration,
            session_type="study",
            status="completed",
            is_break=False,
            label=label or topic_name,
        )
        session.save()

        NotificationService.create(
            request.user,
            f'Recorded {duration}m of focus time on "{topic_name}". Keep it up!',
            notification_type="progress",
        )

        return Response({
            "message": f"Recorded {duration}m of study time.",
            "session": session.to_dict(),
        })


class SessionStatusView(APIView):
    """Mark one of the user's study sessions completed or pending."""

    permission_classes = [IsAuthenticated]

    def put(self, request, session_id):
        session = StudySession.objects(id=str(session_id), user_id=str(request.user.id)).first()
        if session is None:
            from django.http import Http404

            raise Http404

        requested = request.data.get("status")
        if requested in ("completed", "pending", "missed"):
            session.status = requested
        elif "completed" in request.data:
            session.status = "completed" if bool(request.data["completed"]) else "pending"
        session.save()

        self._sync_topic_status(request, session)
        return Response({"session": session.to_dict()})

    def _sync_topic_status(self, request, session):
        """Keep the linked topic in step when a plan session is checked off or reopened,
        so progress, stats and future plans agree with what the user did today."""
        if session.session_type == "break" or not session.topic_id:
            return

        topic = Topic.objects(id=str(session.topic_id)).first()
        if topic is None:
            return
        subject = get_user_subject_or_404(request, topic.subject_id)

        if session.status == "completed" and topic.status != "completed":
            topic.status = "completed"
            topic.save()
            NotificationService.create(
                request.user,
                f'Nice! You completed "{topic.name}" for {subject.name}.',
                notification_type="progress",
            )
        elif session.status != "completed" and topic.status == "completed":
            topic.status = "in_progress"
            topic.save()
