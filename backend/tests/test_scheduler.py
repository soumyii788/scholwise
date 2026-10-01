from datetime import timedelta

from django.test import SimpleTestCase

import services.priority as priority
from services.scheduler import (
    BREAK_AFTER_MINUTES,
    MIN_SESSION_MINUTES,
    _chunk_topics,
    _minutes_between,
    _select_chunks,
)

from .base import StudyFlowTestCase


class PriorityScoreTests(SimpleTestCase):
    def _topic_stub(self, difficulty="Hard", minutes=60):
        class Stub:
            pass

        stub = Stub()
        stub.difficulty = difficulty
        stub.estimated_minutes = minutes
        return stub

    def _subject_stub(self, days=10, preparation=40, difficulty="Medium"):
        class Stub:
            pass

        stub = Stub()
        stub.exam_date = common_now() + timedelta(days=days)
        stub.preparation_percentage = preparation
        stub.difficulty = difficulty
        stub.days_until_exam = lambda: days
        return stub

    def test_closer_exam_scores_higher(self):
        soon = priority.score_topic(self._topic_stub(), self._subject_stub(days=3))
        far = priority.score_topic(self._topic_stub(), self._subject_stub(days=30))
        self.assertGreater(soon["score"], far["score"])

    def test_lower_preparation_scores_higher(self):
        behind = priority.score_topic(self._topic_stub(), self._subject_stub(preparation=20))
        ahead = priority.score_topic(self._topic_stub(), self._subject_stub(preparation=80))
        self.assertGreater(behind["score"], ahead["score"])

    def test_hard_beats_easy_at_equal_urgency(self):
        hard = priority.score_topic(self._topic_stub("Hard"), self._subject_stub())
        easy = priority.score_topic(self._topic_stub("Easy"), self._subject_stub())
        self.assertGreater(hard["score"], easy["score"])

    def test_score_is_bounded_and_breakdown_present(self):
        result = priority.score_topic(self._topic_stub(), self._subject_stub(days=1, preparation=0))
        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)
        for key in ("urgency_score", "preparation_score", "difficulty_score", "urgency_label"):
            self.assertIn(key, result)

    def test_urgency_labels(self):
        self.assertEqual(priority.urgency_label(2), "Very High")
        self.assertEqual(priority.urgency_label(5), "High")
        self.assertEqual(priority.urgency_label(10), "Medium")
        self.assertEqual(priority.urgency_label(20), "Normal")


def common_now():
    from common.utils import today

    return today()


class ChunkingTests(SimpleTestCase):
    def _topic(self, minutes):
        class Stub:
            pass

        stub = Stub()
        stub.estimated_minutes = minutes
        stub.id = f"t{minutes}-{id(stub)}"
        return stub

    def test_long_topic_split_into_chunks(self):
        chunks = _chunk_topics([self._topic(130)])
        self.assertEqual([c["minutes"] for c in chunks], [50, 50, 30])

    def test_short_topic_not_split(self):
        chunks = _chunk_topics([self._topic(30)])
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["minutes"], 30)

    def test_selection_never_exceeds_budget(self):
        chunks = _chunk_topics([self._topic(120), self._topic(120), self._topic(120)])
        selected, used = _select_chunks(chunks, 240)
        self.assertLessEqual(used, 240)
        self.assertEqual(sum(c["minutes"] for c in selected), used)

    def test_window_wraps_midnight(self):
        self.assertEqual(_minutes_between(22 * 60, 2 * 60), 4 * 60)
        self.assertEqual(_minutes_between(18 * 60, 22 * 60), 4 * 60)


