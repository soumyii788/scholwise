from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .service import ProgressService


class ProgressView(APIView):
    """Per-subject progress plus aggregate stats for the progress page."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        summary = ProgressService.progress_summary(str(request.user.id))
        total_topics = sum(item["total_topics"] for item in summary)
        completed = sum(item["completed"] for item in summary)
        return Response(
            {
                "subjects": summary,
                "totals": {
                    "subjects": len(summary),
                    "total_topics": total_topics,
                    "completed": completed,
                    "pending": total_topics - completed,
                    "overall_progress": ProgressService.overall_progress(str(request.user.id)),
                },
            }
        )
