"""
storage.py
==========
Supabase Storage access for generated PDFs, via plain HTTP.

WHY NOT THE supabase-py SDK. The backend needs exactly two calls — an upload
and a signed-URL mint. Both are single REST requests against a stable API, and
pulling in the whole SDK (plus its auth and realtime machinery) for them adds
dependency weight without adding safety. httpx is already a requirement.

THE SERVICE-ROLE KEY IS MANDATORY for these calls: the bucket is private, so
uploads bypass RLS with the service key and downloads happen through
short-lived signed URLs handed out only after this server has checked
ownership. The service key therefore never leaves the process.
"""

import logging
from urllib.parse import quote

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_URL_TTL_S = 300


class StorageUnavailable(RuntimeError):
    """Storage not configured, or the API refused the call."""


def _base() -> tuple[str, str, str]:
    """(project_url, service_key, bucket) or raise."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        raise StorageUnavailable(
            "Supabase Storage is not configured "
            "(SUPABASE_URL / SUPABASE_SERVICE_KEY missing)."
        )
    return (
        s.supabase_url.rstrip("/"),
        s.supabase_service_key,
        s.storage_bucket,
    )


def _object_path(bucket: str, object_key: str) -> str:
    # Object keys contain user UUIDs and notebook UUIDs; quote defensively.
    return f"{bucket}/{quote(object_key, safe='/')}"


async def upload_pdf(object_key: str, pdf: bytes) -> None:
    """Upload/overwrite one PDF at <object_key> inside the private bucket."""
    base, key, bucket = _base()
    url = f"{base}/storage/v1/object/{_object_path(bucket, object_key)}"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            content=pdf,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/pdf",
                "x-upsert": "true",
            },
        )
    if resp.status_code >= 400:
        logger.error("Storage upload failed (%s): %s", resp.status_code, resp.text[:300])
        raise StorageUnavailable(f"Upload failed with status {resp.status_code}.")


async def signed_pdf_url(object_key: str, ttl_s: int = DEFAULT_URL_TTL_S) -> str:
    """Mint a short-lived download URL. Ownership must already be checked."""
    base, key, bucket = _base()
    url = f"{base}/storage/v1/object/sign/{_object_path(bucket, object_key)}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            json={"expiresIn": ttl_s},
            headers={"Authorization": f"Bearer {key}"},
        )
    if resp.status_code >= 400:
        logger.error("Sign failed (%s): %s", resp.status_code, resp.text[:300])
        raise StorageUnavailable(f"Signing failed with status {resp.status_code}.")
    signed = resp.json().get("signedURL")
    if not signed:
        raise StorageUnavailable("Signing returned no URL.")
    return f"{base}/storage/v1{signed}"


async def delete_object(object_key: str) -> None:
    """Best-effort delete; a missing object is fine (200/404 both acceptable)."""
    base, key, bucket = _base()
    url = f"{base}/storage/v1/object/{_object_path(bucket, object_key)}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.delete(url, headers={"Authorization": f"Bearer {key}"})
    except httpx.HTTPError as e:  # noqa: BLE001 — cleanup must never raise
        logger.warning("Storage delete of %s failed: %s", object_key, e)


def storage_configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and s.supabase_service_key)
