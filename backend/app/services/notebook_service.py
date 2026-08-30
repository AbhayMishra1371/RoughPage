"""
notebook_service.py
===================
Input of any kind → a validated NotebookDocument.

This is the layer the HTTP routes call. It owns exactly two things the AI service
deliberately does not:

  1. WHERE THE TRANSCRIPT CAME FROM. A YouTube URL, or text pasted straight in.
     ai_service.generate_notebook() takes a string and does not care.

  2. TURNING FAILURE INTO SOMETHING A CLIENT CAN ACT ON. Every failure below is a
     PipelineError carrying an HTTP status and a stable machine-readable code, so
     a route never has to guess whether a ValueError from three layers down was
     the caller's fault or ours.

THE BUG THIS EXISTS TO STOP: `fetch_transcript()` returns None on any failure —
it catches, prints, and returns — and `clean_transcript_basic(None)` turns that
into "". Wired naively, a video with captions disabled therefore sends an EMPTY
transcript to Groq, burns three retries per chunk on a prompt with no content,
and either fails with a validation error that mentions nothing about captions or
succeeds in inventing a notebook out of nothing. Both are worse than a 422.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from dotenv import load_dotenv

from app.config import get_settings
from app.schemas.notebook import NotebookDocument, NoteStyle
from app.services.transcript.cleaner import clean_transcript_basic
from app.services.transcript.extractor import fetch_transcript
from app.services.transcript.youtube import extract_video_id

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Errors
# ─────────────────────────────────────────────


class PipelineError(Exception):
    """
    A failure with a client-facing identity.

    `code` is the contract, not `detail`. Callers should branch on
    "transcript_unavailable", never on the wording of a sentence that will be
    rephrased the next time someone reads it.
    """

    code = "pipeline_error"
    http_status = 500

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class InvalidVideoUrl(PipelineError):
    code = "invalid_video_url"
    http_status = 400


class TranscriptUnavailable(PipelineError):
    code = "transcript_unavailable"
    http_status = 422


class TranscriptTooShort(PipelineError):
    code = "transcript_too_short"
    http_status = 422


class TranscriptTooLong(PipelineError):
    code = "transcript_too_long"
    http_status = 413


class GenerationFailed(PipelineError):
    """The AI never produced a document that satisfies the schema."""

    code = "generation_failed"
    http_status = 502


class AiUnavailable(PipelineError):
    """No API key, or the SDK could not be constructed at all."""

    code = "ai_unavailable"
    http_status = 503


# ─────────────────────────────────────────────
# Step 1 — Where did the words come from?
# ─────────────────────────────────────────────


@dataclass(frozen=True)
class ResolvedSource:
    """A transcript plus the provenance that ends up in notebook metadata."""

    transcript: str
    video_id: str | None
    source_url: str | None


def transcript_from_youtube(url: str) -> ResolvedSource:
    """
    Fetch and clean one video's captions.

    Raises:
        InvalidVideoUrl        — the URL is not a recognised YouTube video link.
        TranscriptUnavailable  — no captions came back.
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise InvalidVideoUrl(
            "Could not find a video ID in that URL. Expected a youtube.com/watch?v=…, "
            "youtu.be/… or youtube.com/embed/… link."
        )

    raw = fetch_transcript(video_id)
    transcript = clean_transcript_basic(raw)

    if not transcript:
        # fetch_transcript() swallows the underlying reason (it prints and returns
        # None), so the causes are listed rather than reported. Fixing that would
        # change the contract of a function the /transcript route also uses.
        raise TranscriptUnavailable(
            f"No transcript available for video {video_id}. The usual causes are "
            "captions being disabled by the uploader, a members-only or private "
            "video, or a region block. Paste the text into `text` instead."
        )

    return ResolvedSource(transcript=transcript, video_id=video_id, source_url=url)


def _check_length(transcript: str) -> None:
    """
    Reject transcripts that cannot produce a sensible notebook, BEFORE spending
    any quota on them. See the field docs in config.py for why each bound exists.
    """
    settings = get_settings()
    n = len(transcript)

    if n < settings.min_transcript_chars:
        raise TranscriptTooShort(
            f"Only {n} characters of transcript — need at least "
            f"{settings.min_transcript_chars} to make notes worth reading."
        )

    if n > settings.max_transcript_chars:
        raise TranscriptTooLong(
            f"{n:,} characters is past the {settings.max_transcript_chars:,} limit. "
            "That many chunks means one sequential Groq call per chunk and a request "
            "that cannot finish. Split the lecture and generate it in parts."
        )


