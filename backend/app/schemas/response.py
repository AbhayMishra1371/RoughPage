"""
response.py
===========
What the API returns.

/generate returns a BARE NotebookDocument, not an envelope. That is a deliberate
interface decision: it makes

    curl -s .../generate -d '{"url":"…"}' > live.json
    npm run render -- live.json out/live.pdf

work with no reshaping step, because the renderer's CLI and the preview page both
expect a document with a `pages` array at the top level. An envelope would mean
every consumer unwraps `.data` first, and the one that forgets gets a confusing
"has no pages array" error instead of a PDF.
"""

from typing import Literal

from pydantic import BaseModel, Field


class TranscriptResponse(BaseModel):
    video_id: str
    transcript: str


# ─────────────────────────────────────────────
# Progress events (the SSE stream)
# ─────────────────────────────────────────────

Stage = Literal["transcript", "chunking", "generating", "merging", "done", "error"]


class ProgressEvent(BaseModel):
    """
    One `event: progress` frame from /generate/stream.

    This model is never used to serialise a response body — SSE frames are text.
    It exists so the stream's shape is in the OpenAPI schema and in one place,
    rather than living only inside the f-strings that emit it.
    """

    stage: Stage
    message: str
    current: int | None = Field(default=None, description="1-based chunk index, when applicable.")
    total: int | None = Field(default=None, description="Total chunks, when known.")


class StreamErrorEvent(BaseModel):
    """
    The final `event: error` frame.

    An SSE stream has already sent 200 OK and its headers by the time generation
    fails, so a failure cannot be an HTTP status code. It has to arrive in-band,
    and a client that ignores this frame will sit waiting for a document that is
    never coming.

    The stream's OTHER terminal frame, `event: document`, deliberately has no
    model here: its data is a bare NotebookDocument, byte-identical to what
    /generate returns, so a client can hand `JSON.parse(e.data)` to the renderer
    with no unwrapping step and no second code path.
    """

    detail: str
    code: str


# ─────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────


class HealthResponse(BaseModel):
    """
    Whether this process can actually do the two things it advertises.

    Worth an endpoint because both capabilities depend on things outside Python:
    generation needs GROQ_API_KEY, and export needs a renderer directory with its
    dependencies installed. Both fail at request time with an error that reads
    like a bug in the API. This turns either into one GET.
    """

    status: Literal["ok", "degraded"]
    can_generate: bool
    can_export: bool
    renderer_dir: str
    renderer_url: str | None
    notes: list[str] = Field(
        default_factory=list,
        description="Human-readable reasons for any capability being unavailable.",
    )
