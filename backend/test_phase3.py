"""
test_phase3.py
==============
Verification script for Phase 3: LangGraph State & Analyzer Node (Routing).
"""

from dotenv import load_dotenv

from app.schemas.notebook import NoteStyle
from app.schemas.pipeline import RoutingDecision, SpecialistRoute, TranscriptSegment
from app.services.ai.graph.nodes.analyzer import analyzer_node
from app.services.ai.graph.routing import route_specialists
from app.services.ai.graph.state import PipelineState
from app.services.transcript.segmenter import segment_transcript

load_dotenv()


def test_pipeline_state_typing():
    print("--- 1. Testing PipelineState Typing & Channel Structure ---")
    mock_segments = [
        TranscriptSegment(id="SEG_001", start_s=0.0, end_s=30.0, text="Intro to Machine Learning."),
        TranscriptSegment(id="SEG_002", start_s=30.0, end_s=60.0, text="Cost function J(theta) = 1/2m sum (h(x) - y)^2."),
    ]

    state: PipelineState = {
        "raw_transcript": "Sample transcript",
        "segments": mock_segments,
        "source_url": None,
        "video_id": None,
        "style": NoteStyle.DETAILED,
        "subject": "Computer Science",
        "title": "Machine Learning",
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

    assert len(state["segments"]) == 2
    assert state["errors"] == []
    print("PipelineState schema initialized and typed correctly.")


def test_routing_edge_logic():
    print("\n--- 2. Testing Conditional Edge Router Logic ---")

    # Case A: Theory Lecture (Text only)
    theory_routing = RoutingDecision(
        lecture_title="History of Computing",
        main_topics=["Origins", "Mainframes"],
        summary="A history lecture with no math or diagrams.",
        text=SpecialistRoute(required=True, segment_ids=["SEG_001", "SEG_002"]),
        formula=SpecialistRoute(required=False, segment_ids=[]),
        visual=SpecialistRoute(required=False, segment_ids=[]),
        comparison=SpecialistRoute(required=False, segment_ids=[]),
    )
    routes_a = route_specialists({"routing": theory_routing})
    assert routes_a == ["text_specialist"], f"Expected ['text_specialist'], got {routes_a}"
    print("Case A (Theory): correctly routed only to ['text_specialist'].")

    # Case B: ML Lecture (Text + Formula + Visual)
    ml_routing = RoutingDecision(
        lecture_title="Linear Regression & Gradient Descent",
        main_topics=["Cost Function", "Gradient Steps"],
        summary="An ML lecture with equations and an update loop.",
        text=SpecialistRoute(required=True, segment_ids=["SEG_001", "SEG_002", "SEG_003"]),
        formula=SpecialistRoute(required=True, segment_ids=["SEG_002"]),
        visual=SpecialistRoute(required=True, segment_ids=["SEG_003"]),
        comparison=SpecialistRoute(required=False, segment_ids=[]),
    )
    routes_b = route_specialists({"routing": ml_routing})
    assert set(routes_b) == {"text_specialist", "formula_specialist", "visual_specialist"}
    print("Case B (ML/Math): correctly routed to ['text_specialist', 'formula_specialist', 'visual_specialist'].")

    # Case C: Analyzer Fallback (None)
    routes_c = route_specialists({"routing": None})
    assert routes_c == ["text_specialist"]
    print("Case C (Fallback): correctly defaulted to ['text_specialist'].")


def test_analyzer_node_execution():
    print("\n--- 3. Testing Analyzer Node Live Execution ---")
    lecture_text = """
    Welcome to lecture 4 on Gradient Descent and Linear Regression.
    First, what is linear regression? It is a supervised learning method where we fit a straight line to data.
    The hypothesis function is h_theta(x) = theta_0 + theta_1 * x.
    To measure how poorly our hypothesis performs, we define the cost function J(theta).
    J(theta) is equal to 1 over 2m times the sum of squared errors between predicted values and actual labels.
    Now, how do we minimize this cost function?
    We use an optimization algorithm called Gradient Descent.
    The algorithm works as a step-by-step loop:
    Step 1: Start with initial guesses for theta_0 and theta_1, usually 0.
    Step 2: Calculate the gradient or partial derivative of J with respect to each parameter.
    Step 3: Update the parameters simultaneously by stepping in the opposite direction of the gradient scaled by learning rate alpha.
    Step 4: Repeat steps 2 and 3 until the parameters converge.
    Let us contrast Batch Gradient Descent with Stochastic Gradient Descent:
    Batch uses all training examples in every step, making it slow but steady.
    Stochastic updates parameters using one random training example at a time, making it faster but noisy.
    """

    seg_transcript = segment_transcript(lecture_text, target_words=45)
    print(f"Segmented test lecture into {len(seg_transcript.segments)} segments.")

    initial_state: PipelineState = {
        "raw_transcript": lecture_text,
        "segments": seg_transcript.segments,
        "source_url": None,
        "video_id": None,
        "style": NoteStyle.DETAILED,
        "subject": "Machine Learning",
        "title": None,
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

    output = analyzer_node(initial_state)
    routing: RoutingDecision = output.get("routing")

    assert routing is not None, "Analyzer returned None for routing!"
    print(f"\nInferred Title: {routing.lecture_title}")
    print(f"Main Topics: {routing.main_topics}")
    print(f"Summary: {routing.summary}")
    print(f"Text route: required={routing.text.required}, segments={routing.text.segment_ids}")
    print(f"Formula route: required={routing.formula.required}, segments={routing.formula.segment_ids}")
    print(f"Visual route: required={routing.visual.required}, segments={routing.visual.segment_ids}")
    print(f"Comparison route: required={routing.comparison.required}, segments={routing.comparison.segment_ids}")

    # Verify that the conditional router produces parallel branches
    parallel_branches = route_specialists({"routing": routing})
    print(f"\nConditional Router decided to execute in parallel: {parallel_branches}")
    assert len(parallel_branches) >= 2, "Expected multiple specialists activated for an ML lecture with formulas and algorithms!"
    print("Analyzer node test passed successfully.")


if __name__ == "__main__":
    test_pipeline_state_typing()
    test_routing_edge_logic()
    test_analyzer_node_execution()
    print("\n>>> ALL PHASE 3 CHECKS PASSED SUCCESSFULLY! <<<")
