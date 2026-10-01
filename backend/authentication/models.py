from mongoengine import BooleanField, EmailField, FloatField, StringField

from authentication.password_hashing import hash_password, verify_password
from common.models import BaseDocument


class User(BaseDocument):
    """A StudyFlow user with their study preferences."""

    meta = {"collection": "users", "indexes": ["email"]}

    name = StringField(required=True, max_length=120)
    email = EmailField(required=True, unique=True)
    password = StringField(required=True)
    daily_study_hours = FloatField(min_value=1, max_value=16, default=4)
    preferred_start_time = StringField(default="18:00")
    preferred_end_time = StringField(default="22:00")
    is_active = BooleanField(default=True)

    def to_public_dict(self):
        """Serialize without the password hash."""
        data = self.to_dict()
        data.pop("password", None)
        return data

    # Django/DRF expect these on any request.user object.
    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def set_password(self, raw_password):
        self.password = hash_password(raw_password)

    def check_password(self, raw_password):
        return verify_password(raw_password, self.password)

    def __str__(self):
        return f"{self.name} <{self.email}>"
