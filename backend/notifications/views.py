gifrom rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .services import NotificationService


def serialize(notification):
    data = notification.to_dict()
    data["type"] = notification.type
    return data


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = NotificationService.recent(request.user)
        return Response(
            {
                "notifications": [serialize(n) for n in notifications],
                "unread_count": NotificationService.unread_count(request.user),
            }
        )

    def delete(self, request):
        Notification.objects(user_id=str(request.user.id)).delete()
        return Response({"detail": "Notifications cleared."})


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, notification_id):
        notification = NotificationService.mark_read(request.user, notification_id)
        return Response({"notification": serialize(notification)})

    def post(self, request, notification_id):
        return self.put(request, notification_id)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        NotificationService.mark_all_read(request.user)
        return Response({"detail": "All notifications marked as read."})
