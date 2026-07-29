# Animify AI Worker (OSS)

Self-hosted video stylization worker. NestJS enqueues jobs here; no paid cloud AI keys are required.

## Stack

- **FastAPI** — `POST /v1/jobs`, `GET /v1/jobs/{taskId}`, `GET /health`
- **Celery + Redis** — async `process_video_job`
- **FFmpeg + MediaPipe** — CPU / no-GPU path (distinct filters per `anime|cartoon|3d|artistic`)
- **ComfyUI + Wan 2.2** — GPU path when ComfyUI is reachable

## Profiles (docker compose)

From repo root:

```bash
# CPU only (FFmpeg + MediaPipe) — works on laptops / Railway-style hosts without GPU
docker compose --profile cpu up --build postgres redis ai-worker celery-worker api

# GPU — adds ComfyUI (NVIDIA runtime required)
docker compose --profile gpu up --build
```

Set Supabase env vars in the shell or a root `.env`:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=...
SUPABASE_STORAGE_BUCKET=animify-videos
```

## Local run (without Docker)

```bash
cd backend/ai-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill SUPABASE_* and REDIS_URL

# terminal 1 — API
uvicorn app.main:app --reload --port 8000

# terminal 2 — Celery
celery -A app.tasks.celery_app worker -Q animify.video.process -l INFO
```

NestJS should have:

```env
AI_PROVIDER=oss
AI_WORKER_URL=http://localhost:8000
```

## Pipeline steps

1. **Preparing** — download input from signed URL  
2. **Normalizing** — FFmpeg → H.264 MP4  
3. **BG remove / Face enhance** — MediaPipe (optional, from job settings)  
4. **Style Wan** — ComfyUI workflows in `workflows/wan_*.json` when GPU + ComfyUI are up  
5. **Style CPU** — FFmpeg style filters if ComfyUI unavailable  
6. **Finalize / Upload** — mux audio, upload to Supabase  

## GPU hosts (Wan)

Wan 2.2 needs a local or rented GPU (RunPod / Vast / local RTX). Place models under ComfyUI’s `models/` as named in the workflow JSONs (UNET / VAE / CLIP). Install Video Helper Suite (`VHS_*`) custom nodes.

CPU-only machines automatically skip Wan and still produce style-differentiated OSS outputs.

## Health

```bash
curl http://localhost:8000/health
# {"ok":true,"gpu":false,"comfyui":false,"preferGpu":true}
```
