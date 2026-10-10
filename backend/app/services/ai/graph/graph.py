"""
graph.py
========
Orchestration entry point for the RoughPage AI LangGraph pipeline.

Architecture:
               ┌─────────┐
               │  START  │
               └────┬────┘
                    │
              ┌─────▼─────┐
              │ Analyzer  │
              └─────┬─────┘
                    │ (conditional fan-out via route_specialists)
        ┌───────────┼──────────────┬──────────────┐
        ▼           ▼              ▼              ▼
   ┌─────────┐ ┌─────────┐   ┌─────────┐   ┌─────────────┐
   │  Text   │ │ Formula │   │ Visual  │   │ Comparison  │
   └────┬────┘ └────┬────┘   └────┬────┘   └──────┬──────┘
        └───────────┼──────────────┴──────────────┘
                    │ (fan-in)
              ┌─────▼─────┐
              │  Merger   │
              └─────┬─────┘
                    │
              ┌─────▼─────┐
              │ Validator │
              └─────┬─────┘
                    │
              ┌─────▼─────┐
              │  Planner  │
              └─────┬─────┘
                    │
               ┌────▼────┐
               │   END   │
               └─────────┘
"""

from __future__ import annotations

import logging
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.services.ai.graph.nodes.analyzer import analyzer_node
from app.services.ai.graph.nodes.comparison import comparison_specialist_node
from app.services.ai.graph.nodes.formula import formula_specialist_node
from app.services.ai.graph.nodes.merger import merger_node
from app.services.ai.graph.nodes.planner import planner_node
from app.services.ai.graph.nodes.text import text_specialist_node
from app.services.ai.graph.nodes.validator import validator_node
from app.services.ai.graph.nodes.visual import visual_specialist_node
from app.services.ai.graph.routing import route_specialists
from app.services.ai.graph.state import PipelineState

logger = logging.getLogger(__name__)


def create_pipeline_graph() -> CompiledStateGraph:
    """
    Constructs and compiles the full multi-specialist LangGraph pipeline.
    """
    logger.info("[graph] Building RoughPage LangGraph pipeline...")
    builder = StateGraph(PipelineState)

    # 1. Register all nodes
    builder.add_node("analyzer", analyzer_node)
    builder.add_node("text_specialist", text_specialist_node)
    builder.add_node("formula_specialist", formula_specialist_node)
    builder.add_node("visual_specialist", visual_specialist_node)
    builder.add_node("comparison_specialist", comparison_specialist_node)
    builder.add_node("merger", merger_node)
    builder.add_node("validator", validator_node)
    builder.add_node("planner", planner_node)

    # 2. Entry point: START -> Analyzer
    builder.add_edge(START, "analyzer")

    # 3. Dynamic fan-out: Analyzer -> Active Specialists (or direct bypass to merger)
    builder.add_conditional_edges(
        "analyzer",
        route_specialists,
        [
            "text_specialist",
            "formula_specialist",
            "visual_specialist",
            "comparison_specialist",
            "merger",
        ],
    )

    # 4. Fan-in: All specialists converge to deterministic Merger
    builder.add_edge("text_specialist", "merger")
    builder.add_edge("formula_specialist", "merger")
    builder.add_edge("visual_specialist", "merger")
    builder.add_edge("comparison_specialist", "merger")

    # 5. Synthesis chain: Merger -> Validator -> Planner -> END
    builder.add_edge("merger", "validator")
    builder.add_edge("validator", "planner")
    builder.add_edge("planner", END)

    compiled = builder.compile()
    logger.info("[graph] RoughPage LangGraph pipeline compiled successfully.")
    return compiled


# Module-level compiled instance for reuse
pipeline_graph = create_pipeline_graph()
