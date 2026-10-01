from django.urls import path

from . import views

urlpatterns = [
    path("", views.SubjectListCreateView.as_view(), name="subject-list"),
    path("<str:subject_id>/", views.SubjectDetailView.as_view(), name="subject-detail"),
]
