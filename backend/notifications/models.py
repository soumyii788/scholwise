from mongoengine import BooleanField, StringField

from common.models import BaseDocument


class Notification(BaseDocument):
    """An in-app reminder shown on the dashboard."""

    meta = {"collection": "notifications", "indexes": ["user_id", "is_read"]}

    TYPE_CHOICES = ["reminder", "exam", "progress", "system"]

    user_id = StringField(required=True)
    message = StringField(required=True, max_length=500)
    type = StringField(choices=TYPE_CHOICES, default="system")
    is_read = BooleanField(default=False)
