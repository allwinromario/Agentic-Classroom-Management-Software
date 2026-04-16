# SCMS Python Agents & Face Recognition Service

## Overview

This directory contains:

- **`attendance_service.py`** — FastAPI microservice for face recognition attendance
- **`class_agent/`** — Google ADK LLM agent for classroom management
- **`tools/`** — Shared Python tools (DB read/write, face monitoring)
- **`config.py`** — Configuration (MongoDB + Google AI)
- **`db_setup.py`** — MongoDB collection setup

---

## Attendance Service (FastAPI)

The `attendance_service.py` is a standalone FastAPI microservice that:

1. Loads face embeddings from the Prisma SQLite database
2. Detects faces in webcam frames via `face_recognition` + OpenCV
3. Returns matched student IDs to the Next.js frontend
4. Broadcasts real-time updates via WebSocket

### Setup

```bash
cd scms/agents

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn attendance_service:app --host 0.0.0.0 --port 8000 --reload
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service status + embedding count |
| POST | `/register-face` | Extract + store face encoding |
| POST | `/mark-attendance` | Detect faces in frame, return matches |
| POST | `/reload-embeddings` | Reload embeddings from DB |
| WS | `/ws` | WebSocket for real-time updates |

### Environment

The service reads the SQLite database from the Next.js project at:
```
../web/prisma/dev.db
```

You can override with:
```bash
SCMS_DB_URL=file:/path/to/dev.db uvicorn attendance_service:app
```

### Mock Mode

If `face_recognition` / `dlib` are not installed (common on Apple Silicon without proper setup), the service runs in **mock mode** — it still responds correctly but returns random "detected" students for demo purposes.

---

## Google ADK Agent

The `class_agent/` contains an LLM-powered agent for:
- Reading/writing student data
- Marking attendance via image
- Natural language classroom management

### Setup

```bash
# Set env vars
export GOOGLE_API_KEY="your-gemini-api-key"

# Run
cd scms/agents
python -m class_agent
```

---

## Demo Credentials (seeded automatically)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@scms.edu | superadmin123 |
| Teacher | teacher@scms.edu | teacher123 |
| Student | student1@scms.edu | student123 |
