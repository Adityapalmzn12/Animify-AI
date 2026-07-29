from __future__ import annotations

import json
import logging
from typing import Any

from celery import Celery
from redis import Redis

from app.config import get_settings
from app.pipeline.runner import run_pipeline
from app.schemas import JobSettings, JobStatus, StyleId

logger = logging.getLogger(__name__)
settings = get_settings()

celery_app = Celery(
    "animify_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_queue=settings.celery_queue,
    task_routes={
        "app.tasks.process_video_job": {"queue": settings.celery_queue},
    },
)


def _redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def job_key(task_id: str) -> str:
    return f"animify:job:{task_id}"


def set_job_state(task_id: str, **fields: Any) -> None:
    r = _redis()
    payload = {k: (json.dumps(v) if isinstance(v, (dict, list)) else str(v)) for k, v in fields.items()}
    r.hset(job_key(task_id), mapping=payload)
    r.expire(job_key(task_id), 60 * 60 * 48)


def get_job_state(task_id: str) -> dict[str, Any]:
    r = _redis()
    data = r.hgetall(job_key(task_id))
    if not data:
        return {"status": JobStatus.queued.value, "progress": "0", "step": None}
    out: dict[str, Any] = dict(data)
    if "progress" in out:
        try:
            out["progress"] = int(out["progress"])
        except ValueError:
            out["progress"] = 0
    if "meta" in out:
        try:
            out["meta"] = json.loads(out["meta"])
        except json.JSONDecodeError:
            pass
    return out


@celery_app.task(bind=True, name="app.tasks.process_video_job")
def process_video_job(
    self,
    job_id: str,
    video_url: str,
    style: str,
    settings_dict: dict[str, Any] | None = None,
    output_path: str | None = None,
) -> dict[str, Any]:
    task_id = self.request.id or job_id
    set_job_state(
        task_id,
        status=JobStatus.running.value,
        progress=1,
        step="Queued",
        jobId=job_id,
    )

    def on_progress(pct: int, step: str) -> None:
        set_job_state(
            task_id,
            status=JobStatus.running.value,
            progress=pct,
            step=step,
            jobId=job_id,
        )
        try:
            self.update_state(state="PROGRESS", meta={"progress": pct, "step": step})
        except Exception:
            pass

    try:
        result = run_pipeline(
            job_id=job_id,
            video_url=video_url,
            style=StyleId(style),
            settings=JobSettings.model_validate(settings_dict or {}),
            output_path=output_path,
            on_progress=on_progress,
        )
        set_job_state(
            task_id,
            status=JobStatus.completed.value,
            progress=100,
            step="Completed",
            outputUrl=result.get("outputUrl") or "",
            meta=json.dumps(result),
            jobId=job_id,
        )
        return result
    except Exception as exc:
        logger.exception("job %s failed", job_id)
        set_job_state(
            task_id,
            status=JobStatus.failed.value,
            progress=0,
            step="Failed",
            error=str(exc)[:2000],
            jobId=job_id,
        )
        raise
