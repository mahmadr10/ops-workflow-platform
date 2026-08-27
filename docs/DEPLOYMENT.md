# Deployment

## Docker Compose (any Docker host)

```bash
cp .env.example .env   # set JWT_SECRET and AI_API_KEY at minimum
docker compose up --build -d
docker compose exec backend npm run seed
```

This brings up PostgreSQL, Redis, the API (port 4000), and the frontend (port 5173) with a single command.

## Live deployment used for this submission (fully free): Render + Vercel

The backend and database run on Render's free tier, the frontend runs on Vercel's free tier. Neither needs a credit card.

### 1. Backend + database on Render

Render reads the `render.yaml` Blueprint at the repo root, so setup is one click:

1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints) and sign in (GitHub login is easiest).
2. Click **New Blueprint Instance**, connect your GitHub account, and select this repository.
3. Render detects `render.yaml` and provisions two resources: a free PostgreSQL database (`ops-platform-db`) and a free Docker web service (`ops-platform-backend`).
4. When prompted for the two secret values it can't generate on its own:
   - `AI_API_KEY`: your Groq (or other OpenAI-compatible) API key
   - `CORS_ORIGIN`: leave blank for now, you'll set it after step 2 below
5. Click **Apply**. The first build takes a few minutes (it runs the Docker build, then `prisma migrate deploy` on boot).
6. Once live, copy the backend's public URL, e.g. `https://ops-platform-backend.onrender.com`.
7. Load demo data (no shell access on the free tier, so this is done through the API instead of `npm run seed`):
   ```bash
   curl -X POST https://ops-platform-backend.onrender.com/api/system/seed-demo-data \
     -H "x-seed-secret: <the SEED_SECRET value Render generated, from the service's Environment tab>"
   ```

**Free tier notes:** the web service spins down after 15 minutes of no traffic and takes 30-60 seconds to wake up on the next request. The free database is deleted after 90 days unless upgraded.

### 2. Frontend on Vercel

```bash
cd frontend
vercel --prod --build-env VITE_API_URL=https://ops-platform-backend.onrender.com/api
```

Or through the dashboard: import the repo at [vercel.com/new](https://vercel.com/new), set the root directory to `frontend`, and add the environment variable `VITE_API_URL` = `https://<your-render-backend>.onrender.com/api`.

### 3. Connect the two

Go back to the Render backend's **Environment** tab and set `CORS_ORIGIN` to your Vercel URL (e.g. `https://ops-workflow-platform.vercel.app`), then redeploy the backend so it accepts requests from the frontend.

## Deploying to any other managed host (Railway / Fly.io / etc.)

Same shape as above, using `backend/Dockerfile` and `frontend/Dockerfile` directly:

1. **Database:** provision a managed PostgreSQL instance and copy its connection string into `DATABASE_URL`.
2. **Backend service:** point the platform at `backend/` with `backend/Dockerfile`, set the environment variables listed in `backend/.env.example`, start command `npx prisma migrate deploy && node dist/index.js`.
3. **Frontend service:** point the platform at `frontend/` with `frontend/Dockerfile`, build arg `VITE_API_URL` set to the backend's public URL plus `/api`.
4. **Seed demo data:** either `npm run seed` in the backend's shell, or `POST /api/system/seed-demo-data` if the host has no shell access (see above).
5. Update `CORS_ORIGIN` on the backend to the frontend's public URL.

## Environment Variables

See `.env.example` (root, for Compose) and `backend/.env.example` / `frontend/.env.example` for the full list. At minimum for a real deployment:

- `DATABASE_URL`
- `JWT_SECRET`
- `AI_API_KEY` (optional; the AI features degrade to a clearly labeled offline fallback without one)
- `CORS_ORIGIN`
- `SEED_SECRET` (optional; only needed to use the shell-less seed endpoint)
