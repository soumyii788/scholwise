from rest_framework import serializers

from common.utils import parse_date

from .models import Subject

DIFFICULTIES = Subject.DIFFICULTY_CHOICES


class SubjectSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=120, trim_whitespace=True)
    exam_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    preparation_percentage = serializers.FloatField(min_value=0, max_value=100, required=False)
    difficulty = serializers.ChoiceField(choices=DIFFICULTIES, required=False)
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate_exam_date(self, value):
        """Accepts YYYY-MM-DD; returns an aware datetime or None."""
        if value in (None, ""):
            return None
        try:
            return parse_date(value, "exam_date")
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))

    def create(self, user_id):
        data = self.validated_data
        return Subject.create(
            user_id=user_id,
            name=data["name"],
            exam_date=data.get("exam_date"),
            preparation_percentage=data.get("preparation_percentage", 0),
            difficulty=data.get("difficulty", "Medium"),
            notes=data.get("notes", ""),
        )

    def update(self, subject, data):
        for field in ("name", "exam_date", "preparation_percentage", "difficulty", "notes"):
            if field in data:
                setattr(subject, field, data[field])
        subject.save()
        return subject
