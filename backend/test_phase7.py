"""
test_phase7.py
==============
End-to-End Test for Phase 7:
1. Unit testing of Planner element sanitization and document assembly.
2. Unit testing of deterministic zero-LLM fallback document synthesis.
3. LangGraph compilation structure verification.
4. Live End-to-End pipeline execution on a full multi-specialist transcript.
"""

import json
import logging
import os
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("test_phase7")

# Add backend to path
sys.path.insert(0, os.path.abspath("backend"))

from app.schemas.notebook import NoteStyle, NotebookDocument
from app.schemas.pipeline import (
    ComparisonRow,
    ExtractedComparison,
    ExtractedConcept,
    ExtractedDefinition,
    ExtractedFlowchart,
    ExtractedFormula,
    ExtractedNote,
    MergedLectureKnowledge,
)
from app.services.ai.graph.graph import pipeline_graph
from app.services.ai.graph.nodes.planner import (
    assemble_notebook_document,
    sanitize_page_elements,
    synthesize_fallback_document,
)
from app.services.transcript.segmenter import segment_transcript


def test_sanitization_and_assembly():
    logger.info("=== 1. Testing Element Sanitization & Assembly ===")
    raw_elements = [
        {"type": "heading", "text": "Introduction", "level": 1},
        {"type": "bullet_list", "items": ["Only one item"]},  # Should convert to paragraph
        {"type": "important_note", "text": "Note 1"},
        {"type": "important_note", "text": "Note 2"},
        {"type": "important_note", "text": "Note 3"},  # Excess note should convert to paragraph
        {"type": "flowchart", "steps": ["Single step only"]},  # Should convert to paragraph
        {"type": "flowchart", "title": "Real Flowchart", "steps": ["Step 1", "Step 2", "Step 3"]},
        {"type": "comparison", "title": "A vs B", "rows": [["Feature", "ValA", "ValB"], {"left": "Speed", "right": "High"}]},
        {"type": "sticky_formula", "label": "Complexity", "formula": "O(log n)", "is_latex": False},
        {"type": "summary", "points": ["Key takeaway 1", "Key takeaway 2"]},
    ]

    sanitized = sanitize_page_elements(raw_elements)
    assert len(sanitized) >= 8, f"Expected sanitized elements, got {len(sanitized)}"

    # Check 1-item bullet converted to paragraph
    assert sanitized[1]["type"] == "paragraph"
    # Check 3rd note converted to paragraph
    assert sanitized[4]["type"] == "paragraph"
    # Check single-step flowchart converted to paragraph
    assert sanitized[5]["type"] == "paragraph"

    doc = assemble_notebook_document(
        raw_data={"title": "Test Title", "pages": [{"topic": "Topic A", "elements": sanitized}]},
        style=NoteStyle.DETAILED,
        subject="Computer Science",
    )
    assert isinstance(doc, NotebookDocument)
    assert doc.metadata.title == "Test Title"
    assert doc.metadata.total_pages == 1
    assert len(doc.pages[0].elements) == len(sanitized)
    logger.info("✓ Element sanitization and document assembly passed.")


def test_fallback_document_synthesis():
    logger.info("=== 2. Testing Deterministic Zero-LLM Fallback Synthesis ===")
    knowledge = MergedLectureKnowledge(
        title="Binary Search vs Linear Search",
        concepts=[ExtractedConcept(name="Binary Search", explanation="Halves search space each step.", source_segments=["SEG_001"])],
        definitions=[ExtractedDefinition(term="Divide and Conquer", meaning="Algorithm paradigm that breaks problems into subproblems.", source_segments=["SEG_001"])],
        formulas=[ExtractedFormula(label="Time Complexity", formula="O(log n)", is_latex=False, source_segments=["SEG_002"])],
        flowcharts=[ExtractedFlowchart(title="Binary Search Flow", steps=["Find mid", "Compare", "Narrow bounds"], source_segments=["SEG_002"])],
        comparisons=[ExtractedComparison(title="Linear vs Binary", left_label="Linear", right_label="Binary", rows=[ComparisonRow(left="O(n)", right="O(log n)")], source_segments=["SEG_002"])],
        notes=[ExtractedNote(text="Array must be sorted prior to binary search.", source_segments=["SEG_001"])],
    )

    doc = synthesize_fallback_document(
        knowledge=knowledge,
        style=NoteStyle.TOPPER,
        subject="Algorithms",
        title="Fallback Binary Search Notes",
    )
    assert isinstance(doc, NotebookDocument)
    assert doc.metadata.title == "Fallback Binary Search Notes"
    assert len(doc.pages) >= 1
    types = [e.type for e in doc.pages[0].elements]
    assert "heading" in types
    assert "definition" in types
    assert "sticky_formula" in types
    assert "flowchart" in types
    assert "comparison" in types
    assert "important_note" in types
    assert "summary" in types
    logger.info(f"✓ Fallback synthesis passed with elements: {set(types)}")


