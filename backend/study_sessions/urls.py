from django.urls import path

from study_sessions import views

urlpatterns = [
    path("record/", views.RecordSessionView.as_view(), name="session-record"),
    path("<str:session_id>/status/", views.SessionStatusView.as_view(), name="session-status"),
]
