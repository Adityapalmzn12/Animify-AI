from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# Keep free-tier / small containers from OOMing on 1080p+ phone videos.
FFMPEG_THREADS = os.environ.get("FFMPEG_THREADS", "2")
FFMPEG_PRESET = os.environ.get("FFMPEG_PRESET", "ultrafast")
# Longest side cap (vertical 1080x1920 → 720x1280)
MAX_SIDE = int(os.environ.get("FFMPEG_MAX_SIDE", "720"))
SCALE_FILTER = (
    f"scale='min({MAX_SIDE},iw)':'min({MAX_SIDE},ih)'"
    f":force_original_aspect_ratio=decrease"
)


class FFmpegError(RuntimeError):
    pass


def _run(cmd: list[str], timeout: int = 900) -> None:
    logger.info("ffmpeg: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise FFmpegError(f"ffmpeg timed out after {timeout}s") from exc

    if result.returncode != 0:
        # Negative codes / 137 often mean SIGKILL (OOM)
        hint = ""
        if result.returncode in (-9, 137, None) or (
            isinstance(result.returncode, int) and result.returncode < 0
        ):
            hint = " (process killed — likely out of memory; video was too large)"
        tail = (result.stderr or result.stdout or "")[-1500:]
        raise FFmpegError(f"ffmpeg exited {result.returncode}{hint}: {tail}")


def which_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise FFmpegError("ffmpeg not found on PATH")
    return path


def _encode_args() -> list[str]:
    return [
        "-c:v",
        "libx264",
        "-preset",
        FFMPEG_PRESET,
        "-crf",
        "28",
        "-threads",
        FFMPEG_THREADS,
        "-pix_fmt",
        "yuv420p",
    ]


def normalize_video(input_path: Path, output_path: Path) -> Path:
    """Normalize to H.264 MP4 with AAC audio for downstream steps."""
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(input_path),
            "-vf",
            SCALE_FILTER,
            *_encode_args(),
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    return output_path


def apply_style_filter(
    input_path: Path,
    output_path: Path,
    vf: str,
    preserve_audio: bool = True,
) -> Path:
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Chain scale + style so style pass stays memory-safe too
    combined_vf = f"{SCALE_FILTER},{vf}" if vf else SCALE_FILTER
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-vf",
        combined_vf,
        *_encode_args(),
    ]
    if preserve_audio:
        cmd += ["-c:a", "aac", "-b:a", "96k", "-ac", "2"]
    else:
        cmd += ["-an"]
    cmd += ["-movflags", "+faststart", str(output_path)]
    _run(cmd)
    return output_path


def mux_audio(video_path: Path, audio_source: Path, output_path: Path) -> Path:
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(audio_source),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0?",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    return output_path


def extract_frames(input_path: Path, frames_dir: Path, fps: float = 8.0) -> list[Path]:
    ffmpeg = which_ffmpeg()
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame_%06d.png"
    _run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(input_path),
            "-vf",
            f"{SCALE_FILTER},fps={fps}",
            "-threads",
            FFMPEG_THREADS,
            str(pattern),
        ]
    )
    return sorted(frames_dir.glob("frame_*.png"))


def frames_to_video(
    frames_dir: Path,
    output_path: Path,
    fps: float = 8.0,
    audio_source: Path | None = None,
) -> Path:
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame_%06d.png"
    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(pattern),
    ]
    if audio_source and audio_source.exists():
        cmd += ["-i", str(audio_source), "-map", "0:v:0", "-map", "1:a:0?", "-shortest"]
    cmd += [
        *_encode_args(),
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    _run(cmd)
    return output_path


async def download_file(url: str, dest: Path) -> Path:
    import httpx

    dest.parent.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in resp.aiter_bytes():
                    f.write(chunk)
    return dest


def download_file_sync(url: str, dest: Path) -> Path:
    import httpx

    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                for chunk in resp.iter_bytes():
                    f.write(chunk)
    return dest
