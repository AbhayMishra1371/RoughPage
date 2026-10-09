"""
analyzer.py
===========
LangGraph node for the Lecture Analyzer.

Responsibilities:
1. Examine the segmented transcript.
2. Infer lecture title, topics, and overview summary.
3. Determine which specialized content exists (formulas, visuals, comparisons).
4. Assign relevant segment IDs to each specialist.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import RoutingDecision, SegmentedTranscript
from app.services.ai.graph.state import PipelineState
from app.services.ai.providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

ANALYZER_SYSTEM_PROMPT = """
You are the Chief Academic Analyzer for RoughPage AI.
Your task is to analyze a segmented lecture transcript and make intelligent, selective routing decisions.

GUIDELINES:
1. Grounding: Rely ONLY on what is spoken in the transcript. Do NOT invent topics or formulas not present.
2. Text Specialist:
   - Required for virtually all academic lectures.
   - Assign segments containing definitions, core explanations, concepts, and key principles.
3. Formula Specialist:
   - Mark required=true ONLY if mathematical formulas, equations, or computational complexity formulas (e.g., O(log n)) are explicitly discussed.
   - List only the segment IDs where those formulas are mentioned.
   - If no formulas exist, set required=false and segment_ids=[].
4. Visual Specialist:
   - Mark required=true ONLY if step-by-step processes (flowcharts), system architectures, hierarchy/tree structures, or concept hub-and-spoke models are clearly described.
   - List only the segment IDs where those structural processes are explained.
   - If no visual or process exists, set required=false and segment_ids=[].
5. Comparison Specialist:
   - Mark required=true ONLY if the lecture explicitly contrasts two or more entities (e.g. Array vs LinkedList, BFS vs DFS) or describes an ordered chronological progression (timelines).
   - If no explicit comparison or timeline exists, set required=false and segment_ids=[].

Be selective. Routing every segment to every specialist wastes tokens and reduces quality.
""".strip()


def build_analyzer_prompt(segments_context: str, subject: str | None = None, title: str | None = None) -> str:
    subject_hint = f"Subject Hint: {subject}\n" if subject else ""
    title_hint = f"Title Hint: {title}\n" if title else ""

    return f"""
{subject_hint}{title_hint}
SEGMENTED LECTURE TRANSCRIPT
============================
{segments_context}

Analyze this lecture transcript. Determine the title, major topics, summary, and routing instructions for each specialist.
Assign exact segment IDs (e.g. ["SEG_001", "SEG_002"]) to the specialists that need them.
""".strip()


def analyzer_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Analyzes the lecture and produces RoutingDecision.
    """
    logger.info("[analyzer_node] Analyzing lecture transcript...")

    segments = state.get("segments") or []
    if not segments:
        raise ValueError("[analyzer_node] No transcript segments provided in state.")

    # Format transcript using SegmentedTranscript container
    seg_container = SegmentedTranscript(segments=segments)
    segments_context = seg_container.to_prompt_context()

    prompt = build_analyzer_prompt(
        segments_context=segments_context,
        subject=state.get("subject"),
        title=state.get("title"),
    )

    provider = get_llm_provider(role="analyzer")
    logger.info(f"[analyzer_node] Invoking {provider.provider_name} ({provider.model_name})...")

    try:
        routing_decision: RoutingDecision = provider.generate_structured(
            prompt=prompt,
            response_model=RoutingDecision,
            system_prompt=ANALYZER_SYSTEM_PROMPT,
            temperature=0.1,
        )

        logger.info(
            f"[analyzer_node] Inferred Title: '{routing_decision.lecture_title}' | "
            f"Text: {routing_decision.text.required} ({len(routing_decision.text.segment_ids)} segs) | "
            f"Formula: {routing_decision.formula.required} ({len(routing_decision.formula.segment_ids)} segs) | "
            f"Visual: {routing_decision.visual.required} ({len(routing_decision.visual.segment_ids)} segs) | "
            f"Comparison: {routing_decision.comparison.required} ({len(routing_decision.comparison.segment_ids)} segs)"
        )

        return {"routing": routing_decision}

    except Exception as e:
        logger.error(f"[analyzer_node] Analysis failed: {e}")
        return {
            "errors": [f"Analyzer failed: {e}"],
            "routing": None,
        }
