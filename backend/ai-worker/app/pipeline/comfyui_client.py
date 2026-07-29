from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class ComfyUIError(RuntimeError):
    pass


class ComfyUIClient:
    """Minimal ComfyUI HTTP client: upload input, queue prompt, poll history, download output."""

    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client_id = str(uuid.uuid4())

    def is_available(self) -> bool:
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.get(f"{self.base_url}/system_stats")
                return r.status_code == 200
        except Exception:
            return False

    def upload_image(self, path: Path, subfolder: str = "", overwrite: bool = True) -> dict[str, Any]:
        with path.open("rb") as f:
            files = {"image": (path.name, f, "application/octet-stream")}
            data = {"overwrite": str(overwrite).lower(), "subfolder": subfolder}
            with httpx.Client(timeout=120.0) as client:
                r = client.post(f"{self.base_url}/upload/image", files=files, data=data)
                r.raise_for_status()
                return r.json()

    def upload_video(self, path: Path) -> dict[str, Any]:
        # ComfyUI treats video uploads similarly via /upload/image with type=input
        with path.open("rb") as f:
            files = {"image": (path.name, f, "video/mp4")}
            data = {"overwrite": "true", "type": "input"}
            with httpx.Client(timeout=300.0) as client:
                r = client.post(f"{self.base_url}/upload/image", files=files, data=data)
                r.raise_for_status()
                return r.json()

    def queue_prompt(self, workflow: dict[str, Any]) -> str:
        payload = {"prompt": workflow, "client_id": self.client_id}
        with httpx.Client(timeout=60.0) as client:
            r = client.post(f"{self.base_url}/prompt", json=payload)
            if r.status_code >= 400:
                raise ComfyUIError(f"queue failed: {r.status_code} {r.text[:500]}")
            data = r.json()
            prompt_id = data.get("prompt_id")
            if not prompt_id:
                raise ComfyUIError(f"no prompt_id in response: {data}")
            return prompt_id

    def get_history(self, prompt_id: str) -> dict[str, Any]:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(f"{self.base_url}/history/{prompt_id}")
            r.raise_for_status()
            return r.json()

    def wait_for_completion(
        self,
        prompt_id: str,
        poll_interval: float = 2.0,
        timeout: float = 1800.0,
    ) -> dict[str, Any]:
        deadline = time.time() + timeout
        while time.time() < deadline:
            history = self.get_history(prompt_id)
            if prompt_id in history:
                entry = history[prompt_id]
                status = entry.get("status", {})
                if status.get("status_str") == "error" or status.get("completed") is False and status.get("messages"):
                    msgs = status.get("messages") or []
                    raise ComfyUIError(f"ComfyUI error: {msgs}")
                outputs = entry.get("outputs") or {}
                if outputs:
                    return entry
            time.sleep(poll_interval)
        raise ComfyUIError(f"timeout waiting for prompt {prompt_id}")

    def download_output_file(
        self,
        filename: str,
        dest: Path,
        subfolder: str = "",
        folder_type: str = "output",
    ) -> Path:
        params = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        dest.parent.mkdir(parents=True, exist_ok=True)
        with httpx.Client(timeout=300.0) as client:
            r = client.get(f"{self.base_url}/view", params=params)
            r.raise_for_status()
            dest.write_bytes(r.content)
        return dest

    def first_video_or_image_from_history(self, history_entry: dict[str, Any]) -> tuple[str, str, str]:
        """Return (filename, subfolder, type) of first media output."""
        outputs = history_entry.get("outputs") or {}
        for _node_id, node_out in outputs.items():
            for key in ("gifs", "videos", "images"):
                items = node_out.get(key) or []
                if items:
                    item = items[0]
                    return (
                        item["filename"],
                        item.get("subfolder", ""),
                        item.get("type", "output"),
                    )
        raise ComfyUIError("no media outputs in ComfyUI history")


def load_workflow_template(path: Path) -> dict[str, Any]:
    with path.open() as f:
        return json.load(f)


def inject_wan_params(
    workflow: dict[str, Any],
    *,
    video_filename: str,
    positive_prompt: str,
    negative_prompt: str,
    seed: int | None = None,
) -> dict[str, Any]:
    """
    Patch common placeholders in Wan workflow JSON.
    Nodes may use class_type LoadVideo / CLIPTextEncode / etc.
    Also supports string placeholders: {{VIDEO}}, {{POSITIVE}}, {{NEGATIVE}}, {{SEED}}.
    """
    raw = json.dumps(workflow)
    raw = raw.replace("{{VIDEO}}", video_filename)
    raw = raw.replace("{{POSITIVE}}", positive_prompt.replace('"', '\\"'))
    raw = raw.replace("{{NEGATIVE}}", negative_prompt.replace('"', '\\"'))
    if seed is not None:
        raw = raw.replace("{{SEED}}", str(seed))
    patched = json.loads(raw)

    for node in patched.values():
        if not isinstance(node, dict):
            continue
        class_type = node.get("class_type", "")
        inputs = node.get("inputs") or {}
        if class_type in ("LoadVideo", "VHS_LoadVideo", "LoadVideoPath"):
            if "video" in inputs:
                inputs["video"] = video_filename
            if "file" in inputs:
                inputs["file"] = video_filename
        if class_type == "CLIPTextEncode":
            text = str(inputs.get("text", ""))
            if "{{POSITIVE}}" in text or text == "POSITIVE_PROMPT":
                inputs["text"] = positive_prompt
            if "{{NEGATIVE}}" in text or text == "NEGATIVE_PROMPT":
                inputs["text"] = negative_prompt
            # Heuristic: first encode with empty/placeholder gets positive
            if text in ("", "positive", "prompt"):
                inputs["text"] = positive_prompt
        node["inputs"] = inputs
    return patched
