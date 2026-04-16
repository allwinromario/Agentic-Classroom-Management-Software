# SCMS Web Application

Next.js app for **Smart Classroom Management** (SCMS): role-based dashboards, attendance APIs, AI assistant hooks, and Prisma-backed persistence. Full product overview, demo accounts, and Python agent setup live in the [monorepo README](../README.md).

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript  
- **Styling:** Tailwind CSS v4  
- **Data:** Prisma 5 + SQLite in dev (`DATABASE_URL` in `.env.local`)  
- **Auth:** JWT (httpOnly cookie) + bcrypt (`JWT_SECRET` in `.env.local`)  
- **Other:** Zustand, Socket.io (optional custom server), MongoDB driver for document features, Zod validation  

## Prerequisites

- Node.js 20+ (LTS recommended)  
- npm (ships with Node)  

## Setup

From this directory (`scms/web`):

```bash
npm install
cp .env.example .env.local
```

Edit **`.env.local`**. At minimum set:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma connection string, e.g. `file:./prisma/dev.db` for SQLite |
| `JWT_SECRET` | Strong secret for signing sessions (use a long random string in production) |
| `MONGODB_URI` / `MONGODB_DB_NAME` | MongoDB (see `.env.example`) |

Optional: `OPENAI_API_KEY`, `ATTENDANCE_SERVICE_URL` or `NEXT_PUBLIC_ATTENDANCE_SERVICE_URL`, `NEXT_PUBLIC_SOCKET_ENABLED=true` when using the Socket.io server.

Initialize the database and seed demo users:

```bash
npx prisma migrate dev
npm run db:seed
```

## Run

**Standard dev server** (no custom Socket.io process):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Dev with Socket.io** (real-time attendance/alerts; set `NEXT_PUBLIC_SOCKET_ENABLED=true` in `.env.local`):

```bash
npm run dev:socket
```

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev |
| `npm run dev:socket` | Custom server + Socket.io (`server.ts`) |
| `npm run build` / `npm start` | Production build and start |
| `npm run lint` | ESLint |
| `npm run db:push` | `prisma db push` (schema sync) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Run `prisma/seed.ts` |

## Layout

- `src/app/` — routes: `admin/`, `student/`, `super-admin/`, `api/`, auth pages  
- `src/components/` — shared UI and providers  
- `src/lib/` — auth, Prisma client, Mongo helpers, sockets, AI helpers  
- `prisma/` — `schema.prisma`, migrations, `seed.ts`  

## Deploy

Configure production `DATABASE_URL` (e.g. PostgreSQL), `JWT_SECRET`, and any optional service URLs on your host (Vercel, Node VM, etc.). For Socket.io you need a deployment target that supports a long-lived Node process, not only serverless functions.

For more detail (API table, attendance service, agents), see **[../README.md](../README.md)**.
