# DigitalSofts Ops Platform

AI-powered Operations & Workflow Management Platform. Tracks any business process (recruitment, sales pipeline, client projects, internal tasks, procurement) as a fully dynamic, admin-defined workflow, with a Jira-style Kanban board, an immutable activity audit log, AI-generated summaries and risk detection, an executive analytics dashboard, multi-channel notifications, and automated reminders.

Built to evolve into an ERP module: entities, workflows, and custom fields are all data, not code.

## Live Demo

- **App:** https://ops-workflow-platform.vercel.app
- **API:** https://backend-production-2be1.up.railway.app (Swagger docs at `/api/docs`, health at `/health`)

Frontend is hosted on Vercel, backend + PostgreSQL on Railway. See `docs/DEPLOYMENT.md` for how to redeploy or run it locally with Docker Compose instead.

## Demo Credentials

All seeded accounts share the password `Password123!`

| Role     | Email                          |
|----------|---------------------------------|
| Admin    | admin@digitalsofts.com          |
| Manager  | manager@digitalsofts.com        |
| Employee | employee@digitalsofts.com       |
| Readonly | viewer@digitalsofts.com         |

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, dnd-kit (drag and drop), Recharts, Zustand
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** PostgreSQL
- **Cache/Queue substrate:** Redis (provisioned; ready for BullMQ-based job queues as the platform grows)
- **AI:** Provider-agnostic layer over any OpenAI-compatible endpoint (wired to Groq's GPT-OSS 120B by default; swap to OpenAI, DeepSeek, Ollama, or LM Studio via env vars only)
- **Auth:** JWT with role-based access control (Admin, Manager, Employee, Readonly)
- **Observability:** Structured logging (pino), request tracing (correlation IDs), Prometheus metrics endpoint, health endpoint
- **Docs:** OpenAPI 3 / Swagger UI at `/api/docs`

## Features

### 1. Dynamic Workflow Engine
Admins create workflows with any number of custom-named statuses through the UI or API. Nothing is hardcoded: `Recruitment`, `Sales Pipeline`, and `Internal Tasks` ship as seed data, but any workflow can be created at runtime (see [Workflows.tsx](frontend/src/pages/Workflows.tsx)).

### 2. Kanban Board
Drag-and-drop board (dnd-kit) with optimistic updates: the card moves instantly and the status change is persisted in the background; a failed request reverts the board. Instant refresh is real, not just local: a WebSocket (Socket.IO) layer pushes a live update to every other browser looking at that workflow the moment anyone creates, moves, edits, comments on, or deletes an item, so two people watching the same board see each other's changes with no manual reload. A Live/Offline badge next to the workflow picker shows the connection state (see [Board.tsx](frontend/src/pages/Board.tsx), [realtime.ts](backend/src/lib/realtime.ts)).

### 3. Entity Management
Every item carries title, description, priority, assignee, due date, labels, real file attachments (uploaded, stored, and served back, not just metadata), comments, and a free-form JSON custom-fields bag, so the same schema fits a candidate, a sales lead, or a support ticket.

### 4. Activity Timeline
Every mutation (creation, status change, priority change, assignee change, comments, attachments, reminders) is appended to an immutable `ActivityLog` table. The application never updates or deletes these rows.

### 5. AI Assistant
Powered by [ai.service.ts](backend/src/services/ai.service.ts), provider-agnostic (OpenAI SDK against any compatible endpoint):
- Automatic candidate/item history summaries
- Daily standup generation from today's completed work
- Risk detection: an hourly cron job scores every active item on time-in-status, priority, and overdue status
- Suggested next action for stalled items (e.g. "Candidate waiting 9 days -> Schedule interview")
- Auto-generated professional notes on every status transition
- AI executive summaries for weekly/monthly reports
- **AI chatbot** (bonus): ask plain-English questions about live operational data, e.g. "Which candidates have been waiting the longest?", from the **AI Assistant** page. The model only ever sees a real, freshly-queried snapshot of your actual items, so it cannot invent records.

Most of these load automatically, the daily standup appears the moment the Board opens and an item's AI summary loads the first time its card is opened, no button click required; a small refresh icon regenerates either on demand.

If no AI key is configured, the service falls back to a clearly labeled offline message so the rest of the platform keeps working end to end.

### 6. Executive Dashboard
Cards (Total, Active, Blocked, Completed, Overdue, AI Risk Score) plus charts: status distribution, 14-day completion trend, average cycle time per workflow, assignee performance, and workflow bottlenecks (see [Dashboard.tsx](frontend/src/pages/Dashboard.tsx)).

### 7. Advanced Search
Combinable filters by text, assignee, priority, label, workflow, status, and due date range, all as query parameters on `GET /api/items`.

### 8. Reporting
Export to CSV, Excel (.xlsx), and PDF; generate an AI executive summary for the current week or month.

### 9. Notification Engine
Adapter-per-channel: Email (SMTP/nodemailer), Slack, Discord, Microsoft Teams, and generic webhooks. Every send is persisted with a `PENDING` -> `SENT`/`FAILED` audit trail regardless of whether the external channel is configured in a given environment.

### 10. Reminder Automation
Declarative rules: `IF status == X AND daysInStatus >= N THEN notify`. Evaluated hourly by a cron job that also doubles as the bonus AI monitoring agent, recomputing risk scores and AI next-action suggestions for every active item. Authored from a real screen (**Automation** in the sidebar), not just the API, see [Automation.tsx](frontend/src/pages/Automation.tsx).

### 11. REST API
Full CRUD across workflows, items, comments, attachments, labels, users, notifications, and reports, documented with OpenAPI 3 / Swagger UI at `/api/docs`.

### 12. Authentication & RBAC
JWT-based auth with four roles (Admin, Manager, Employee, Readonly). Readonly is enforced at the middleware level and can never perform a write, regardless of route.

### 13. Security
Helmet, CORS allowlist, rate limiting (global and a stricter limit on `/api/auth`), Zod input validation on every write endpoint, bcrypt password hashing, centralized error handling that never leaks stack traces.

### 14. Observability
Structured JSON logs, a correlation ID on every request (`X-Request-Id`), a `/health` endpoint, and a Prometheus-compatible `/metrics` endpoint.

### 15. Deployment
Docker Compose brings up PostgreSQL, Redis, the API, and the frontend with one command. See `docs/DEPLOYMENT.md` for pushing the same images to a managed host.

### 16. Admin Account Management
Admins create as many team accounts as needed directly from the **Team Accounts** page (Admin-only), no self-service signup flow required. A temporary password is generated and shown once if the admin doesn't set one; roles can be changed from the same page at any time.

## Bonus Challenges Implemented

- **Real-time collaboration via WebSockets** - Socket.IO pushes live board updates to every connected viewer of a workflow the instant anyone changes an item, see [realtime.ts](backend/src/lib/realtime.ts) and [socket.ts](frontend/src/api/socket.ts).
- **AI chatbot over operational data** ("Which candidates have been waiting the longest?") - `POST /api/ai/chat`, see [Chatbot.tsx](frontend/src/pages/Chatbot.tsx).
- **GitHub Actions CI/CD pipeline** - builds, type-checks, and tests both apps on every push, see [.github/workflows/ci.yml](.github/workflows/ci.yml).
- **Hourly AI monitoring agent** - the reminder engine recomputes risk scores and next-action suggestions for every active item every hour, unattended, see [reminder.service.ts](backend/src/services/reminder.service.ts).

## Quick Start (Docker Compose)

```bash
cp .env.example .env          # fill in AI_API_KEY etc.
docker compose up --build
# backend:  http://localhost:4000  (docs at /api/docs, health at /health)
# frontend: http://localhost:5173
docker compose exec backend npm run seed
```

## Quick Start (Local Dev, no Docker)

```bash
# Postgres must be running locally and DATABASE_URL set in backend/.env

cd backend
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev            # http://localhost:4000

cd ../frontend
npm install
npm run dev             # http://localhost:5173
```

## Project Structure

```
backend/
  prisma/schema.prisma   dynamic workflow/status/item data model
  src/
    routes/               REST endpoints (auth, workflows, items, ai, dashboard, reports, ...)
    services/             AI layer, notification adapters, reminder/cron engine
    middleware/            JWT auth, RBAC, rate limiting, error handling, request tracing
frontend/
  src/
    pages/                Login, Board, Workflows, Dashboard, Reports, Automation, Chatbot, Users
    components/            Kanban column/card, item detail drawer, modals, layout, notification bell
docs/                       architecture, ER diagram, deployment notes
```

## API Documentation

Swagger UI: `GET /api/docs` (backed by [backend/openapi.yaml](backend/openapi.yaml)).

## Testing

```bash
cd backend && npm test
```

## Architecture Decisions, AI Tooling, Challenges & Learnings

See [docs/BUILD_LOG.md](docs/BUILD_LOG.md).

## Diagrams

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md).
