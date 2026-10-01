from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok", "service": "studyflow-api"})


def home(request):
    return JsonResponse(
        {"message": "StudyFlow API", "docs": "/api/", "health": "/api/health/"}
    )
