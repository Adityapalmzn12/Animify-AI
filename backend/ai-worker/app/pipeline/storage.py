from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)


def upload_to_supabase(
    local_path: Path,
    object_key: str,
    *,
    supabase_url: str,
    supabase_key: str,
    bucket: str,
    content_type: str = "video/mp4",
) -> str:
    """
    Upload via Storage REST (supports sb_secret_ / legacy JWT service keys).
    Returns a signed download URL.
    """
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SECRET_KEY not configured on worker")

    base = supabase_url.rstrip("/")
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key,
    }
    # upsert
    upload_url = f"{base}/storage/v1/object/{bucket}/{quote(object_key, safe='/')}"
    data = local_path.read_bytes()
    with httpx.Client(timeout=120.0) as client:
        put = client.post(
            upload_url,
            content=data,
            headers={
                **headers,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
        if put.status_code >= 400:
            # retry as PUT for some gateways
            put = client.put(
                upload_url,
                content=data,
                headers={
                    **headers,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
        if put.status_code >= 400:
            raise RuntimeError(f"Supabase upload failed: {put.status_code} {put.text[:500]}")

        sign = client.post(
            f"{base}/storage/v1/object/sign/{bucket}/{quote(object_key, safe='/')}",
            headers={**headers, "Content-Type": "application/json"},
            json={"expiresIn": 60 * 60 * 24},
        )
        if sign.status_code >= 400:
            raise RuntimeError(f"Supabase sign failed: {sign.status_code} {sign.text[:500]}")
        body = sign.json()
        signed_path = body.get("signedURL") or body.get("signedUrl") or ""
        if not signed_path:
            raise RuntimeError(f"Supabase sign returned no URL: {body}")
        if signed_path.startswith("http"):
            url = signed_path
        else:
            url = f"{base}/storage/v1{signed_path}" if signed_path.startswith("/") else f"{base}/storage/v1/{signed_path}"
    logger.info("uploaded %s -> %s", object_key, url[:100])
    return url
