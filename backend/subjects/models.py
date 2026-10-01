import math

from mongoengine import DateTimeField, FloatField, StringField

from common.models import BaseDocument
from common.utils import days_until


class Subject(BaseDocument):
    """A subject a user is studying, with an exam date and preparation level."""

    meta = {"collection": "subjects", "indexes": ["user_id", "exam_date"]}

    DIFFICULTY_CHOICES = ["Easy", "Medium", "Hard"]

    user_id = StringField(required=True)
    name = StringField(required=True, max_length=120)
    exam_date = DateTimeField()
    preparation_percentage = FloatField(min_value=0, max_value=100, default=0)
    difficulty = StringField(choices=DIFFICULTY_CHOICES, default="Medium")
    notes = StringField(max_length=2000, blank=True)

    def days_until_exam(self):
        return days_until(self.exam_date)

    def round_preparation(self):
        return int(math.floor(self.preparation_percentage or 0))

    def to_dict(self, include_topics=False):
        data = super().to_dict()
        data["preparation_percentage"] = self.round_preparation()
        data["exam_date"] = self.exam_date.date().isoformat() if self.exam_date else None
        data["days_until_exam"] = self.days_until_exam()
        if include_topics:
            from topics.models import Topic

            data["topics"] = [
                t.to_dict()
                for t in Topic.objects(subject_id=str(self.id)).order_by("created_at")
            ]
        return data
