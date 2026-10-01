from django.urls import path

from . import views

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notification-list"),
    path("<str:notification_id>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),
]
