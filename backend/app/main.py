"""
main.py
=======
The ASGI app: middleware, error translation, and the router.

TWO THINGS HAPPEN HERE THAT ARE EASY TO GET WRONG.

1. CORS. The preview page runs on the renderer's dev server (a different origin
   from this API) and calls /generate/stream from the browser. Without the
   middleware that request never leaves Chrome. And custom response headers are
   invisible to JavaScript across origins unless they are explicitly exposed —
   which is why `expose_headers` lists the X-Roughpage-* set and
   Content-Disposition, not because the browser blocks them outright but because
   it hides them silently, so the header looks like it was never sent.

2. ERROR TRANSLATION. The service layer raises exceptions that already know their
   own HTTP status and a stable machine-readable code. Registering handlers for
   the two base classes means every route stays free of try/except, and a new
   error type gets correct HTTP behaviour just by subclassing.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as api_router
from app.api.routes_library import router as library_router
from app.config import get_settings
from app.services.export.pdf_exporter import ExportError
from app.services.notebook_service import PipelineError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="RoughPage AI",
    version="1.1.0",
    description=(
        "YouTube lecture → a PDF that looks like a real student's handwritten "
        "notebook.\n\n"
        "`POST /api/v1/export` is the whole thing in one call. `POST /api/v1/generate` "
        "stops at the NotebookDocument JSON if you want to inspect or edit it first."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-Roughpage-Pages",
        "X-Roughpage-Content-Hash",
        "X-Roughpage-Fonts",
        "X-Roughpage-Duration",
        "X-Roughpage-Warnings",
    ],
)


# ─────────────────────────────────────────────
# Errors → JSON
# ─────────────────────────────────────────────


@app.exception_handler(PipelineError)
async def _pipeline_error(_: Request, exc: PipelineError) -> JSONResponse:
    """
    `code` is the contract; `detail` is prose that may be reworded.

    Shaped as {"detail": …} to match what FastAPI's own HTTPException produces, so
    a client has one error shape to handle rather than two.
    """
    return JSONResponse(
        status_code=exc.http_status,
        content={"detail": exc.detail, "code": exc.code},
    )


@app.exception_handler(ExportError)
async def _export_error(_: Request, exc: ExportError) -> JSONResponse:
    """
    Same shape, plus the renderer's own last words.

    `output` is the tail of the CLI's stdout/stderr. It is included in the
    response rather than only logged because the actual cause of a failed export
    is almost always in there — a missing font, a 404 on a stylesheet, a page that
    never signalled ready — and making someone SSH in to read a log to learn that
    is a waste of their afternoon.
    """
    body: dict[str, object] = {"detail": exc.detail, "code": exc.code}
    if exc.output:
        body["output"] = exc.output
    return JSONResponse(status_code=exc.http_status, content=body)


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

app.include_router(api_router, prefix="/api/v1")
app.include_router(library_router, prefix="/api/v1")


@app.get("/", tags=["Meta"])
def root() -> dict[str, object]:
    return {
        "status": "running",
        "message": "RoughPage AI",
        "docs": "/docs",
        "endpoints": [
            "POST /api/v1/transcript",
            "POST /api/v1/generate",
            "POST /api/v1/generate/stream",
            "POST /api/v1/export",
            "GET  /api/v1/health",
        ],
    }
