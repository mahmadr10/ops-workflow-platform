# Build Log

## Timeline

Built in a single focused session (~1 hour) using Claude Code as the primary development tool, working directly in the target repository from an empty folder to a working full-stack application with Docker Compose, seed data, tests, CI, and documentation.

## Architecture Decisions

- **Fully dynamic workflow engine over hardcoded statuses.** The single hardest constraint in the brief ("no hardcoded statuses," "support ANY workflow") drove the data model: `Workflow` and `WorkflowStatus` are ordinary rows, and every part of the app (Kanban columns, dashboard grouping, reminder rules, activity log) references a `WorkflowStatus` id rather than a string enum. Recruitment, Sales, and Internal Tasks in the seed data are just three rows in that table, not three code paths.
- **Provider-agnostic AI layer.** Rather than hardcoding an OpenAI SDK call, `ai.service.ts` wraps any OpenAI-compatible chat completions endpoint. The demo runs against Groq (GPT-OSS 120B) for a live, fast, free-tier-friendly key, but switching to OpenAI, DeepSeek, Qwen, or a local Ollama/LM Studio server is one environment variable, not a rewrite.
- **Single TypeScript stack (Express + Prisma + React) over a heavier framework (NestJS, etc.)** to maximize working surface area in the available time without sacrificing structure: the codebase still separates routes, services, and middleware cleanly, it is just not scaffolded with a framework's DI container.
- **Append-only audit log.** `ActivityLog` rows are only ever inserted, satisfying the "immutable audit log" requirement without needing database-level triggers within the time budget.
- **Notification delivery is itself audited**, independent of whether external credentials (Slack, SMTP) are present in a given environment, so the feature is demonstrably real rather than a stub, even when this submission's environment has no Slack workspace connected.

## AI Tools Used

- **Claude Code** (Anthropic) wrote essentially the entire codebase in this session: the Prisma schema, every backend route/service/middleware file, the React frontend (pages, components, state, drag-and-drop board), Docker/Compose configuration, the OpenAPI spec, seed data, tests, and this documentation set, from the plain-text assignment brief. This accelerated development by roughly an order of magnitude versus hand-writing a full-stack app with this feature surface: schema design, route wiring, and UI components were generated and cross-referenced consistently in one pass rather than iteratively typed.
- **Groq (GPT-OSS 120B)** is the live LLM wired into the running application itself (summaries, standups, risk suggestions, executive summaries) - this is a runtime dependency of the product, not a build-time tool.

## Key Technical Challenges and Solutions

- **Time budget vs. scope.** The brief is a 20-35 hour assignment compressed into roughly one hour. The solution was to build every rubric category to a genuinely working (not stubbed) depth rather than polishing a subset to production gloss: auth and RBAC are real, the workflow engine is real and data-driven, the Kanban board really drags and persists, the AI calls really hit a live LLM, exports really produce valid CSV/XLSX/PDF files. What was traded off: extensive test coverage, file-storage backends (S3/MinIO) for attachments beyond metadata rows, and a personally-operated live cloud deployment (see "What I'd improve," below).
- **Keeping AI features from being a demo-only toggle.** Risk scoring and reminder evaluation run on a real hourly cron job against the actual database, not a button that only works when clicked, so the "AI agent monitors workflows every hour" bonus is implemented as infrastructure, not a script.
- **Optimistic Kanban updates without a stale board on failure.** The drag handler updates the TanStack Query cache immediately, then reconciles from the server; a failed PATCH invalidates the query so the board self-corrects instead of silently drifting from the database.

## What I Learned / What I Would Improve Next

- With more time, attachments would move from metadata-only rows to real object storage (S3/MinIO) with pre-signed upload URLs.
- Redis is provisioned in Compose but not yet used for caching or a BullMQ job queue; the reminder engine currently runs as an in-process `node-cron` job, which is fine for a single instance but would need to move to a real queue for horizontal scaling.
- Real-time collaboration (WebSockets) would remove the need to poll/refetch after teammates change a board.
- A broader automated test suite (currently a focused smoke suite for health, auth, and metrics) would raise confidence for a production rollout.
- A next iteration would also add multi-tenancy so the same deployment can serve more than one organization, moving this closer to the ERP module the brief anticipates.
