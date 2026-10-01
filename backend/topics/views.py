from notifications.services import NotificationService
from progress.service import ProgressService
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.errors import ValidationError
from subjects.views import get_user_subject_or_404

from .models import Topic
from .serializers import TopicSerializer


class TopicListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        subject = get_user_subject_or_404(request, subject_id)
        topics = Topic.objects(subject_id=str(subject.id)).order_by("created_at")
        return Response({"subject": subject.to_dict(), "topics": [t.to_dict() for t in topics]})

    def post(self, request, subject_id):
        subject = get_user_subject_or_404(request, subject_id)
        serializer = TopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.create(str(subject.id))
        return Response(
            {"topic": topic.to_dict()},
            status=status.HTTP_201_CREATED,
        )


class TopicDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_topic(self, request, topic_id):
        topic = Topic.objects(id=str(topic_id)).first()
        if topic is None:
            from django.http import Http404

            raise Http404
        get_user_subject_or_404(request, topic.subject_id)  # enforce ownership
        return topic

    def get(self, request, topic_id):
        topic = self._get_topic(request, topic_id)
        return Response({"topic": topic.to_dict()})

    def put(self, request, topic_id):
        topic = self._get_topic(request, topic_id)
        serializer = TopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.update(topic, serializer.validated_data)
        return Response({"topic": topic.to_dict()})

    def delete(self, request, topic_id):
        topic = self._get_topic(request, topic_id)
        from study_sessions.models import StudySession

        StudySession.objects(topic_id=str(topic.id)).delete()
        topic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopicCompleteView(APIView):
    """Mark a topic complete (or undo), updating progress and notifying the user."""

    permission_classes = [IsAuthenticated]

    def put(self, request, topic_id):
        topic = Topic.objects(id=str(topic_id)).first()
        if topic is None:
            from django.http import Http404

            raise Http404
        subject = get_user_subject_or_404(request, topic.subject_id)

        requested = request.data.get("completed")
        completed = True if requested is None else bool(requested)

        if completed and topic.status == "completed":
            return Response({"topic": topic.to_dict(), "already_completed": True})

        topic.status = "completed" if completed else "in_progress"
        topic.save()

        if completed:
            NotificationService.create(
                request.user,
                f"Nice! You completed \"{topic.name}\" for {subject.name}.",
                notification_type="progress",
            )

        progress = ProgressService.subject_progress(str(subject.id))
        return Response(
            {
                "topic": topic.to_dict(),
                "subject_progress": progress,
                "overall_progress": ProgressService.overall_progress(str(request.user.id)),
            }
        )
