from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("dashboard/stats/", views.DashboardStatsView.as_view(), name="dashboard-stats"),
    path("dashboard/insights/", views.SmartInsightsView.as_view(), name="dashboard-insights"),
]
