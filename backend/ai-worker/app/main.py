from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.pipeline.runner import detect_gpu
from app.pipeline.comfyui_client import ComfyUIClient
from app.schemas import CreateJobRequest, CreateJobResponse, JobProgressResponse, JobStatus
from app.tasks import get_job_state, process_video_job, set_job_state

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    logger.info(
        "ai-worker starting redis=%s comfy=%s gpu=%s",
        settings.redis_url,
        settings.comfyui_url,
        detect_gpu(),
    )
    yield


app = FastAPI(
    title="Animify AI Worker",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    settings = get_settings()
    comfy = ComfyUIClient(settings.comfyui_url)
    return {
        "ok": True,
        "gpu": detect_gpu(),
        "comfyui": comfy.is_available(),
        "preferGpu": settings.prefer_gpu,
    }


@app.post("/v1/jobs", response_model=CreateJobResponse)
def create_job(body: CreateJobRequest):
    settings_dict = body.settings.model_dump(by_alias=True)
    async_result = process_video_job.delay(
        job_id=body.job_id,
        video_url=body.video_url,
        style=body.style.value,
        settings_dict=settings_dict,
        output_path=body.output_path,
    )
    task_id = async_result.id
    set_job_state(
        task_id,
        status=JobStatus.queued.value,
        progress=0,
        step="Queued",
        jobId=body.job_id,
    )
    return CreateJobResponse(taskId=task_id)


@app.get("/v1/jobs/{task_id}", response_model=JobProgressResponse)
def get_job(task_id: str):
    state = get_job_state(task_id)
    if not state:
        raise HTTPException(status_code=404, detail="task not found")
    status_raw = state.get("status") or JobStatus.queued.value
    try:
        status = JobStatus(status_raw)
    except ValueError:
        status = JobStatus.running
    return JobProgressResponse(
        status=status,
        progress=int(state.get("progress") or 0),
        step=state.get("step"),
        outputUrl=state.get("outputUrl") or None,
        error=state.get("error") or None,
        meta=state.get("meta") if isinstance(state.get("meta"), dict) else {},
    )
