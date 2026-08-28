# Build Log

## Timeline

Built in a single focused session (starting under a 1-hour target) using Claude Code as the primary development tool, working directly in the target repository from an empty folder to a working full-stack application with Docker Compose, seed data, tests, CI, and documentation. The initial build finished within the hour; the session continued afterward for live testing, demo preparation, and the production deployment described below.

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

- **Time budget vs. scope.** The brief is a 20-35 hour assignment compressed into roughly one hour for the initial build. The solution was to build every rubric category to a genuinely working (not stubbed) depth rather than polishing a subset to production gloss: auth and RBAC are real, the workflow engine is real and data-driven, the Kanban board really drags and persists, the AI calls really hit a live LLM, exports really produce valid CSV/XLSX/PDF files.
- **Keeping AI features from being a demo-only toggle.** Risk scoring and reminder evaluation run on a real hourly cron job against the actual database, not a button that only works when clicked, so the "AI agent monitors workflows every hour" bonus is implemented as infrastructure, not a script.
- **Optimistic Kanban updates without a stale board on failure.** The drag handler updates the TanStack Query cache immediately, then reconciles from the server; a failed PATCH invalidates the query so the board self-corrects instead of silently drifting from the database.
- **A model got retired mid-project.** The AI layer originally targeted Groq's `llama-3.3-70b-versatile`; Groq had since removed it from their catalog, so live calls were silently falling back to an offline message. Caught by actually calling the endpoint rather than trusting the code, and fixed by switching to `openai/gpt-oss-120b`.
- **Prisma on Alpine Linux.** The first live deployment crash-looped with `Could not parse schema engine response`, a classic mismatch between Prisma's query engine binary and the OpenSSL version `node:20-alpine` ships. Fixed by installing `openssl` in the Docker image and adding `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to the Prisma schema.
- **Free-tier hosting without a shell.** Render and Railway's free tiers don't offer interactive shell access to run a one-off seed script. Solved with a small protected HTTP endpoint (`POST /api/system/seed-demo-data`) that runs the same seeder over the network, guarded by a secret header and a no-op check if the database already has data, so it can never duplicate demo content.
- **A "free" host asking for a card.** Render's free tier turned out to require card-based identity verification (a refunded $1 hold) to provision even free services. Since the goal was a genuinely zero-cost, zero-card deployment, pivoted to Railway, whose trial credit requires no card at all.
- **Reasoning models silently truncating output.** The daily standup report was occasionally cutting off mid-sentence. Root cause: `openai/gpt-oss-120b` is a reasoning model, it spends part of the `max_tokens` budget on a hidden "reasoning" pass (returned separately as `message.reasoning`, not `message.content`) before writing the visible answer. With enough items to reason about, the visible answer got cut off before `max_tokens` was reached for content, even though the request itself "succeeded". Fixed by raising every call's token budget generously and logging a warning whenever `finish_reason === "length"`, so a truncation can never ship silently again.
- **Real usage moving rehearsed demo data.** Testing the live app (dragging cards, changing status) naturally moves the exact "candidate stuck 9 days" scenario the demo script depends on. Solved generally rather than by hand-editing the database: `POST /api/system/reset-demo-data` wipes and reseeds the pristine dataset over HTTP, on any host, no shell access needed, so the rehearsed scenario can always be restored right before a real demo.

## What I Learned / What I Would Improve Next

- With more time, attachments would move from metadata-only rows to real object storage (S3/MinIO) with pre-signed upload URLs.
- Redis is provisioned in Compose but not yet used for caching or a BullMQ job queue; the reminder engine currently runs as an in-process `node-cron` job, which is fine for a single instance but would need to move to a real queue for horizontal scaling.
- Real-time collaboration (WebSockets) would remove the need to poll/refetch after teammates change a board.
- A broader automated test suite (currently a focused smoke suite for health, auth, and metrics) would raise confidence for a production rollout.
- A next iteration would also add multi-tenancy so the same deployment can serve more than one organization, moving this closer to the ERP module the brief anticipates.
