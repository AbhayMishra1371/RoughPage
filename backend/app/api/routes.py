"""
routes.py
=========
The HTTP surface. Four things you can do:

    POST /transcript        a YouTube URL → its cleaned transcript
    POST /generate          a URL or text → a NotebookDocument
    POST /generate/stream   the same, as Server-Sent Events with progress
    POST /export            a URL, text, or a document → a PDF

/export is the whole product in one call: YouTube link in, handwritten-notebook
PDF out, no intermediate file and no second command.

WHY THE ROUTES ARE `async def` BUT DO THE WORK IN A THREADPOOL. Generation makes
one blocking Groq call per chunk, sequentially, and sleeps on rate limits;
printing waits on a subprocess. Awaiting either directly in a coroutine would
block the event loop and stall every other request on the server for the whole
duration — including the health check. `run_in_threadpool` puts the blocking work
where it belongs. (Declaring the routes plain `def` would achieve the same for
/generate, but /export genuinely needs to await a subprocess, so the two are kept
consistent.)

ERRORS ARE NOT CAUGHT HERE. PipelineError and ExportError both carry their own
status code and a stable `code` string, and main.py turns them into JSON. A route
that caught them would only be re-deriving what the exception already knows.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.config import get_settings
from app.schemas.notebook import NotebookDocument
from app.schemas.request import ExportRequest, GenerateRequest, TranscriptRequest
from app.schemas.response import (
    HealthResponse,
    ProgressEvent,
    StreamErrorEvent,
    TranscriptResponse,
)
from app.services.export.pdf_exporter import export_pdf, renderer_status, safe_filename
from app.services.notebook_service import (
    PipelineError,
    ResolvedSource,
    ai_configured,
    build_notebook,
    notebook_from_source,
    resolve_source,
    transcript_from_youtube,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────
# Transcript
# ─────────────────────────────────────────────


@router.post("/transcript", response_model=TranscriptResponse, tags=["Transcript"])
async def get_transcript(request: TranscriptRequest) -> TranscriptResponse:
    """
    Fetch and clean one video's captions.

    Routed through transcript_from_youtube() rather than calling the three
    transcript functions inline, because fetch_transcript() returns None on
    failure and clean_transcript_basic(None) returns "". Called directly, a video
    with captions disabled produced `200 {"transcript": ""}` — a success response
    for a request that did not succeed.
    """
    source = await run_in_threadpool(transcript_from_youtube, str(request.url))
    return TranscriptResponse(
        video_id=source.video_id or "",
        transcript=source.transcript,
    )


# ─────────────────────────────────────────────
# Generate
# ─────────────────────────────────────────────


@router.post("/generate", response_model=NotebookDocument, tags=["Notebook"])
async def generate(
    request: GenerateRequest,
    owner_id: str = Depends(get_current_user),
) -> NotebookDocument:
    """
    A lecture in, a NotebookDocument out.

    Returns the document at the TOP LEVEL, with no envelope, so that

        curl -s .../generate -d '{"url":"…"}' > live.json
        cd renderer && npm run render -- live.json out/live.pdf

    needs no reshaping step. The renderer's CLI and its preview page both expect
    a `pages` array at the root.

    Slow by nature — one sequential Groq call per ~1000-word chunk. Use
    /generate/stream if anything is watching, and /export if what you actually
    want is the PDF.
    """
    return await run_in_threadpool(
        build_notebook,
        url=str(request.url) if request.url else None,
        text=request.text,
        style=request.style,
        subject=request.subject,
        title=request.title,
    )


# ─────────────────────────────────────────────
# Generate, with progress
# ─────────────────────────────────────────────

#: Emitted as an SSE comment when nothing else has been sent for this long.
#: Without it a proxy or load balancer sees an idle connection during a long Groq
#: call and closes it, which the browser reports as a network error rather than a
#: timeout, and the whole generation is lost with no way to tell why.
HEARTBEAT_S = 15.0


def _frame(event: str, data: str) -> str:
    """
    One SSE frame.

    `data:` may not contain a newline, so a multi-line payload has to become one
    `data:` line per line. Pydantic's JSON has no newlines in it, but a client
    hand-posting a document does not know that, and a single stray newline
    silently truncates the frame at the parser.
    """
    body = "".join(f"data: {line}\n" for line in data.split("\n"))
    return f"event: {event}\n{body}\n"


async def _stream_notebook(
    source: ResolvedSource, request: GenerateRequest
) -> AsyncIterator[str]:
    """
    Run generation on a worker thread and relay its progress as it happens.

    THE THREAD-TO-LOOP BRIDGE IS THE WHOLE POINT. generate_notebook() is
    synchronous and reports progress by calling a plain function. That callback
    therefore fires on the worker thread, where touching an asyncio primitive
    directly is undefined behaviour. `loop.call_soon_threadsafe` is the one
    sanctioned door between the two, so every event goes through it and the
    generator below only ever awaits an ordinary asyncio.Queue.
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def emit(item: object | None) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, item)

    def sink(stage: str, message: str, current=None, total=None) -> None:
        emit(("progress", ProgressEvent(stage=stage, message=message,
                                        current=current, total=total)))

    def work() -> None:
        try:
            doc = notebook_from_source(
                source,
                style=request.style,
                subject=request.subject,
                title=request.title,
                on_progress=sink,
            )
            emit(("document", doc))
        except PipelineError as e:
            emit(("error", StreamErrorEvent(detail=e.detail, code=e.code)))
        except Exception as e:  # noqa: BLE001 — must reach the client, not the log only
            logger.exception("Streaming generation failed.")
            emit(("error", StreamErrorEvent(detail=str(e), code="internal_error")))
        finally:
            emit(None)

    worker = loop.run_in_executor(None, work)

    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_S)
            except asyncio.TimeoutError:
                # A comment line: valid SSE, ignored by EventSource, keeps the
                # connection demonstrably alive.
                yield ": keep-alive\n\n"
                continue

            if item is None:
                break

            kind, payload = item
            if kind == "document":
                yield _frame("document", payload.model_dump_json())
            elif kind == "error":
                yield _frame("error", payload.model_dump_json())
            else:
                yield _frame("progress", payload.model_dump_json())
    finally:
        # The client may have hung up. generate_notebook() is not cancellable
        # mid-Groq-call, so the thread is left to finish and its result is
        # discarded — awaiting it here would hold the response open for minutes
        # after the socket closed, so it is deliberately not awaited.
        if worker.done():
            worker.exception()  # retrieve it, so asyncio does not log it as unhandled


