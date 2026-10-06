import os

import mongoengine
from dotenv import load_dotenv

# Load .env from the backend/ directory regardless of where the server starts.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def env_list(name, default=""):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-key-change-me-32-bytes-min")
DEBUG = os.getenv("DEBUG", "True").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
TESTING = os.getenv("DJANGO_TESTING", "").lower() in ("1", "true", "yes")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "authentication",
    "subjects",
    "topics",
    "study_planner",
    "notifications",
    "study_sessions",
    "progress",
    "common",
    "services",
]

# Django "apps" that are plain Python packages (no Django app config needed).
NON_DJANGO_PACKAGES = {"common", "services"}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

X_FRAME_OPTIONS = "DENY"

# Security hardening — only applied in production (DEBUG=False) so local dev is unaffected.
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True


ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]

# --- Database: MongoDB via MongoEngine ---------------------------------------
# The test suite swaps in an in-memory MongoDB so real data is never touched.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "studyflow")

if TESTING:
    import mongomock

    mongoengine.connect(
        "studyflow_test",
        mongo_client_class=mongomock.MongoClient,
        uuidRepresentation="standard",
    )
else:
    mongoengine.connect(host=MONGO_URI, db=MONGO_DB, uuidRepresentation="standard")

# --- REST Framework ------------------------------------------------------------
TEST_RUNNER = "tests.test_runner.MongoTestRunner"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "authentication.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "EXCEPTION_HANDLER": "common.errors.friendly_exception_handler",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        *(["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    ],
}

# --- JWT ------------------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", SECRET_KEY)
JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", str(7 * 24 * 60)))

# --- CORS -------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
CORS_ALLOW_CREDENTIALS = True

# --- AI service (optional) ---------------------------------------------------------
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_API_URL = os.getenv("AI_API_URL", "https://api.openai.com/v1/chat/completions")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
AI_TIMEOUT_SECONDS = int(os.getenv("AI_TIMEOUT_SECONDS", "20"))

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
