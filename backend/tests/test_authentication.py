from rest_framework.test import APIClient

from .base import LOGIN_URL, REGISTER_URL, StudyFlowTestCase


class RegistrationTests(StudyFlowTestCase):
    def test_register_success(self):
        response = APIClient().post(
            REGISTER_URL,
            {
                "name": "Soumya",
                "email": "soumya@example.com",
                "password": "password123",
                "confirm_password": "password123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "soumya@example.com")
        self.assertNotIn("password", response.data["user"])

    def test_register_duplicate_email_rejected(self):
        APIClient().post(
            REGISTER_URL,
            {"name": "A", "email": "dup@example.com", "password": "password123",
             "confirm_password": "password123"},
            format="json",
        )
        response = APIClient().post(
            REGISTER_URL,
            {"name": "B", "email": "dup@example.com", "password": "password123",
             "confirm_password": "password123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_register_password_mismatch(self):
        response = APIClient().post(
            REGISTER_URL,
            {"name": "A", "email": "a@example.com", "password": "password123",
             "confirm_password": "different123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_register_short_password(self):
        response = APIClient().post(
            REGISTER_URL,
            {"name": "A", "email": "a@example.com", "password": "short",
             "confirm_password": "short"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_register_invalid_email(self):
        response = APIClient().post(
            REGISTER_URL,
            {"name": "A", "email": "not-an-email", "password": "password123",
             "confirm_password": "password123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class LoginTests(StudyFlowTestCase):
    def _seed_user(self, email="login@example.com", password="password123"):
        response = APIClient().post(
            REGISTER_URL,
            {"name": "Soumya", "email": email, "password": password,
             "confirm_password": password},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)

    def test_login_success(self):
        self._seed_user()
        response = APIClient().post(
            LOGIN_URL, {"email": "login@example.com", "password": "password123"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)

    def test_login_wrong_password(self):
        self._seed_user()
        response = APIClient().post(
            LOGIN_URL, {"email": "login@example.com", "password": "wrongpass123"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_login_unknown_email(self):
        response = APIClient().post(
            LOGIN_URL, {"email": "ghost@example.com", "password": "password123"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_protected_route_requires_token(self):
        response = APIClient().get("/api/subjects/")
        self.assertEqual(response.status_code, 401)

    def test_profile_update_daily_hours(self):
        client, _ = self.register_and_login(email="profile@example.com")
        response = client.put(
            "/api/profile/", {"daily_study_hours": 6, "preferred_start_time": "17:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["daily_study_hours"], 6)

    def test_profile_rejects_out_of_range_hours(self):
        client, _ = self.register_and_login(email="profile2@example.com")
        response = client.put("/api/profile/", {"daily_study_hours": 30}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_password_change_requires_current_password(self):
        client, _ = self.register_and_login(email="pwchange@example.com")
        response = client.put(
            "/api/profile/",
            {"new_password": "newpassword123", "confirm_password": "newpassword123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        response = client.put(
            "/api/profile/",
            {
                "current_password": "password123",
                "new_password": "newpassword123",
                "confirm_password": "newpassword123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        login = APIClient().post(
            LOGIN_URL, {"email": "pwchange@example.com", "password": "newpassword123"}, format="json"
        )
        self.assertEqual(login.status_code, 200)
