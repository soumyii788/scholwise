# StudyFlow — AI Study Planner

StudyFlow helps college students answer one question every day:

> **"What should I study today, how much time should I spend on it, and what should I revise?"**

Enter your subjects, exam dates, preparation levels, and available study hours. StudyFlow scores every pending topic by exam urgency, preparation deficit, and difficulty — then builds a practical daily schedule with breaks and revision time. An optional AI layer can explain the plan and suggest improvements, but **the app works fully without any AI API key**.

## Description

Students juggle multiple subjects, limited hours, different preparation levels, and approaching exams. StudyFlow removes the guesswork:

- Prioritizes topics using a transparent scoring formula (no black box)
- Fits the day's highest-value work inside the time you actually have
- Adds breaks automatically after ~50 minutes of study
- Reserves time for revision of your most urgent subject
- Tracks topic completion and progress per subject and overall

## Features

- **Authentication** — register, login, logout, JWT-protected routes, password hashing (PBKDF2-SHA256), change password
- **Profile** — daily study hours (1–16) and preferred study window (e.g. 18:00–22:00)
- **Subjects** — name, exam date, preparation %, difficulty, notes; full CRUD
- **Topics** — estimated minutes (5–300), difficulty, status (`pending` / `in_progress` / `completed`); full CRUD
- **Priority engine** — `Urgency×50 + PreparationDeficit×30 + Difficulty×10`, normalized to 0–100
- **Scheduler** — splits long topics into ~50-min chunks, fills the day highest-priority-first, guarantees total ≤ available time, inserts breaks, reserves ~15% for revision
- **Today's Plan** — timed blocks with completion checkboxes
- **Calendar** — month view of sessions and exam dates (no external calendar library)
- **Progress** — per-subject and overall completion tracking
- **Notifications** — in-app reminders (plan ready, exam alerts within 3 days, completions)
- **Optional AI** — "Improve Plan with AI" and "Why this plan?" (OpenAI-compatible API); degrades gracefully when unconfigured

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, JavaScript, CSS, Axios, React Router |
| Backend | Python, Django, Django REST Framework |
| Database | MongoDB (MongoEngine ODM; PyMongo driver) |
| Auth | JWT (PyJWT), PBKDF2 password hashing |
| AI (optional) | Any OpenAI-compatible chat completions API |

## Architecture

```
User Input → Validation → Scheduling Algorithm → Generated Study Plan → Optional AI Enhancement
```

The AI layer is advisory only: it receives the generated plan, returns text (an explanation or a JSON list of suggestions), and **never writes to the database**. All AI output is validated/sanitized before display.

### Project structure

```
studyflow/
├── backend/
│   ├── config/                 # Django settings, URLs, WSGI/ASGI
│   ├── common/                 # Base document, datetime helpers, error handler
│   ├── authentication/         # User model, JWT, register/login/profile APIs
│   ├── subjects/               # Subject model + CRUD APIs
│   ├── topics/                 # Topic model + CRUD/complete APIs
│   ├── study_sessions/         # StudySession model + status API
│   ├── study_planner/          # Plan generate/today/calendar + AI endpoints
│   ├── notifications/          # In-app notification model, service, APIs
│   ├── progress/               # Progress service + API
│   ├── services/               # Business logic (no HTTP code)
│   │   ├── priority.py         # Transparent priority scoring
│   │   ├── scheduler.py        # Daily plan generation + persistence
│   │   └── ai_service.py       # Optional AI layer (fails soft)
│   ├── tests/                  # 48 tests incl. end-to-end flow
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   └── src/
│       ├── components/         # Navbar, Sidebar, SubjectCard, TopicCard,
│       │                       # StudySession, ProgressBar, Loading, SubjectFormModal
│       ├── pages/              # Login, Register, Dashboard, Subjects, Calendar,
│       │                       # Progress, Profile
│       ├── services/api.js     # Axios instance + all API calls
│       ├── context/AuthContext.jsx
│       ├── utils/helpers.js
│       └── styles.css
├── .env.example                # copy to backend/.env
└── README.md
```

## Installation

**Prerequisites:** Python 3.9+, Node 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
# 1. Clone and enter the project
cd studyflow

# 2. Backend: virtual environment + dependencies
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt

