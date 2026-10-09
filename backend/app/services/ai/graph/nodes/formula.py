"""
formula.py
==========
LangGraph node for the Formula / Mathematics Specialist.

Responsibilities:
- Extracts mathematical formulas, equations, complexity terms, and variable definitions.
- Distinguishes LaTeX formulas (summations, fractions) vs plain text.
- Short-circuits immediately with empty result if the Analyzer did not require formulas.
- Cites source segment IDs for every formula.
"""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.pipeline import FormulaKnowledge, SegmentedTranscript
from app.services.ai.graph.state import PipelineState
from app.services.ai.providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

FORMULA_SPECIALIST_SYSTEM_PROMPT = """
You are the Mathematics & Formula Specialist for RoughPage AI.
Your role is to extract equations, formulas, algorithms complexity expressions, and their variables from assigned lecture segments.

RULES:
1. STRICT SOURCE GROUNDING:
   - Extract ONLY formulas that are explicitly discussed in the provided segments.
   - Attach `source_segments` (e.g. ["SEG_002"]) indicating where the formula was stated or explained.
   - If no formulas are present in the provided segments, return an empty list: `{"formulas": []}`. Never invent formulas.
2. LATEX vs PLAIN TEXT:
   - `is_latex: true` ONLY for formulas requiring LaTeX rendering (fractions, summations, integrals, square roots, matrices, subscripts/superscripts).
   - `is_latex: false` for clean plain text formulas like "O(log n)", "y = mx + c".
3. VARIABLES:
   - Identify variables used in the formula and their meaning (e.g. ["θ: parameter vector", "m: number of training examples"]).
4. LABELS & EXPLANATION:
   - Provide a clear descriptive label (e.g. "Mean Squared Error Cost Function", "Average Case Search Complexity").
   - Provide a 1-sentence explanation of what the formula computes or represents.

Return a valid JSON object matching the FormulaKnowledge schema.
""".strip()


def build_formula_prompt(segments_text: str) -> str:
    return f"""
ASSIGNED LECTURE SEGMENTS
=========================
{segments_text}

Extract all mathematical formulas, equations, or computational complexity formulas from the segments above.
If none exist, return `{{"formulas": []}}`.
""".strip()


def formula_specialist_node(state: PipelineState) -> dict[str, Any]:
    """
    LangGraph node: Executes the Formula Specialist.
    """
    routing = state.get("routing")

    # Short-circuit: If Analyzer explicitly flagged that no formulas exist, skip LLM call entirely
    if routing and (not routing.formula.required or not routing.formula.segment_ids):
        logger.info("[formula_specialist_node] Not required by Analyzer routing. Skipping LLM call.")
        return {"formula_result": FormulaKnowledge(formulas=[])}

    all_segments = state.get("segments") or []
    assigned_ids = routing.formula.segment_ids if (routing and routing.formula) else []
    seg_container = SegmentedTranscript(segments=all_segments)

    if assigned_ids:
        segments_context = seg_container.get_text_for_segments(assigned_ids)
    else:
        segments_context = seg_container.to_prompt_context()

    if not segments_context.strip():
        logger.info("[formula_specialist_node] Assigned segments are empty. Returning empty result.")
        return {"formula_result": FormulaKnowledge(formulas=[])}

    logger.info(f"[formula_specialist_node] Extracting formulas from segments: {assigned_ids or 'all'}...")

    prompt = build_formula_prompt(segments_text=segments_context)
    provider = get_llm_provider(role="formula")
    logger.info(f"[formula_specialist_node] Invoking {provider.provider_name} ({provider.model_name})...")

    try:
        formula_result: FormulaKnowledge = provider.generate_structured(
            prompt=prompt,
            response_model=FormulaKnowledge,
            system_prompt=FORMULA_SPECIALIST_SYSTEM_PROMPT,
            temperature=0.1,
        )

        logger.info(f"[formula_specialist_node] Extracted {len(formula_result.formulas)} formula(s).")
        return {"formula_result": formula_result}

    except Exception as e:
        logger.error(f"[formula_specialist_node] Extraction failed: {e}")
        return {
            "errors": [f"Formula specialist failed: {e}"],
            "formula_result": None,
        }