class SchedulerInvariantTests(StudyFlowTestCase):
    """End-to-end scheduler invariants against the API."""

    def _plan_case(self, subjects_spec, daily_hours, email="student@example.com"):
        client, _ = self.register_and_login(email=email, daily_hours=daily_hours)
        for spec in subjects_spec:
            subject = self.make_subject(
                client,
                name=spec["name"],
                exam_in_days=spec["days"],
                preparation=spec["prep"],
                difficulty=spec.get("difficulty", "Medium"),
            )
            for topic_name, minutes in spec["topics"]:
                self.make_topic(client, subject["id"], name=topic_name, minutes=minutes)
        return self.generate_plan(client)

    def _study_minutes(self, plan):
        return sum(
            s["duration"] for s in plan["plan"] if not s["is_break"] and s["session_type"] == "study"
        )

    def test_two_subjects_plan_fits_budget(self):
        data = self._plan_case(
            [
                {"name": "Maths", "days": 10, "prep": 30,
                 "topics": [("Probability", 90), ("Integrals", 60)]},
                {"name": "DBMS", "days": 15, "prep": 60,
                 "topics": [("Normalization", 90), ("SQL", 60)]},
            ],
            daily_hours=4,
        )
        self.assertLessEqual(self._study_minutes(data), 240)
        self.assertGreater(len(data["plan"]), 0)
        self.assertGreater(data["meta"]["break_minutes"], 0)

    def test_three_subjects_plan_fits_budget(self):
        data = self._plan_case(
            [
                {"name": "Mathematics", "days": 10, "prep": 30,
                 "topics": [("Probability", 90)]},
                {"name": "DBMS", "days": 15, "prep": 60, "topics": [("ER Model", 90)]},
                {"name": "Operating Systems", "days": 7, "prep": 20,
                 "topics": [("Process Scheduling", 75)]},
            ],
            daily_hours=4,
        )
        self.assertLessEqual(self._study_minutes(data), 240)
        subjects_in_plan = {s["subject_name"] for s in data["plan"] if s["subject_name"]}
        self.assertIn("Operating Systems", subjects_in_plan)  # most urgent wins

    def test_smaller_budget_still_fits(self):
        data = self._plan_case(
            [
                {"name": "Maths", "days": 5, "prep": 10, "topics": [("Calculus", 180)]},
                {"name": "DBMS", "days": 9, "prep": 45, "topics": [("Transactions", 120)]},
            ],
            daily_hours=2,
        )
        self.assertLessEqual(self._study_minutes(data), 120)

    def test_planned_time_never_exceeds_available_time(self):
        for index, hours in enumerate((1, 2, 4, 6)):
            data = self._plan_case(
                [
                    {"name": "A", "days": 3, "prep": 10, "topics": [("T1", 150), ("T2", 90)]},
                    {"name": "B", "days": 12, "prep": 50, "topics": [("T3", 120), ("T4", 60)]},
                ],
                daily_hours=hours,
                email=f"budget{index}@example.com",
            )
            self.assertLessEqual(
                self._study_minutes(data), hours * 60,
                f"plan exceeded {hours}h budget",
            )

    def test_completed_topics_excluded_from_plan(self):
        client, _ = self.register_and_login(daily_hours=3)
        subject = self.make_subject(client, name="DBMS", exam_in_days=6)
        done = self.make_topic(client, subject["id"], name="Finished Topic", minutes=90)
        self.make_topic(client, subject["id"], name="Pending Topic", minutes=90)
        client.put(f"/api/topics/{done['id']}/complete/", {}, format="json")

        data = self.generate_plan(client)
        planned_topics = {s["topic_name"] for s in data["plan"] if s["topic_name"]}
        self.assertNotIn("Finished Topic", planned_topics)
        self.assertIn("Pending Topic", planned_topics)

    def test_breaks_inserted_between_long_runs(self):
        data = self._plan_case(
            [
                {"name": "Maths", "days": 4, "prep": 20, "topics": [("Calculus", 150), ("Algebra", 100)]},
            ],
            daily_hours=4,
        )
        breaks = [s for s in data["plan"] if s["is_break"]]
        self.assertGreater(len(breaks), 0)
        # Every break should come after >= BREAK_AFTER_MINUTES of continuous study.
        run = 0
        for session in data["plan"]:
            if session["is_break"]:
                self.assertGreaterEqual(run, BREAK_AFTER_MINUTES)
                run = 0
            else:
                run += session["duration"]

    def test_no_break_before_short_session(self):
        data = self._plan_case(
            [{"name": "Maths", "days": 4, "prep": 20, "topics": [("Algebra", 40)]}],
            daily_hours=1,
        )
        breaks = [s for s in data["plan"] if s["is_break"]]
        self.assertEqual(len(breaks), 0)  # 40 min single session: no unnecessary break

    def test_generate_without_subjects_fails_friendly(self):
        client, _ = self.register_and_login()
        response = client.post("/api/study-plan/generate/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_generate_without_topics_fails_friendly(self):
        client, _ = self.register_and_login()
        self.make_subject(client)
        response = client.post("/api/study-plan/generate/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_regenerate_replaces_old_plan(self):
        client, _ = self.register_and_login(daily_hours=4)
        subject = self.make_subject(client, exam_in_days=5)
        self.make_topic(client, subject["id"], minutes=180)
        first = self.generate_plan(client)
        second = self.generate_plan(client)
        today_view = client.get("/api/study-plan/today/").data
        self.assertEqual(len(today_view["plan"]), len(second["plan"]))
        self.assertNotEqual(first["plan"][0]["id"], second["plan"][0]["id"])
