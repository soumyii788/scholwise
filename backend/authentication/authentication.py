import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User
from .services import decode_token, get_user_by_id


class JWTAuthentication(BaseAuthentication):
    """Authenticate requests using an Authorization: Bearer <jwt> header."""

    keyword = "bearer"

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword:
            raise AuthenticationFailed(
                "Invalid authorization header. Use: Bearer <token>."
            )

        try:
            payload = decode_token(parts[1])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed(
                "Your session has expired. Please log in again."
            )
        except jwt.InvalidTokenError:
            raise AuthenticationFailed(
                "Invalid session token. Please log in again."
            )

        user = get_user_by_id(payload["sub"])
        if user is None or not user.is_active:
            raise AuthenticationFailed("User account not found. Please log in again.")
        return (user, parts[1])

    def authenticate_header(self, request):
        return self.keyword
