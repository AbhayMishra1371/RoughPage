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
import re
import time
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
from app.services.ai.prompts.user_prompt import (
    build_user_prompt,
    build_planner_prompt_from_knowledge,
)
from app.services.ai.knowledge_extractor import (
    KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT,
    build_extraction_prompt,
)
from app.services.ai.knowledge_merger import (
    merge_knowledge,
)
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
NVIDIA_TIMEOUT = float(os.getenv("NVIDIA_TIMEOUT", "75.0"))
client = OpenAI(
    base_url=NVIDIA_BASE_URL,
    api_key=NVIDIA_API_KEY,
    timeout=NVIDIA_TIMEOUT,
    max_retries=0,
)

logger = logging.getLogger(__name__)

LLM_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.2-11b-vision-instruct")
MAX_RETRIES = 1

FALLBACK_MODELS = [
    LLM_MODEL,
    os.getenv("NVIDIA_FALLBACK_MODEL", "minimaxai/minimax-m3"),
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
# Step 1 — Call NVIDIA LLM with 504 separate handling
# ─────────────────────────────────────────────

def _call_llm(
    user_prompt: str,
    system_prompt: str = SYSTEM_PROMPT,
    max_tokens: int = 4096,
) -> str:
    """
    Sends system prompt + user prompt to the NVIDIA endpoint.
    Handles 504 Gateway Timeouts with a single 2s backoff retry per model,
    then immediately switches to candidate fallback models.
    """
    last_exception = None

    for model_name in CANDIDATE_MODELS:
        for attempt in range(2):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
                if content:
                    return content.strip()
            except Exception as e:
                last_exception = e
                err_msg = str(e).lower()

                if "response_format" in err_msg or "json_object" in err_msg:
                    logger.warning(
                        f"Model '{model_name}' rejected json_object mode; "
                        "retrying with plain prompt..."
                    )
                    try:
                        response = client.chat.completions.create(
                            model=model_name,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            temperature=0.2,
                            max_tokens=max_tokens,
                        )
                        content = response.choices[0].message.content
                        if content:
                            return content.strip()
                    except Exception as inner_e:
                        last_exception = inner_e

                is_timeout_or_504 = (
                    "504" in err_msg
                    or "gateway timeout" in err_msg
                    or "timeout" in err_msg
                    or "connection" in err_msg
                )
                if is_timeout_or_504 and attempt == 0:
                    logger.warning(
                        f"Model '{model_name}' hit 504/timeout. Backing off 2.0s and retrying once..."
                    )
                    time.sleep(2.0)
                    continue

                logger.warning(f"Model '{model_name}' attempt {attempt + 1} failed: {e}")
                break

    raise last_exception if last_exception else RuntimeError("All LLM calls failed.")


# ─────────────────────────────────────────────
# Step 2 — Parse JSON safely with targeted correction
# ─────────────────────────────────────────────

def _clean_json_text(raw: str) -> str:
    """
    Cleans raw LLM text to extract parseable JSON:
    - Strips code fences (```json, ```python, etc.)
    - Extracts the outermost {...}
    - Cleans trailing commas before } or ]
    """
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[-1].strip().startswith("```"):
            text = "\n".join(lines[1:-1]).strip()
        else:
            text = "\n".join(lines[1:]).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    # Clean trailing commas
    text = re.sub(r",\s*([\]}])", r"\1", text)
    return text


def _correct_json_llm(broken: str, error_msg: str) -> dict:
    """
    Lightweight targeted JSON repair call.
    Sends only the malformed snippet and the syntax error to the fast model.
    Cost: ~150-300 tokens, ~1-2 seconds.
    Avoids repeating the entire multi-thousand-token prompt from scratch.
    """
    repair_prompt = f"""
Fix this invalid JSON syntax. Return ONLY the corrected valid JSON:
ERROR: {error_msg}
INVALID JSON:
{broken[:3000]}
""".strip()
    raw = _call_llm(
        user_prompt=repair_prompt,
        system_prompt="You are a JSON repair tool. Fix syntax errors and return ONLY valid raw JSON.",
        max_tokens=3500,
    )
    cleaned = _clean_json_text(raw)
    return json.loads(cleaned)


def _safe_parse_json(raw: str, allow_correction: bool = True) -> dict:
    """
    Parses the model's response as JSON.
    Applies automatic cleanup first, and falls back to a fast targeted
    correction request if a minor syntax error exists.
    """
    cleaned = _clean_json_text(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        if allow_correction:
            logger.warning(f"JSON decode failed ({e}). Sending fast targeted correction request...")
            try:
                return _correct_json_llm(cleaned, str(e))
            except Exception as corr_e:
                logger.warning(f"Targeted JSON correction failed: {corr_e}")
        raise e


# ─────────────────────────────────────────────
# Step 3 — Extract knowledge for one chunk
# ─────────────────────────────────────────────

def _extract_knowledge_for_chunk(
    chunk:       TranscriptChunk,
    on_progress: ProgressSink | None = None,
) -> dict:
    """
    Processes one transcript chunk through the Knowledge Extractor AI.
    Returns the extracted structured knowledge dictionary.
    Does NOT generate pages or select NotebookDocument element types.
    """
    user_prompt = build_extraction_prompt(
        transcript   = chunk.text,
        chunk_index  = chunk.index,
        total_chunks = chunk.total,
    )

    last_error: Exception | None = None
    human = f"{chunk.index + 1}/{chunk.total}"

    for attempt in range(MAX_RETRIES + 1):
        try:
            logger.info(
                f"Chunk {human} — extracting knowledge (attempt {attempt + 1})..."
            )
            _emit(
                on_progress,
                "extracting",
                f"Extracting knowledge from section {human}"
                + (f" (retry {attempt})" if attempt else ""),
                chunk.index + 1,
                chunk.total + 1,
            )

            raw    = _call_llm(
                user_prompt   = user_prompt,
                system_prompt = KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT,
            )
            parsed = _safe_parse_json(raw)
            if not isinstance(parsed, dict):
                raise ValueError("Expected a JSON dictionary from knowledge extractor")

            logger.info(
                f"Chunk {human} — extracted {len(parsed.get('concepts', []))} concepts, "
                f"{len(parsed.get('formulas', []))} formulas, "
                f"{len(parsed.get('algorithms', []))} algorithms."
            )
            return parsed

        except Exception as e:
            last_error = e
            logger.warning(f"Chunk {human} extraction attempt {attempt + 1} failed: {e}")

    raise ValueError(
        f"Chunk {human} knowledge extraction failed after "
        f"{MAX_RETRIES + 1} attempts. Last error: {last_error}"
    )


# ─────────────────────────────────────────────
# Python Document Sanitizer & Assembler
# ─────────────────────────────────────────────

def _extract_text(val: Any) -> str:
    """Recursively unpacks clean string text even if the LLM wraps it in a dict or nested structure."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, dict):
        for k in ("text", "content", "step", "point", "item", "description", "val", "value", "name"):
            if k in val and val[k]:
                return _extract_text(val[k])
        return " ".join(_extract_text(v) for v in val.values() if v).strip()
    if isinstance(val, (list, tuple)):
        return ", ".join(_extract_text(v) for v in val if v).strip()
    return str(val).strip()


def _clean_comparison_row(row: Any) -> tuple[str, str] | None:
    """Normalizes various LLM comparison row formats into (left_text, right_text)."""
    if isinstance(row, (list, tuple)):
        # Handle [ "row", [ {text: "A"}, {text: "B"} ] ]
        if len(row) == 2 and isinstance(row[1], (list, tuple)):
            return _clean_comparison_row(row[1])
        cells = [_extract_text(c) for c in row if _extract_text(c)]
        if len(cells) >= 2:
            return (cells[0], cells[1])
        elif len(cells) == 1:
            return (cells[0], "")
        return None
    elif isinstance(row, dict):
        if "left" in row and "right" in row:
            return (_extract_text(row["left"]), _extract_text(row["right"]))
        if "cells" in row and isinstance(row["cells"], (list, tuple)):
            return _clean_comparison_row(row["cells"])
        vals = [_extract_text(v) for v in row.values() if _extract_text(v)]
        if len(vals) >= 2:
            return (vals[0], vals[1])
        elif len(vals) == 1:
            return (vals[0], "")
    text = _extract_text(row)
    return (text, "") if text else None


def _sanitize_page_elements(elements_raw: list) -> list[dict]:
    """
    Sanitizes raw element dictionaries produced by the LLM:
    - Prunes empty paragraphs, headings, notes.
    - Bullet lists: removes blank items; converts 1-item lists to paragraphs; caps excessive items.
    - Important notes: limits to max 2 per page, converts excess notes to paragraphs.
    - Flowcharts: converts single/zero step charts to paragraphs.
    - Comparisons: provides fallback labels if omitted.
    - Mind maps & diagrams: strips invalid structure.
    - Ensures every element has a valid type and non-empty content.
    """
    if not isinstance(elements_raw, list):
        return []

    sanitized: list[dict] = []
    important_notes_count = 0

    for raw in elements_raw:
        if not isinstance(raw, dict):
            continue

        elem = dict(raw)
        elem_type = str(elem.get("type", "")).strip().lower()
        if not elem_type:
            continue
        elem["type"] = elem_type

        # Default importance if missing
        if "importance" not in elem or elem["importance"] not in ("low", "medium", "high"):
            elem["importance"] = "high" if elem_type == "important_note" else "low"

        # 1. Heading
        if elem_type == "heading":
            text = _extract_text(elem.get("text"))
            if not text:
                continue
            elem["text"] = text
            if elem.get("level") not in (1, 2):
                elem["level"] = 1
            sanitized.append(elem)

        # 2. Paragraph
        elif elem_type == "paragraph":
            text = _extract_text(elem.get("text"))
            if not text:
                continue
            elem["text"] = text
            sanitized.append(elem)

        # 3. Bullet List
        elif elem_type == "bullet_list":
            raw_items = elem.get("items")
            if not isinstance(raw_items, list):
                if raw_items:
                    raw_items = [raw_items]
                else:
                    raw_items = []
            cleaned_items = [_extract_text(x) for x in raw_items if _extract_text(x)]
            if not cleaned_items:
                continue
            if len(cleaned_items) == 1:
                title = (_extract_text(elem.get("title")) + ": ") if elem.get("title") else ""
                sanitized.append({
                    "type": "paragraph",
                    "text": f"{title}{cleaned_items[0]}",
                    "importance": elem.get("importance", "low"),
                })
            else:
                elem["items"] = cleaned_items[:8]
                sanitized.append(elem)

        # 4. Important Note (max 2 per page)
        elif elem_type == "important_note":
            text = _extract_text(elem.get("text"))
            if not text:
                continue
            if important_notes_count >= 2:
                sanitized.append({
                    "type": "paragraph",
                    "text": f"Note: {text}",
                    "importance": "medium",
                })
            else:
                elem["text"] = text
                important_notes_count += 1
                sanitized.append(elem)

        # 5. Definition
        elif elem_type == "definition":
            term = _extract_text(elem.get("term"))
            meaning = _extract_text(elem.get("meaning"))
            if not term and not meaning:
                continue
            elem["term"] = term or "Definition"
            elem["meaning"] = meaning or term
            sanitized.append(elem)

        # 6. Sticky Formula
        elif elem_type == "sticky_formula":
            formula = _extract_text(elem.get("formula"))
            label = _extract_text(elem.get("label"))
            if not formula and not label:
                continue
            elem["label"] = label or "Key Formula"
            elem["formula"] = formula or label
            elem["is_latex"] = bool(elem.get("is_latex", False))
            sanitized.append(elem)

        # 7. Flowchart
        elif elem_type == "flowchart":
            raw_steps = elem.get("steps")
            if not isinstance(raw_steps, list):
                raw_steps = [raw_steps] if raw_steps else []
            steps = [_extract_text(s) for s in raw_steps if _extract_text(s)]
            if not steps:
                continue
            if len(steps) < 2:
                title = (_extract_text(elem.get("title")) + ": ") if elem.get("title") else ""
                sanitized.append({
                    "type": "paragraph",
                    "text": f"{title}Process step: {steps[0]}",
                    "importance": elem.get("importance", "low"),
                })
            else:
                elem["steps"] = steps[:8]
                sanitized.append(elem)

        # 8. Comparison
        elif elem_type == "comparison":
            title = _extract_text(elem.get("title")) or "Comparison"
            left_label = _extract_text(elem.get("left_label")) or "Option A"
            right_label = _extract_text(elem.get("right_label")) or "Option B"
            raw_rows = elem.get("rows")
            if not isinstance(raw_rows, list) or not raw_rows:
                continue
            cleaned_rows = []
            for r in raw_rows:
                pair = _clean_comparison_row(r)
                if pair:
                    cleaned_rows.append(pair)
            if not cleaned_rows:
                continue
            elem["title"] = title
            elem["left_label"] = left_label
            elem["right_label"] = right_label
            elem["rows"] = cleaned_rows
            sanitized.append(elem)

        # 9. Summary
        elif elem_type == "summary":
            raw_points = elem.get("points")
            if not isinstance(raw_points, list):
                raw_points = [raw_points] if raw_points else []
            points = [_extract_text(p) for p in raw_points if _extract_text(p)]
            if not points:
                continue
            elem["points"] = points[:6]
            sanitized.append(elem)

        # 10. Code Block
        elif elem_type == "code_block":
            code = _extract_text(elem.get("code"))
            if not code:
                continue
            elem["code"] = code
            elem["language"] = str(elem.get("language") or "text").strip()
            sanitized.append(elem)

        # 11. Example
        elif elem_type == "example":
            context = _extract_text(elem.get("context"))
            walkthrough = _extract_text(elem.get("walkthrough"))
            if not context and not walkthrough:
                continue
            elem["context"] = context or "Worked Example"
            elem["walkthrough"] = walkthrough or context
            sanitized.append(elem)

        # 12. Other elements (diagram, mind_map, timeline, screenshot)
        else:
            sanitized.append(elem)

    return sanitized


def _assemble_notebook_document(
    raw_data: dict,
    style: NoteStyle,
    subject: str | None = None,
    source_url: str | None = None,
    video_id: str | None = None,
    title: str | None = None,
) -> NotebookDocument:
    """
    Python-driven document assembly:
    1. Extracts and sanitizes pages and elements via _sanitize_page_elements.
    2. Sequentially calculates page numbers (1..N).
    3. Calculates total_pages.
    4. Attaches authoritative metadata (timestamps, style, video_id, source_url, title).
    5. Validates with Pydantic and stamps unique IDs via assign_ids.
    """
    raw_pages = raw_data.get("pages", [])
    if not isinstance(raw_pages, list) or not raw_pages:
        raw_elements = raw_data.get("elements", [])
        raw_pages = [{"topic": "Lecture Notes", "elements": raw_elements}]

    cleaned_pages: list[NotebookPage] = []
    for idx, raw_page in enumerate(raw_pages, start=1):
        if not isinstance(raw_page, dict):
            continue
        topic = str(raw_page.get("topic") or f"Section {idx}").strip()
        raw_elements = raw_page.get("elements", [])
        if not isinstance(raw_elements, list):
            raw_elements = []

        sanitized_elements = _sanitize_page_elements(raw_elements)
        if not sanitized_elements:
            sanitized_elements = [{"type": "paragraph", "text": f"Overview of {topic}."}]

        page = NotebookPage(
            page_number=idx,
            topic=topic,
            elements=sanitized_elements,
        )
        cleaned_pages.append(page)

    if not cleaned_pages:
        cleaned_pages.append(
            NotebookPage(
                page_number=1,
                topic="Lecture Notes",
                elements=[{"type": "paragraph", "text": "Notes summary."}],
            )
        )

    resolved_title = (
        title
        or raw_data.get("title")
        or (raw_data.get("metadata", {}) or {}).get("title")
        or (cleaned_pages[0].topic if cleaned_pages else None)
        or subject
        or "Lecture Notes"
    )

    metadata = NotebookMetadata(
        title=str(resolved_title),
        subject=subject or (raw_data.get("metadata", {}) or {}).get("subject") or None,
        source_url=source_url or (raw_data.get("metadata", {}) or {}).get("source_url") or None,
        video_id=video_id or (raw_data.get("metadata", {}) or {}).get("video_id") or None,
        style=style,
        total_pages=len(cleaned_pages),
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    doc = NotebookDocument(
        metadata=metadata,
        pages=cleaned_pages,
    )
    return assign_ids(doc)


# ─────────────────────────────────────────────
# Step 4 — Direct Single-Call Notebook Generation
# ─────────────────────────────────────────────

def _generate_single_notebook(
    transcript:  str,
    style:       NoteStyle,
    subject:     str | None,
    source_url:  str | None,
    video_id:    str | None,
    title:       str | None,
    on_progress: ProgressSink | None = None,
) -> NotebookDocument:
    """
    Direct single-call generation for normal-length transcripts.
    One LLM call → Python sanitization & assembly → validated NotebookDocument.
    """
    user_prompt = build_user_prompt(
        transcript   = transcript,
        style        = style,
        subject      = subject,
        source_url   = source_url,
        video_id     = video_id,
        chunk_index  = None,
        total_chunks = None,
    )

    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            logger.info(f"Single-call LLM attempt {attempt + 1}...")
            _emit(
                on_progress,
                "generating",
                "Writing lecture notes" + (f" (retry {attempt})" if attempt else ""),
                1,
                1,
            )

            raw    = _call_llm(user_prompt)
            parsed = _safe_parse_json(raw)
            doc    = _assemble_notebook_document(
                raw_data=parsed,
                style=style,
                subject=subject,
                source_url=source_url,
                video_id=video_id,
                title=title,
            )

            logger.info(f"Single-call succeeded — assembled {len(doc.pages)} page(s).")
            return doc

        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}: LLM returned malformed JSON — {e}")

        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}: Assembly/Validation failed — {e}")

    raise ValueError(
        f"Single-call notebook generation failed after "
        f"{MAX_RETRIES + 1} attempts. Last error: {last_error}"
    )


# ─────────────────────────────────────────────
# Step 5 — Plan Notebook from Unified Knowledge
# ─────────────────────────────────────────────

def _plan_notebook_from_knowledge(
    knowledge:    dict,
    style:        NoteStyle,
    subject:      str | None,
    source_url:   str | None,
    video_id:     str | None,
    title:        str | None,
    on_progress:  ProgressSink | None = None,
    current_step: int = 1,
    total_steps:  int = 1,
) -> NotebookDocument:
    """
    Synthesizes unified, deduplicated knowledge into a full,
    cohesive NotebookDocument in ONE Planner LLM call.
    """
    user_prompt = build_planner_prompt_from_knowledge(
        knowledge  = knowledge,
        style      = style,
        subject    = subject,
        source_url = source_url,
        video_id   = video_id,
        title      = title,
    )

    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            logger.info(
                f"Notebook Planner LLM attempt {attempt + 1} from unified knowledge..."
            )
            _emit(
                on_progress,
                "planning",
                "Synthesizing unified knowledge into notebook pages"
                + (f" (retry {attempt})" if attempt else ""),
                current_step,
                total_steps,
            )

            raw    = _call_llm(user_prompt=user_prompt, system_prompt=SYSTEM_PROMPT)
            parsed = _safe_parse_json(raw)
            doc    = _assemble_notebook_document(
                raw_data=parsed,
                style=style,
                subject=subject,
                source_url=source_url,
                video_id=video_id,
                title=title,
            )

            logger.info(f"Notebook Planner succeeded — assembled {len(doc.pages)} page(s).")
            return doc

        except json.JSONDecodeError as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}: Planner returned malformed JSON — {e}")

        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1}: Planner assembly/validation failed — {e}")

    raise ValueError(
        f"Notebook Planner failed after "
        f"{MAX_RETRIES + 1} attempts. Last error: {last_error}"
    )


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
        ValueError — if generation fails after all retries.
    """
    word_count = len(transcript.split())

    # ── Single-call path for normal transcripts ───────────────────────────────
    if not needs_chunking(transcript):
        logger.info(
            f"Transcript has {word_count:,} words (under threshold) — "
            "processing in ONE direct LLM call."
        )
        _emit(
            on_progress,
            "starting",
            f"Processing lecture ({word_count:,} words) in a single pass",
            0,
            1,
        )
        notebook = _generate_single_notebook(
            transcript  = transcript,
            style       = style,
            subject     = subject,
            source_url  = source_url,
            video_id    = video_id,
            title       = title,
            on_progress = on_progress,
        )
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
            1,
            1,
        )
        return notebook

    # ── Multi-chunk architecture path for massive transcripts (>12k words) ────
    # Follows: N Extraction calls + Python Merger + 1 Notebook Planner call
    logger.info(f"Massive transcript ({word_count:,} words) — chunking into segments.")
    chunks = chunk_by_word_count(transcript)
    total_chunks = len(chunks)
    total_steps = total_chunks + 1  # N extraction steps + 1 planning step
    logger.info(f"Total chunks: {total_chunks}")
    _emit(
        on_progress,
        "chunking",
        f"Split the lecture into {total_chunks} sections for knowledge extraction",
        0,
        total_steps,
    )

    # Step 1: N Knowledge Extraction calls (strictly extracts knowledge, no pages)
    all_knowledge_chunks: list[dict] = []
    for chunk in chunks:
        extracted = _extract_knowledge_for_chunk(chunk, on_progress=on_progress)
        all_knowledge_chunks.append(extracted)

    # Step 2: Python Knowledge Merger (deduplication & unification, 0 LLM calls)
    _emit(
        on_progress,
        "merging",
        "Deduplicating and unifying knowledge across all sections",
        total_chunks,
        total_steps,
    )
    unified_knowledge = merge_knowledge(all_knowledge_chunks)

    # Step 3: ONE Notebook Planner call from unified knowledge
    notebook = _plan_notebook_from_knowledge(
        knowledge    = unified_knowledge,
        style        = style,
        subject      = subject,
        source_url   = source_url,
        video_id     = video_id,
        title        = title,
        on_progress  = on_progress,
        current_step = total_steps,
        total_steps  = total_steps,
    )

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
        total_steps,
        total_steps,
    )

    return notebook