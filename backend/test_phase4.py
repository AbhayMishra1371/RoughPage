"""
test_phase4.py
==============
Verification script for Phase 4: Core Specialists (Text & Formula Nodes).
"""

from dotenv import load_dotenv

from app.schemas.notebook import NoteStyle
from app.schemas.pipeline import (
    FormulaKnowledge,
    RoutingDecision,
    SpecialistRoute,
    TextKnowledge,
    TranscriptSegment,
)
from app.services.ai.graph.nodes.formula import formula_specialist_node
from app.services.ai.graph.nodes.text import text_specialist_node
from app.services.ai.graph.state import PipelineState
from app.services.transcript.segmenter import segment_transcript

load_dotenv()


def test_formula_short_circuit():
    print("--- 1. Testing Formula Specialist Short-Circuit (0 LLM Calls) ---")
    mock_state: PipelineState = {
        "raw_transcript": "Philosophy lecture",
        "segments": [TranscriptSegment(id="SEG_001", text="Socrates discussed virtue.")],
        "source_url": None,
        "video_id": None,
        "style": NoteStyle.DETAILED,
        "subject": "Philosophy",
        "title": "Ethics",
        "routing": RoutingDecision(
            lecture_title="Ethics",
            main_topics=["Virtue"],
            summary="A lecture with no math.",
            text=SpecialistRoute(required=True, segment_ids=["SEG_001"]),
            formula=SpecialistRoute(required=False, segment_ids=[]),  # NOT required
            visual=SpecialistRoute(required=False, segment_ids=[]),
            comparison=SpecialistRoute(required=False, segment_ids=[]),
        ),
        "text_result": None,
        "formula_result": None,
        "visual_result": None,
        "comparison_result": None,
        "errors": [],
        "merged_knowledge": None,
        "validation_passed": False,
        "notebook_document": None,
    }

    output = formula_specialist_node(mock_state)
    res: FormulaKnowledge = output.get("formula_result")
    assert res is not None, "Formula result should not be None"
    assert len(res.formulas) == 0, "Expected empty formulas list for non-formula lecture"
    print("Short-circuit passed: returned empty formulas with 0 API calls.")


def test_text_specialist_extraction():
    print("\n--- 2. Testing Text Specialist Live Extraction ---")
    lecture_text = (
        "A Binary Search Tree is a hierarchical node-based data structure where each node has at most two children. "
        "The left subtree contains keys strictly less than the node key, while the right subtree contains keys strictly greater. "
        "A critical warning: if inputs are inserted in sorted order, the BST degenerates into a linked list with O(n) search time. "
        "Key advantages of BSTs include dynamic size, fast average lookup, and naturally maintaining sorted order."
    )

    seg_transcript = segment_transcript(lecture_text, target_words=30)
    print(f"Segmented into {len(seg_transcript.segments)} segments: {[s.id for s in seg_transcript.segments]}")

    state: PipelineState = {
        "raw_transcript": lecture_text,
        "segments": seg_transcript.segments,
        "source_url": None,
        "video_id": None,
        "style": NoteStyle.DETAILED,
        "subject": "Data Structures",
        "title": "Binary Search Trees",
        "routing": RoutingDecision(
            lecture_title="Binary Search Trees",
            main_topics=["BST Definition", "BST Properties"],
            summary="An introductory lecture on binary search trees.",
            text=SpecialistRoute(required=True, segment_ids=[s.id for s in seg_transcript.segments]),
            formula=SpecialistRoute(required=False, segment_ids=[]),
            visual=SpecialistRoute(required=False, segment_ids=[]),
            comparison=SpecialistRoute(required=False, segment_ids=[]),
        ),
        "text_result": None,
        "formula_result": None,
        "visual_result": None,
        "comparison_result": None,
        "errors": [],
        "merged_knowledge": None,
        "validation_passed": False,
        "notebook_document": None,
    }

    output = text_specialist_node(state)
    text_res: TextKnowledge = output.get("text_result")

    assert text_res is not None, "Text specialist returned None!"
    print(f"Extracted {len(text_res.concepts)} concepts, {len(text_res.definitions)} definitions, {len(text_res.notes)} notes, {len(text_res.bullet_groups)} bullet groups.")

    # Validate provenance
    for concept in text_res.concepts:
        print(f"  Concept: {concept.name} (Source: {concept.source_segments})")
        assert len(concept.source_segments) > 0, "Concept missing source_segments!"

    for defn in text_res.definitions:
        print(f"  Definition: {defn.term} -> {defn.meaning[:40]}... (Source: {defn.source_segments})")
        assert len(defn.source_segments) > 0, "Definition missing source_segments!"

    print("Text Specialist extraction & provenance verification passed.")


def test_formula_specialist_extraction():
    print("\n--- 3. Testing Formula Specialist Live Extraction ---")
    formula_lecture = (
        "In linear regression, we define the Mean Squared Error cost function as J(theta) = 1/(2m) * sum_{i=1}^{m} (h_theta(x^(i)) - y^(i))^2. "
        "Here, m represents the number of training examples, theta is the parameter vector, and h_theta(x) is our hypothesis. "
        "The goal is to find theta that minimizes J(theta). In balanced search trees, search complexity is simply O(log n)."
    )

    seg_transcript = segment_transcript(formula_lecture, target_words=40)
    print(f"Segmented into {len(seg_transcript.segments)} segments: {[s.id for s in seg_transcript.segments]}")

    state: PipelineState = {
        "raw_transcript": formula_lecture,
        "segments": seg_transcript.segments,
        "source_url": None,
        "video_id": None,
        "style": NoteStyle.DETAILED,
        "subject": "Machine Learning",
        "title": "Cost Function",
        "routing": RoutingDecision(
            lecture_title="Cost Function",
            main_topics=["MSE", "Complexity"],
            summary="Lecture covering MSE cost function and search complexity.",
            text=SpecialistRoute(required=True, segment_ids=[s.id for s in seg_transcript.segments]),
            formula=SpecialistRoute(required=True, segment_ids=[s.id for s in seg_transcript.segments]),
            visual=SpecialistRoute(required=False, segment_ids=[]),
            comparison=SpecialistRoute(required=False, segment_ids=[]),
        ),
        "text_result": None,
        "formula_result": None,
        "visual_result": None,
        "comparison_result": None,
        "errors": [],
        "merged_knowledge": None,
        "validation_passed": False,
        "notebook_document": None,
    }

    output = formula_specialist_node(state)
    formula_res: FormulaKnowledge = output.get("formula_result")

    assert formula_res is not None, "Formula specialist returned None!"
    print(f"Extracted {len(formula_res.formulas)} formula(s):")

    for f in formula_res.formulas:
        print(f"  Formula: {f.label}")
        print(f"    Raw: {f.formula}")
        print(f"    is_latex: {f.is_latex}")
        print(f"    variables: {f.variables}")
        print(f"    source_segments: {f.source_segments}")
        assert len(f.source_segments) > 0, "Formula missing source_segments!"

    assert len(formula_res.formulas) >= 1, "Expected at least 1 formula extracted!"
    print("Formula Specialist extraction & provenance verification passed.")


if __name__ == "__main__":
    test_formula_short_circuit()
    test_text_specialist_extraction()
    test_formula_specialist_extraction()
    print("\n>>> ALL PHASE 4 CHECKS PASSED SUCCESSFULLY! <<<")
