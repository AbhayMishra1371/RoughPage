"""
knowledge_merger.py
===================

Merges KnowledgeChunk results from multiple transcript chunks
into one unified knowledge object.

No LLM is involved.

Responsibilities:
    - Combine knowledge from all chunks.
    - Deduplicate repeated topics and extracted items.
    - Preserve unique information.
    - Deduplicate relationships.
    - Produce one unified knowledge object for the
      Notebook Planner.

Important:
    This module does NOT infer new relationships between concepts.
    It only merges and deduplicates relationships that were already
    extracted by the Knowledge Extraction stage.

The Notebook Planner receives the unified knowledge and makes
the final global decisions about notebook structure.
"""

from __future__ import annotations

import json


# ─────────────────────────────────────────────
# Deduplication helpers
# ─────────────────────────────────────────────

def _normalize(text: str) -> str:
    """
    Normalize text for case-insensitive comparison.
    """
    return str(text).strip().lower()


def _deduplicate_by_key(
    items: list[dict],
    key: str,
) -> list[dict]:
    """
    Remove duplicate dictionaries based on one field.

    Keeps the first occurrence.
    Comparison is case-insensitive.
    """

    seen: set[str] = set()
    result: list[dict] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        value = _normalize(item.get(key, ""))

        if value and value not in seen:
            seen.add(value)
            result.append(item)

    return result


def _deduplicate_strings(
    items: list[str],
) -> list[str]:
    """
    Remove duplicate strings while preserving order.
    """

    seen: set[str] = set()
    result: list[str] = []

    for item in items:
        if not isinstance(item, str):
            continue

        key = _normalize(item)

        if key and key not in seen:
            seen.add(key)
            result.append(item)

    return result


def _deduplicate_relationships(
    items: list[dict],
) -> list[dict]:
    """
    Deduplicate relationships using:

        from + to + type

    This does not infer new relationships.
    It only removes duplicate relationships already
    extracted from the transcript chunks.
    """

    seen: set[tuple[str, str, str]] = set()
    result: list[dict] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        key = (
            _normalize(item.get("from", "")),
            _normalize(item.get("to", "")),
            _normalize(item.get("type", "")),
        )

        if key not in seen:
            seen.add(key)
            result.append(item)

    return result


# ─────────────────────────────────────────────
# Main merge function
# ─────────────────────────────────────────────

def merge_knowledge(
    chunks: list[dict],
) -> dict:
    """
    Merge knowledge extracted from multiple transcript chunks.

    Args:
        chunks:
            List of KnowledgeChunk dictionaries.

    Returns:
        One unified knowledge dictionary.

    If there are no chunks, an empty knowledge structure
    is returned.

    If there is one chunk, it is normalized and returned
    without unnecessary processing.
    """

    if not chunks:
        return _empty_knowledge()

    # ─────────────────────────────────────────
    # Aggregate all fields
    # ─────────────────────────────────────────

    all_topics: list[str] = []
    all_concepts: list[dict] = []
    all_formulas: list[dict] = []
    all_algorithms: list[dict] = []
    all_examples: list[dict] = []
    all_comparisons: list[dict] = []
    all_diagrams: list[dict] = []
    all_important_notes: list[dict] = []
    all_relationships: list[dict] = []
    all_code_snippets: list[dict] = []

    for chunk in chunks:

        if not isinstance(chunk, dict):
            continue

        all_topics.extend(
            chunk.get("topics", [])
        )

        all_concepts.extend(
            chunk.get("concepts", [])
        )

        all_formulas.extend(
            chunk.get("formulas", [])
        )

        all_algorithms.extend(
            chunk.get("algorithms", [])
        )

        all_examples.extend(
            chunk.get("examples", [])
        )

        all_comparisons.extend(
            chunk.get("comparisons", [])
        )

        all_diagrams.extend(
            chunk.get("diagrams", [])
        )

        all_important_notes.extend(
            chunk.get("important_notes", [])
        )

        all_relationships.extend(
            chunk.get("relationships", [])
        )

        all_code_snippets.extend(
            chunk.get("code_snippets", [])
        )

    # ─────────────────────────────────────────
    # Deduplicate
    # ─────────────────────────────────────────

    merged_topics = _deduplicate_strings(
        all_topics
    )

    merged_concepts = _deduplicate_by_key(
        all_concepts,
        "name",
    )

    merged_formulas = _deduplicate_by_key(
        all_formulas,
        "formula",
    )

    merged_algorithms = _deduplicate_by_key(
        all_algorithms,
        "name",
    )

    merged_examples = _deduplicate_by_key(
        all_examples,
        "context",
    )

    merged_comparisons = _deduplicate_by_key(
        all_comparisons,
        "title",
    )

    merged_diagrams = _deduplicate_by_key(
        all_diagrams,
        "title",
    )

    merged_notes = _deduplicate_by_key(
        all_important_notes,
        "text",
    )

    merged_snippets = _deduplicate_by_key(
        all_code_snippets,
        "code",
    )

    merged_relationships = _deduplicate_relationships(
        all_relationships
    )

    # ─────────────────────────────────────────
    # Unified result
    # ─────────────────────────────────────────

    return {
        "topics": merged_topics,
        "concepts": merged_concepts,
        "formulas": merged_formulas,
        "algorithms": merged_algorithms,
        "examples": merged_examples,
        "comparisons": merged_comparisons,
        "diagrams": merged_diagrams,
        "important_notes": merged_notes,
        "relationships": merged_relationships,
        "code_snippets": merged_snippets,
    }


# ─────────────────────────────────────────────
# Empty knowledge structure
# ─────────────────────────────────────────────

def _empty_knowledge() -> dict:
    """
    Return an empty knowledge structure with all
    expected fields.
    """

    return {
        "topics": [],
        "concepts": [],
        "formulas": [],
        "algorithms": [],
        "examples": [],
        "comparisons": [],
        "diagrams": [],
        "important_notes": [],
        "relationships": [],
        "code_snippets": [],
    }


# ─────────────────────────────────────────────
# Knowledge → prompt serialization
# ─────────────────────────────────────────────

def knowledge_to_prompt_text(
    knowledge: dict,
) -> str:
    """
    Convert unified knowledge into JSON text for the
    Notebook Planner.

    The Notebook Planner receives this structured
    knowledge instead of the original raw transcript
    when the long-transcript path is used.
    """

    return json.dumps(
        knowledge,
        indent=2,
        ensure_ascii=False,
    )