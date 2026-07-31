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
    cpu_style_filter,
    prompt_for,
)
from app.schemas import JobSettings, StyleId

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, str], None]

# Skip heavy frame extraction when input is large (phone HEVC often OOMs).
MAX_BYTES_FOR_FRAME_PIPELINE = int(
    os.environ.get("MAX_BYTES_FOR_FRAME_PIPELINE", str(12 * 1024 * 1024))
)


def detect_gpu() -> bool:
    if shutil.which("nvidia-smi"):
        return True
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
        suffix = ".mov" if ".mov" in video_url.lower() else ".mp4"
        raw = (work / "input_raw").with_suffix(suffix)
        ffmpeg_ops.download_file_sync(video_url, raw)
        input_size = raw.stat().st_size

        use_gpu = cfg.prefer_gpu and detect_gpu()
        comfy = ComfyUIClient(cfg.comfyui_url)
        comfy_ok = use_gpu and comfy.is_available()

        style_vf, use_complex = cpu_style_filter(style)
        simple_vf = FFMPEG_STYLE_FILTERS[style]
        styled = work / "styled.mp4"
        engine = "cpu-ffmpeg"

        if comfy_ok:
            progress(15, "Normalizing")
            normalized = work / "normalized.mp4"
            ffmpeg_ops.normalize_video(raw, normalized)
            current = normalized

            if (settings.remove_background or settings.enhance_face) and input_size <= MAX_BYTES_FOR_FRAME_PIPELINE:
                progress(25, "BG remove" if settings.remove_background else "Face enhance")
                frames_dir = work / "frames"
                fps = 6.0
                ffmpeg_ops.extract_frames(current, frames_dir, fps=fps)
                if settings.remove_background:
                    mediapipe_ops.soft_background_blur(frames_dir)
                if settings.enhance_face:
                    progress(35, "Face enhance")
                    mediapipe_ops.enhance_faces_in_frames(frames_dir)
                pre = work / "preprocessed.mp4"
                ffmpeg_ops.frames_to_video(frames_dir, pre, fps=fps, audio_source=normalized)
                current = pre

            progress(45, "Style Wan")
            try:
                styled = _run_comfy_wan(
                    comfy=comfy,
                    input_video=current,
                    style=style,
                    work=work,
                    cfg=cfg,
                )
                engine = "wan"
            except Exception as exc:
                logger.warning("ComfyUI/Wan failed, falling back to CPU: %s", exc)
                progress(50, f"Style {style.value}")
                ffmpeg_ops.stylize_one_pass(
                    current,
                    styled,
                    style_vf,
                    preserve_audio=settings.preserve_audio,
                    use_filter_complex=use_complex,
                    simple_vf=simple_vf,
                )
        else:
            # One-pass CPU stylize: decode HEVC once (critical for phone videos on free tier).
            progress(20, "Normalizing")
            # Light normalize only when optional frame steps are needed and file is small
            if (settings.remove_background or settings.enhance_face) and input_size <= MAX_BYTES_FOR_FRAME_PIPELINE:
                normalized = work / "normalized.mp4"
                ffmpeg_ops.normalize_video(raw, normalized)
                progress(30, "BG remove" if settings.remove_background else "Face enhance")
                frames_dir = work / "frames"
                ffmpeg_ops.extract_frames(normalized, frames_dir, fps=6.0)
                if settings.remove_background:
                    mediapipe_ops.soft_background_blur(frames_dir)
                if settings.enhance_face:
                    mediapipe_ops.enhance_faces_in_frames(frames_dir)
                pre = work / "preprocessed.mp4"
                ffmpeg_ops.frames_to_video(frames_dir, pre, fps=6.0, audio_source=normalized)
                progress(50, f"Style {style.value}")
                ffmpeg_ops.stylize_one_pass(
                    pre,
                    styled,
                    style_vf,
                    preserve_audio=settings.preserve_audio,
                    use_filter_complex=use_complex,
                    simple_vf=simple_vf,
                )
            else:
                progress(35, f"Style {style.value}")
                ffmpeg_ops.stylize_one_pass(
                    raw,
                    styled,
                    style_vf,
                    preserve_audio=settings.preserve_audio,
                    use_filter_complex=use_complex,
                    simple_vf=simple_vf,
                )

        progress(85, "Finalize")
        final = work / "final.mp4"
        if settings.preserve_audio and styled.exists():
            # Audio already muxed in one-pass when present; copy as final
            shutil.copy(styled, final)
        else:
            shutil.copy(styled, final)

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
            "engine": engine,
            "style": style.value,
        }
    finally:
        # Best-effort cleanup to free container disk
        try:
            shutil.rmtree(work, ignore_errors=True)
        except Exception:
            pass


def _run_comfy_wan(
    *,
    comfy: ComfyUIClient,
    input_video: Path,
    style: StyleId,
    work: Path,
    cfg: Settings,
) -> Path:
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
    downloaded = comfy.download_output_file(
        filename,
        out if filename.endswith(".mp4") else work / filename,
        subfolder,
        folder_type,
    )
    if downloaded.suffix.lower() != ".mp4":
        ffmpeg_ops.normalize_video(downloaded, out)
        return out
    return downloaded
