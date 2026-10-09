from unittest.mock import patch

from rest_framework.test import APIClient

from django.test import TestCase

from .base import StudyFlowTestCase


class FullUserFlowTests(StudyFlowTestCase):
    """The exact flow from the product spec, end to end."""

    def test_register_to_progress_flow(self):
        # 1. Register + login
        client, user = self.register_and_login(email="flow@example.com", daily_hours=4)
        self.assertEqual(user["name"], "Soumya")

        # 2. Create subjects with exam dates
        dbms = self.make_subject(client, name="DBMS", exam_in_days=15, preparation=60, difficulty="Hard")
        os_subject = self.make_subject(client, name="Operating Systems", exam_in_days=7, preparation=20)
        maths = self.make_subject(client, name="Mathematics", exam_in_days=10, preparation=30)

        # 3. Add topics
        self.make_topic(client, dbms["id"], "Normalization", 90, "Hard")
        self.make_topic(client, dbms["id"], "SQL", 60, "Medium")
        self.make_topic(client, os_subject["id"], "Process Scheduling", 75, "Hard")
        self.make_topic(client, maths["id"], "Probability", 60, "Medium")

        # 4. Dashboard stats reflect the setup
        stats = client.get("/api/dashboard/stats/").data
        self.assertEqual(stats["subjects"], 3)
        self.assertEqual(stats["topics"]["total"], 4)
        self.assertEqual(stats["topics"]["pending"], 4)
        self.assertEqual(stats["overall_progress"], 0)

        # 5. Generate today's plan
        plan_data = self.generate_plan(client)
        planned_topics = {s["topic_name"] for s in plan_data["plan"] if s["topic_name"]}
        self.assertTrue(planned_topics)
        study_minutes = sum(
            s["duration"] for s in plan_data["plan"] if not s["is_break"] and s["session_type"] == "study"
        )
        self.assertLessEqual(study_minutes, 240)

        # 6. Today's plan endpoint returns the saved plan
        today = client.get("/api/study-plan/today/").data
        self.assertTrue(today["summary"]["planned"])
        self.assertEqual(len(today["plan"]), len(plan_data["plan"]))

        # 7. Mark one session completed — this now also completes its linked topic.
        first_study = next(s for s in today["plan"] if s["session_type"] == "study")
        marked = client.put(f"/api/sessions/{first_study['id']}/status/", {"status": "completed"}, format="json")
        self.assertEqual(marked.status_code, 200)
        all_topics = [
            t for s in [dbms, os_subject, maths]
            for t in client.get(f"/api/subjects/{s['id']}/").data["subject"]["topics"]
        ]
        session_topic = next(t for t in all_topics if t["id"] == first_study["topic_id"])
        self.assertEqual(session_topic["status"], "completed")

        # Then complete a second topic explicitly via the topics endpoint.
        pending_topic_id = next(t["id"] for t in all_topics if t["status"] != "completed")
        completed = client.put(f"/api/topics/{pending_topic_id}/complete/", {}, format="json")
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.data["overall_progress"], 50)

        # 8. Dashboard reflects the change (session topic + explicitly completed topic)
        stats_after = client.get("/api/dashboard/stats/").data
        self.assertEqual(stats_after["topics"]["completed"], 2)
        self.assertEqual(stats_after["overall_progress"], 50)

        # 9. Progress endpoint
        progress = client.get("/api/progress/").data
        self.assertEqual(progress["totals"]["completed"], 2)
        self.assertEqual(progress["totals"]["overall_progress"], 50)

        # 10. Calendar shows today's sessions
        month = plan_data["meta"]["date"][:7]
        calendar_data = client.get(f"/api/study-plan/calendar/?month={month}").data
        self.assertTrue(calendar_data["sessions_by_date"])

        # 11. Notifications were generated
        notifications = client.get("/api/notifications/").data
        self.assertGreaterEqual(len(notifications["notifications"]), 1)

        # 12. Logout (stateless) - token itself remains valid until expiry
        logout = client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(logout.status_code, 200)

    def test_ai_endpoints_graceful_without_key(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        self.make_topic(client, subject["id"])
        self.generate_plan(client)

        # Force ai_enabled() → False regardless of what is in .env,
        # so this test always exercises the "no API key configured" code path.
        with patch("services.ai_service.ai_enabled", return_value=False):
            for endpoint in ("/api/study-plan/explain/", "/api/study-plan/suggestions/"):
                response = client.post(endpoint, {}, format="json")
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.data["ai_available"])
                self.assertIn("detail", response.data)

    def test_ai_assistant_chat_without_key(self):
        client, _ = self.register_and_login(email="chat_offline@example.com")
        subject = self.make_subject(client, name="Operating Systems")
        self.make_topic(client, subject["id"], name="Threads")

        with patch("services.ai_service.ai_enabled", return_value=False):
            response = client.post(
                "/api/ai-assistant/chat/",
                {"message": "What should I study next?"},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.data["ai_available"])
            self.assertIn("reply", response.data)
            self.assertIn("Operating Systems", response.data["reply"])

    def test_ai_assistant_chat_with_mocked_ai(self):
        client, _ = self.register_and_login(email="chat_online@example.com")
        subject = self.make_subject(client, name="Algorithms")
        self.make_topic(client, subject["id"], name="Graph Traversal")

        with patch("services.ai_service.ai_enabled", return_value=True), \
             patch("services.ai_service._chat", return_value="Focus on DFS and BFS first."):
            response = client.post(
                "/api/ai-assistant/chat/",
                {"message": "Give me a recommendation."},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data["ai_available"])
            self.assertEqual(response.data["reply"], "Focus on DFS and BFS first.")

    def test_ai_assistant_chat_handles_failure_gracefully(self):
        client, _ = self.register_and_login(email="chat_fail@example.com")
        with patch("services.ai_service.ai_enabled", return_value=True), \
             patch("services.ai_service._chat", return_value=None):
            response = client.post(
                "/api/ai-assistant/chat/",
                {"message": "Can you help me?"},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.data["ai_available"])
            self.assertIn("reply", response.data)

    def test_ai_assistant_chat_empty_message_validation(self):
        client, _ = self.register_and_login(email="chat_empty@example.com")
        response = client.post("/api/ai-assistant/chat/", {"message": "   "}, format="json")
        self.assertEqual(response.status_code, 400)
