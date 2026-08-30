"""
library.py
==========
Request/response models for the saved-notebooks API.

The list endpoint deliberately does NOT include document_json: a library page
shows fifty titles and must not drag fifty full notebooks out of SQLite to do
it. The heavy JSON travels only in NotebookDetail, which is fetched when one
notebook is actually opened.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.notebook import NotebookDocument


class NotebookCreate(BaseModel):
    """The frontend POSTs this after /generate/stream hands it a document."""

    document: NotebookDocument


class NotebookSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    subject: str | None
    style: str
    source_url: str | None
    video_id: str | None
    page_count: int
    pdf_ready: bool
    created_at: datetime


class NotebookDetail(NotebookSummary):
    document: NotebookDocument


class PdfUrlResponse(BaseModel):
    url: str
    expires_in: int
