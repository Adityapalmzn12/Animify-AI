#!/bin/sh
set -eu

# Build Redis URL for Celery from Railway Redis plugin vars when REDIS_URL is unset.
if [ -z "${REDIS_URL:-}" ]; then
  HOST="${REDIS_HOST:-redis.railway.internal}"
  PORT="${REDIS_PORT:-6379}"
  PASS="${REDIS_PASSWORD:-}"
  if [ -n "$PASS" ]; then
    export REDIS_URL="redis://:${PASS}@${HOST}:${PORT}/0"
  else
    export REDIS_URL="redis://${HOST}:${PORT}/0"
  fi
fi

export CELERY_QUEUE="${CELERY_QUEUE:-animify.video.process}"
export WORK_DIR="${WORK_DIR:-/tmp/animify-worker}"
export PREFER_GPU="${PREFER_GPU:-false}"
export COMFYUI_URL="${COMFYUI_URL:-http://127.0.0.1:8188}"
export FFMPEG_MAX_SIDE="${FFMPEG_MAX_SIDE:-480}"
export FFMPEG_THREADS="${FFMPEG_THREADS:-1}"
export FFMPEG_PRESET="${FFMPEG_PRESET:-ultrafast}"
export FFMPEG_MAX_FPS="${FFMPEG_MAX_FPS:-24}"
export PYTHONPATH="/app/ai-worker${PYTHONPATH:+:$PYTHONPATH}"
export AI_WORKER_URL="${AI_WORKER_URL:-http://127.0.0.1:8000}"
export AI_PROVIDER="${AI_PROVIDER:-oss}"

mkdir -p "$WORK_DIR"

echo "[start] Migrating database..."
cd /app/api
npx prisma migrate deploy

echo "[start] Launching AI worker (FastAPI) on 127.0.0.1:8000..."
cd /app/ai-worker
uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info &
UVICORN_PID=$!

echo "[start] Launching Celery worker..."
celery -A app.tasks.celery_app worker \
  --loglevel=INFO \
  --queues="${CELERY_QUEUE}" \
  --concurrency=1 \
  --hostname=animify@%h &
CELERY_PID=$!

cleanup() {
  echo "[start] Shutting down..."
  kill "$UVICORN_PID" "$CELERY_PID" 2>/dev/null || true
  wait "$UVICORN_PID" "$CELERY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait briefly so Nest can reach the worker immediately
i=0
while [ "$i" -lt 30 ]; do
  if wget -qO- "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    echo "[start] AI worker healthy"
    break
  fi
  i=$((i + 1))
  sleep 1
done

# Nest must listen on the public HTTP port (3000). Railway Redis may inject PORT=6379.
if [ -n "${API_PORT:-}" ]; then
  export PORT="$API_PORT"
elif [ -z "${PORT:-}" ] || [ "$PORT" = "6379" ] || [ "$PORT" = "${REDIS_PORT:-}" ]; then
  export PORT=3000
fi

echo "[start] Launching NestJS API on port ${PORT}..."
cd /app/api
exec node dist/src/main
