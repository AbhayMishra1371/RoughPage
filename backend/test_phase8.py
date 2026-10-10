"""
test_phase8.py
==============
End-to-End Test for Phase 8:
1. Verify notebook_service capability check (ai_configured).
2. Verify source resolution and validation.
3. Verify SSE streaming progress callback integration via ProgressSink.
4. Verify notebook_from_source producing a fully validated NotebookDocument.
"""

import json
import logging
import os
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("test_phase8")

# Add backend to path
sys.path.insert(0, os.path.abspath("backend"))

from app.schemas.notebook import NoteStyle, NotebookDocument
from app.services.notebook_service import (
    ai_configured,
    notebook_from_source,
    resolve_source,
)


def test_service_configuration():
    logger.info("=== 1. Testing AI Configuration Check ===")
    configured = ai_configured()
    logger.info(f"ai_configured() returned: {configured}")
    assert configured is True, "AI service must report configured when API key is set"
    logger.info("✓ ai_configured() passed.")


def test_source_resolution():
    logger.info("=== 2. Testing Source Resolution ===")
    sample_text = "This is a lecture on Graph Neural Networks. " * 20
    source = resolve_source(url=None, text=sample_text)
    assert source.video_id is None
    assert source.source_url is None
    assert len(source.transcript) > 100
    logger.info(f"Resolved source with {len(source.transcript)} characters.")
    logger.info("✓ Source resolution passed.")


def test_live_notebook_generation_with_progress():
    logger.info("=== 3. Testing Live Notebook Generation with SSE Progress Events ===")

    transcript = """
    In today's lecture, we examine Breadth First Search (BFS) and Depth First Search (DFS) for graph traversal.
    First, Breadth First Search explores the graph level by level using a Queue data structure (First In First Out).
    Its time complexity is O(V + E), where V is the number of vertices and E is the number of edges.
    
    In contrast, Depth First Search explores as far as possible along each branch before backtracking.
    DFS uses a Stack data structure or recursion.
    The time complexity of DFS is also O(V + E).
    
    Let's walk through the exact steps of BFS:
    Step 1: Enqueue the start vertex and mark it as visited.
    Step 2: While the queue is not empty, dequeue the front vertex u.
    Step 3: For each unvisited neighbor v of u, mark v as visited and enqueue v.
    Step 4: Continue until all reachable vertices are processed.
    
    Here is an important exam note: BFS always finds the shortest path on unweighted graphs! DFS does not guarantee shortest path.
    
    Now let's compare BFS and DFS:
    BFS uses a Queue; DFS uses a Stack or recursion.
    BFS requires O(V) space for wide trees; DFS requires O(h) space where h is the tree height.
    BFS is ideal for shortest paths; DFS is ideal for topological sorting and cycle detection.
    """

    source = resolve_source(url=None, text=transcript)

    captured_events: list[dict] = []

    def mock_progress_sink(stage: str, message: str, current: int | None = None, total: int | None = None):
        event = {"stage": stage, "message": message, "current": current, "total": total}
        captured_events.append(event)
        logger.info(f"[SSE Event] stage={stage!r} | msg={message!r} | current={current}/{total}")

    doc = notebook_from_source(
        source,
        style=NoteStyle.DETAILED,
        subject="Graph Algorithms",
        title="BFS vs DFS Traversal",
        on_progress=mock_progress_sink,
    )

    assert isinstance(doc, NotebookDocument), f"Expected NotebookDocument, got {type(doc)}"
    assert doc.metadata.title == "BFS vs DFS Traversal"
    assert doc.metadata.subject == "Graph Algorithms"
    assert len(doc.pages) >= 1

    stages_seen = [e["stage"] for e in captured_events]
    logger.info(f"Captured progress stages: {stages_seen}")

    assert "transcript" in stages_seen, "Must emit 'transcript' stage"
    assert "segmenting" in stages_seen, "Must emit 'segmenting' stage"
    assert "done" in stages_seen, "Must emit 'done' stage"

    # Verify JSON serializability for Next.js and PDF generator
    doc_json = doc.model_dump_json()
    assert len(doc_json) > 100
    parsed = json.loads(doc_json)
    assert "metadata" in parsed
    assert "pages" in parsed
    assert len(parsed["pages"]) > 0

    element_count = sum(len(p.elements) for p in doc.pages)
    logger.info(f"Generated {len(doc.pages)} page(s) and {element_count} element(s).")
    logger.info("✓ Full notebook generation with streaming progress passed.")


if __name__ == "__main__":
    test_service_configuration()
    test_source_resolution()
    test_live_notebook_generation_with_progress()
    logger.info("\n🎉 ALL PHASE 8 TESTS PASSED SUCCESSFULLY!")
