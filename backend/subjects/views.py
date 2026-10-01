import common.utils as common
from django.http import Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.errors import ValidationError

from .models import Subject
from .serializers import SubjectSerializer


def get_user_subject_or_404(request, subject_id):
    """Return the subject only if it belongs to the authenticated user."""
    subject = Subject.objects(id=str(subject_id), user_id=str(request.user.id)).first()
    if subject is None:
        raise Http404
    return subject


class SubjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects = Subject.objects(user_id=str(request.user.id)).order_by("exam_date", "created_at")
        return Response({"subjects": [s.to_dict(include_topics=True) for s in subjects]})

    def post(self, request):
        serializer = SubjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get("exam_date") and data["exam_date"].date() < common.today().date():
            raise ValidationError("Exam date must be today or in the future.")

        subject = serializer.create(str(request.user.id))
        return Response({"subject": subject.to_dict(include_topics=True)}, status=status.HTTP_201_CREATED)


class SubjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        subject = get_user_subject_or_404(request, subject_id)
        return Response({"subject": subject.to_dict(include_topics=True)})

    def put(self, request, subject_id):
        subject = get_user_subject_or_404(request, subject_id)
        serializer = SubjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get("exam_date") and data["exam_date"].date() < common.today().date():
            raise ValidationError("Exam date must be today or in the future.")

        subject = serializer.update(subject, data)
        return Response({"subject": subject.to_dict(include_topics=True)})

    def delete(self, request, subject_id):
        subject = get_user_subject_or_404(request, subject_id)
        subject_id_str = str(subject.id)

        from topics.models import Topic

        Topic.objects(subject_id=subject_id_str).delete()
        from study_sessions.models import StudySession

        StudySession.objects(subject_id=subject_id_str).delete()
        subject.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
