"""
routes_library.py
=================
Saved-notebook endpoints: the persistence layer's HTTP surface.

    POST /notebooks              save a generated document (auto-renders PDF)
    GET  /notebooks              list MINE (summaries only — no heavy JSON)
    GET  /notebooks/{id}         one notebook, full document
    DELETE /notebooks/{id}       delete mine (+ best-effort bucket cleanup)
    GET  /notebooks/{id}/pdf-url ownership-checked signed download URL

AUTHORIZATION IS A WHERE CLAUSE. Every query filters owner_id == token `sub`,
and a foreign or missing id both return 404 — never 403, which would confirm
existence to a stranger.

AUTO-SAVE PIPELINE. POST saves metadata + JSON immediately, then renders the
PDF as a background task so the client's save round-trip doesn't wait ~10s for
Chromium. If storage is unconfigured (dev), the row still saves and pdf_url
renders on demand instead.
"""

from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db, SessionLocal
from app.models import Notebook
from app.schemas.library import (
    NotebookCreate,
    NotebookDetail,
    NotebookSummary,
    PdfUrlResponse,
)
from app.schemas.notebook import NotebookDocument
from app.services import storage
from app.services.export.pdf_exporter import ExportError, export_pdf

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Library"])

PDF_URL_TTL_S = 300


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────


def _summary(row: Notebook) -> NotebookSummary:
    return NotebookSummary(
        id=row.id,
        title=row.title,
        subject=row.subject,
        style=row.style,
        source_url=row.source_url,
        video_id=row.video_id,
        page_count=row.page_count,
        pdf_ready=bool(row.pdf_object_key),
        created_at=row.created_at,
    )


def _get_owned(db: Session, notebook_id: str, owner_id: str) -> Notebook:
    """404 on missing OR foreign; see module docstring for why not 403."""
    row = db.get(Notebook, notebook_id)
    if row is None or row.owner_id != owner_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found.")
    return row


class _PdfJob:
    """Async render+upload callable for BackgroundTasks."""
    """Callable wrapper so BackgroundTasks can run the async render+upload."""

    def __init__(self, notebook_id: str, document_json: str, object_key: str):
        self.notebook_id = notebook_id
        self.document_json = document_json
        self.object_key = object_key

    async def __call__(self) -> None:
        try:
            result = await export_pdf(json.loads(self.document_json))
            await storage.upload_pdf(self.object_key, result.pdf)

            db = SessionLocal()
            try:
                row = db.get(Notebook, self.notebook_id)
                if row is not None:
                    row.pdf_object_key = self.object_key
                    if result.pages:
                        row.page_count = result.pages
                    db.commit()
            finally:
                db.close()

            logger.info("Auto-saved PDF for notebook %s.", self.notebook_id)
        except ExportError as e:
            logger.error("PDF render failed for %s: %s", self.notebook_id, e.detail)
        except storage.StorageUnavailable as e:
            logger.error("Storage upload failed for %s: %s", self.notebook_id, e)


async def _ensure_pdf(row: Notebook) -> str:
    """Render+upload now if the PDF isn't stored yet, then return a signed URL."""
    if row.pdf_object_key is None:
        logger.info("Rendering PDF on demand for %s.", row.id)
        result = await export_pdf(json.loads(row.document_json))
        key = f"{row.owner_id}/{row.id}.pdf"
        await storage.upload_pdf(key, result.pdf)
        db = SessionLocal()
        try:
            fresh = db.get(Notebook, row.id)
            if fresh is not None:
                fresh.pdf_object_key = key
                if result.pages:
                    fresh.page_count = result.pages
                db.commit()
        finally:
            db.close()
        row.pdf_object_key = key

    url = await storage.signed_pdf_url(row.pdf_object_key, PDF_URL_TTL_S)
    return PdfUrlResponse(url=url, expires_in=PDF_URL_TTL_S)


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────


@router.post("/notebooks", response_model=NotebookSummary, status_code=201)
async def save_notebook(
    payload: NotebookCreate,
    tasks: BackgroundTasks,
    owner_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotebookSummary:
    doc = payload.document
    meta = doc.metadata

    row = Notebook(
        id=str(uuid.uuid4()),
        owner_id=owner_id,
        title=meta.title or meta.subject or "Lecture Notes",
        subject=meta.subject,
        style=meta.style.value if hasattr(meta.style, "value") else str(meta.style),
        source_url=meta.source_url,
        video_id=meta.video_id,
        page_count=len(doc.pages),
        document_json=doc.model_dump_json(),
    )
    db.add(row)
    db.commit()

    if storage.storage_configured():
        tasks.add_task(_PdfJob(row.id, row.document_json, f"{owner_id}/{row.id}.pdf"))

    return _summary(row)


@router.get("/notebooks", response_model=list[NotebookSummary])
def list_notebooks(
    owner_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NotebookSummary]:
    rows = db.scalars(
        select(Notebook)
        .where(Notebook.owner_id == owner_id)
        .order_by(Notebook.created_at.desc())
    ).all()
    return [_summary(r) for r in rows]


@router.get("/notebooks/{notebook_id}", response_model=NotebookDetail)
def get_notebook(
    notebook_id: str,
    owner_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotebookDetail:
    row = _get_owned(db, notebook_id, owner_id)
    detail = _summary(row).model_dump()
    detail["document"] = NotebookDocument.model_validate(json.loads(row.document_json))
    return NotebookDetail(**detail)


@router.delete("/notebooks/{notebook_id}", status_code=204)
async def delete_notebook(
    notebook_id: str,
    background: BackgroundTasks,
    owner_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = _get_owned(db, notebook_id, owner_id)
    key = row.pdf_object_key
    db.delete(row)
    db.commit()
    if key:
        background.add_task(storage.delete_object, key)


@router.get("/notebooks/{notebook_id}/pdf-url", response_model=PdfUrlResponse)
async def notebook_pdf_url(
    notebook_id: str,
    owner_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PdfUrlResponse:
    if not storage.storage_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Storage is not configured.",
        )
    row = _get_owned(db, notebook_id, owner_id)
    return await _ensure_pdf(row)
