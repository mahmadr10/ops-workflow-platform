# Architecture

## System Overview

```mermaid
flowchart TB
    subgraph Client
        UI[React + Vite SPA]
    end

    subgraph API["Backend - Node.js / Express / TypeScript"]
        AUTH[Auth + RBAC middleware]
        ROUTES[REST Routes]
        AISVC[AI Service - provider agnostic]
        NOTIFSVC[Notification Service]
        CRON[Reminder / Risk Cron Engine]
    end

    subgraph Data
        PG[(PostgreSQL via Prisma)]
        REDIS[(Redis - cache / future job queue)]
    end

    subgraph External
        LLM[LLM Provider - Groq / OpenAI / Ollama...]
        WEBHOOK[Generic Webhook]
        SMTP[SMTP]
    end

    UI -- JWT Bearer --> AUTH --> ROUTES
    ROUTES --> PG
    ROUTES --> AISVC --> LLM
    ROUTES --> NOTIFSVC
    CRON --> PG
    CRON --> AISVC
    CRON --> NOTIFSVC
    NOTIFSVC --> WEBHOOK
    NOTIFSVC --> SMTP
    ROUTES -.optional cache.-> REDIS
```

## Request Flow: Kanban Drag and Drop

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React Board
    participant API as PATCH /items/:id/status
    participant DB as PostgreSQL
    participant AI as AI Service

    U->>FE: drags card to new column
    FE->>FE: optimistic UI update (instant)
    FE->>API: PATCH /items/:id/status { statusId }
    API->>DB: update item.statusId, statusEnteredAt
    API->>DB: insert ActivityLog (STATUS_CHANGED)
    API-->>FE: 200 OK (updated item)
    API->>AI: generateTransitionNote() [async, fire-and-forget]
    AI-->>DB: insert Comment (aiGenerated: true)
```

## Key Decisions

- **Workflows and statuses are rows, not enums.** `Workflow` and `WorkflowStatus` are first-class Prisma models. Every "status" reference in the app (Kanban columns, dashboard grouping, reminder rules) is a foreign key, not a hardcoded string, so the platform genuinely supports "any workflow."
- **AI is provider-agnostic by construction.** `ai.service.ts` talks to any OpenAI-compatible chat completions endpoint. Swapping Groq for OpenAI, DeepSeek, or a local Ollama/LM Studio server is an environment variable change, not a code change. A deterministic offline fallback keeps every route functional without a live key.
- **Audit log is append-only.** `ActivityLog` rows are only ever created, never updated or deleted, satisfying the immutable-audit requirement.
- **Notification delivery is itself audited.** Every dispatch is persisted with a status (`PENDING`/`SENT`/`FAILED`), independent of whether the external channel (Slack, SMTP, etc.) is actually configured in a given environment, so the notification log stays meaningful in a demo/CI environment with no external credentials.
- **The reminder cron doubles as the bonus "AI agent" requirement.** The same hourly job that evaluates `IF status == X AND daysInStatus >= N THEN notify` rules also recomputes every active item's risk score and AI-suggested next action.
- **Readonly is enforced once, centrally.** `blockReadonlyWrites` middleware rejects any non-GET request from a Readonly user before it reaches a route handler, rather than relying on every handler to remember the check.
