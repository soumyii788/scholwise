from rest_framework.test import APIClient

from django.test import SimpleTestCase

REGISTER_URL = "/api/auth/register/"
LOGIN_URL = "/api/auth/login/"


class StudyFlowTestCase(SimpleTestCase):
    """Base case for MongoEngine: cleans collections between tests, no relational DB."""

    databases = {}

    def _cleanup(self):
        from authentication.models import User
        from notifications.models import Notification
        from study_sessions.models import StudySession
        from subjects.models import Subject
        from topics.models import Topic

        User.drop_collection()
        Subject.drop_collection()
        Topic.drop_collection()
        StudySession.drop_collection()
        Notification.drop_collection()

    def setUp(self):
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def register_and_login(self, email="student@example.com", password="password123",
                           name="Soumya", daily_hours=None):
        payload = {
            "name": name,
            "email": email,
            "password": password,
            "confirm_password": password,
        }
        if daily_hours is not None:
            payload["daily_study_hours"] = daily_hours

        response = APIClient().post(REGISTER_URL, payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['token']}")

        if daily_hours is not None:
            updated = client.put(
                "/api/profile/", {"daily_study_hours": daily_hours}, format="json"
            )
            self.assertEqual(updated.status_code, 200, updated.content)

        return client, response.data["user"]

    def make_subject(self, client, name="DBMS", exam_in_days=10, preparation=40, difficulty="Hard"):
        from datetime import timedelta

        import common.utils as common

        payload = {"name": name, "preparation_percentage": preparation, "difficulty": difficulty}
        if exam_in_days is not None:
            payload["exam_date"] = (common.today() + timedelta(days=exam_in_days)).strftime("%Y-%m-%d")
        response = client.post("/api/subjects/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.data["subject"]

    def make_topic(self, client, subject_id, name="Normalization", minutes=60, difficulty="Hard"):
        response = client.post(
            f"/api/subjects/{subject_id}/topics/",
            {"name": name, "estimated_minutes": minutes, "difficulty": difficulty},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.data["topic"]

    def generate_plan(self, client):
        response = client.post("/api/study-plan/generate/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        return response.data
