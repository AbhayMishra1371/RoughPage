"""
ai_service.py
=============
The main AI service for notebook generation.

Responsibility:
    Takes a cleaned transcript.
    Calls NVIDIA NIM (DeepSeek V4 Flash).
    Validates the response.
    Returns a NotebookDocument.

Pipeline:
    transcript
        │
        ▼
    chunk_by_word_count()     — splits long transcripts
        │
        ▼
    _call_llm()               — sends system + user prompt
        │
        ▼
    _safe_parse_json()        — strips accidental markdown fences
        │
        ▼
    NotebookDocument.model_validate()  — Pydantic validation
        │
        ▼
    _merge_pages()            — combines chunks into one document
        │
        ▼
    assign_ids()              — stamps clean human-readable IDs
        │
        ▼
    NotebookDocument          — ready for the renderer
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Protocol

from openai import OpenAI
from dotenv import load_dotenv

from app.schemas.notebook import (
    NotebookDocument,
    NotebookMetadata,
    NotebookPage,
    NoteStyle,
    assign_ids,
)
from app.services.ai.prompts.system_prompt import SYSTEM_PROMPT
from app.services.ai.prompts.user_prompt import build_user_prompt
from app.services.ai.prompts.chunker import (
    chunk_by_word_count,
    needs_chunking,
    TranscriptChunk,
)

# ─────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────

load_dotenv()

NVIDIA_BASE_URL = os.getenv(
    "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"
)
NVIDIA_API_KEY = (os.getenv("NVIDIA_API_KEY") or "").strip()

# Single retry owner: the SDK. It honours Retry-After headers and applies
# exponential backoff on 429s, so this module never sleeps or re-loops on
# rate limits itself — it only falls back to another model on hard errors.
client = OpenAI(
    base_url=NVIDIA_BASE_URL,
    api_key=NVIDIA_API_KEY,
    max_retries=4,
)

logger = logging.getLogger(__name__)

LLM_MODEL = os.getenv("NVIDIA_MODEL", "minimaxai/minimax-m3")
MAX_RETRIES = 2

FALLBACK_MODELS = [
    LLM_MODEL,
    os.getenv("NVIDIA_FALLBACK_MODEL", "deepseek-ai/deepseek-v4-flash-0731"),
]

# Deduplicate while preserving order
_SEEN_MODELS = set()
CANDIDATE_MODELS = [m for m in FALLBACK_MODELS if not (m in _SEEN_MODELS or _SEEN_MODELS.add(m))]


# ─────────────────────────────────────────────
# Progress reporting
# ─────────────────────────────────────────────


class ProgressSink(Protocol):
    """
    Where generate_notebook reports what it is doing.

    This exists because generation is SLOW and sequential — one LLM round-trip
    per chunk, with rate-limit backoff — so a caller streaming to a browser needs
    to say "chunk 3 of 7" rather than leaving a spinner up for two minutes with
    no evidence anything is happening. It is deliberately a plain callable and
    not a logging handler: log records are formatted strings, and the caller needs
    the chunk NUMBERS, which it would otherwise have to parse back out.

    Kept free of any HTTP or Pydantic type on purpose. This module is about
    talking to the LLM; how progress reaches a client is the API layer's problem.
    """

    def __call__(
        self,
        stage: str,
        message: str,
        current: int | None = None,
        total: int | None = None,
    ) -> None: ...


def _emit(
    sink: ProgressSink | None,
    stage: str,
    message: str,
    current: int | None = None,
    total: int | None = None,
) -> None:
    """
    Report progress, and never let reporting break generation.

    The sink usually belongs to a client that may have hung up mid-render. A
    closed queue or a dead socket must not lose work that has already been paid
    for in API quota, so the exception is swallowed to a debug line.
    """
    if sink is None:
        return
    try:
        sink(stage, message, current, total)
    except Exception as e:  # noqa: BLE001 — see above
        logger.debug(f"progress sink raised {e!r}; continuing.")


# ─────────────────────────────────────────────
# Step 1 — Call NVIDIA LLM
# ─────────────────────────────────────────────

def _call_llm(user_prompt: str) -> str:
    """
    Sends the system prompt + user prompt to the NVIDIA endpoint.
    Tries candidate models; rate limits are retried by the SDK itself.
    Returns the raw text response.
    """
    last_exception = None

    for model_name in FALLBACK_MODELS:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if content:
                return content.strip()
        except Exception as e:
            last_exception = e
            err_msg = str(e).lower()
            if "response_format" in err_msg or "json_object" in err_msg:
                # This model doesn't support JSON mode — retry once without it.
                logger.warning(
                    f"Model '{model_name}' rejected json_object mode; "
                    "retrying with plain prompt..."
                )
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                )
                content = response.choices[0].message.content
                if content:
                    return content.strip()
            else:
                logger.warning(
                    f"Model '{model_name}' failed: {e}. Trying fallback model..."
                )

    raise last_exception if last_exception else RuntimeError("All LLM calls failed.")


# ─────────────────────────────────────────────
# Step 2 — Parse JSON safely
# ─────────────────────────────────────────────

def _safe_parse_json(raw: str) -> dict:
    """
    Parses the model's response as JSON.

    Even when you tell the LLM "no markdown, no code fences,"
    it sometimes wraps output in ```json ... ``` anyway.
    This strips that silently before parsing.

    Raises:
        json.JSONDecodeError — if the response is genuinely malformed.
    """
    text = raw.strip()

    # Strip ```json ... ``` or ``` ... ``` wrapping
    if text.startswith("```"):
        lines = text.split("\n")
        text  = "\n".join(lines[1:-1]).strip()

    return json.loads(text)


# ─────────────────────────────────────────────
# Step 3 — Generate pages for one chunk
# ─────────────────────────────────────────────

def _generate_pages_for_chunk(
    chunk:       TranscriptChunk,
    style:       NoteStyle,
    subject:     str | None,
    source_url:  str | None,
    video_id:    str | None,
    on_progress: ProgressSink | None = None,
) -> list[NotebookPage]:
    """
    Processes one transcript chunk through the LLM.
    Validates the output against NotebookDocument schema.
    Retries up to MAX_RETRIES times on failure.

    Returns:
        A list of validated NotebookPage objects.

    Raises:
        ValueError — if all retry attempts fail.
    """
    user_prompt = build_user_prompt(
        transcript   = chunk.text,
        style        = style,
        subject      = subject,
        source_url   = source_url,
        video_id     = video_id,
        chunk_index  = chunk.index,
        total_chunks = chunk.total,
    )

    last_error: Exception | None = None
    human = f"{chunk.index + 1}/{chunk.total}"

    for attempt in range(MAX_RETRIES + 1):
        try:
            logger.info(
                f"Chunk {human} — LLM call attempt {attempt + 1}..."
            )
            _emit(
                on_progress,
                "generating",
                f"Writing notes for section {human}"
                + (f" (retry {attempt})" if attempt else ""),
                chunk.index + 1,
                chunk.total,
            )

            raw    = _call_llm(user_prompt)
            parsed = _safe_parse_json(raw)
            doc    = NotebookDocument.model_validate(parsed)

            logger.info(
                f"Chunk {human} — validated {len(doc.pages)} page(s)."
            )
            return doc.pages

        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}: LLM returned malformed JSON — {e}")

        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}: Validation failed — {e}")

    raise ValueError(
        f"Chunk {human} failed after "
        f"{MAX_RETRIES + 1} attempts. Last error: {last_error}"
    )


# ─────────────────────────────────────────────
# Step 4 — Merge all chunks
# ─────────────────────────────────────────────

def _merge_pages(
    all_pages:  list[list[NotebookPage]],
    title:      str,
    style:      NoteStyle,
    subject:    str | None,
    source_url: str | None,
    video_id:   str | None,
) -> NotebookDocument:
    """
    Combines pages from all chunks into one NotebookDocument.
    Re-sequences page numbers starting from 1.
    Builds the final metadata.
    """
    flat_pages: list[NotebookPage] = []
    page_number = 1

    for chunk_pages in all_pages:
        for page in chunk_pages:
            page.page_number = page_number
            flat_pages.append(page)
            page_number += 1

    metadata = NotebookMetadata(
        title       = title,
        subject     = subject,
        source_url  = source_url,
        video_id    = video_id,
        style       = style,
        total_pages = len(flat_pages),
        created_at  = datetime.now(timezone.utc).isoformat(),
    )

    return NotebookDocument(metadata=metadata, pages=flat_pages)


# ─────────────────────────────────────────────
# Public function — this is what your route calls
# ─────────────────────────────────────────────

def generate_notebook(
    transcript:  str,
    style:       NoteStyle          = NoteStyle.DETAILED,
    subject:     str | None         = None,
    source_url:  str | None         = None,
    video_id:    str | None         = None,
    title:       str | None         = None,
    on_progress: ProgressSink | None = None,
) -> NotebookDocument:
    """
    Full pipeline: transcript → NotebookDocument.

    Args:
        transcript:  Cleaned lecture transcript text.
        style:       Note style (detailed / topper / last_minute).
        subject:     Optional subject hint for the model.
        source_url:  Original YouTube URL stored in metadata.
        video_id:    YouTube video ID stored in metadata.
        title:       Notebook title. Falls back to subject or "Lecture Notes".
        on_progress: Optional callback invoked as each stage starts. See
                     ProgressSink. Purely observational — omitting it changes
                     nothing about the output.

    Returns:
        A fully validated, ID-stamped NotebookDocument.

    Raises:
        ValueError — if any chunk fails after all retries.
    """

    # ── Chunking ───────────────────────────────────────────────────────────────

    if needs_chunking(transcript):
        logger.info("Long transcript — chunking into segments.")
        chunks = chunk_by_word_count(transcript)
    else:
        logger.info("Short transcript — processing as single chunk.")
        chunks = [TranscriptChunk(
            index      = 0,
            total      = 1,
            text       = transcript,
            word_count = len(transcript.split()),
            is_last    = True,
        )]

    logger.info(f"Total chunks: {len(chunks)}")
    _emit(
        on_progress,
        "chunking",
        f"Split the lecture into {len(chunks)} section"
        f"{'' if len(chunks) == 1 else 's'}",
        0,
        len(chunks),
    )

    # ── Generate pages per chunk ───────────────────────────────────────────────

    all_pages: list[list[NotebookPage]] = []

    for chunk in chunks:
        pages = _generate_pages_for_chunk(
            chunk       = chunk,
            style       = style,
            subject     = subject,
            source_url  = source_url,
            video_id    = video_id,
            on_progress = on_progress,
        )
        all_pages.append(pages)

    # ── Merge ──────────────────────────────────────────────────────────────────

    notebook_title = title or subject or "Lecture Notes"
    _emit(on_progress, "merging", "Stitching the sections together", len(chunks), len(chunks))

    notebook = _merge_pages(
        all_pages  = all_pages,
        title      = notebook_title,
        style      = style,
        subject    = subject,
        source_url = source_url,
        video_id   = video_id,
    )

    # ── Stamp IDs ──────────────────────────────────────────────────────────────

    notebook = assign_ids(notebook)

    element_count = sum(len(p.elements) for p in notebook.pages)
    logger.info(
        f"Done — {notebook.metadata.total_pages} page(s), "
        f"{element_count} element(s)."
    )
    _emit(
        on_progress,
        "done",
        f"{len(notebook.pages)} topic group"
        f"{'' if len(notebook.pages) == 1 else 's'}, {element_count} elements",
        len(chunks),
        len(chunks),
    )

    return notebook