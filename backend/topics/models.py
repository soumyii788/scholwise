from mongoengine import IntField, StringField

from common.models import BaseDocument


class Topic(BaseDocument):
    """A study topic belonging to a subject."""

    meta = {"collection": "topics", "indexes": ["subject_id", "status"]}

    DIFFICULTY_CHOICES = ["Easy", "Medium", "Hard"]
    STATUS_CHOICES = ["pending", "in_progress", "completed"]

    subject_id = StringField(required=True)
    name = StringField(required=True, max_length=200)
    estimated_minutes = IntField(min_value=5, max_value=300, default=30)
    difficulty = StringField(choices=DIFFICULTY_CHOICES, default="Medium")
    status = StringField(choices=STATUS_CHOICES, default="pending")

    def to_dict(self):
        data = super().to_dict()
        data["estimated_minutes"] = int(self.estimated_minutes or 0)
        return data
