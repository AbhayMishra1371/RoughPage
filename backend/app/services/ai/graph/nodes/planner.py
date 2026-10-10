"""
planner.py
==========
LangGraph node for the Notebook Planner.

Responsibilities:
- Synthesizes validated, unified knowledge (concepts, definitions, formulas, visuals, comparisons)
  into a coherent, structured NotebookDocument.
- Uses the Smart LLM tier (DeepSeek V4.1 Flash with Gemini 3.5 Flash fallback).
- Strictly enforces the NotebookDocument schema and element composition rules.
- Python-driven sanitization and assembly guarantees contract safety with the Next.js renderer.
- Fallback deterministic synthesis ensures zero downtime or crashes even if LLM output fails.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import re
from typing import Any

from app.schemas.notebook import (
    NotebookDocument,
    NotebookMetadata,
    NotebookPage,
    NoteStyle,
    assign_ids,
)
from app.schemas.pipeline import MergedLectureKnowledge
from app.services.ai.graph.state import PipelineState
from app.services.ai.prompts.system_prompt import SYSTEM_PROMPT
from app.services.ai.prompts.user_prompt import build_planner_prompt_from_knowledge
from app.services.ai.providers.factory import get_llm_provider

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Python Document Sanitizers & Helpers
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


def _clean_json_text(raw: str) -> str:
    """Extracts valid JSON substring and cleans common markdown fences."""
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


def _safe_parse_json(raw: str) -> dict[str, Any]:
    """Parses JSON safely from LLM output."""
    cleaned = _clean_json_text(raw)
    return json.loads(cleaned)


def sanitize_page_elements(elements_raw: list) -> list[dict[str, Any]]:
    """
    Sanitizes raw element dictionaries produced by the LLM:
    - Prunes empty paragraphs, headings, notes.
    - Bullet lists: removes blank items; converts 1-item lists to paragraphs; caps excessive items.
    - Important notes: limits to max 2 per page, converts excess notes to paragraphs.
    - Flowcharts: converts single/zero step charts to paragraphs.
    - Comparisons: provides fallback labels if omitted.
    - Diagrams: normalizes nodes and edge pairs.
    - Ensures every element has a valid type, valid importance, and non-empty content.
    """
    if not isinstance(elements_raw, list):
        return []

    sanitized: list[dict[str, Any]] = []
    important_notes_count = 0

    for raw in elements_raw:
        if not isinstance(raw, dict):
            continue

        elem = dict(raw)
        elem_type = str(elem.get("type", "")).strip().lower()
        if not elem_type:
            continue
        elem["type"] = elem_type

        # Default importance
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
                raw_items = [raw_items] if raw_items else []
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
            example = _extract_text(elem.get("example"))
            if example:
                elem["example"] = example
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

        # 12. Diagram
        elif elem_type == "diagram":
            raw_nodes = elem.get("nodes")
            if not isinstance(raw_nodes, list):
                raw_nodes = []
            nodes = [_extract_text(n) for n in raw_nodes if _extract_text(n)]
            raw_edges = elem.get("edges")
            if not isinstance(raw_edges, list):
                raw_edges = []
            edges = []
            for e in raw_edges:
                if isinstance(e, (list, tuple)) and len(e) >= 2:
                    edges.append((_extract_text(e[0]), _extract_text(e[1])))
                elif isinstance(e, dict):
                    src = _extract_text(e.get("source") or e.get("from") or e.get("src"))
                    dst = _extract_text(e.get("target") or e.get("to") or e.get("dst"))
                    if src and dst:
                        edges.append((src, dst))
            if nodes:
                elem["nodes"] = nodes
                elem["edges"] = edges
                sanitized.append(elem)

        # 13. Other elements (mind_map, timeline, screenshot)
        else:
            sanitized.append(elem)

    return sanitized


def assemble_notebook_document(
    raw_data: dict[str, Any],
    style: NoteStyle,
    subject: str | None = None,
    source_url: str | None = None,
    video_id: str | None = None,
    title: str | None = None,
) -> NotebookDocument:
    """
    Python-driven document assembly:
    1. Extracts and sanitizes pages and elements.
    2. Sequentially calculates page numbers (1..N).
    3. Calculates total_pages.
    4. Attaches authoritative metadata.
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

        sanitized_elements = sanitize_page_elements(raw_elements)
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


