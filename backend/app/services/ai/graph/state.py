"""
state.py
========
TypedDict state schema for the RoughPage AI LangGraph pipeline.

Design principles:
1. Independent channels for parallel specialist nodes to avoid race conditions.
2. Operator.add reducer for `errors` so failures accumulate gracefully.
3. Provenance tracking: `segments` remain the immutable source of truth throughout graph execution.
"""

from __future__ import annotations

import operator
from typing import Annotated, Optional, TypedDict

from app.schemas.notebook import NoteStyle, NotebookDocument
from app.schemas.pipeline import (
    ComparisonKnowledge,
    FormulaKnowledge,
    MergedLectureKnowledge,
    RoutingDecision,
    TextKnowledge,
    TranscriptSegment,
    VisualKnowledge,
)


class PipelineState(TypedDict):
    """
    State object flowing through the LangGraph pipeline.
    """

    # ── 1. Input Context ──
    raw_transcript: str
    segments: list[TranscriptSegment]
    source_url: Optional[str]
    video_id: Optional[str]
    style: NoteStyle
    subject: Optional[str]
    title: Optional[str]

    # ── 2. Analyzer & Routing ──
    routing: Optional[RoutingDecision]

    # ── 3. Parallel Specialist Outputs (Isolated keys prevent merge conflicts) ──
    text_result: Optional[TextKnowledge]
    formula_result: Optional[FormulaKnowledge]
    visual_result: Optional[VisualKnowledge]
    comparison_result: Optional[ComparisonKnowledge]

    # ── 4. Fault Tolerance (Accumulating error log) ──
    errors: Annotated[list[str], operator.add]

    # ── 5. Downstream Synthesis ──
    merged_knowledge: Optional[MergedLectureKnowledge]
    validation_passed: bool
    notebook_document: Optional[NotebookDocument]
