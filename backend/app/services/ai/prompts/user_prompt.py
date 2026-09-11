"""
user_prompt.py
==============
Builds the per-request user prompt sent to Groq.
This is intentionally short — it contains only:
  - Note style instruction (changes per request)
  - Metadata context (video ID, URL, subject)
  - The transcript chunk to process

Everything else (rules, element reference, example)
lives in system_prompt.py and is sent once.
"""

import json
from app.schemas.notebook import NoteStyle


# ─────────────────────────────────────────────
# Style instructions
# These change per request based on what the user selects.
# Kept here (not in system prompt) so the system prompt
# stays constant and benefits from prompt caching.
# ─────────────────────────────────────────────

STYLE_INSTRUCTIONS: dict[NoteStyle, str] = {

    NoteStyle.DETAILED: """
NOTE STYLE: Detailed
Cover all concepts in the transcript — definitions, examples, code, diagrams.
Include flowcharts for every algorithm. Use comparisons when concepts are contrasted.
Prefer depth. Every topic should feel complete.
""".strip(),

    NoteStyle.TOPPER: """
NOTE STYLE: Topper Notes
Cover all concepts but keep each element concise and scannable.
Prioritize definitions, flowcharts, sticky formulas, and comparisons.
Break long explanations into bullet lists. Avoid dense paragraphs.
Every page should feel structured and easy to review.
""".strip(),

    NoteStyle.LAST_MINUTE: """
NOTE STYLE: Last Minute Revision
Extract ONLY the most critical facts, formulas, and definitions.
Use bullet_list and important_note heavily.
Avoid long paragraphs, lengthy examples, and code blocks unless critical.
Every element should be the kind of thing that appears in an exam question.
Keep it dense and fast to scan.
""".strip(),

}


def build_user_prompt(
    transcript: str,
    style: NoteStyle = NoteStyle.DETAILED,
    subject: str | None = None,
    source_url: str | None = None,
    video_id: str | None = None,
    chunk_index: int | None = None,
    total_chunks: int | None = None,
    title: str | None = None,
) -> str:
    """
    Builds the user prompt for single-call lecture note generation.
    """
    style_block = STYLE_INSTRUCTIONS[style]
    subject_hint = f"Subject: {subject}\n" if subject else ""
    title_hint = f'Topic Title: "{title}"\n' if title else ""

    return f"""
{style_block}

{subject_hint}{title_hint}TRANSCRIPT
==========
{transcript}

Generate the lecture notes JSON:
{{
  "title": "{title or '(inferred lecture title)'}",
  "pages": [
    {{
      "topic": "Section Topic",
      "elements": [ ... ]
    }}
  ]
}}
Raw JSON only. No markdown. No code fences.
""".strip()


def build_planner_prompt_from_knowledge(
    knowledge: dict,
    style: NoteStyle = NoteStyle.DETAILED,
    subject: str | None = None,
    source_url: str | None = None,
    video_id: str | None = None,
    title: str | None = None,
) -> str:
    """
    Builds the user prompt for the Notebook Planner using unified knowledge.
    """
    style_block = STYLE_INSTRUCTIONS[style]
    subject_hint = f"Subject: {subject}\n" if subject else ""
    title_hint = f'Topic Title: "{title}"\n' if title else ""
    knowledge_str = json.dumps(knowledge, indent=2, ensure_ascii=False)

    return f"""
{style_block}

{subject_hint}{title_hint}UNIFIED KNOWLEDGE BASE
======================
{knowledge_str}

Plan and synthesize these concepts into cohesive notebook pages as JSON:
{{
  "title": "{title or '(inferred lecture title)'}",
  "pages": [
    {{
      "topic": "Section Topic",
      "elements": [ ... ]
    }}
  ]
}}
Raw JSON only. No markdown. No code fences.
""".strip()