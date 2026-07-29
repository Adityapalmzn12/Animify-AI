from __future__ import annotations

import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Callable

from app.config import Settings, get_settings
from app.pipeline import ffmpeg_ops, mediapipe_ops
from app.pipeline.comfyui_client import (
    ComfyUIClient,
    ComfyUIError,
    inject_wan_params,
    load_workflow_template,
)
from app.pipeline.storage import upload_to_supabase
from app.pipeline.styles import (
    FFMPEG_STYLE_FILTERS,
    STYLE_NEGATIVE,
    WORKFLOW_FILES,
    prompt_for,
)
from app.schemas import JobSettings, StyleId

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, str], None]


def detect_gpu() -> bool:
    # NVIDIA
    if shutil.which("nvidia-smi"):
        return True
    # Apple Metal / CUDA env hints
    if os.environ.get("CUDA_VISIBLE_DEVICES", "") not in ("", "-1"):
        return True
    return False


def run_pipeline(
    *,
    job_id: str,
    video_url: str,
    style: StyleId,
    settings: JobSettings,
    output_path: str | None = None,
    on_progress: ProgressCb | None = None,
    settings_obj: Settings | None = None,
) -> dict[str, Any]:
    cfg = settings_obj or get_settings()
    work = Path(cfg.work_dir) / job_id / str(uuid.uuid4())[:8]
    work.mkdir(parents=True, exist_ok=True)

    def progress(pct: int, step: str) -> None:
        logger.info("[%s] %s%% %s", job_id, pct, step)
        if on_progress:
            on_progress(pct, step)

    try:
        progress(5, "Preparing")
        raw = work / "input_raw"
        # extension from URL if possible
        suffix = ".mp4"
        if ".mov" in video_url.lower():
            suffix = ".mov"
        raw = raw.with_suffix(suffix)
        ffmpeg_ops.download_file_sync(video_url, raw)

        progress(15, "Normalizing")
        normalized = work / "normalized.mp4"
        ffmpeg_ops.normalize_video(raw, normalized)

        use_gpu = cfg.prefer_gpu and detect_gpu()
        comfy = ComfyUIClient(cfg.comfyui_url)
        comfy_ok = use_gpu and comfy.is_available()

        current = normalized

        # Optional CPU MediaPipe steps (also useful before GPU stylize)
        if settings.remove_background or settings.enhance_face:
            progress(25, "BG remove" if settings.remove_background else "Face enhance")
            frames_dir = work / "frames"
            fps = 8.0 if settings.quality != "fhd" else 12.0
            ffmpeg_ops.extract_frames(current, frames_dir, fps=fps)
            if settings.remove_background:
                mediapipe_ops.soft_background_blur(frames_dir)
            if settings.enhance_face:
                progress(35, "Face enhance")
                mediapipe_ops.enhance_faces_in_frames(frames_dir)
            pre = work / "preprocessed.mp4"
            ffmpeg_ops.frames_to_video(frames_dir, pre, fps=fps, audio_source=normalized)
            current = pre

        styled = work / "styled.mp4"

        if comfy_ok:
            progress(45, "Style Wan")
            try:
                styled = _run_comfy_wan(
                    comfy=comfy,
                    input_video=current,
                    style=style,
                    work=work,
                    cfg=cfg,
                )
            except Exception as exc:
                logger.warning("ComfyUI/Wan failed, falling back to CPU: %s", exc)
                progress(50, "Style CPU fallback")
                styled = _run_cpu_style(current, styled, style, settings.preserve_audio)
        else:
            progress(45, "Style CPU")
            styled = _run_cpu_style(current, styled, style, settings.preserve_audio)

        progress(85, "Finalize")
        final = work / "final.mp4"
        if settings.preserve_audio:
            try:
                ffmpeg_ops.mux_audio(styled, normalized, final)
            except Exception:
                shutil.copy(styled, final)
        else:
            shutil.copy(styled, final)

        # Quality bump via ffmpeg scale for fhd
        if settings.quality == "fhd":
            progress(90, "Upscale")
            upscaled = work / "final_fhd.mp4"
            ffmpeg_ops.apply_style_filter(
                final,
                upscaled,
                "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                preserve_audio=True,
            )
            final = upscaled

        progress(95, "Upload")
        object_key = output_path or f"outputs/{job_id}/styled.mp4"
        output_url = upload_to_supabase(
            final,
            object_key,
            supabase_url=cfg.supabase_url,
            supabase_key=cfg.supabase_secret_key,
            bucket=cfg.supabase_storage_bucket,
        )

        progress(100, "Completed")
        return {
            "outputUrl": output_url,
            "outputPath": object_key,
            "engine": "wan" if comfy_ok else "cpu-ffmpeg",
            "style": style.value,
        }
    finally:
        # keep artifacts briefly for debug; wipe on success path optional
        pass


def _run_cpu_style(
    input_path: Path,
    output_path: Path,
    style: StyleId,
    preserve_audio: bool,
) -> Path:
    vf = FFMPEG_STYLE_FILTERS[style]
    return ffmpeg_ops.apply_style_filter(input_path, output_path, vf, preserve_audio)


def _run_comfy_wan(
    *,
    comfy: ComfyUIClient,
    input_video: Path,
    style: StyleId,
    work: Path,
    cfg: Settings,
) -> Path:
    # pipeline -> app -> ai-worker
    workflows_dir = Path(__file__).resolve().parents[2] / "workflows"
    wf_name = WORKFLOW_FILES[style]
    wf_path = workflows_dir / wf_name
    if not wf_path.exists():
        raise ComfyUIError(f"workflow missing: {wf_path}")

    upload_info = comfy.upload_video(input_video)
    video_name = upload_info.get("name") or input_video.name

    workflow = load_workflow_template(wf_path)
    workflow = inject_wan_params(
        workflow,
        video_filename=video_name,
        positive_prompt=prompt_for(style),
        negative_prompt=STYLE_NEGATIVE,
        seed=42,
    )

    prompt_id = comfy.queue_prompt(workflow)
    history = comfy.wait_for_completion(prompt_id)
    filename, subfolder, folder_type = comfy.first_video_or_image_from_history(history)

    out = work / "comfy_out.mp4"
    # If still image sequence exported as gif/webp, we still download and re-encode if needed
    downloaded = comfy.download_output_file(filename, out if filename.endswith(".mp4") else work / filename, subfolder, folder_type)
    if downloaded.suffix.lower() != ".mp4":
        ffmpeg_ops.normalize_video(downloaded, out)
        return out
    return downloaded