@router.post("/generate/stream", tags=["Notebook"])
async def generate_stream(
    request: GenerateRequest,
    owner_id: str = Depends(get_current_user),
) -> StreamingResponse:
    """
    Generation as Server-Sent Events. Three event types:

        event: progress    {"stage","message","current","total"}   — repeatedly
        event: document    a bare NotebookDocument                 — terminal, success
        event: error       {"detail","code"}                       — terminal, failure

    The transcript is fetched BEFORE the stream opens, so an unparseable URL or a
    video without captions is still a normal 4xx and not a 200 whose body says
    otherwise. Everything after that point is in-band by necessity.
    """
    source = await run_in_threadpool(
        resolve_source,
        str(request.url) if request.url else None,
        request.text,
    )

    return StreamingResponse(
        _stream_notebook(source, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # nginx buffers proxied responses by default, which holds every
            # progress event until the whole stream finishes — turning a live
            # progress bar into a long pause followed by all of it at once.
            "X-Accel-Buffering": "no",
        },
    )


# ─────────────────────────────────────────────
# Export
# ─────────────────────────────────────────────


@router.post(
    "/export",
    tags=["Export"],
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}, "description": "The rendered notebook."}},
)
async def export(
    request: ExportRequest,
    owner_id: str = Depends(get_current_user),
) -> Response:
    """
    A PDF, in one call.

    Three ways in — `url`, `text`, or a `document` you already have — and the
    same handwritten-notebook PDF out of all three. This is the automated export
    path: it drives the renderer's own CLI as a subprocess, so the output is
    identical to `npm run render` and to what the preview page shows, with no
    second layout implementation to drift.

    The interesting numbers come back as headers rather than being buried in the
    server log:

        X-Roughpage-Pages          real page count after reflow
        X-Roughpage-Content-Hash   sha256 of the PDF with its timestamps blanked,
                                   so two renders of the same document can be
                                   compared for determinism
        X-Roughpage-Fonts          which fonts actually got embedded
        X-Roughpage-Duration       seconds
        X-Roughpage-Warnings       count of layout warnings (the text is logged)
    """
    if request.document is not None:
        doc = request.document
    else:
        doc = await run_in_threadpool(
            build_notebook,
            url=str(request.url) if request.url else None,
            text=request.text,
            style=request.style,
            subject=request.subject,
            title=request.title,
        )

    result = await export_pdf(
        doc.model_dump(mode="json"),
        break_on_topic=request.break_on_topic,
    )

    for w in result.warnings:
        logger.warning(f"Export layout warning — {w}")

    filename = safe_filename(request.filename or doc.metadata.title)

    return Response(
        content=result.pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{request.disposition}; filename="{filename}"',
            "X-Roughpage-Pages": str(result.pages if result.pages is not None else ""),
            "X-Roughpage-Content-Hash": result.content_hash or "",
            # Font names are ASCII; a header value is latin-1, so the layout
            # warnings are NOT put here — they contain em dashes and would raise
            # on encoding. Only their count travels.
            "X-Roughpage-Fonts": ", ".join(result.fonts),
            "X-Roughpage-Duration": str(result.duration_s),
            "X-Roughpage-Warnings": str(len(result.warnings)),
        },
    )


# ─────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health() -> HealthResponse:
    """
    Can this process actually generate and print?

    Both capabilities depend on things outside Python — an API key, and a Node
    checkout with its dependencies installed — and both fail at request time with
    errors that read like bugs in the API. One GET answers it instead.
    """
    settings = get_settings()
    renderer = renderer_status()
    can_generate = ai_configured()

    notes = list(renderer.notes)
    if not can_generate:
        notes.append("NVIDIA_API_KEY is not set — /generate and /export from a URL will fail.")
    if settings.renderer_url:
        notes.append(
            f"Exports print from {settings.renderer_url} instead of their own server. "
            "Convenient in development; do not ship it."
        )

    return HealthResponse(
        status="ok" if (can_generate and renderer.ok) else "degraded",
        can_generate=can_generate,
        can_export=renderer.ok,
        renderer_dir=str(settings.renderer_dir),
        renderer_url=settings.renderer_url,
        notes=notes,
    )
