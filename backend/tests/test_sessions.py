from topics.models import Topic

from .base import StudyFlowTestCase


class SessionStatusTests(StudyFlowTestCase):
    """Checking off a session in today's plan must keep the linked topic in sync."""

    def setUp(self):
        super().setUp()
        self.client, self.user = self.register_and_login()
        subject = self.make_subject(self.client, name="DBMS")
        self.topic = self.make_topic(self.client, subject["id"], name="Normalization", minutes=60)
        # A second topic keeps plan regeneration possible after completing the first.
        self.make_topic(self.client, subject["id"], name="SQL Practice", minutes=30)
        data = self.generate_plan(self.client)
        self.study_session = next(
            s for s in data["plan"] if not s["is_break"] and s.get("topic_id")
        )

    def topic_status(self):
        return Topic.objects(id=str(self.topic["id"])).first().status

    def test_completing_session_completes_topic(self):
        response = self.client.put(
            f"/api/sessions/{self.study_session['id']}/status/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["session"]["status"], "completed")
        self.assertEqual(self.topic_status(), "completed")

        progress = self.client.get("/api/progress/").data
        self.assertEqual(progress["totals"]["completed"], 1)

    def test_regenerated_plan_excludes_session_completed_topic(self):
        self.client.put(
            f"/api/sessions/{self.study_session['id']}/status/",
            {"status": "completed"},
            format="json",
        )
        data = self.generate_plan(self.client)
        planned_topic_ids = {
            s["topic_id"] for s in data["plan"] if not s["is_break"] and s.get("topic_id")
        }
        self.assertNotIn(str(self.topic["id"]), planned_topic_ids)

    def test_uncompleting_session_reopens_topic(self):
        self.client.put(
            f"/api/sessions/{self.study_session['id']}/status/",
            {"status": "completed"},
            format="json",
        )
        response = self.client.put(
            f"/api/sessions/{self.study_session['id']}/status/",
            {"status": "pending"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.topic_status(), "in_progress")

    def test_break_session_does_not_touch_topics(self):
        data = self.generate_plan(self.client)
        break_session = next(s for s in data["plan"] if s["is_break"])
        response = self.client.put(
            f"/api/sessions/{break_session['id']}/status/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.topic_status(), "pending")

    def test_missing_session_returns_404(self):
        response = self.client.put(
            "/api/sessions/not-a-real-id/status/", {"status": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, 404)
