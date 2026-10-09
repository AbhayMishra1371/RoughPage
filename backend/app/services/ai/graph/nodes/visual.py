"""
visual.py
=========
LangGraph node for the Visual / Diagram Specialist.

Responsibilities:
- Extracts structural visuals: Flowcharts (processes/algorithms), Diagrams (node-edge relationships), and Mind Maps.
- Enforces strict node-edge integrity: every edge (source, target) must link valid nodes.
- Short-circuits with 0 API calls if the Analyzer determines visuals are not required.
- Cites source segment IDs for every visual representation.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import ExtractedDiagram, SegmentedTranscript, VisualKnowledge
from app.services.ai.graph.state import PipelineState
from app.services.ai.providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

VISUAL_SPECIALIST_SYSTEM_PROMPT = """
You are the Visual & Diagram Specialist for RoughPage AI.
Your role is to extract structural visuals (flowcharts, node-edge diagrams, and mind maps) strictly supported by the lecture transcript.

RULES:
1. STRICT SOURCE GROUNDING:
   - Extract visuals ONLY if explicitly described or clearly supported by the lecture text.
   - Attach `source_segments` (e.g. ["SEG_002", "SEG_003"]) indicating where the structure was explained.
   - If no useful visual structure exists, return an empty object: `{"flowcharts": [], "diagrams": [], "mindmaps": []}`. Never invent imaginary visuals.
2. FLOWCHARTS:
   - Use for linear step-by-step algorithms, processes, or decision flows (minimum 3 steps, maximum 8).
   - Each step must be a concise, actionable sentence or phrase.
3. DIAGRAMS:
   - Use for non-linear relationships, system architectures, memory hierarchies, or tree/graph structures.
   - `nodes`: list of unique entity labels (e.g. ["CPU", "Cache", "RAM", "Disk"]).
   - `edges`: list of directed [source, target] pairs. CRITICAL: every entity in an edge MUST be present in `nodes`!
   - `edge_labels`: optional list of descriptions matching the edges.
4. MIND MAPS:
   - Use for central concepts with radiating sub-topic branches (e.g. center: "Machine Learning", branches: ["Supervised", "Unsupervised", "Reinforcement"]).
   - `sub_branches`: optional mapping from branch name to sub-topics: {"Supervised": ["Regression", "Classification"]}.

Return a valid JSON object matching the VisualKnowledge schema.
""".strip()


def _sanitize_diagram_integrity(visual_result: VisualKnowledge) -> VisualKnowledge:
    """
    Enforces referential integrity on extracted diagrams:
    Every source and target in an edge must exist in `nodes`.
    """
    from app.schemas.pipeline import DiagramEdge

    sanitized_diagrams: list[ExtractedDiagram] = []

    for diag in visual_result.diagrams:
        node_set = {n.strip() for n in diag.nodes if n.strip()}
        valid_edges: list[DiagramEdge] = []

        for edge in diag.edges:
            src = str(edge.source).strip()
            tgt = str(edge.target).strip()
            if src in node_set and tgt in node_set:
                valid_edges.append(
                    DiagramEdge(
                        source=src,
                        target=tgt,
                        label=edge.label,
                    )
                )

        sanitized_diagrams.append(
            ExtractedDiagram(
                title=diag.title,
                nodes=list(node_set),
                edges=valid_edges,
                source_segments=diag.source_segments,
            )
        )

    visual_result.diagrams = sanitized_diagrams
    return visual_result


def build_visual_prompt(segments_text: str) -> str:
    return f"""
ASSIGNED LECTURE SEGMENTS
=========================
{segments_text}

Extract any step-by-step flowcharts, node-edge relationship diagrams, or mind maps from the segments above.
If none are described or justified, return `{{"flowcharts": [], "diagrams": [], "mindmaps": []}}`.
""".strip()


def visual_specialist_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Executes the Visual Specialist.
    """
    routing = state.get("routing")

    # Short-circuit: If Analyzer explicitly flagged that no visuals exist, skip LLM call entirely
    if routing and (not routing.visual.required or not routing.visual.segment_ids):
        logger.info("[visual_specialist_node] Not required by Analyzer routing. Skipping LLM call.")
        return {"visual_result": VisualKnowledge()}

    all_segments = state.get("segments") or []
    assigned_ids = routing.visual.segment_ids if (routing and routing.visual) else []
    seg_container = SegmentedTranscript(segments=all_segments)

    if assigned_ids:
        segments_context = seg_container.get_text_for_segments(assigned_ids)
    else:
        segments_context = seg_container.to_prompt_context()

    if not segments_context.strip():
        logger.info("[visual_specialist_node] Assigned segments are empty. Returning empty result.")
        return {"visual_result": VisualKnowledge()}

    logger.info(f"[visual_specialist_node] Extracting visuals from segments: {assigned_ids or 'all'}...")

    prompt = build_visual_prompt(segments_text=segments_context)
    provider = get_llm_provider(role="visual")
    logger.info(f"[visual_specialist_node] Invoking {provider.provider_name} ({provider.model_name})...")

    try:
        visual_result: VisualKnowledge = provider.generate_structured(
            prompt=prompt,
            response_model=VisualKnowledge,
            system_prompt=VISUAL_SPECIALIST_SYSTEM_PROMPT,
            temperature=0.1,
        )

        # Enforce node-edge integrity
        visual_result = _sanitize_diagram_integrity(visual_result)

        logger.info(
            f"[visual_specialist_node] Extracted {len(visual_result.flowcharts)} flowchart(s), "
            f"{len(visual_result.diagrams)} diagram(s), {len(visual_result.mindmaps)} mindmap(s)."
        )
        return {"visual_result": visual_result}

    except Exception as e:
        logger.error(f"[visual_specialist_node] Extraction failed: {e}")
        return {
            "errors": [f"Visual specialist failed: {e}"],
            "visual_result": None,
        }
