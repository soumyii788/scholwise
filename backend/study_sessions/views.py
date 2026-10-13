from notifications.services import NotificationService
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from subjects.views import get_user_subject_or_404
from topics.models import Topic

from .models import StudySession


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
