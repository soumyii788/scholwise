from django.urls import path

from study_sessions import views

urlpatterns = [
    path("<str:session_id>/status/", views.SessionStatusView.as_view(), name="session-status"),
]
