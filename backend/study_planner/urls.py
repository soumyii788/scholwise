from django.urls import path

from . import views

urlpatterns = [
    path("study-plan/generate/", views.GeneratePlanView.as_view(), name="plan-generate"),
    path("study-plan/today/", views.TodayPlanView.as_view(), name="plan-today"),
    path("study-plan/calendar/", views.CalendarView.as_view(), name="plan-calendar"),
    path("study-plan/explain/", views.PlanExplainView.as_view(), name="plan-explain"),
    path("study-plan/suggestions/", views.PlanSuggestionsView.as_view(), name="plan-suggestions"),
    path("ai-assistant/chat/", views.AIAssistantChatView.as_view(), name="ai-assistant-chat"),
]
