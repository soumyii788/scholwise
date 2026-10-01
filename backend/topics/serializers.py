from rest_framework import serializers

from .models import Topic

DIFFICULTIES = Topic.DIFFICULTY_CHOICES
STATUSES = Topic.STATUS_CHOICES


class TopicSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=200, trim_whitespace=True)
    estimated_minutes = serializers.IntegerField(min_value=5, max_value=300, required=False)
    difficulty = serializers.ChoiceField(choices=DIFFICULTIES, required=False)
    status = serializers.ChoiceField(choices=STATUSES, required=False)

    def create(self, subject_id):
        data = self.validated_data
        return Topic.create(
            subject_id=subject_id,
            name=data["name"],
            estimated_minutes=data.get("estimated_minutes", 30),
            difficulty=data.get("difficulty", "Medium"),
            status=data.get("status", "pending"),
        )

    def update(self, topic, data):
        for field in ("name", "estimated_minutes", "difficulty", "status"):
            if field in data:
                setattr(topic, field, data[field])
        topic.save()
        return topic
