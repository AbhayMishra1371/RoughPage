"""
text.py
=======
LangGraph node for the Text / Content Specialist.

Responsibilities:
- Extracts core academic concepts, definitions, explanations, bullet groups, and important notes.
- Receives ONLY the segments assigned by the Analyzer (`routing.text.segment_ids`).
- Enforces strict provenance: every extracted item must cite its source segment IDs.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import SegmentedTranscript, TextKnowledge
from app.services.ai.graph.state import PipelineState
from app.services.ai.providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

TEXT_SPECIALIST_SYSTEM_PROMPT = """
You are the Text & Concept Specialist for RoughPage AI.
Your role is to extract factual concepts, definitions, and key notes from lecture segments.

RULES:
1. STRICT SOURCE GROUNDING:
   - Every extracted concept, definition, bullet group, and note MUST include `source_segments` listing the segment IDs (e.g. ["SEG_001", "SEG_002"]) where that information appeared.
   - Do NOT invent facts or concepts not directly supported by the transcript.
2. DEFINITIONS:
   - Identify newly introduced technical terms with concise, exact meanings.
3. CONCEPTS:
   - Extract primary explanations, core principles, mechanisms, and rules.
4. IMPORTANT NOTES:
   - Extract critical warnings, exam-relevant constraints, or common student mistakes (maximum 1-2 per topic).
5. BULLET GROUPS:
   - Extract lists of properties, characteristics, steps, or advantages (minimum 2 items, maximum 7).

Return a valid JSON object matching the TextKnowledge schema.
""".strip()


def build_text_prompt(segments_text: str, topics: list[str]) -> str:
    topics_hint = f"Focus Topics: {', '.join(topics)}\n" if topics else ""

    return f"""
{topics_hint}
ASSIGNED LECTURE SEGMENTS
=========================
{segments_text}

Extract all definitions, concepts, important notes, and bullet groups from the segments above.
Ensure every extracted item includes its supporting `source_segments`.
""".strip()


def text_specialist_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Executes the Text Specialist.
    """
    logger.info("[text_specialist_node] Starting text extraction...")

    routing = state.get("routing")
    all_segments = state.get("segments") or []

    # If routing specified segment IDs, filter down to only those segments
    assigned_ids = routing.text.segment_ids if (routing and routing.text) else []
    seg_container = SegmentedTranscript(segments=all_segments)

    if assigned_ids:
        segments_context = seg_container.get_text_for_segments(assigned_ids)
    else:
        # Fallback to full transcript if no specific IDs assigned
        segments_context = seg_container.to_prompt_context()

    if not segments_context.strip():
        logger.warning("[text_specialist_node] No segment text found for text specialist.")
        return {"text_result": TextKnowledge()}

    topics = routing.main_topics if routing else []
    prompt = build_text_prompt(segments_text=segments_context, topics=topics)

    provider = get_llm_provider(role="text")
    logger.info(f"[text_specialist_node] Invoking {provider.provider_name} ({provider.model_name})...")

    try:
        text_result: TextKnowledge = provider.generate_structured(
            prompt=prompt,
            response_model=TextKnowledge,
            system_prompt=TEXT_SPECIALIST_SYSTEM_PROMPT,
            temperature=0.1,
        )

        logger.info(
            f"[text_specialist_node] Extracted {len(text_result.concepts)} concepts, "
            f"{len(text_result.definitions)} definitions, "
            f"{len(text_result.notes)} notes, "
            f"{len(text_result.bullet_groups)} bullet groups."
        )

        return {"text_result": text_result}

    except Exception as e:
        logger.error(f"[text_specialist_node] Extraction failed: {e}")
        return {
            "errors": [f"Text specialist failed: {e}"],
            "text_result": None,
        }
