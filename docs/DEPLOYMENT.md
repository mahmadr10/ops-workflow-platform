# Deployment

## Docker Compose (any Docker host)

```bash
cp .env.example .env   # set JWT_SECRET and AI_API_KEY at minimum
docker compose up --build -d
docker compose exec backend npm run seed
```

This brings up PostgreSQL, Redis, the API (port 4000), and the frontend (port 5173) with a single command, and is the deployment path used for this submission.

## Deploying to a managed host (Railway / Render / Fly.io)

Each of these platforms can build directly from `backend/Dockerfile` and `frontend/Dockerfile`.

1. **Database:** provision a managed PostgreSQL instance (Railway and Render both offer one-click PostgreSQL) and copy its connection string into `DATABASE_URL`.
2. **Backend service:** point the platform at `backend/` with `backend/Dockerfile`, set the environment variables listed in `backend/.env.example`, and set the start command to `npx prisma migrate deploy && node dist/index.js` (already the default `CMD`/compose command).
3. **Frontend service:** point the platform at `frontend/` with `frontend/Dockerfile`, and set the build arg `VITE_API_URL` to the backend's public URL plus `/api`.
4. **Seed demo data:** run `npm run seed` once inside the backend service's shell (Railway/Render both expose a one-off run/shell command).
5. Update `CORS_ORIGIN` on the backend to the frontend's public URL.

## Environment Variables

See `.env.example` (root, for Compose) and `backend/.env.example` / `frontend/.env.example` for the full list. At minimum for a real deployment:

- `DATABASE_URL`
- `JWT_SECRET`
- `AI_API_KEY` (optional; the AI features degrade to a clearly labeled offline fallback without one)
- `CORS_ORIGIN`
