"""
pipeline.py
===========
Canonical schemas for the RoughPage AI specialist pipeline.

These models define:
1. Transcript segments with stable IDs and timestamps (SEG_001, SEG_002, ...).
2. Routing decisions produced by the Lecture Analyzer.
3. Structured specialist outputs (Text, Formula, Visual, Comparison), where
   every extracted item carries `source_segments` for provenance and validation.
4. The MergedLectureKnowledge schema consumed by the Notebook Planner.
"""

from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, model_validator


# ─────────────────────────────────────────────
# 1. Transcript Segments & Segmented Transcript
# ─────────────────────────────────────────────


class TranscriptSegment(BaseModel):
    """
    A single segmented slice of the lecture transcript.
    Carries a stable identifier and optional start/end timestamps.
    """

    id: str = Field(description="Stable ID, e.g. 'SEG_001'")
    start_s: Optional[float] = Field(default=None, description="Start time in seconds")
    end_s: Optional[float] = Field(default=None, description="End time in seconds")
    text: str = Field(description="Cleaned transcript text for this segment")

    @property
    def timestamp_str(self) -> str:
        """Human-readable timestamp range, e.g. '01:23 - 02:05' or 'N/A'."""
        if self.start_s is None or self.end_s is None:
            return "N/A"
        start_min, start_sec = divmod(int(self.start_s), 60)
        end_min, end_sec = divmod(int(self.end_s), 60)
        return f"{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}"

    @property
    def formatted_text(self) -> str:
        """Formatted snippet with ID and timestamp header."""
        return f"[{self.id} | {self.timestamp_str}]\n{self.text}"


class SegmentedTranscript(BaseModel):
    """
    The canonical source of truth for a lecture transcript.
    Contains an ordered list of segments with lookup and formatting utilities.
    """

    segments: list[TranscriptSegment] = Field(default_factory=list)
    total_words: int = 0
    duration_seconds: Optional[float] = None

    @model_validator(mode="after")
    def _compute_metrics(self) -> SegmentedTranscript:
        if not self.total_words and self.segments:
            self.total_words = sum(len(s.text.split()) for s in self.segments)
        if self.duration_seconds is None and self.segments:
            valid_ends = [s.end_s for s in self.segments if s.end_s is not None]
            if valid_ends:
                self.duration_seconds = max(valid_ends)
        return self

    def get_segment(self, segment_id: str) -> Optional[TranscriptSegment]:
        """Find a segment by ID (case-insensitive)."""
        sid = segment_id.strip().upper()
        for seg in self.segments:
            if seg.id.upper() == sid:
                return seg
        return None

    def get_text_for_segments(self, segment_ids: list[str]) -> str:
        """Extract and join text for a specific list of segment IDs."""
        id_set = {s.strip().upper() for s in segment_ids}
        selected = [s.formatted_text for s in self.segments if s.id.upper() in id_set]
        return "\n\n".join(selected)

    def to_prompt_context(self) -> str:
        """Format the entire segmented transcript for LLM prompts."""
        return "\n\n".join(s.formatted_text for s in self.segments)


# ─────────────────────────────────────────────
# 2. Router / Lecture Analysis Schemas
# ─────────────────────────────────────────────


class SpecialistRoute(BaseModel):
    """Routing instructions for a single specialist."""

    required: bool = Field(
        default=False,
        description="True if this specialist should be invoked",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Brief justification for why this specialist is or is not needed",
    )
    segment_ids: list[str] = Field(
        default_factory=list,
        description="List of segment IDs relevant to this specialist",
    )


class RoutingDecision(BaseModel):
    """
    Output produced by the Lecture Analyzer node.
    Specifies which specialists to activate and which segments they receive.
    """

    lecture_title: str = Field(description="Inferred or given lecture title")
    main_topics: list[str] = Field(
        default_factory=list,
        description="Key topics covered in the lecture",
    )
    summary: str = Field(description="2-3 sentence overview of the lecture")
    text: SpecialistRoute = Field(
        default_factory=SpecialistRoute,
        description="Route for general text concepts & definitions",
    )
    formula: SpecialistRoute = Field(
        default_factory=SpecialistRoute,
        description="Route for mathematical formulas & equations",
    )
    visual: SpecialistRoute = Field(
        default_factory=SpecialistRoute,
        description="Route for flowcharts, diagrams, and architectures",
    )
    comparison: SpecialistRoute = Field(
        default_factory=SpecialistRoute,
        description="Route for comparison tables and timelines",
    )


# ─────────────────────────────────────────────
# 3. Specialist Output Schemas (Source Grounded)
# ─────────────────────────────────────────────


