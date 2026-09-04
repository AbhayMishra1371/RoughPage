"""
supabase_db.py
==============
Supabase PostgREST database client using HTTPX.

Directly performs CRUD operations against the Supabase `notebooks` table
via the PostgREST REST API over HTTPS. No direct PostgreSQL database
connection or psycopg2 driver needed.

If the user's JWT token is supplied, it is forwarded in the Authorization
header so Supabase Row Level Security (RLS) policies are honored.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class SupabaseDbError(Exception):
    def __init__(self, message: str, status_code: int | None = None, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


def is_supabase_db_configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and (s.supabase_anon_key or s.supabase_service_key))


def _get_headers(user_token: str | None = None) -> dict[str, str]:
    s = get_settings()
    api_key = s.supabase_service_key or s.supabase_anon_key or ""
    bearer_token = user_token or s.supabase_service_key or s.supabase_anon_key or ""
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {bearer_token}",
        "Content-Type": "application/json",
    }


def _table_url() -> str:
    s = get_settings()
    base = (s.supabase_url or "").rstrip("/")
    return f"{base}/rest/v1/notebooks"


async def insert_notebook(data: dict[str, Any], user_token: str | None = None) -> dict[str, Any]:
    """Insert a notebook record into Supabase via REST API."""
    url = _table_url()
    headers = _get_headers(user_token)
    headers["Prefer"] = "return=representation"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, json=data)

    if resp.status_code not in (200, 201):
        logger.error("Supabase insert error (%s): %s", resp.status_code, resp.text[:300])
        raise SupabaseDbError(
            f"Failed to save notebook: {resp.text}",
            status_code=resp.status_code,
            details=resp.text,
        )

    res = resp.json()
    return res[0] if isinstance(res, list) and res else res


async def list_notebooks(owner_id: str, user_token: str | None = None) -> list[dict[str, Any]]:
    """List notebooks owned by owner_id."""
    params = {
        "owner_id": f"eq.{owner_id}",
        "order": "created_at.desc",
        "select": "id,owner_id,title,subject,style,source_url,video_id,page_count,pdf_object_key,created_at",
    }
    url = _table_url()
    headers = _get_headers(user_token)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params=params)

    if resp.status_code != 200:
        logger.error("Supabase list error (%s): %s", resp.status_code, resp.text[:300])
        raise SupabaseDbError(
            f"Failed to list notebooks: {resp.text}",
            status_code=resp.status_code,
            details=resp.text,
        )

    return resp.json()


async def get_notebook(notebook_id: str, owner_id: str, user_token: str | None = None) -> dict[str, Any] | None:
    """Fetch one notebook by id and owner_id."""
    params = {
        "id": f"eq.{notebook_id}",
        "owner_id": f"eq.{owner_id}",
        "select": "*",
    }
    url = _table_url()
    headers = _get_headers(user_token)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params=params)

    if resp.status_code != 200:
        logger.error("Supabase get error (%s): %s", resp.status_code, resp.text[:300])
        raise SupabaseDbError(
            f"Failed to get notebook: {resp.text}",
            status_code=resp.status_code,
            details=resp.text,
        )

    rows = resp.json()
    if not rows or len(rows) == 0:
        return None
    return rows[0]


async def update_notebook(
    notebook_id: str,
    updates: dict[str, Any],
    user_token: str | None = None,
) -> dict[str, Any] | None:
    """Update a notebook record."""
    params = {"id": f"eq.{notebook_id}"}
    url = _table_url()
    headers = _get_headers(user_token)
    headers["Prefer"] = "return=representation"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.patch(url, headers=headers, params=params, json=updates)

    if resp.status_code not in (200, 204):
        logger.error("Supabase update error (%s): %s", resp.status_code, resp.text[:300])
        raise SupabaseDbError(
            f"Failed to update notebook: {resp.text}",
            status_code=resp.status_code,
            details=resp.text,
        )

    if resp.status_code == 204 or not resp.text.strip():
        return updates
    res = resp.json()
    return res[0] if isinstance(res, list) and res else res


async def delete_notebook(
    notebook_id: str,
    owner_id: str,
    user_token: str | None = None,
) -> dict[str, Any] | None:
    """Delete a notebook by id and owner_id. Returns the deleted row if found."""
    params = {
        "id": f"eq.{notebook_id}",
        "owner_id": f"eq.{owner_id}",
    }
    url = _table_url()
    headers = _get_headers(user_token)
    headers["Prefer"] = "return=representation"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(url, headers=headers, params=params)

    if resp.status_code not in (200, 204):
        logger.error("Supabase delete error (%s): %s", resp.status_code, resp.text[:300])
        raise SupabaseDbError(
            f"Failed to delete notebook: {resp.text}",
            status_code=resp.status_code,
            details=resp.text,
        )

    if resp.status_code == 204 or not resp.text.strip():
        return None
    res = resp.json()
    return res[0] if isinstance(res, list) and res else None