# 3. Frontend dependencies
cd ../frontend
npm install
```

## Environment Variables

Copy the example and fill in real values (never commit `.env`):

```bash
cp .env.example backend/.env
```

| Variable | Purpose | Example |
|---|---|---|
| `SECRET_KEY` | Django secret | long random string |
| `MONGO_URI` | MongoDB connection | `mongodb://localhost:27017` |
| `MONGO_DB` | Database name | `studyflow` |
| `JWT_SECRET` | Token signing (falls back to SECRET_KEY) | long random string |
| `JWT_EXPIRY_MINUTES` | Token lifetime | `10080` (7 days) |
| `CORS_ALLOWED_ORIGINS` | Frontend origins | `http://localhost:5173` |
| `AI_API_KEY` | **Optional** — enables AI features | `sk-...` |
| `AI_API_URL` | OpenAI-compatible endpoint | `https://api.openai.com/v1/chat/completions` |
| `AI_MODEL` | Model name | `gpt-4o-mini` |

## Database Setup

MongoDB stores everything; no migrations are needed (MongoEngine creates collections on first write).

```bash
# Local MongoDB via Homebrew (macOS)
brew tap mongodb/brew
brew install mongodb-community@8.0
brew services start mongodb/brew/mongodb-community@8.0

# Or with Docker
docker run -d --name studyflow-mongo -p 27017:27017 mongo:8
```

Using Atlas? Paste your connection string into `MONGO_URI`.

## Running Backend

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
# → http://127.0.0.1:8000  (health check: /api/health/)
```

## Running Frontend

```bash
cd frontend
npm run dev
# → http://localhost:5173  (proxies /api to the backend)
```

## API Documentation

All routes are prefixed with `/api/`. Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register/` | `{name, email, password, confirm_password}` | 201 + `{user, token}` |
| POST | `/api/auth/login/` | `{email, password}` | 200 + `{user, token}` |
| POST | `/api/auth/logout/` | — | stateless; client discards token |
| GET / PUT | `/api/profile/` | PUT: name, `daily_study_hours` (1–16), `preferred_start_time`, `preferred_end_time`, optional password fields | |
| GET | `/api/dashboard/stats/` | — | counts + overall progress |

### Subjects & Topics
| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/subjects/` | create: `{name, exam_date?, preparation_percentage?, difficulty?, notes?}` |
| GET / PUT / DELETE | `/api/subjects/:id/` | exam date must be today or future |
| GET / POST | `/api/subjects/:id/topics/` | topic: `{name, estimated_minutes?, difficulty?, status?}` |
| GET / PUT / DELETE | `/api/topics/:id/` | |
| PUT | `/api/topics/:id/complete/` | `{completed: true/false}` → returns updated progress |

### Study plan
| Method | Path | Notes |
|---|---|---|
| POST | `/api/study-plan/generate/` | builds and saves today's plan |
| GET | `/api/study-plan/today/` | saved plan + summary |
| GET | `/api/study-plan/calendar/?month=YYYY-MM` | sessions grouped by date + exams |
| POST | `/api/study-plan/explain/` | optional AI explanation |
| POST | `/api/study-plan/suggestions/` | optional AI suggestions |

### Sessions, Progress, Notifications
| Method | Path | Notes |
|---|---|---|
| PUT | `/api/sessions/:id/status/` | `{status: pending/completed/missed}` |
| GET | `/api/progress/` | per-subject + overall |
| GET / DELETE | `/api/notifications/` | list / clear all |
| PUT | `/api/notifications/:id/read/` · POST `/api/notifications/read-all/` | |

Errors return `{"detail": "friendly message"}` or `{"errors": {field: [...]}}` — raw backend errors are never exposed.

## Testing

```bash
cd backend
python manage.py test tests
```

48 tests cover: registration/login (including duplicate email, wrong password), subject CRUD + ownership isolation, topic CRUD + completion + progress math, priority scoring (urgency/preparation/difficulty), chunking and break rules, the "planned time ≤ available time" invariant across 1–6 hour budgets, and the full end-to-end flow (register → subjects → topics → plan → complete → progress → calendar → notifications). Tests run against an in-memory MongoDB — your real data is never touched.

## The Priority Formula

```
Urgency Score      = 1 / max(days_until_exam, 1)      × 50
Preparation Score  = 1 - preparation_percentage / 100  × 30
Difficulty Score   = Easy 1 / Medium 2 / Hard 3 (÷3)   × 10
Priority Score     = sum of the above (0–100)
```

Exam ≤ 3 days → Very High · ≤ 7 → High · ≤ 14 → Medium · else Normal.

## Future Improvements

- AI-generated study techniques per topic
- Google Calendar integration
- Email and WhatsApp reminders
- Pomodoro timer
- Study streaks and gamification
- Collaborative study groups
- AI tutor chat
- PDF → syllabus extraction and automatic syllabus generation
- Voice-based planning

## License

MIT — see [LICENSE](LICENSE).
