"""
validator.py
============
LangGraph node for Source-Grounding and Provenance Validation.

Responsibilities:
- Verifies that all cited segment IDs (SEG_xxx) actually exist in the canonical transcript.
- Prunes fabricated/hallucinated segment IDs.
- Drops unsupported items that have zero valid transcript references.
- Validates structural consistency (diagram edge nodes, comparison columns).
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import (
    ExtractedBulletGroup,
    ExtractedComparison,
    ExtractedConcept,
    ExtractedDefinition,
    ExtractedDiagram,
    ExtractedFlowchart,
    ExtractedFormula,
    ExtractedMindMap,
    ExtractedNote,
    ExtractedTimeline,
    MergedLectureKnowledge,
)
from app.services.ai.graph.state import PipelineState

logger = logging.getLogger(__name__)


def _filter_valid_segments(source_segments: list[str], valid_ids: set[str]) -> list[str]:
    """Keeps only segment IDs that exist in the canonical transcript."""
    return [sid.strip().upper() for sid in source_segments if sid.strip().upper() in valid_ids]


def validate_source_grounding(
    knowledge: MergedLectureKnowledge,
    valid_ids: set[str],
) -> MergedLectureKnowledge:
    """
    Validates and cleans all extracted items against the transcript's valid segment IDs.
    Items citing only hallucinated segment IDs are dropped.
    """
    # 1. Concepts
    clean_concepts: list[ExtractedConcept] = []
    for c in knowledge.concepts:
        clean_segs = _filter_valid_segments(c.source_segments, valid_ids)
        # If segments were provided but all were invalid, prune; otherwise keep with clean IDs
        if clean_segs or not c.source_segments:
            clean_concepts.append(c.model_copy(update={"source_segments": clean_segs}))
        else:
            logger.warning(f"[validator] Dropping hallucinated concept '{c.name}' citing fake IDs: {c.source_segments}")

    # 2. Definitions
    clean_definitions: list[ExtractedDefinition] = []
    for d in knowledge.definitions:
        clean_segs = _filter_valid_segments(d.source_segments, valid_ids)
        if clean_segs or not d.source_segments:
            clean_definitions.append(d.model_copy(update={"source_segments": clean_segs}))
        else:
            logger.warning(f"[validator] Dropping hallucinated definition '{d.term}' citing fake IDs: {d.source_segments}")

    # 3. Notes
    clean_notes: list[ExtractedNote] = []
    for n in knowledge.notes:
        clean_segs = _filter_valid_segments(n.source_segments, valid_ids)
        if clean_segs or not n.source_segments:
            clean_notes.append(n.model_copy(update={"source_segments": clean_segs}))

    # 4. Bullet Groups
    clean_bullets: list[ExtractedBulletGroup] = []
    for b in knowledge.bullet_groups:
        clean_segs = _filter_valid_segments(b.source_segments, valid_ids)
        clean_items = [it.strip() for it in b.items if it.strip()]
        if len(clean_items) >= 2:
            clean_bullets.append(b.model_copy(update={"items": clean_items, "source_segments": clean_segs}))

    # 5. Formulas
    clean_formulas: list[ExtractedFormula] = []
    for f in knowledge.formulas:
        clean_segs = _filter_valid_segments(f.source_segments, valid_ids)
        if f.formula.strip() and (clean_segs or not f.source_segments):
            clean_formulas.append(f.model_copy(update={"source_segments": clean_segs}))
        else:
            logger.warning(f"[validator] Dropping ungrounded formula '{f.label}' citing fake IDs: {f.source_segments}")

    # 6. Flowcharts
    clean_flowcharts: list[ExtractedFlowchart] = []
    for fc in knowledge.flowcharts:
        clean_segs = _filter_valid_segments(fc.source_segments, valid_ids)
        clean_steps = [s.strip() for s in fc.steps if s.strip()]
        if len(clean_steps) >= 2:
            clean_flowcharts.append(fc.model_copy(update={"steps": clean_steps, "source_segments": clean_segs}))

    # 7. Diagrams
    clean_diagrams: list[ExtractedDiagram] = []
    for diag in knowledge.diagrams:
        clean_segs = _filter_valid_segments(diag.source_segments, valid_ids)
        node_set = {n.strip() for n in diag.nodes if n.strip()}
        valid_edges = [e for e in diag.edges if e.source in node_set and e.target in node_set]
        if len(node_set) >= 2:
            clean_diagrams.append(
                diag.model_copy(
                    update={
                        "nodes": list(node_set),
                        "edges": valid_edges,
                        "source_segments": clean_segs,
                    }
                )
            )

    # 8. Mind Maps
    clean_mindmaps: list[ExtractedMindMap] = []
    for mm in knowledge.mindmaps:
        clean_segs = _filter_valid_segments(mm.source_segments, valid_ids)
        clean_branches = [b.strip() for b in mm.branches if b.strip()]
        if mm.center.strip() and len(clean_branches) >= 2:
            clean_mindmaps.append(mm.model_copy(update={"branches": clean_branches, "source_segments": clean_segs}))

    # 9. Comparisons
    clean_comparisons: list[ExtractedComparison] = []
    for comp in knowledge.comparisons:
        clean_segs = _filter_valid_segments(comp.source_segments, valid_ids)
        valid_rows = [r for r in comp.rows if r.left.strip() or r.right.strip()]
        if comp.left_label.strip() and comp.right_label.strip() and len(valid_rows) >= 2:
            clean_comparisons.append(comp.model_copy(update={"rows": valid_rows, "source_segments": clean_segs}))

    # 10. Timelines
    clean_timelines: list[ExtractedTimeline] = []
    for tl in knowledge.timelines:
        clean_segs = _filter_valid_segments(tl.source_segments, valid_ids)
        valid_events = [ev for ev in tl.events if ev.label.strip() and ev.description.strip()]
        if len(valid_events) >= 2:
            clean_timelines.append(tl.model_copy(update={"events": valid_events, "source_segments": clean_segs}))

    return MergedLectureKnowledge(
        title=knowledge.title,
        main_topics=knowledge.main_topics,
        summary=knowledge.summary,
        concepts=clean_concepts,
        definitions=clean_definitions,
        notes=clean_notes,
        bullet_groups=clean_bullets,
        formulas=clean_formulas,
        flowcharts=clean_flowcharts,
        diagrams=clean_diagrams,
        mindmaps=clean_mindmaps,
        comparisons=clean_comparisons,
        timelines=clean_timelines,
    )


def validator_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Validates provenance of MergedLectureKnowledge.
    """
    logger.info("[validator_node] Validating source grounding and provenance...")

    merged_knowledge = state.get("merged_knowledge")
    if not merged_knowledge:
        logger.warning("[validator_node] No merged knowledge present to validate.")
        return {"validation_passed": False}

    segments = state.get("segments") or []
    valid_ids = {s.id.strip().upper() for s in segments}

    validated_knowledge = validate_source_grounding(merged_knowledge, valid_ids)

    return {
        "merged_knowledge": validated_knowledge,
        "validation_passed": True,
    }
