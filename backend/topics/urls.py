from django.urls import include, path

from . import views

urlpatterns = [
    path("<str:topic_id>/", views.TopicDetailView.as_view(), name="topic-detail"),
    path("<str:topic_id>/complete/", views.TopicCompleteView.as_view(), name="topic-complete"),
]
