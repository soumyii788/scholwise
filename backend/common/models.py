from mongoengine import DateTimeField, Document, StringField

from common.utils import serialize_value, utcnow


class BaseDocument(Document):
    """Common fields and behaviour for all collections."""

    meta = {"abstract": True, "indexes": ["created_at"]}

    id = StringField(primary_key=True, default=lambda: BaseDocument.new_id())
    created_at = DateTimeField(required=True, default=utcnow)

    @staticmethod
    def new_id():
        import uuid

        return str(uuid.uuid4())

    @classmethod
    def create(cls, **kwargs):
        kwargs.setdefault("created_at", utcnow())
        doc = cls(**kwargs)
        doc.save()
        return doc

    def to_dict(self):
        return {
            field_name: serialize_value(getattr(self, field_name))
            for field_name in self._fields
        }
