"""
test_page_count.py
==================
Unit tests verifying physical page-count consistency logic:
1. Logical topic sections versus physical page counts.
2. Successful PDF export updating Supabase page_count.
3. PDF export failure preserving existing record without DB updates.
4. Missing or invalid physical page counts (None, <=0) safely skipped.
5. Database update failure handled gracefully without masking notebook generation.
"""

import json
import logging
import pytest
from unittest.mock import AsyncMock, patch

from app.api.routes_library import _PdfJob
from app.schemas.notebook import (
    NotebookDocument,
    NotebookMetadata,
    NotebookPage,
    NoteStyle,
)
from app.services.export.pdf_exporter import ExportError, ExportResult
from app.services.supabase_db import SupabaseDbError

logger = logging.getLogger("test_page_count")


@pytest.fixture
def sample_document_json() -> str:
    """NotebookDocument with 2 logical topic sections and 4 total elements."""
    doc = NotebookDocument(
        metadata=NotebookMetadata(
            title="Graph Traversal",
            subject="Algorithms",
            style=NoteStyle.DETAILED,
            total_pages=2,
        ),
        pages=[
            NotebookPage(
                page_number=1,
                topic="Breadth First Search",
                elements=[
                    {"type": "heading", "text": "BFS Overview", "level": 1, "importance": "high"},
                    {"type": "paragraph", "text": "BFS visits layer by layer using a queue.", "importance": "medium"},
                ],
            ),
            NotebookPage(
                page_number=2,
                topic="Depth First Search",
                elements=[
                    {"type": "heading", "text": "DFS Overview", "level": 1, "importance": "high"},
                    {"type": "paragraph", "text": "DFS visits deeply along each branch.", "importance": "medium"},
                ],
            ),
        ],
    )
    return doc.model_dump_json()


def test_logical_topic_sections_vs_physical_page_count(sample_document_json: str):
    """
    Test 1:
    Verify that NotebookDocument.pages holds logical topic sections (here 2),
    while physical page counts are decoupled and computed downstream.
    """
    raw = json.loads(sample_document_json)
    doc = NotebookDocument.model_validate(raw)

    # Document has 2 logical topic sections
    assert len(doc.pages) == 2
    assert doc.pages[0].topic == "Breadth First Search"
    assert doc.pages[1].topic == "Depth First Search"

    # Total elements across topic sections
    total_elements = sum(len(p.elements) for p in doc.pages)
    assert total_elements == 4

    # metadata.total_pages on backend reflects topic sections (2) before physical pagination
    assert doc.metadata.total_pages == 2


@pytest.mark.anyio
async def test_successful_pdf_export_updates_page_count(sample_document_json: str):
    """
    Test 2:
    Successful PDF generation (physical page count = 6) must update Supabase page_count
    with the actual physical page count reported by ExportResult.
    """
    fake_result = ExportResult(
        pdf=b"%PDF-1.4 simulated pdf data",
        pages=6,
        fonts=["Kalam"],
        content_hash="abcdef0123456789",
        warnings=[],
        duration_s=1.2,
        stdout="  pages          6 (reflowed from 2 topic groups)",
    )

    with (
        patch("app.api.routes_library.export_pdf", new=AsyncMock(return_value=fake_result)) as mock_export,
        patch("app.api.routes_library.storage.upload_pdf", new=AsyncMock(return_value=None)) as mock_upload,
        patch("app.api.routes_library.supabase_db.update_notebook", new=AsyncMock(return_value={"id": "nb-123"})) as mock_update,
    ):
        job = _PdfJob(
            notebook_id="nb-123",
            document_json=sample_document_json,
            object_key="user-1/nb-123.pdf",
            user_token="test-token",
        )
        await job()

        mock_export.assert_awaited_once()
        mock_upload.assert_awaited_once_with("user-1/nb-123.pdf", fake_result.pdf)
        mock_update.assert_awaited_once_with(
            "nb-123",
            {"pdf_object_key": "user-1/nb-123.pdf", "page_count": 6},
            user_token="test-token",
            use_service_role=True,
        )


@pytest.mark.anyio
async def test_pdf_export_failure_preserves_record(sample_document_json: str):
    """
    Test 3:
    When PDF generation fails (e.g. ExportError), no database update should be attempted,
    preserving the existing record and not raising unhandled errors.
    """
    with (
        patch(
            "app.api.routes_library.export_pdf",
            new=AsyncMock(side_effect=ExportError("Renderer exited with code 1", output="timeout")),
        ),
        patch("app.api.routes_library.supabase_db.update_notebook", new=AsyncMock()) as mock_update,
        patch("app.api.routes_library.storage.upload_pdf", new=AsyncMock()) as mock_upload,
    ):
        job = _PdfJob(
            notebook_id="nb-123",
            document_json=sample_document_json,
            object_key="user-1/nb-123.pdf",
            user_token="test-token",
        )
        # Must not raise
        await job()

        mock_upload.assert_not_called()
        mock_update.assert_not_called()


@pytest.mark.anyio
@pytest.mark.parametrize("invalid_pages", [None, 0, -3, "invalid"])
async def test_missing_or_invalid_page_count_not_updated(sample_document_json: str, invalid_pages):
    """
    Test 4:
    When ExportResult returns missing or invalid physical page counts (None, 0, negative),
    page_count must NOT be overwritten, though pdf_object_key is still stored if upload succeeded.
    """
    fake_result = ExportResult(
        pdf=b"%PDF-1.4 simulated pdf data",
        pages=invalid_pages,  # type: ignore
        fonts=["Kalam"],
        content_hash="abcdef0123456789",
        warnings=[],
        duration_s=1.2,
        stdout="pages not found",
    )

    with (
        patch("app.api.routes_library.export_pdf", new=AsyncMock(return_value=fake_result)),
        patch("app.api.routes_library.storage.upload_pdf", new=AsyncMock(return_value=None)),
        patch("app.api.routes_library.supabase_db.update_notebook", new=AsyncMock(return_value={"id": "nb-123"})) as mock_update,
    ):
        job = _PdfJob(
            notebook_id="nb-123",
            document_json=sample_document_json,
            object_key="user-1/nb-123.pdf",
            user_token="test-token",
        )
        await job()

        # update_notebook called only for pdf_object_key, NOT page_count
        mock_update.assert_awaited_once_with(
            "nb-123",
            {"pdf_object_key": "user-1/nb-123.pdf"},
            user_token="test-token",
            use_service_role=True,
        )


@pytest.mark.anyio
async def test_database_update_failure_handled_gracefully(sample_document_json: str):
    """
    Test 5:
    If Supabase update_notebook fails with SupabaseDbError, the error is caught and logged,
    without crashing background execution or masking successful notebook generation.
    """
    fake_result = ExportResult(
        pdf=b"%PDF-1.4 simulated pdf data",
        pages=6,
        fonts=["Kalam"],
        content_hash="abcdef0123456789",
        warnings=[],
        duration_s=1.2,
        stdout="  pages          6 (reflowed from 2 topic groups)",
    )

    with (
        patch("app.api.routes_library.export_pdf", new=AsyncMock(return_value=fake_result)),
        patch("app.api.routes_library.storage.upload_pdf", new=AsyncMock(return_value=None)),
        patch(
            "app.api.routes_library.supabase_db.update_notebook",
            new=AsyncMock(side_effect=SupabaseDbError("Database permission error", status_code=403)),
        ),
    ):
        job = _PdfJob(
            notebook_id="nb-123",
            document_json=sample_document_json,
            object_key="user-1/nb-123.pdf",
            user_token="test-token",
        )
        # Must execute without unhandled exception
        await job()
