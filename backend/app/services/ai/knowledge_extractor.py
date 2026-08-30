"""
knowledge_extractor.py
======================

Handles the Knowledge Extraction stage of the hybrid pipeline.

This stage is used when the transcript is too long for a single
Notebook Planner call.

Responsibility:
    Read one transcript chunk and extract structured knowledge:
    - concepts
    - definitions
    - formulas
    - algorithms
    - examples
    - comparisons
    - diagrams
    - important notes
    - relationships
    - code snippets

It does NOT:
    - generate notebook pages
    - choose NotebookDocument element types
    - make layout decisions
    - render anything

Output:
    KnowledgeChunk — an intermediate representation that can later
    be merged and passed to the Notebook Planner.

Pipeline:

    Long Transcript
          ↓
       Chunker
          ↓
    Knowledge Extractor × N
          ↓
    Knowledge Merger
          ↓
    Unified Knowledge
          ↓
    Notebook Planner
          ↓
    NotebookDocument
"""


# ─────────────────────────────────────────────
# Knowledge schema
#
# This is NOT the NotebookDocument schema.
#
# It is an intermediate representation containing
# factual/structural knowledge extracted from the
# transcript.
# ─────────────────────────────────────────────

KNOWLEDGE_SCHEMA = """
OUTPUT SCHEMA
=============

Return a single JSON object with this exact structure:

{
  "topics": ["Topic 1", "Topic 2"],

  "concepts": [
    {
      "name": "concept name",
      "type": "definition | algorithm | process | theory | formula | principle",
      "explanation": "clear explanation of the concept",
      "importance": "high | medium | low",
      "belongs_to_topic": "which topic this concept is part of"
    }
  ],

  "formulas": [
    {
      "label": "e.g. Time Complexity",
      "formula": "e.g. O(log n)",
      "is_latex": false,
      "belongs_to": "concept or topic name"
    }
  ],

  "algorithms": [
    {
      "name": "algorithm name",
      "steps": ["step 1", "step 2", "step 3"],
      "belongs_to_topic": "topic name"
    }
  ],

  "examples": [
    {
      "context": "one-line setup of the example",
      "walkthrough": "step-by-step explanation",
      "belongs_to": "concept or topic name"
    }
  ],

  "comparisons": [
    {
      "title": "X vs Y",
      "left_label": "X",
      "right_label": "Y",
      "points": [
        ["left point", "right point"]
      ]
    }
  ],

  "diagrams": [
    {
      "title": "diagram title",
      "nodes": ["node1", "node2", "node3"],
      "edges": [
        ["node1", "node2"],
        ["node2", "node3"]
      ]
    }
  ],

  "important_notes": [
    {
      "text": "critical fact or warning",
      "belongs_to": "concept or topic name"
    }
  ],

  "relationships": [
    {
      "from": "concept A",
      "to": "concept B",
      "type": "requires | leads_to | contrasts_with | is_part_of | depends_on"
    }
  ],

  "code_snippets": [
    {
      "language": "python | java | cpp | pseudocode",
      "code": "the code",
      "belongs_to": "concept or topic name"
    }
  ]
}
"""


# ─────────────────────────────────────────────
# Knowledge Extraction system prompt
#
# This is separate from the Notebook Planner
# SYSTEM_PROMPT in system_prompt.py.
# ─────────────────────────────────────────────

KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT = f"""
You are a Knowledge Extraction AI.

Your job is to read a lecture transcript chunk and extract
the knowledge contained in that chunk into structured JSON.

You are NOT:
- a summarizer
- a notebook planner
- a renderer

You are an EXTRACTOR.

RULES
=====

- Extract concepts, definitions, formulas, algorithms,
  examples, comparisons, diagrams, important facts,
  relationships, and code snippets present in the transcript.
- Preserve important details from the transcript.
- Do NOT decide how the information should look in a notebook.
- Do NOT generate NotebookDocument elements.
- Do NOT generate headings, bullet lists, flowcharts,
  sticky notes, or other renderer elements.
- Do NOT invent information that is not supported by the transcript.
- Preserve formulas and code accurately.
- If something is unclear or absent from the transcript,
  do not invent it.
- Extract only information contained in this chunk.
- Do not speculate about information from other chunks.
- Output ONLY valid raw JSON.
- Do NOT output markdown.
- Do NOT use ```json fences.
- Do NOT include explanations outside the JSON.

{KNOWLEDGE_SCHEMA}
""".strip()


# ─────────────────────────────────────────────
# User prompt builder
# ─────────────────────────────────────────────

def build_extraction_prompt(
    transcript: str,
    chunk_index: int | None = None,
    total_chunks: int | None = None,
) -> str:
    """
    Build the user prompt for one knowledge extraction call.

    Args:
        transcript:
            One cleaned transcript chunk.

        chunk_index:
            Zero-based index of the current chunk.

        total_chunks:
            Total number of chunks.

    Returns:
        Prompt string for the knowledge extraction model.
    """

    chunk_context = ""

    if chunk_index is not None and total_chunks is not None:
        chunk_context = (
            f"This is chunk {chunk_index + 1} of {total_chunks} "
            f"from a longer lecture. Extract only information "
            f"supported by this chunk."
        )

    return f"""
{chunk_context}

Extract the structured knowledge from the following
lecture transcript.

Return ONLY valid raw JSON according to the provided schema.

TRANSCRIPT
==========

{transcript}
""".strip()