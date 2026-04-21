# 🎓 SCMS — Smart Classroom Management System

A production-grade intelligent classroom platform with AI-powered facial recognition attendance, real-time updates, Gemini-powered teacher agent, and role-based management.

---

## 🧠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| **UI** | Framer Motion, Lucide Icons, Recharts, ShadCN-style components |
| **State** | Zustand (with localStorage persistence), React Context |
| **Backend** | Next.js API Routes |
| **Database** | Prisma ORM + SQLite (dev) → PostgreSQL ready |
| **Auth** | JWT + bcrypt |
| **Real-time** | Socket.io |
| **AI / CV** | Python FastAPI + face_recognition + OpenCV |
| **LLM Agent** | Google Gemini API (multi-model fallback chain) |

---

## 🚀 Quick Start

### 1. Web Application

```bash
cd scms/web

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, JWT_SECRET, GOOGLE_API_KEY at minimum

# Push schema and seed demo data
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
```

Open `http://localhost:3000`

### 2. AI Face Recognition Service (optional)

```bash
cd scms/agents

python -m venv .venv
source .venv/bin/activate

pip install fastapi uvicorn face-recognition opencv-python pillow numpy

uvicorn attendance_service:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Teacher Class-Agent Service (optional)

```bash
cd scms/agents
source .venv/bin/activate
uvicorn agent_service:app --host 0.0.0.0 --port 8001 --reload
```

---

## 🔐 Demo Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Super Admin** | superadmin@scms.edu | superadmin123 | Full system control |
| **Teacher** | teacher@scms.edu | teacher123 | Classes + Attendance + AI Agent |
| **Student** | student1@scms.edu | student123 | View-only |

---

## 📁 Project Structure

```
scms/
├── web/                          # Next.js application
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   ├── migrations/           # SQL migration history
│   │   ├── seed.ts               # Demo data seed
│   │   └── dev.db                # SQLite database (dev)
│   └── src/
│       ├── app/
│       │   ├── (auth pages)      # login, register, pending
│       │   ├── super-admin/      # SUPER_ADMIN dashboard
│       │   ├── admin/            # ADMIN (Teacher) dashboard
│       │   ├── student/          # STUDENT dashboard
│       │   ├── assistant/        # AI chatbot (persistent sessions)
│       │   └── api/              # REST API routes
│       ├── components/
│       │   ├── Sidebar.tsx       # Navigation + dark/light toggle
│       │   ├── DashboardLayout.tsx
│       │   ├── ChatHistorySidebar.tsx  # Slide-in AI chat history
│       │   ├── ThemeProvider.tsx       # Dark/light theme context
│       │   └── ui/               # Shared primitives
│       ├── lib/                  # Auth, Prisma, Socket.io, AI helpers
│       └── store/
│           ├── auth.ts           # Auth state
│           ├── alerts.ts         # Alert state
│           └── chat.ts           # Persistent chat sessions (Zustand + localStorage)
└── agents/                       # Python AI services
    ├── attendance_service.py     # FastAPI face recognition
    ├── class_agent/              # Google ADK LLM agent
    └── tools/                    # Shared Python utilities
```

---

## 🎨 Features

### Role-Based Access
- **SUPER_ADMIN**: Approve users, approve timetables, database view
- **ADMIN (Teacher)**: Create timetables, AI attendance camera, marks entry, alerts, AI agent
- **STUDENT**: View approved schedules, attendance history, AI performance

### AI Facial Recognition Attendance
- WebRTC camera capture in browser
- Python FastAPI microservice processes frames
- `face_recognition` library with HOG model
- Auto-marks attendance when faces match enrolled students

### Gemini-Powered Teacher Agent
- Conversational AI that can **enter marks**, **mark attendance**, and **update class timings** via natural language
- Function-calling agentic loop — executes directly without asking confirmation
- Multi-model fallback chain: `gemini-2.5-flash` → `gemini-2.0-flash-lite` → `gemini-2.0-flash` → versioned aliases
- Multi-key rotation: set `GOOGLE_API_KEY_2`, `_3`… in `.env.local` to extend free-tier quota
- CSV upload for bulk marks entry

### Persistent AI Chat
- Chat sessions stored in localStorage via Zustand — conversations survive page navigation
- Up to 50 sessions retained per user
- Right-side slide-in history panel: hover the right edge to browse and switch sessions
- **New Chat** button in both the assistant page and history sidebar

### Dark / Light Mode
- Toggle switch in the sidebar (animated pill, Sun/Moon icons)
- Theme persisted in `localStorage`, applied before first paint (no flash)
- Comprehensive CSS overrides for all zinc, tinted, and accent color classes

### Real-Time Updates
- Socket.io custom server (`npm run dev:socket`)
- Attendance updates broadcast to all connected clients
- Emergency alerts pushed to all users

### Premium UI
- Glassmorphism design with dark and light themes
- Framer Motion animations throughout
- Recharts analytics dashboards
- Animated status badges (Approved / Pending / Rejected / Draft)

---

## 🔧 Environment Variables

```env
# Required
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key"

# Gemini AI (teacher agent + AI tools)
GOOGLE_API_KEY="AIza..."
# Add more keys for free-tier quota rotation:
# GOOGLE_API_KEY_2="AIza..."
# GOOGLE_API_KEY_3="AIza..."

# Face recognition service
ATTENDANCE_SERVICE_URL="http://localhost:8000"
NEXT_PUBLIC_ATTENDANCE_SERVICE_URL="http://localhost:8000"

# Optional: Socket.io real-time
# NEXT_PUBLIC_SOCKET_ENABLED="true"

# Optional: Teacher class-agent
CLASS_AGENT_URL="http://localhost:8001"
```

Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Add additional `GOOGLE_API_KEY_2` / `_3` keys (from different Google accounts) to avoid hitting the free-tier daily limit.

---

## 📊 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Sign in |
| POST | `/api/auth/logout` | Any | Sign out |
| GET | `/api/auth/me` | Any | Current user |
| GET | `/api/users` | SUPER_ADMIN | List users |
| PATCH | `/api/users/[id]` | SUPER_ADMIN | Approve/reject user |
| GET | `/api/timetables` | Any auth | List timetables |
| POST | `/api/timetables` | ADMIN | Create timetable |
| PATCH | `/api/timetables/[id]` | ADMIN/SA | Update/approve |
| GET | `/api/attendance` | Any auth | Get attendance |
| POST | `/api/attendance/mark` | ADMIN | Mark attendance |
| POST | `/api/chat` | Any auth | Student AI chatbot |
| POST | `/api/agent/chat` | ADMIN/SA | Teacher Gemini agent |
| GET | `/api/alerts` | Any auth | Active alerts |
| POST | `/api/alerts` | ADMIN/SA | Create alert |
| GET | `/api/marks` | Any auth | Get marks |
| POST | `/api/marks` | ADMIN | Enter marks |
| GET | `/api/reports` | ADMIN/SA | Generate reports |
