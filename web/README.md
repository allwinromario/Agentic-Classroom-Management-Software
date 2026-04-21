# SCMS Web Application

Next.js app for **Smart Classroom Management** (SCMS): role-based dashboards, AI-powered attendance, Gemini teacher agent, persistent chat sessions, and dark/light theming. Full product overview and Python agent setup live in the [monorepo README](../README.md).

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 + dark/light theme system
- **Data:** Prisma 5 + SQLite in dev (`DATABASE_URL` in `.env.local`)
- **Auth:** JWT (httpOnly cookie) + bcrypt (`JWT_SECRET` in `.env.local`)
- **State:** Zustand (auth, alerts, persistent chat sessions via localStorage)
- **AI:** Google Gemini API with multi-model fallback chain and multi-key rotation
- **Other:** Socket.io (optional custom server), Framer Motion, Recharts, Zod

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm (ships with Node)
- A free [Gemini API key](https://aistudio.google.com/apikey) for the teacher AI agent

## Setup

From this directory (`scms/web`):

```bash
npm install
cp .env.example .env.local
```

Edit **`.env.local`**:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | Prisma connection string, e.g. `file:./prisma/dev.db` |
| `JWT_SECRET` | ✅ | Strong secret for signing sessions |
| `GOOGLE_API_KEY` | Recommended | Gemini API key for teacher AI agent |
| `GOOGLE_API_KEY_2` … `_10` | Optional | Extra keys for free-tier quota rotation |
| `ATTENDANCE_SERVICE_URL` | Optional | Python face recognition service URL |
| `NEXT_PUBLIC_SOCKET_ENABLED` | Optional | Set `true` to enable Socket.io client |
| `CLASS_AGENT_URL` | Optional | Teacher class-agent service URL |

Initialize the database and seed demo users:

```bash
npx prisma db push
npm run db:seed
```

> If you hit a migration conflict, use `npx prisma db push --force-reset` then re-seed.

## Run

**Standard dev server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Dev with Socket.io** (real-time attendance/alerts):

```bash
# Set NEXT_PUBLIC_SOCKET_ENABLED=true in .env.local first
npm run dev:socket
```

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@scms.edu | superadmin123 |
| Teacher | teacher@scms.edu | teacher123 |
| Student | student1@scms.edu | student123 |

## Key features

### Dark / Light mode
Toggle in the sidebar (animated pill switch, Sun/Moon icons). Theme is saved to `localStorage` and applied before first paint to avoid flash.

### AI Chat History sidebar
Hover the right edge of any dashboard page to slide open a chat history panel. Browse past sessions, start a new chat, or delete old sessions. Up to 50 sessions are retained per browser in `localStorage`.

### Persistent chat across navigation
Chat state is stored in a Zustand store (`src/store/chat.ts`) with `localStorage` persistence. Navigating to other pages and back preserves the full conversation.

### Gemini teacher agent
Teachers on the `/assistant` page can enter marks, mark attendance, and update class timings using natural language. The agent:
- Executes immediately without asking for confirmation
- Supports CSV upload for bulk marks entry
- Falls back through `gemini-2.5-flash` → `gemini-2.0-flash-lite` → `gemini-2.0-flash` → versioned aliases
- Rotates across multiple API keys (`GOOGLE_API_KEY`, `GOOGLE_API_KEY_2` …) when free-tier quota is exhausted

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run dev:socket` | Custom server + Socket.io |
| `npm run build` / `npm start` | Production build and start |
| `npm run lint` | ESLint |
| `npm run db:push` | `prisma db push` (schema sync without migrations) |
| `npm run db:studio` | Prisma Studio (GUI for the database) |
| `npm run db:seed` | Seed demo users, timetable, attendance, marks |

## Layout

```
src/
├── app/
│   ├── admin/          # Teacher dashboards (attendance, marks, timetable, AI tools)
│   ├── student/        # Student dashboards
│   ├── super-admin/    # Admin dashboards (users, timetables, database)
│   ├── assistant/      # AI chatbot page
│   ├── api/            # REST API routes
│   ├── layout.tsx      # Root layout (ThemeProvider, AuthProvider)
│   └── globals.css     # Global styles + comprehensive dark/light mode overrides
├── components/
│   ├── Sidebar.tsx             # Navigation + dark/light toggle
│   ├── DashboardLayout.tsx     # Auth-gated shell + chat sidebar
│   ├── ChatHistorySidebar.tsx  # Right slide-in chat history panel
│   ├── ThemeProvider.tsx       # Theme context (localStorage + data-theme attribute)
│   └── ui/                     # Button, Card, Input, Badge primitives
├── lib/                # Auth helpers, Prisma client, AI service, socket utils
└── store/
    ├── auth.ts         # User auth state
    ├── alerts.ts       # Alert notification state
    └── chat.ts         # Persistent chat sessions (Zustand + localStorage)
```

## Deploy

Configure `DATABASE_URL` (e.g. PostgreSQL), `JWT_SECRET`, `GOOGLE_API_KEY`, and optional service URLs on your host (Vercel, Railway, etc.). For Socket.io you need a deployment target that supports a persistent Node process rather than serverless functions only.

For full details (API reference, face recognition service, Python agents), see **[../README.md](../README.md)**.
