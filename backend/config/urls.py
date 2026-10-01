from django.urls import include, path

from . import views

api_patterns = [
    path("health/", views.health, name="api-health"),
    path("", include("authentication.urls")),
    path("subjects/", include("subjects.urls")),
    path("subjects/<str:subject_id>/topics/", include("topics.urls_subject")),
    path("topics/", include("topics.urls")),
    path("", include("study_planner.urls")),
    path("progress/", include("progress.urls")),
    path("notifications/", include("notifications.urls")),
    path("sessions/", include("study_sessions.urls")),
]

urlpatterns = [
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("api/", include(api_patterns)),
]
