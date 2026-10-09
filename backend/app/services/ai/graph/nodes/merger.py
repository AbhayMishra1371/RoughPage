"""
merger.py
=========
LangGraph node for Deterministic Knowledge Merging.

Zero LLM calls. Pure Python consolidation.
Responsibilities:
- Unifies structured outputs from Text, Formula, Visual, and Comparison specialists.
- Deduplicates repeated concepts and definitions while preserving source segment provenance.
- Assembles the canonical MergedLectureKnowledge object for the Notebook Planner.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import (
    ExtractedConcept,
    ExtractedDefinition,
    ExtractedNote,
    MergedLectureKnowledge,
)
from app.services.ai.graph.state import PipelineState

logger = logging.getLogger(__name__)


def _normalize(text: str) -> str:
    return " ".join(str(text).strip().lower().split())


def _deduplicate_concepts(concepts: list[ExtractedConcept]) -> list[ExtractedConcept]:
    """
    Deduplicates concepts by normalized name.
    If duplicates exist, combines their source_segments and keeps the longer explanation.
    """
    seen: dict[str, ExtractedConcept] = {}

    for c in concepts:
        key = _normalize(c.name)
        if not key:
            continue

        if key not in seen:
            seen[key] = c
        else:
            existing = seen[key]
            # Union of source segments while preserving order
            merged_segments = list(dict.fromkeys(existing.source_segments + c.source_segments))
            # Pick longer explanation
            chosen_expl = c.explanation if len(c.explanation) > len(existing.explanation) else existing.explanation
            seen[key] = ExtractedConcept(
                name=existing.name,
                type=existing.type if existing.type != "general" else c.type,
                explanation=chosen_expl,
                importance=existing.importance if existing.importance == "high" else c.importance,
                belongs_to_topic=existing.belongs_to_topic or c.belongs_to_topic,
                source_segments=merged_segments,
            )

    return list(seen.values())


def _deduplicate_definitions(definitions: list[ExtractedDefinition]) -> list[ExtractedDefinition]:
    """
    Deduplicates definitions by normalized term name.
    """
    seen: dict[str, ExtractedDefinition] = {}

    for d in definitions:
        key = _normalize(d.term)
        if not key:
            continue

        if key not in seen:
            seen[key] = d
        else:
            existing = seen[key]
            merged_segments = list(dict.fromkeys(existing.source_segments + d.source_segments))
            chosen_meaning = d.meaning if len(d.meaning) > len(existing.meaning) else existing.meaning
            seen[key] = ExtractedDefinition(
                term=existing.term,
                meaning=chosen_meaning,
                example=existing.example or d.example,
                source_segments=merged_segments,
            )

    return list(seen.values())


def _deduplicate_notes(notes: list[ExtractedNote]) -> list[ExtractedNote]:
    """
    Deduplicates notes by normalized text.
    """
    seen: dict[str, ExtractedNote] = {}

    for n in notes:
        key = _normalize(n.text)
        if not key:
            continue

        if key not in seen:
            seen[key] = n
        else:
            existing = seen[key]
            merged_segments = list(dict.fromkeys(existing.source_segments + n.source_segments))
            seen[key] = ExtractedNote(
                text=existing.text,
                importance="high" if "high" in (existing.importance, n.importance) else existing.importance,
                source_segments=merged_segments,
            )

    return list(seen.values())


def merger_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Combines all specialist outputs into MergedLectureKnowledge.
    Zero LLM calls.
    """
    logger.info("[merger_node] Consolidating specialist knowledge...")

    routing = state.get("routing")
    title = (routing.lecture_title if routing else state.get("title")) or "Lecture Notes"
    topics = routing.main_topics if routing else []
    summary = routing.summary if routing else ""

    text_res = state.get("text_result")
    formula_res = state.get("formula_result")
    visual_res = state.get("visual_result")
    comp_res = state.get("comparison_result")

    # 1. Deduplicate text concepts, definitions, and notes
    raw_concepts = text_res.concepts if text_res else []
    raw_definitions = text_res.definitions if text_res else []
    raw_notes = text_res.notes if text_res else []
    raw_bullets = text_res.bullet_groups if text_res else []

    merged_concepts = _deduplicate_concepts(raw_concepts)
    merged_definitions = _deduplicate_definitions(raw_definitions)
    merged_notes = _deduplicate_notes(raw_notes)

    # 2. Collect formulas
    formulas = formula_res.formulas if formula_res else []

    # 3. Collect visuals
    flowcharts = visual_res.flowcharts if visual_res else []
    diagrams = visual_res.diagrams if visual_res else []
    mindmaps = visual_res.mindmaps if visual_res else []

    # 4. Collect comparisons & timelines
    comparisons = comp_res.comparisons if comp_res else []
    timelines = comp_res.timelines if comp_res else []

    merged_knowledge = MergedLectureKnowledge(
        title=title,
        main_topics=topics,
        summary=summary,
        concepts=merged_concepts,
        definitions=merged_definitions,
        notes=merged_notes,
        bullet_groups=raw_bullets,
        formulas=formulas,
        flowcharts=flowcharts,
        diagrams=diagrams,
        mindmaps=mindmaps,
        comparisons=comparisons,
        timelines=timelines,
    )

    logger.info(
        f"[merger_node] Merged: {len(merged_concepts)} concepts, "
        f"{len(merged_definitions)} definitions, {len(formulas)} formulas, "
        f"{len(flowcharts)} flowcharts, {len(diagrams)} diagrams, "
        f"{len(comparisons)} comparisons."
    )

    return {"merged_knowledge": merged_knowledge}
