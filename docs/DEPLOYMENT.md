# Deployment

## Live deployment used for this submission: Railway (backend + database) + Vercel (frontend)

- **Frontend:** https://ops-workflow-platform.vercel.app
- **Backend:** https://backend-production-2be1.up.railway.app

Railway was chosen over Render because Render now requires a card for identity verification (a refunded $1 hold) even on its free tier; Railway's trial credit needs no card at all.

### How it was deployed

```bash
# Backend + Postgres on Railway
railway init --name ops-workflow-platform
railway add --database postgres
railway add --service backend
cd backend
railway variable set "DATABASE_URL=\${{Postgres.DATABASE_URL}}"
railway variable set "JWT_SECRET=<random>"
railway variable set "SEED_SECRET=<random>"
railway variable set "AI_PROVIDER=groq"
railway variable set "AI_API_KEY=<your Groq key>"
railway variable set "AI_BASE_URL=https://api.groq.com/openai/v1"
railway variable set "AI_MODEL=openai/gpt-oss-120b"
railway variable set "CORS_ORIGIN=<your Vercel URL>"
railway up --service backend
railway domain   # generates the public URL

# Load demo data (Railway's free tier has no interactive shell access from the CLI in this flow,
# so this reuses the same shell-less seed endpoint built for Render)
curl -X POST https://<your-backend>.up.railway.app/api/system/seed-demo-data \
  -H "x-seed-secret: <the SEED_SECRET value you set above>"

# Frontend on Vercel
cd ../frontend
vercel link --yes --project ops-workflow-platform
vercel env add VITE_API_URL production   # paste https://<your-backend>.up.railway.app/api
vercel --prod --yes
```

The backend's `Dockerfile` runs `npx prisma migrate deploy` automatically on every boot before starting the server, so schema migrations apply themselves on each deploy, no manual step needed.

**A note on Alpine + Prisma:** `node:20-alpine` doesn't ship the OpenSSL version Prisma's engine expects by default, which shows up as `Could not parse schema engine response`. Fixed by installing `openssl` in the Docker image and adding `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to the Prisma `generator client` block.

## Docker Compose (any Docker host, including fully offline)

```bash
cp .env.example .env   # set JWT_SECRET and AI_API_KEY at minimum
docker compose up --build -d
docker compose exec backend npm run seed
```

This brings up PostgreSQL, Redis, the API (port 4000), and the frontend (port 5173) with a single command.

## Alternative: Render (needs card verification)

Render also works, using the `render.yaml` Blueprint at the repo root:

1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints), sign in, click **New Blueprint Instance**, select this repo.
2. Render provisions a free PostgreSQL database and a free Docker web service from `render.yaml`.
3. It will ask for a card for identity verification (a $1 hold, refunded, not an actual charge) before creating the free services.
4. Fill in `AI_API_KEY`, leave `CORS_ORIGIN` blank initially, click **Apply**.
5. Once live, seed it the same way as Railway above, against the Render URL instead.

**Free tier notes:** Render's web service spins down after 15 minutes of no traffic (30-60 second wake-up on the next request); its free database is deleted after 90 days unless upgraded.

## Deploying to any other managed host (Fly.io, etc.)

Same shape, using `backend/Dockerfile` and `frontend/Dockerfile` directly:

1. **Database:** provision a managed PostgreSQL instance and copy its connection string into `DATABASE_URL`.
2. **Backend service:** point the platform at `backend/` with `backend/Dockerfile`, set the environment variables listed in `backend/.env.example`. Migrations run automatically on boot.
3. **Frontend service:** point the platform at `frontend/` with `frontend/Dockerfile`, build arg `VITE_API_URL` set to the backend's public URL plus `/api`.
4. **Seed demo data:** either `npm run seed` in the backend's shell, or `POST /api/system/seed-demo-data` if the host has no shell access.
5. Update `CORS_ORIGIN` on the backend to the frontend's public URL.

## Environment Variables

See `.env.example` (root, for Compose) and `backend/.env.example` / `frontend/.env.example` for the full list. At minimum for a real deployment:

- `DATABASE_URL`
- `JWT_SECRET`
- `AI_API_KEY` (optional; the AI features degrade to a clearly labeled offline fallback without one)
- `CORS_ORIGIN`
- `SEED_SECRET` (optional; only needed to use the shell-less seed endpoint)