def resolve_source(url: str | None, text: str | None) -> ResolvedSource:
    """
    Normalise either input into a length-checked transcript.

    Exactly one of `url`/`text` is expected; the request schema already enforces
    that, and this re-checks rather than trusting it because the service is also
    callable from a script.
    """
    if (url is None) == (text is None):
        raise PipelineError("Provide exactly one of `url` or `text`.")

    if url is not None:
        source = transcript_from_youtube(url)
    else:
        source = ResolvedSource(
            transcript=" ".join((text or "").split()),
            video_id=None,
            source_url=None,
        )

    _check_length(source.transcript)
    return source


# ─────────────────────────────────────────────
# Step 2 — Transcript → NotebookDocument
# ─────────────────────────────────────────────


def build_notebook(
    *,
    url: str | None = None,
    text: str | None = None,
    style: NoteStyle = NoteStyle.DETAILED,
    subject: str | None = None,
    title: str | None = None,
    on_progress=None,
) -> NotebookDocument:
    """
    The whole thing: a URL or some text in, a renderer-ready document out.

    BLOCKING AND SLOW — one Groq round-trip per chunk, sequentially, with sleeps
    for rate-limit backoff. Never call this from an `async def` route body without
    a threadpool; it will stall every other request on the server for its whole
    duration.

    Args:
        on_progress: An ai_service.ProgressSink, or None. Passed straight through.

    Raises:
        PipelineError — always this type, never a raw exception from below.
    """
    source = resolve_source(url, text)
    return notebook_from_source(
        source,
        style=style,
        subject=subject,
        title=title,
        on_progress=on_progress,
    )


def notebook_from_source(
    source: ResolvedSource,
    *,
    style: NoteStyle = NoteStyle.DETAILED,
    subject: str | None = None,
    title: str | None = None,
    on_progress=None,
) -> NotebookDocument:
    """
    The AI half, split out from build_notebook so a caller can resolve the
    transcript FIRST.

    That split exists for the streaming endpoint. Once an SSE response has begun
    it has already sent 200 OK, so every later failure has to be reported in-band
    where a careless client will miss it. Fetching the transcript up front means
    the two most common failures by far — an unparseable URL and a video with
    captions disabled — are still ordinary 4xx responses.

    BLOCKING AND SLOW; see build_notebook.
    """
    if on_progress is not None:
        on_progress(
            "transcript",
            f"Got {len(source.transcript):,} characters of transcript",
            None,
            None,
        )

    # Imported HERE, not at module scope, because ai_service constructs its LLM
    # client at import time. At module scope a missing key would take down the
    # whole app at startup — including
    # /health, which exists to explain this exact problem, and the export path,
    # which does not need the AI at all when it is handed a finished document.
    try:
        from app.services.ai.ai_service import generate_notebook
    except Exception as e:  # noqa: BLE001 — reported, not handled
        raise AiUnavailable(
            f"The AI client could not be initialised: {e}. "
            "Check that NVIDIA_API_KEY is set in the repo-root .env."
        ) from e

    try:
        return generate_notebook(
            transcript=source.transcript,
            style=style,
            subject=subject,
            source_url=source.source_url,
            video_id=source.video_id,
            title=title,
            on_progress=on_progress,
        )
    except PipelineError:
        raise
    except Exception as e:  # noqa: BLE001 — mapped to a 502 below
        logger.exception("Notebook generation failed.")
        raise GenerationFailed(
            f"The AI did not return a usable notebook: {e}"
        ) from e


# ─────────────────────────────────────────────
# Capability check (for /health)
# ─────────────────────────────────────────────


def ai_configured() -> bool:
    """Whether generation has any chance of working. Cheap; makes no network call."""
    # The AI service module owns the dotenv load and is imported lazily, so
    # /health would otherwise report an unconfigured key that is in fact set.
    load_dotenv()
    return bool(os.getenv("NVIDIA_API_KEY"))
