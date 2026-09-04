"""
routes_library.py
=================
Saved-notebook endpoints using Supabase PostgREST REST API.

    POST /notebooks              save a generated document (auto-renders PDF)
    GET  /notebooks              list MINE (summaries only — no heavy JSON)
    GET  /notebooks/{id}         one notebook, full document
    DELETE /notebooks/{id}       delete mine (+ best-effort bucket cleanup)
    GET  /notebooks/{id}/pdf-url ownership-checked signed download URL
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.api.deps import AuthContext, get_current_auth
from app.schemas.library import (
    NotebookCreate,
    NotebookDetail,
    NotebookSummary,
    PdfUrlResponse,
)
from app.schemas.notebook import NotebookDocument
from app.services import storage, supabase_db
from app.services.export.pdf_exporter import ExportError, export_pdf

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Library"])

PDF_URL_TTL_S = 300


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────


def _summary(row: dict[str, Any]) -> NotebookSummary:
    created_at = row.get("created_at")
    if isinstance(created_at, str):
        # Ensure compatible datetime format
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at = datetime.now(timezone.utc)
    elif not isinstance(created_at, datetime):
        created_at = datetime.now(timezone.utc)

    return NotebookSummary(
        id=str(row["id"]),
        title=row.get("title") or "Lecture Notes",
        subject=row.get("subject"),
        style=row.get("style") or "detailed",
        source_url=row.get("source_url"),
        video_id=row.get("video_id"),
        page_count=row.get("page_count", 0),
        pdf_ready=bool(row.get("pdf_object_key")),
        created_at=created_at,
    )


class _PdfJob:
    """Callable wrapper so BackgroundTasks can run the async render+upload."""

    def __init__(
        self,
        notebook_id: str,
        document_json: str,
        object_key: str,
        user_token: str | None = None,
    ):
        self.notebook_id = notebook_id
        self.document_json = document_json
        self.object_key = object_key
        self.user_token = user_token

    async def __call__(self) -> None:
        try:
            doc_dict = json.loads(self.document_json)
            result = await export_pdf(doc_dict)
            await storage.upload_pdf(self.object_key, result.pdf)

            updates: dict[str, Any] = {"pdf_object_key": self.object_key}
            if result.pages:
                updates["page_count"] = result.pages

            await supabase_db.update_notebook(
                self.notebook_id,
                updates,
                user_token=self.user_token,
            )

            logger.info("Auto-saved PDF for notebook %s.", self.notebook_id)
        except ExportError as e:
            logger.error("PDF render failed for %s: %s", self.notebook_id, e.detail)
        except storage.StorageUnavailable as e:
            logger.error("Storage upload failed for %s: %s", self.notebook_id, e)
        except Exception as e:
            logger.error("Error in PDF job for %s: %s", self.notebook_id, e)


async def _ensure_pdf(row: dict[str, Any], user_token: str | None = None) -> PdfUrlResponse:
    """Render+upload now if the PDF isn't stored yet, then return a signed URL."""
    key = row.get("pdf_object_key")
    if not key:
        logger.info("Rendering PDF on demand for %s.", row["id"])
        doc_raw = row["document_json"]
        doc_dict = json.loads(doc_raw) if isinstance(doc_raw, str) else doc_raw
        result = await export_pdf(doc_dict)
        key = f"{row['owner_id']}/{row['id']}.pdf"
        await storage.upload_pdf(key, result.pdf)

        updates: dict[str, Any] = {"pdf_object_key": key}
        if result.pages:
            updates["page_count"] = result.pages

        await supabase_db.update_notebook(row["id"], updates, user_token=user_token)
        row["pdf_object_key"] = key

    url = await storage.signed_pdf_url(key, PDF_URL_TTL_S)
    return PdfUrlResponse(url=url, expires_in=PDF_URL_TTL_S)


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────


@router.post("/notebooks", response_model=NotebookSummary, status_code=201)
async def save_notebook(
    payload: NotebookCreate,
    tasks: BackgroundTasks,
    auth: AuthContext = Depends(get_current_auth),
) -> NotebookSummary:
    doc = payload.document
    meta = doc.metadata
    owner_id = auth.user_id

    notebook_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    row_data = {
        "id": notebook_id,
        "owner_id": owner_id,
        "title": meta.title or meta.subject or "Lecture Notes",
        "subject": meta.subject,
        "style": meta.style.value if hasattr(meta.style, "value") else str(meta.style),
        "source_url": meta.source_url,
        "video_id": meta.video_id,
        "page_count": len(doc.pages),
        "document_json": doc.model_dump_json(),
        "created_at": now_iso,
    }

    try:
        record = await supabase_db.insert_notebook(row_data, user_token=auth.token)
    except supabase_db.SupabaseDbError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        ) from e

    if storage.storage_configured():
        tasks.add_task(
            _PdfJob(
                notebook_id,
                row_data["document_json"],
                f"{owner_id}/{notebook_id}.pdf",
                user_token=auth.token,
            )
        )

    return _summary(record)


@router.get("/notebooks", response_model=list[NotebookSummary])
async def list_notebooks(
    auth: AuthContext = Depends(get_current_auth),
) -> list[NotebookSummary]:
    try:
        records = await supabase_db.list_notebooks(auth.user_id, user_token=auth.token)
    except supabase_db.SupabaseDbError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        ) from e
    return [_summary(r) for r in records]


@router.get("/notebooks/{notebook_id}", response_model=NotebookDetail)
async def get_notebook(
    notebook_id: str,
    auth: AuthContext = Depends(get_current_auth),
) -> NotebookDetail:
    try:
        record = await supabase_db.get_notebook(notebook_id, auth.user_id, user_token=auth.token)
    except supabase_db.SupabaseDbError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        ) from e

    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found.")

    detail = _summary(record).model_dump()
    doc_raw = record["document_json"]
    doc_dict = json.loads(doc_raw) if isinstance(doc_raw, str) else doc_raw
    detail["document"] = NotebookDocument.model_validate(doc_dict)
    return NotebookDetail(**detail)


@router.delete("/notebooks/{notebook_id}", status_code=204)
async def delete_notebook(
    notebook_id: str,
    background: BackgroundTasks,
    auth: AuthContext = Depends(get_current_auth),
) -> None:
    try:
        record = await supabase_db.get_notebook(notebook_id, auth.user_id, user_token=auth.token)
    except supabase_db.SupabaseDbError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        ) from e

    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found.")

    key = record.get("pdf_object_key")
    try:
        await supabase_db.delete_notebook(notebook_id, auth.user_id, user_token=auth.token)
    except supabase_db.SupabaseDbError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        ) from e

    if key and storage.storage_configured():
        background.add_task(storage.delete_object, key)


@router.get("/notebooks/{notebook_id}/pdf-url", response_model=PdfUrlResponse)
async def notebook_pdf_url(
    notebook_id: str,
    auth: AuthContext = Depends(get_current_auth),
) -> PdfUrlResponse:
    if not storage.storage_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Storage is not configured.",
        )

    try:
        record = await supabase_db.get_notebook(notebook_id, auth.user_id, user_token=auth.token)
    except supabase_db.SupabaseDbError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        ) from e

    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found.")

    return await _ensure_pdf(record, user_token=auth.token)
