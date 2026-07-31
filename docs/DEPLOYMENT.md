# Animify AI — Production deployment

## Architecture

- **API**: NestJS (`backend/animify-api`) — auth, projects, credits, generator, payments, admin
- **Queue**: BullMQ on Redis — `ai-jobs` processor
- **Worker**: FastAPI + Celery (`backend/ai-worker`) — FFmpeg / Wan / ComfyUI
- **Storage**: Supabase by default; set `STORAGE_PROVIDER=s3` for S3+CloudFront
- **Realtime**: Socket.IO namespace `/jobs` for job progress

## Railway (combined image)

Use `backend/Dockerfile.railway` + `backend/start-prod.sh`:

1. Nest listens on `API_PORT` / non-6379 `PORT`
2. Uvicorn worker on `127.0.0.1:8000`
3. Celery worker against Redis

Required Railway services: **Postgres**, **Redis**, one web service.

```bash
# After deploy
npx prisma migrate deploy
```

Set `AI_WORKER_URL=http://127.0.0.1:8000` and `AI_PROVIDER=oss`.

## GPU worker hosting (Text→Video quality)

True Kling/Runway-class output needs a GPU host (RunPod / Vast / self-hosted) running ComfyUI + Wan. Point `AI_WORKER_URL` at that host, or configure `FAL_API_KEY` / `REPLICATE_API_TOKEN` for paid T2V.

Free Railway CPU remains suitable for stylize / FFmpeg animate paths.

## Docker Compose (local full stack)

```bash
docker compose up --build
```

See root `docker-compose.yml` for Postgres, Redis, API, and worker.

## Migrations

```bash
cd backend/animify-api
npx prisma migrate deploy
npx prisma generate
```

Platform foundation migration: `20260730120000_platform_foundation`.

## Health

- `GET /health` — liveness
- `GET /ready` — Postgres + Redis
- Swagger: `/api/docs`

## Stripe webhooks

Point Stripe to `POST /api/v1/payments/webhook/stripe` with `STRIPE_WEBHOOK_SECRET`. Raw body enabled in Nest bootstrap.

## Security checklist

- Helmet enabled
- Global JWT + Roles guards
- Throttler rate limits
- Refresh token rotation + reuse detection
- Never commit secrets; use Railway/GitHub env vars
