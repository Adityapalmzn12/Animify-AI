from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class StyleId(str, Enum):
    anime = "anime"
    cartoon = "cartoon"
    three_d = "3d"
    artistic = "artistic"


class JobSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    remove_background: bool = Field(default=False, alias="removeBackground")
    enhance_face: bool = Field(default=False, alias="enhanceFace")
    quality: str = "hd"
    output_format: str = Field(default="mp4", alias="outputFormat")
    preserve_audio: bool = Field(default=True, alias="preserveAudio")


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(alias="jobId")
    video_url: str = Field(alias="videoUrl")
    style: StyleId
    settings: JobSettings = Field(default_factory=JobSettings)
    output_path: str | None = Field(default=None, alias="outputPath")


class CreateJobResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    task_id: str = Field(alias="taskId")


class JobProgressResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    status: JobStatus
    progress: int = 0
    step: str | None = None
    output_url: str | None = Field(default=None, alias="outputUrl")
    error: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