class ExtractedConcept(BaseModel):
    name: str
    type: Literal["definition", "process", "principle", "property", "theory", "general"] = "general"
    explanation: str
    importance: Literal["high", "medium", "low"] = "medium"
    belongs_to_topic: Optional[str] = None
    source_segments: list[str] = Field(default_factory=list)


class ExtractedDefinition(BaseModel):
    term: str
    meaning: str
    example: Optional[str] = None
    source_segments: list[str] = Field(default_factory=list)


class ExtractedNote(BaseModel):
    text: str
    importance: Literal["high", "medium", "low"] = "high"
    source_segments: list[str] = Field(default_factory=list)


class ExtractedBulletGroup(BaseModel):
    title: Optional[str] = None
    items: list[str] = Field(default_factory=list)
    source_segments: list[str] = Field(default_factory=list)


class TextKnowledge(BaseModel):
    """Structured output returned by the Text Specialist."""

    concepts: list[ExtractedConcept] = Field(default_factory=list)
    definitions: list[ExtractedDefinition] = Field(default_factory=list)
    notes: list[ExtractedNote] = Field(default_factory=list)
    bullet_groups: list[ExtractedBulletGroup] = Field(default_factory=list)


class ExtractedFormula(BaseModel):
    label: str
    formula: str
    is_latex: bool = False
    explanation: Optional[str] = None
    variables: list[str] = Field(default_factory=list)
    source_segments: list[str] = Field(default_factory=list)


class FormulaKnowledge(BaseModel):
    """Structured output returned by the Formula Specialist."""

    formulas: list[ExtractedFormula] = Field(default_factory=list)


class ExtractedFlowchart(BaseModel):
    title: Optional[str] = None
    steps: list[str] = Field(default_factory=list)
    source_segments: list[str] = Field(default_factory=list)


class ExtractedDiagram(BaseModel):
    title: Optional[str] = None
    nodes: list[str] = Field(default_factory=list)
    edges: list[tuple[str, str]] = Field(default_factory=list)
    edge_labels: Optional[list[str]] = None
    source_segments: list[str] = Field(default_factory=list)


class ExtractedMindMap(BaseModel):
    center: str
    branches: list[str] = Field(default_factory=list)
    sub_branches: Optional[dict[str, list[str]]] = None
    source_segments: list[str] = Field(default_factory=list)


class VisualKnowledge(BaseModel):
    """Structured output returned by the Visual/Diagram Specialist."""

    flowcharts: list[ExtractedFlowchart] = Field(default_factory=list)
    diagrams: list[ExtractedDiagram] = Field(default_factory=list)
    mindmaps: list[ExtractedMindMap] = Field(default_factory=list)


class ExtractedComparison(BaseModel):
    title: str
    left_label: str
    right_label: str
    rows: list[tuple[str, str]] = Field(default_factory=list)
    source_segments: list[str] = Field(default_factory=list)


class ExtractedTimeline(BaseModel):
    title: Optional[str] = None
    events: list[dict[str, str]] = Field(default_factory=list)  # [{"label": "...", "description": "..."}]
    source_segments: list[str] = Field(default_factory=list)


class ComparisonKnowledge(BaseModel):
    """Structured output returned by the Comparison/Graph Specialist."""

    comparisons: list[ExtractedComparison] = Field(default_factory=list)
    timelines: list[ExtractedTimeline] = Field(default_factory=list)


# ─────────────────────────────────────────────
# 4. Canonical Merged Knowledge (Input to Planner)
# ─────────────────────────────────────────────


class MergedLectureKnowledge(BaseModel):
    """
    Unified knowledge produced by the deterministic merger.
    Passed to the Notebook Planner to assemble pages and elements.
    """

    title: str
    main_topics: list[str] = Field(default_factory=list)
    summary: str = ""
    concepts: list[ExtractedConcept] = Field(default_factory=list)
    definitions: list[ExtractedDefinition] = Field(default_factory=list)
    notes: list[ExtractedNote] = Field(default_factory=list)
    bullet_groups: list[ExtractedBulletGroup] = Field(default_factory=list)
    formulas: list[ExtractedFormula] = Field(default_factory=list)
    flowcharts: list[ExtractedFlowchart] = Field(default_factory=list)
    diagrams: list[ExtractedDiagram] = Field(default_factory=list)
    mindmaps: list[ExtractedMindMap] = Field(default_factory=list)
    comparisons: list[ExtractedComparison] = Field(default_factory=list)
    timelines: list[ExtractedTimeline] = Field(default_factory=list)
