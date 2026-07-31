from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# Free-tier safe defaults — iPhone HEVC/Dolby Vision OOMs at higher res.
FFMPEG_THREADS = os.environ.get("FFMPEG_THREADS", "1")
FFMPEG_PRESET = os.environ.get("FFMPEG_PRESET", "ultrafast")
MAX_SIDE = int(os.environ.get("FFMPEG_MAX_SIDE", "480"))
MAX_FPS = float(os.environ.get("FFMPEG_MAX_FPS", "24"))


class FFmpegError(RuntimeError):
    pass


def _scale_filter(max_side: int) -> str:
    """Scale + force even dims (libx264 requires width/height divisible by 2)."""
    return (
        f"scale='min({max_side},iw)':'min({max_side},ih)'"
        f":force_original_aspect_ratio=decrease:flags=fast_bilinear,"
        f"scale=trunc(iw/2)*2:trunc(ih/2)*2,"
        f"fps={MAX_FPS},"
        f"format=yuv420p"
    )


def _run(cmd: list[str], timeout: int = 900) -> None:
    logger.info("ffmpeg: %s", " ".join(cmd))
    env = {**os.environ, "OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1"}
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise FFmpegError(f"ffmpeg timed out after {timeout}s") from exc

    if result.returncode != 0:
        hint = ""
        if result.returncode in (-9, 137) or (
            isinstance(result.returncode, int) and result.returncode < 0
        ):
            hint = " (process killed — out of memory; retrying at lower quality)"
        tail = (result.stderr or result.stdout or "")[-1200:]
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
        "30",
        "-threads",
        FFMPEG_THREADS,
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "baseline",
        "-level",
        "3.1",
    ]


def _common_input_flags() -> list[str]:
    """Low-memory / phone-video friendly input flags."""
    return [
        "-hide_banner",
        "-loglevel",
        "error",
        "-threads",
        FFMPEG_THREADS,
        "-filter_threads",
        FFMPEG_THREADS,
        "-fflags",
        "+genpts+discardcorrupt",
    ]


