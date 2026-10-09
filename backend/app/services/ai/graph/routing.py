"""
routing.py
==========
Conditional edge router for LangGraph.
Decides which specialist nodes to execute in parallel based on RoutingDecision.
"""

from __future__ import annotations

import logging
from app.services.ai.graph.state import PipelineState

logger = logging.getLogger(__name__)


def route_specialists(state: PipelineState) -> list[str]:
    """
    Evaluates the Analyzer's RoutingDecision and returns the list of
    specialist node names to invoke in parallel.

    Possible return values:
      - ['text_specialist']
      - ['text_specialist', 'formula_specialist']
      - ['text_specialist', 'formula_specialist', 'visual_specialist']
      - ['merger'] (if no specialists needed or fallback)
    """
    routing = state.get("routing")

    # Fallback: If analyzer failed, ensure at least the core text specialist runs
    if not routing:
        logger.warning("[route_specialists] No routing decision found. Falling back to ['text_specialist'].")
        return ["text_specialist"]

    active_specialists: list[str] = []

    if routing.text and routing.text.required:
        active_specialists.append("text_specialist")

    if routing.formula and routing.formula.required:
        active_specialists.append("formula_specialist")

    if routing.visual and routing.visual.required:
        active_specialists.append("visual_specialist")

    if routing.comparison and routing.comparison.required:
        active_specialists.append("comparison_specialist")

    logger.info(f"[route_specialists] Selected parallel nodes: {active_specialists or ['merger']}")

    # If somehow no specialists are required, bypass directly to merger
    return active_specialists if active_specialists else ["merger"]
