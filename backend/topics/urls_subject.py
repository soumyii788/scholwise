from django.urls import path

from . import views

urlpatterns = [
    path("", views.TopicListCreateView.as_view(), name="topic-list"),
]
