import re

from rest_framework import serializers

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=120, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)
    confirm_password = serializers.CharField(max_length=128, write_only=True)

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, write_only=True)

    def validate_email(self, value):
        return value.strip().lower()


class ProfileSerializer(serializers.Serializer):
    """Profile fields a user may view/update (name, preferences, password)."""

    name = serializers.CharField(min_length=2, max_length=120, required=False, trim_whitespace=True)
    daily_study_hours = serializers.FloatField(min_value=1, max_value=16, required=False)
    preferred_start_time = serializers.RegexField(
        regex=r"^([01]\d|2[0-3]):[0-5]\d$", required=False
    )
    preferred_end_time = serializers.RegexField(
        regex=r"^([01]\d|2[0-3]):[0-5]\d$", required=False
    )
    current_password = serializers.CharField(max_length=128, required=False, write_only=True)
    new_password = serializers.CharField(min_length=8, max_length=128, required=False, write_only=True)
    confirm_password = serializers.CharField(max_length=128, required=False, write_only=True)

    def validate(self, attrs):
        new_password = attrs.get("new_password")
        current_password = attrs.get("current_password")

        if new_password:
            if not current_password:
                raise serializers.ValidationError(
                    {"current_password": "Enter your current password to change it."}
                )
            if new_password != attrs.get("confirm_password"):
                raise serializers.ValidationError(
                    {"confirm_password": "New passwords do not match."}
                )
        return attrs

    def update(self, user, attrs):
        if "name" in attrs:
            user.name = attrs["name"]
        if "daily_study_hours" in attrs:
            user.daily_study_hours = attrs["daily_study_hours"]
        if "preferred_start_time" in attrs:
            user.preferred_start_time = attrs["preferred_start_time"]
        if "preferred_end_time" in attrs:
            user.preferred_end_time = attrs["preferred_end_time"]

        if attrs.get("new_password"):
            if not user.check_password(attrs["current_password"]):
                raise serializers.ValidationError(
                    {"current_password": "Current password is incorrect."}
                )
            user.set_password(attrs["new_password"])

        user.save()
        return user