def normalize_video(input_path: Path, output_path: Path) -> Path:
    """
    Normalize to H.264 MP4. Retries at lower resolution on OOM/failure.
    Handles iPhone HEVC / Dolby Vision / rotation metadata.
    """
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    attempts = [
        MAX_SIDE,
        min(MAX_SIDE, 360),
        320,
    ]
    # de-dupe while preserving order
    seen: set[int] = set()
    sides = [s for s in attempts if not (s in seen or seen.add(s))]

    last_error: Exception | None = None
    for side in sides:
        try:
            _run(
                [
                    ffmpeg,
                    "-y",
                    *_common_input_flags(),
                    "-i",
                    str(input_path),
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a:0?",
                    "-vf",
                    _scale_filter(side),
                    *_encode_args(),
                    "-c:a",
                    "aac",
                    "-b:a",
                    "64k",
                    "-ac",
                    "1",
                    "-ar",
                    "44100",
                    "-map_metadata",
                    "-1",
                    "-movflags",
                    "+faststart",
                    "-max_muxing_queue_size",
                    "9999",
                    str(output_path),
                ],
                timeout=600,
            )
            return output_path
        except FFmpegError as exc:
            last_error = exc
            logger.warning("normalize failed at max_side=%s: %s", side, exc)
            if output_path.exists():
                output_path.unlink(missing_ok=True)

    # Last resort: video only, no audio, tiniest size
    try:
        _run(
            [
                ffmpeg,
                "-y",
                *_common_input_flags(),
                "-i",
                str(input_path),
                "-map",
                "0:v:0",
                "-an",
                "-vf",
                _scale_filter(240),
                *_encode_args(),
                "-map_metadata",
                "-1",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            timeout=600,
        )
        return output_path
    except FFmpegError as exc:
        last_error = exc

    raise FFmpegError(f"normalize failed after retries: {last_error}")


def apply_style_filter(
    input_path: Path,
    output_path: Path,
    style_vf: str,
    preserve_audio: bool = True,
    *,
    use_filter_complex: bool = False,
) -> Path:
    """Apply style. Retries at lower res on failure."""
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sides = [MAX_SIDE, min(MAX_SIDE, 360), 320]
    seen: set[int] = set()
    sides = [s for s in sides if not (s in seen or seen.add(s))]

    last_error: Exception | None = None
    for side in sides:
        scale = _scale_filter(side)
        try:
            cmd = [ffmpeg, "-y", *_common_input_flags(), "-i", str(input_path)]
            if use_filter_complex and "[styled]" in style_vf:
                # style_vf is a filter_complex graph ending in [styled]
                # Inject scale on input first
                graph = (
                    f"[0:v]{scale}[base];"
                    + style_vf.replace("[0:v]", "[base]").replace("[in]", "[base]")
                )
                if "[styled]" not in graph:
                    graph = f"[0:v]{scale},{style_vf}[styled]"
                cmd += ["-filter_complex", graph, "-map", "[styled]"]
            else:
                cmd += ["-vf", f"{scale},{style_vf}", "-map", "0:v:0"]

            cmd += [*_encode_args()]
            if preserve_audio:
                cmd += [
                    "-map",
                    "0:a:0?",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "64k",
                    "-ac",
                    "1",
                ]
            else:
                cmd += ["-an"]
            cmd += ["-movflags", "+faststart", "-shortest", str(output_path)]
            _run(cmd, timeout=900)
            return output_path
        except FFmpegError as exc:
            last_error = exc
            logger.warning("style failed at max_side=%s: %s", side, exc)
            if output_path.exists():
                output_path.unlink(missing_ok=True)

    raise FFmpegError(f"style encode failed after retries: {last_error}")


def stylize_one_pass(
    input_path: Path,
    output_path: Path,
    style_vf: str,
    *,
    preserve_audio: bool = True,
    use_filter_complex: bool = False,
    simple_vf: str | None = None,
) -> Path:
    """
    Decode phone video once: scale + style + encode in a single ffmpeg call.
    Critical for HEVC/Dolby Vision on small containers (avoids double decode OOM).
    """
    try:
        return apply_style_filter(
            input_path,
            output_path,
            style_vf,
            preserve_audio=preserve_audio,
            use_filter_complex=use_filter_complex,
        )
    except FFmpegError:
        if simple_vf and use_filter_complex:
            logger.warning("filter_complex stylize failed; retrying with simple -vf")
            return apply_style_filter(
                input_path,
                output_path,
                simple_vf,
                preserve_audio=preserve_audio,
                use_filter_complex=False,
            )
        raise



def mux_audio(video_path: Path, audio_source: Path, output_path: Path) -> Path:
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        _run(
            [
                ffmpeg,
                "-y",
                *_common_input_flags(),
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
                "64k",
                "-ac",
                "1",
                "-shortest",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            timeout=300,
        )
        return output_path
    except FFmpegError:
        shutil.copy(video_path, output_path)
        return output_path


def extract_frames(input_path: Path, frames_dir: Path, fps: float = 6.0) -> list[Path]:
    ffmpeg = which_ffmpeg()
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame_%06d.png"
    _run(
        [
            ffmpeg,
            "-y",
            *_common_input_flags(),
            "-i",
            str(input_path),
            "-vf",
            f"{_scale_filter(min(MAX_SIDE, 360))},fps={fps}",
            "-threads",
            FFMPEG_THREADS,
            str(pattern),
        ],
        timeout=600,
    )
    return sorted(frames_dir.glob("frame_*.png"))


def frames_to_video(
    frames_dir: Path,
    output_path: Path,
    fps: float = 6.0,
    audio_source: Path | None = None,
) -> Path:
    ffmpeg = which_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame_%06d.png"
    cmd = [
        ffmpeg,
        "-y",
        *_common_input_flags(),
        "-framerate",
        str(fps),
        "-i",
        str(pattern),
    ]
    if audio_source and audio_source.exists():
        cmd += ["-i", str(audio_source), "-map", "0:v:0", "-map", "1:a:0?", "-shortest"]
    cmd += [*_encode_args(), "-movflags", "+faststart", str(output_path)]
    _run(cmd, timeout=600)
    return output_path


def download_file_sync(url: str, dest: Path) -> Path:
    import httpx

    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=180.0, follow_redirects=True) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                for chunk in resp.iter_bytes():
                    f.write(chunk)
    return dest
