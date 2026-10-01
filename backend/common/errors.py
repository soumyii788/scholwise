import logging

from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

from .utils import utcnow


class StudyFlowError(Exception):
    """Base class for expected (user-facing) application errors."""

    status_code = 400
    default_message = "Something went wrong. Please try again."


class ValidationError(StudyFlowError):
    status_code = 400
    default_message = "Please check your input and try again."


class ConflictError(StudyFlowError):
    status_code = 409
    default_message = "That action conflicts with the current state."


def friendly_exception_handler(exc, context):
    """
    DRF exception handler that:
      * converts expected app errors into clean JSON responses
      * wraps unexpected errors in a generic message (never leaking internals)
    """
    from rest_framework import status as drf_status
    from rest_framework.response import Response

    if isinstance(exc, StudyFlowError):
        return Response(
            {"detail": str(exc) or exc.default_message},
            status=exc.status_code,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error: %s", exc)
        return Response(
            {"detail": "Something went wrong on our side. Please try again."},
            status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Normalize DRF validation errors into {"detail": "..."} or {"errors": {...}}
    data = getattr(response, "data", None)
    if isinstance(data, dict) and "detail" not in data and "errors" not in data:
        response.data = {"errors": data}
    return response
