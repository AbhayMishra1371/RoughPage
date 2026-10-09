"""
comparison.py
=============
LangGraph node for the Comparison & Timeline Specialist.

Responsibilities:
- Extracts structured two-column comparisons (tables) and chronological progressions (timelines).
- Short-circuits with 0 API calls if the Analyzer determines comparisons are not required.
- Cites source segment IDs for every comparison and timeline.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import ComparisonKnowledge, SegmentedTranscript
from app.services.ai.graph.state import PipelineState
from app.services.ai.providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

COMPARISON_SPECIALIST_SYSTEM_PROMPT = """
You are the Comparison & Timeline Specialist for RoughPage AI.
Your role is to extract explicit concept comparisons and chronological timelines from assigned lecture segments.

RULES:
1. STRICT SOURCE GROUNDING:
   - Extract ONLY comparisons and timelines explicitly established in the provided segments.
   - Attach `source_segments` (e.g. ["SEG_004"]) indicating where the comparison was stated.
   - If no explicit comparison or timeline exists, return an empty object: `{"comparisons": [], "timelines": []}`. Never invent artificial comparisons.
2. COMPARISONS:
   - Extract side-by-side contrasts between two concepts (e.g. "Array vs Linked List", "Batch vs Stochastic GD").
   - `left_label` and `right_label`: exact names of the two entities being compared.
   - `rows`: list of [left_aspect, right_aspect] comparison rows (minimum 2 rows, maximum 6).
3. TIMELINES:
   - Extract chronological or historical progressions mentioned in the lecture.
   - `events`: ordered list of dicts: `[{"label": "1943", "description": "McCulloch-Pitts neuron"}, ...]`.

Return a valid JSON object matching the ComparisonKnowledge schema.
""".strip()


def build_comparison_prompt(segments_text: str) -> str:
    return f"""
ASSIGNED LECTURE SEGMENTS
=========================
{segments_text}

Extract any explicit side-by-side comparisons or chronological timelines from the segments above.
If none exist, return `{{"comparisons": [], "timelines": []}}`.
""".strip()


def comparison_specialist_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Executes the Comparison & Timeline Specialist.
    """
    routing = state.get("routing")

    # Short-circuit: If Analyzer explicitly flagged that no comparisons exist, skip LLM call entirely
    if routing and (not routing.comparison.required or not routing.comparison.segment_ids):
        logger.info("[comparison_specialist_node] Not required by Analyzer routing. Skipping LLM call.")
        return {"comparison_result": ComparisonKnowledge()}

    all_segments = state.get("segments") or []
    assigned_ids = routing.comparison.segment_ids if (routing and routing.comparison) else []
    seg_container = SegmentedTranscript(segments=all_segments)

    if assigned_ids:
        segments_context = seg_container.get_text_for_segments(assigned_ids)
    else:
        segments_context = seg_container.to_prompt_context()

    if not segments_context.strip():
        logger.info("[comparison_specialist_node] Assigned segments are empty. Returning empty result.")
        return {"comparison_result": ComparisonKnowledge()}

    logger.info(f"[comparison_specialist_node] Extracting comparisons from segments: {assigned_ids or 'all'}...")

    prompt = build_comparison_prompt(segments_text=segments_context)
    provider = get_llm_provider(role="comparison")
    logger.info(f"[comparison_specialist_node] Invoking {provider.provider_name} ({provider.model_name})...")

    try:
        comparison_result: ComparisonKnowledge = provider.generate_structured(
            prompt=prompt,
            response_model=ComparisonKnowledge,
            system_prompt=COMPARISON_SPECIALIST_SYSTEM_PROMPT,
            temperature=0.1,
        )

        logger.info(
            f"[comparison_specialist_node] Extracted {len(comparison_result.comparisons)} comparison(s), "
            f"{len(comparison_result.timelines)} timeline(s)."
        )
        return {"comparison_result": comparison_result}

    except Exception as e:
        logger.error(f"[comparison_specialist_node] Extraction failed: {e}")
        return {
            "errors": [f"Comparison specialist failed: {e}"],
            "comparison_result": None,
        }