def test_graph_structure():
    logger.info("=== 3. Testing Pipeline Graph Structure ===")
    nodes = set(pipeline_graph.nodes.keys())
    expected = {
        "analyzer",
        "text_specialist",
        "formula_specialist",
        "visual_specialist",
        "comparison_specialist",
        "merger",
        "validator",
        "planner",
    }
    assert expected.issubset(nodes), f"Missing nodes: {expected - nodes}"
    logger.info(f"✓ Graph contains all expected nodes: {expected}")


def test_live_end_to_end_pipeline():
    logger.info("=== 4. Testing Live End-to-End Pipeline Execution ===")
    transcript = """
    Welcome back everyone. Today we are diving into searching algorithms, focusing specifically on Binary Search versus Linear Search.
    First, let's establish the fundamental definition. Linear search checks every single element sequentially from index 0 to n-1. 
    Its time complexity is O(n), which means if you have one million items, you might need one million operations.
    
    In contrast, Binary Search is a divide and conquer algorithm. It repeatedly divides the search interval in half.
    The formula for the middle index is mid = low + (high - low) / 2.
    Because it halves the search space each iteration, its time complexity is O(log n).
    For one million items, binary search takes at most 20 comparisons!
    
    Here is an extremely important note: Binary search ONLY works if the array is already sorted. If it is unsorted, you cannot use it.
    
    Let's walk through the exact steps of binary search:
    First step: Initialize low = 0 and high = length - 1.
    Second step: Calculate the middle element mid.
    Third step: If target equals array[mid], return mid immediately.
    Fourth step: If target is less than array[mid], set high = mid - 1.
    Fifth step: If target is greater than array[mid], set low = mid + 1.
    Sixth step: Repeat until low exceeds high, in which case return -1 indicating not found.
    
    Now let's compare the two approaches directly.
    Linear search works on unsorted arrays, whereas binary search requires sorted arrays.
    Linear search has O(n) worst-case time complexity, whereas binary search achieves O(log n).
    Linear search is best for tiny lists, while binary search scales to massive datasets.
    """

    segmented = segment_transcript(transcript)
    segments = segmented.segments
    logger.info(f"Segmented transcript into {len(segments)} segments: {[s.id for s in segments]}")

    initial_state = {
        "raw_transcript": transcript,
        "segments": segments,
        "source_url": "https://youtube.com/watch?v=algo_101",
        "video_id": "algo_101",
        "style": NoteStyle.DETAILED,
        "subject": "Data Structures & Algorithms",
        "title": "Binary Search vs Linear Search",
        "routing": None,
        "text_result": None,
        "formula_result": None,
        "visual_result": None,
        "comparison_result": None,
        "errors": [],
        "merged_knowledge": None,
        "validation_passed": False,
        "notebook_document": None,
    }

    final_state = pipeline_graph.invoke(initial_state)

    routing = final_state.get("routing")
    if routing:
        logger.info(f"Routing Decision: Text={routing.text.required}, Formula={routing.formula.required}, Visual={routing.visual.required}, Comparison={routing.comparison.required}")
    else:
        logger.warning("Routing Decision: None (Analyzer hit error, fallback route activated)")
    
    merged = final_state.get("merged_knowledge")
    assert merged is not None, "merged_knowledge must not be None"
    logger.info(f"Merged Knowledge: {len(merged.concepts)} concepts, {len(merged.definitions)} definitions, {len(merged.formulas)} formulas, {len(merged.flowcharts)} flowcharts, {len(merged.comparisons)} comparisons")

    doc = final_state.get("notebook_document")
    assert doc is not None, "notebook_document must not be None"
    assert isinstance(doc, NotebookDocument), f"doc must be a NotebookDocument, got {type(doc)}"
    assert len(doc.pages) >= 1, "Must generate at least 1 page"

    logger.info(f"Generated NotebookDocument with {len(doc.pages)} page(s):")
    for page in doc.pages:
        element_types = [e.type for e in page.elements]
        logger.info(f"  Page {page.page_number} ({page.topic}): {len(page.elements)} elements -> {element_types}")
        assert len(page.elements) > 0, "Page must not be empty"

    # Verify JSON serialization works (contract with frontend)
    doc_dict = doc.model_dump()
    json_str = json.dumps(doc_dict, indent=2)
    assert len(json_str) > 100
    assert "metadata" in doc_dict
    assert "pages" in doc_dict
    logger.info("✓ JSON serialization validated successfully.")

    if final_state.get("errors"):
        logger.warning(f"Accumulated non-fatal errors during run: {final_state['errors']}")


if __name__ == "__main__":
    test_sanitization_and_assembly()
    test_fallback_document_synthesis()
    test_graph_structure()
    test_live_end_to_end_pipeline()
    logger.info("\n🎉 ALL PHASE 7 TESTS PASSED SUCCESSFULLY!")
