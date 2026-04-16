# 🎓 SCMS — Smart Classroom Management System

A production-grade intelligent classroom platform with AI-powered facial recognition attendance, real-time updates, and role-based management.

---

## 🧠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| **UI** | Framer Motion, Lucide Icons, Recharts, ShadCN-style components |
| **State** | Zustand, React Context |
| **Backend** | Next.js API Routes |
| **Database** | Prisma ORM + SQLite (dev) → PostgreSQL ready |
| **Auth** | JWT + bcrypt |
| **Validation** | Zod |
| **Real-time** | Socket.io |
| **AI / CV** | Python FastAPI + face_recognition + OpenCV |
| **LLM Agent** | Google ADK + Gemini |

---

## 🚀 Quick Start

### 1. Web Application

```bash
cd scms/web

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your settings

# Run database migrations
npx prisma migrate dev

# Seed demo data
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

---

## 🔐 Demo Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Super Admin** | superadmin@scms.edu | superadmin123 | Full system control |
| **Teacher** | teacher@scms.edu | teacher123 | Classes + Attendance |
| **Student** | student1@scms.edu | student123 | View-only |

---

## 📁 Project Structure

```
scms/
├── web/                      # Next.js application
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   ├── seed.ts           # Demo data seed
│   │   └── dev.db            # SQLite database
│   └── src/
│       ├── app/
│       │   ├── (auth pages)  # login, register, pending
│       │   ├── super-admin/  # SUPER_ADMIN dashboard
│       │   ├── admin/        # ADMIN (Teacher) dashboard
│       │   ├── student/      # STUDENT dashboard
│       │   ├── assistant/    # AI chatbot
│       │   └── api/          # REST API routes
│       ├── components/       # Shared UI components
│       ├── lib/              # Auth, Prisma, Socket.io utils
│       └── store/            # Zustand state stores
└── agents/                   # Python AI services
    ├── attendance_service.py # FastAPI face recognition
    ├── class_agent/          # Google ADK LLM agent
    └── tools/                # Shared Python utilities
```

---

## 🎨 Features

### Role-Based Access
- **SUPER_ADMIN**: Approve users, approve timetables, database view
- **ADMIN (Teacher)**: Create timetables, AI attendance camera, alerts
- **STUDENT**: View approved schedules, attendance history

### AI Facial Recognition
- WebRTC camera capture in browser
- Python FastAPI microservice processes frames
- `face_recognition` library with HOG model
- Auto-marks attendance when faces match

### Real-Time Updates
- Socket.io custom server
- Attendance updates broadcast to all connected clients
- Emergency alerts pushed to all users

### AI Chatbot
- Context-aware rule-based assistant
- OpenAI API ready (set `OPENAI_API_KEY`)
- Answers timetable queries, attendance info

### Premium UI
- Dark glassmorphism design
- Framer Motion animations
- Recharts analytics dashboards
- Status badges (Approved/Pending/Rejected)

---

## 🔧 Environment Variables

```env
# Required
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key"

# Optional
NEXT_PUBLIC_ATTENDANCE_SERVICE_URL="http://localhost:8000"
OPENAI_API_KEY="sk-..."
```

---

## 📊 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Sign in |
| GET | `/api/auth/me` | Any | Current user |
| GET | `/api/users` | SUPER_ADMIN | List users |
| PATCH | `/api/users/[id]` | SUPER_ADMIN | Approve/reject user |
| GET | `/api/timetables` | Any auth | List timetables |
| POST | `/api/timetables` | ADMIN | Create timetable |
| PATCH | `/api/timetables/[id]` | ADMIN/SA | Update/approve |
| GET | `/api/attendance` | Any auth | Get attendance |
| POST | `/api/attendance/mark` | ADMIN | Mark attendance |
| POST | `/api/chat` | Any auth | AI chatbot |
| GET | `/api/alerts` | Public | Active alerts |
| POST | `/api/alerts` | ADMIN/SA | Create alert |
