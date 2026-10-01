from subjects.models import Subject
from topics.models import Topic


class ProgressService:
    """Computes per-subject and overall completion progress."""

    @staticmethod
    def subject_progress(subject_id):
        topics = Topic.objects(subject_id=str(subject_id))
        if not topics:
            return 0
        completed = sum(1 for t in topics if t.status == "completed")
        return round(100 * completed / len(topics))

    @staticmethod
    def overall_progress(user_id):
        subject_ids = [
            str(s.id) for s in Subject.objects(user_id=str(user_id)).only("id")
        ]
        topics = Topic.objects(subject_id__in=subject_ids)
        if not topics:
            return 0
        completed = sum(1 for t in topics if t.status == "completed")
        return round(100 * completed / len(topics))

    @staticmethod
    def progress_summary(user_id):
        """Per-subject progress for the progress page."""
        subjects = Subject.objects(user_id=str(user_id)).order_by("exam_date", "created_at")
        summary = []
        for subject in subjects:
            topics = Topic.objects(subject_id=str(subject.id)).order_by("created_at")
            completed = sum(1 for t in topics if t.status == "completed")
            in_progress = sum(1 for t in topics if t.status == "in_progress")
            summary.append(
                {
                    "subject": subject.to_dict(),
                    "total_topics": len(topics),
                    "completed": completed,
                    "in_progress": in_progress,
                    "pending": len(topics) - completed,
                    "progress_percentage": ProgressService.subject_progress(subject.id),
                }
            )
        return summary