def synthesize_fallback_document(
    knowledge: MergedLectureKnowledge,
    style: NoteStyle,
    subject: str | None = None,
    source_url: str | None = None,
    video_id: str | None = None,
    title: str | None = None,
) -> NotebookDocument:
    """
    Zero-LLM deterministic fallback:
    Directly converts validated MergedLectureKnowledge into a structured NotebookDocument
    if the Planner LLM encounters unrecoverable errors.
    """
    logger.warning("[planner] Generating zero-LLM deterministic fallback NotebookDocument.")
    elements: list[dict[str, Any]] = []

    # Main Heading
    resolved_title = title or subject or "Lecture Notes"
    elements.append({"type": "heading", "text": resolved_title, "level": 1, "importance": "high"})

    # Concepts & Explanations
    for c in knowledge.concepts:
        elements.append({"type": "heading", "text": c.name, "level": 2, "importance": "medium"})
        elements.append({"type": "paragraph", "text": c.explanation, "importance": "low"})

    # Definitions
    for d in knowledge.definitions:
        elem: dict[str, Any] = {"type": "definition", "term": d.term, "meaning": d.meaning, "importance": "high"}
        if d.example:
            elem["example"] = d.example
        elements.append(elem)

    # Formulas
    for f in knowledge.formulas:
        elements.append({
            "type": "sticky_formula",
            "label": f.label,
            "formula": f.formula,
            "is_latex": bool(f.is_latex),
            "importance": "high",
        })

    # Flowcharts
    for fc in knowledge.flowcharts:
        if len(fc.steps) >= 2:
            elements.append({
                "type": "flowchart",
                "title": fc.title,
                "steps": fc.steps,
                "importance": "medium",
            })

    # Comparisons
    for cmp in knowledge.comparisons:
        if cmp.rows:
            elements.append({
                "type": "comparison",
                "title": cmp.title,
                "left_label": cmp.left_label,
                "right_label": cmp.right_label,
                "rows": [(r.left, r.right) for r in cmp.rows],
                "importance": "medium",
            })

    # Bullet Groups
    for bg in knowledge.bullet_groups:
        if bg.items:
            elements.append({
                "type": "bullet_list",
                "title": bg.title,
                "items": bg.items,
                "importance": "low",
            })

    # Important Notes
    for n in knowledge.notes[:2]:
        elements.append({"type": "important_note", "text": n.text, "importance": "high"})

    # Summary
    summary_points = [c.name for c in knowledge.concepts[:4]]
    if not summary_points and knowledge.definitions:
        summary_points = [d.term for d in knowledge.definitions[:4]]
    if not summary_points:
        summary_points = ["Lecture concepts reviewed."]
    elements.append({"type": "summary", "points": summary_points, "importance": "medium"})

    raw_data = {
        "title": resolved_title,
        "pages": [{"topic": resolved_title, "elements": elements}],
    }

    return assemble_notebook_document(
        raw_data=raw_data,
        style=style,
        subject=subject,
        source_url=source_url,
        video_id=video_id,
        title=title,
    )


# ─────────────────────────────────────────────
# Planner Node Execution
# ─────────────────────────────────────────────

def planner_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Executes the Notebook Planner.
    Consumes unified knowledge and plans cohesive notebook pages.
    """
    logger.info("[planner_node] Starting Notebook Planner...")

    title = state.get("title")
    merged_knowledge = state.get("merged_knowledge") or MergedLectureKnowledge(title=title or "Lecture Notes")
    style = state.get("style", NoteStyle.DETAILED)
    subject = state.get("subject")
    source_url = state.get("source_url")
    video_id = state.get("video_id")

    # Build prompt from unified knowledge
    knowledge_dict = merged_knowledge.model_dump()
    user_prompt = build_planner_prompt_from_knowledge(
        knowledge=knowledge_dict,
        style=style,
        subject=subject,
        source_url=source_url,
        video_id=video_id,
        title=title,
    )

    provider = get_llm_provider("planner")
    max_retries = 2
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            logger.info(f"[planner_node] Invoking Smart Planner LLM (attempt {attempt + 1})...")
            raw_response = provider.generate_text(
                prompt=user_prompt,
                system_prompt=SYSTEM_PROMPT,
                temperature=0.2,
            )

            parsed = _safe_parse_json(raw_response)
            doc = assemble_notebook_document(
                raw_data=parsed,
                style=style,
                subject=subject,
                source_url=source_url,
                video_id=video_id,
                title=title,
            )

            logger.info(f"[planner_node] Successfully assembled {len(doc.pages)} notebook page(s).")
            return {"notebook_document": doc}

        except Exception as e:
            last_error = e
            logger.warning(f"[planner_node] Attempt {attempt + 1} failed: {e}")

    # Fallback if all attempts fail
    error_msg = f"Planner LLM failed after {max_retries + 1} attempts: {last_error}"
    logger.error(f"[planner_node] {error_msg}. Triggering fallback document synthesis.")
    fallback_doc = synthesize_fallback_document(
        knowledge=merged_knowledge,
        style=style,
        subject=subject,
        source_url=source_url,
        video_id=video_id,
        title=title,
    )

    return {
        "notebook_document": fallback_doc,
        "errors": [error_msg],
    }
