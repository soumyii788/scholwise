from .models import Notification


class NotificationService:
    """Creates and manages in-app notifications (no email/SMS in v1)."""

    @staticmethod
    def create(user, message, notification_type="system"):
        user_id = str(getattr(user, "id", user))
        # Avoid piling up identical reminders on the same day.
        duplicate = Notification.objects(
            user_id=user_id, message=message, is_read=False
        ).first()
        if duplicate:
            return duplicate
        return Notification.create(user_id=user_id, message=message, type=notification_type)

    @staticmethod
    def recent(user, limit=20):
        return list(
            Notification.objects(user_id=str(user.id)).order_by("-created_at")[:limit]
        )

    @staticmethod
    def unread_count(user):
        return Notification.objects(user_id=str(user.id), is_read=False).count()

    @staticmethod
    def mark_read(user, notification_id):
        notification = Notification.objects(
            id=str(notification_id), user_id=str(user.id)
        ).first()
        if notification is None:
            from django.http import Http404

            raise Http404
        notification.is_read = True
        notification.save()
        return notification

    @staticmethod
    def mark_all_read(user):
        Notification.objects(user_id=str(user.id), is_read=False).update(is_read=True)

    @staticmethod
    def notify_exam_alerts(user, subjects):
        """Create a reminder for exams that are 3 or fewer days away."""
        from common.utils import days_until

        for subject in subjects:
            days = subject.days_until_exam()
            if days is not None and days <= 3:
                when = "today" if days == 0 else f"in {days} day{'s' if days != 1 else ''}"
                NotificationService.create(
                    user,
                    f"Your {subject.name} exam is {when}!",
                    notification_type="exam",
                )
