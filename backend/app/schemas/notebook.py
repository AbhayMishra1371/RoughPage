
"""
Notebook Schema v1.0
====================
This is the contract between the AI layer (Groq) and the Renderer.

Groq fills this schema.
FastAPI validates it.
The Renderer reads it and draws — nothing else.

Rules:
- Groq never invents new element types.
- Groq only decides WHICH elements to use and WHAT content to put in them.
- The Renderer never calls the AI.
- This schema is the only thing they share.
"""

from pydantic import BaseModel, Field
from typing import Literal, Union, Optional
from enum import Enum

class ImportanceLevel(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class NoteStyle(str, Enum):
    DETAILED   = "detailed"
    TOPPER     = "topper"
    LAST_MINUTE = "last_minute"

# ─────────────────────────────────────────────
# Every element carries `importance`.
#
# The system prompt tells the AI to set it on EVERY element because
# "the renderer uses it for visual weight". Declaring it only on
# ParagraphElement meant Pydantic's default extra='ignore' silently
# stripped it from the other 14 types — no error, no warning — so the
# renderer never saw it. Declared here once and inherited instead.
# ─────────────────────────────────────────────

class _BaseElement(BaseModel):
    importance: ImportanceLevel = ImportanceLevel.LOW


class HeadingElement(_BaseElement):
    """
    The main title of a topic or section.
    Rendered as large handwritten text, underlined.
    One per major topic shift.
    """
    type: Literal["heading"] = "heading"
    text: str
    level: Literal[1, 2] = 1  # 1 = topic title, 2 = subtopic


class ParagraphElement(_BaseElement):
    """
    A block of explanatory text.
    Rendered as flowing handwritten lines on ruled paper.
    Use for conceptual explanations, not lists.
    """
    type: Literal["paragraph"] = "paragraph"
    text: str


class BulletListElement(_BaseElement):
    """
    A list of related points.
    Rendered with handwritten arrow bullets (→) instead of dots.
    Use for properties, features, steps, or advantages.
    """
    type: Literal["bullet_list"] = "bullet_list"
    title: Optional[str] = None  # e.g. "Advantages", "Properties"
    items: list[str]


class DefinitionElement(_BaseElement):
    """
    A term and its meaning.
    Rendered as:
      [Term] — [meaning]
    inside a rough.js dashed box.
    Use when a lecture introduces a new concept by name.
    """
    type: Literal["definition"] = "definition"
    term: str
    meaning: str
    example: Optional[str] = None  # optional "e.g." line beneath


class ImportantNoteElement(_BaseElement):
    """
    A critical callout the student must not miss.
    Rendered inside a red rough.js box with a ★ symbol.
    Use sparingly — maximum 2 per page.
    """
    type: Literal["important_note"] = "important_note"
    text: str

    # Critical by definition — default higher than the rest.
    importance: ImportanceLevel = ImportanceLevel.HIGH


class StickyFormulaElement(_BaseElement):
    """
    A formula or equation worth highlighting.
    Rendered as a rotated yellow sticky note on top of the page.
    Use for time complexities, equations, key relationships.
    """
    type: Literal["sticky_formula"] = "sticky_formula"
    label: str
    formula: str
    is_latex: bool = False


class ComparisonElement(_BaseElement):
    """
    A side-by-side comparison of two concepts.
    Rendered as a hand-drawn two-column table.
    Use when a lecture explicitly contrasts two things.
    """
    type: Literal["comparison"] = "comparison"
    title: str
    left_label: str
    right_label: str
    rows: list[tuple[str, str]]


class FlowchartElement(_BaseElement):
    """
    A sequence of steps connected by arrows.
    Rendered using rough.js boxes and arrows.
    Use for algorithms, processes, decision flows.
    """
    type: Literal["flowchart"] = "flowchart"
    title: Optional[str] = None
    steps: list[str]


class DiagramElement(_BaseElement):
    """
    A labeled node-relationship diagram.
    Rendered using rough.js circles/boxes and connecting arrows.
    Use for architectures, memory models, tree structures.
    Example: CPU → RAM → Storage
    """
    type: Literal["diagram"] = "diagram"
    title: Optional[str] = None
    nodes: list[str]
    edges: list[tuple[str, str]]
    edge_labels: Optional[list[str]] = None


class CodeBlockElement(_BaseElement):
    """
    A snippet of code.
    Rendered in JetBrains Mono on a dark inset box
    that looks like a printed page taped into the notebook.
    """
    type: Literal["code_block"] = "code_block"
    language: str
    code: str


class ExampleElement(_BaseElement):
    """
    A concrete worked example.
    Rendered with a small "e.g." label in the margin
    and the example body slightly indented.
    """
    type: Literal["example"] = "example"
    context: str
    walkthrough: str


class TimelineElement(_BaseElement):
    """
    A sequence of events or chronological points.
    Rendered as a rough.js vertical line with labeled nodes at each point.
    Use for historical sequences, version histories, or ordered events.
    """
    type: Literal["timeline"] = "timeline"
    title: Optional[str] = None
    events: list[dict]   # [{"label": "1945", "description": "..."}]


class MindMapElement(_BaseElement):
    """
    A central concept with radiating branches.
    Rendered as a rough.js hub-and-spoke diagram.
    Use for summarizing a topic's sub-concepts at the end of a section.
    """
    type: Literal["mind_map"] = "mind_map"
    center: str
    branches: list[str]           # main branches
    sub_branches: Optional[dict[str, list[str]]] = None  # branch → sub-items


class SummaryElement(_BaseElement):
    """
    A short recap at the end of a topic.
    Rendered at the bottom of a page in a slightly smaller font
    with a horizontal rough.js divider above it.
    """
    type: Literal["summary"] = "summary"
    points: list[str]   # 3–5 key takeaways


class ScreenshotElement(_BaseElement):
    """
    A frame captured from the lecture video.
    Rendered as a slightly-rotated photo pasted onto the page
    with a rough.js border (like tape-in printout in a real notebook).
    Only used when a diagram/formula was shown visually
    and NOT narrated verbally.
    """
    type: Literal["screenshot"] = "screenshot"
    timestamp_seconds: int          # which frame to extract
    caption: Optional[str] = None   # handwritten caption beneath




NotebookElement = Union[
    HeadingElement,
    ParagraphElement,
    BulletListElement,
    DefinitionElement,
    ImportantNoteElement,
    StickyFormulaElement,
    ComparisonElement,
    FlowchartElement,
    DiagramElement,
    CodeBlockElement,
    ExampleElement,
    TimelineElement,
    MindMapElement,
    SummaryElement,
    ScreenshotElement,
]


# ─────────────────────────────────────────────
# Page — a single notebook page
# ─────────────────────────────────────────────

class NotebookPage(BaseModel):
    """
    One physical notebook page.
    The renderer fills content top-to-bottom using a vertical cursor.
    When the cursor exceeds page height, a new page begins automatically —
    so the AI does NOT need to think about page breaks.
    The AI just groups elements by topic, not by page capacity.
    """
    page_number: int
    topic: str          # what section/topic this page covers
    elements: list[NotebookElement]

    class Config:
        # needed so the Union discriminator works during validation
        arbitrary_types_allowed = True


# ─────────────────────────────────────────────
# NotebookMetadata — top-level info
# ─────────────────────────────────────────────

class NotebookMetadata(BaseModel):
    title: str                  # derived from the lecture title
    subject: Optional[str]      # e.g. "Data Structures", "Economics"
    source_url: Optional[str]   # original YouTube URL
    video_id: Optional[str]
    style: NoteStyle = NoteStyle.DETAILED
    total_pages: int            # filled after rendering, not by the AI
    created_at: Optional[str]   # ISO timestamp


# ─────────────────────────────────────────────
# NotebookDocument — the root object
# This is what the AI produces.
# This is what the Renderer consumes.
# ─────────────────────────────────────────────

class NotebookDocument(BaseModel):
    """
    The complete notebook.
    The AI fills `metadata` (partially) and `pages`.
    FastAPI validates this object before passing to the Renderer.
    The Renderer reads this and draws — nothing else.
    """
    metadata: NotebookMetadata
    pages: list[NotebookPage]


# ─────────────────────────────────────────────
# Example — what a valid NotebookDocument looks like
# Use this as a few-shot example in the AI prompt.
# ─────────────────────────────────────────────

EXAMPLE_NOTEBOOK: dict = {
    "metadata": {
        "title": "Binary Search",
        "subject": "Data Structures & Algorithms",
        "source_url": "https://youtube.com/watch?v=example",
        "video_id": "example",
        "style": "detailed",
        "total_pages": 1,
        "created_at": None
    },
    "pages": [
        {
            "page_number": 1,
            "topic": "Binary Search",
            "elements": [
                {
                    "type": "heading",
                    "text": "Binary Search",
                    "level": 1
                },
                {
                    "type": "definition",
                    "term": "Binary Search",
                    "meaning": "A search algorithm that finds a target by repeatedly halving the search space.",
                    "example": "Find 7 in [1,3,5,7,9] — check middle 5, go right, find 7."
                },
                {
                    "type": "important_note",
                    "text": "Only works on SORTED arrays. Always verify before applying."
                },
                {
                    "type": "flowchart",
                    "title": "Algorithm Steps",
                    "steps": [
                        "Set low = 0, high = n-1",
                        "Find mid = (low + high) / 2",
                        "If arr[mid] == target → return mid",
                        "If target > arr[mid] → low = mid + 1",
                        "If target < arr[mid] → high = mid - 1",
                        "Repeat until low > high"
                    ]
                },
                {
                    "type": "sticky_formula",
                    "label": "Time Complexity",
                    "formula": "O(log n)",
                    "is_latex": False
                },
                {
                    "type": "bullet_list",
                    "title": "Advantages",
                    "items": [
                        "Fast — eliminates half the array each step",
                        "O(log n) vs O(n) for linear search",
                        "Works well on large sorted datasets"
                    ]
                },
                {
                    "type": "summary",
                    "points": [
                        "Only works on sorted arrays",
                        "Time complexity: O(log n)",
                        "Space complexity: O(1) for iterative"
                    ]
                }
            ]
        }
    ]
}


def assign_ids(notebook: NotebookDocument) -> NotebookDocument:
    """
    Stamps clean human-readable IDs onto pages and elements.
    Currently returns the document as-is since the schemas do not
    define explicit id fields, but satisfies the service pipeline contract.
    """
    return notebook
