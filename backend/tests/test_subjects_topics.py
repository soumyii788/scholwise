from datetime import timedelta

import common.utils as common
from rest_framework.test import APIClient

from django.test import TestCase

from .base import StudyFlowTestCase


class SubjectTests(StudyFlowTestCase):
    def test_create_subject(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client, name="Operating Systems", exam_in_days=7, preparation=20)
        self.assertEqual(subject["name"], "Operating Systems")
        self.assertEqual(subject["difficulty"], "Hard")
        self.assertEqual(subject["days_until_exam"], 7)

    def test_create_subject_past_exam_date_rejected(self):
        client, _ = self.register_and_login()
        past = (common.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        response = client.post(
            "/api/subjects/",
            {"name": "History", "exam_date": past, "preparation_percentage": 50},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_subject_invalid_date_rejected(self):
        client, _ = self.register_and_login()
        response = client.post(
            "/api/subjects/",
            {"name": "History", "exam_date": "15-10-2026", "preparation_percentage": 50},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_preparation_out_of_range_rejected(self):
        client, _ = self.register_and_login()
        response = client.post(
            "/api/subjects/",
            {"name": "History", "preparation_percentage": 150},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_update_subject(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        response = client.put(
            f"/api/subjects/{subject['id']}/",
            {"name": "DBMS Advanced", "preparation_percentage": 55},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["subject"]["name"], "DBMS Advanced")
        self.assertEqual(response.data["subject"]["preparation_percentage"], 55)

    def test_delete_subject(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        response = client.delete(f"/api/subjects/{subject['id']}/")
        self.assertEqual(response.status_code, 204)
        listing = client.get("/api/subjects/")
        self.assertEqual(listing.data["subjects"], [])

    def test_user_cannot_see_other_users_subjects(self):
        client_a, _ = self.register_and_login(email="a@example.com")
        subject = self.make_subject(client_a, name="Secret Subject")

        client_b, _ = self.register_and_login(email="b@example.com")
        response = client_b.get(f"/api/subjects/{subject['id']}/")
        self.assertEqual(response.status_code, 404)

        response = client_b.get("/api/subjects/")
        self.assertEqual(len(response.data["subjects"]), 0)

    def test_user_cannot_modify_other_users_subject(self):
        client_a, _ = self.register_and_login(email="a@example.com")
        subject = self.make_subject(client_a)
        client_b, _ = self.register_and_login(email="b@example.com")
        response = client_b.delete(f"/api/subjects/{subject['id']}/")
        self.assertEqual(response.status_code, 404)


class TopicTests(StudyFlowTestCase):
    def test_create_topic(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        topic = self.make_topic(client, subject["id"], name="ER Model", minutes=90)
        self.assertEqual(topic["name"], "ER Model")
        self.assertEqual(topic["estimated_minutes"], 90)
        self.assertEqual(topic["status"], "pending")

    def test_topic_estimated_minutes_bounds(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        response = client.post(
            f"/api/subjects/{subject['id']}/topics/",
            {"name": "Too long", "estimated_minutes": 999},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_update_topic(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        topic = self.make_topic(client, subject["id"])
        response = client.put(
            f"/api/topics/{topic['id']}/",
            {"name": "Normalization Basics", "status": "in_progress"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["topic"]["status"], "in_progress")

    def test_complete_topic_updates_progress(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client, name="DBMS")
        self.make_topic(client, subject["id"], name="SQL")
        topic = self.make_topic(client, subject["id"], name="ER Model")

        response = client.put(f"/api/topics/{topic['id']}/complete/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["topic"]["status"], "completed")
        self.assertEqual(response.data["subject_progress"], 50)
        self.assertEqual(response.data["overall_progress"], 50)

    def test_complete_other_users_topic_forbidden(self):
        client_a, _ = self.register_and_login(email="a@example.com")
        subject = self.make_subject(client_a)
        topic = self.make_topic(client_a, subject["id"])

        client_b, _ = self.register_and_login(email="b@example.com")
        response = client_b.put(f"/api/topics/{topic['id']}/complete/", {}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_delete_topic(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        topic = self.make_topic(client, subject["id"])
        response = client.delete(f"/api/topics/{topic['id']}/")
        self.assertEqual(response.status_code, 204)

    def test_delete_subject_removes_topics(self):
        client, _ = self.register_and_login()
        subject = self.make_subject(client)
        topic = self.make_topic(client, subject["id"])
        client.delete(f"/api/subjects/{subject['id']}/")
        response = client.get(f"/api/topics/{topic['id']}/")
        self.assertEqual(response.status_code, 404)
