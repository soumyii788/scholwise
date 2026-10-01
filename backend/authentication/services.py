import uuid
from datetime import datetime, timedelta, timezone

import jwt

from config.settings import JWT_EXPIRY_MINUTES, JWT_SECRET

from .models import User


def create_access_token(user):
    """Create a signed JWT identifying the given user."""
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token):
    """Decode a JWT. Raises jwt exceptions (or LookupError) when invalid."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    user_id = payload.get("sub")
    if not user_id:
        raise LookupError("token has no subject")
    return payload


def get_user_by_id(user_id):
    try:
        return User.objects(id=str(user_id)).first()
    except Exception:
        return None
