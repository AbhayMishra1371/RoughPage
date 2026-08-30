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
) -> str:
    """
    Builds the user-side prompt for a single Groq call.

    Args:
        transcript:    The cleaned transcript text (or one chunk of it).
        style:         The requested note style.
        subject:       Optional subject hint.
        source_url:    Original YouTube URL for metadata.
        video_id:      Video ID for metadata.
        chunk_index:   If chunking, which chunk this is (0-indexed).
        total_chunks:  Total number of chunks.

    Returns:
        A short prompt string to send as the user message.
    """

    style_block   = STYLE_INSTRUCTIONS[style]
    subject_line  = subject or "(infer from transcript)"
    url_value     = f'"{source_url}"' if source_url else "null"
    id_value      = f'"{video_id}"'   if video_id   else "null"
    style_value   = style.value

    chunk_context = ""
    if chunk_index is not None and total_chunks is not None:
        chunk_context = f"""
CHUNK INFO
==========
This is chunk {chunk_index + 1} of {total_chunks}.
page_number values in this chunk should start from {chunk_index * 10 + 1}.
Continue page numbering from where the previous chunk left off.
Do not re-introduce topics already covered in earlier chunks.
""".strip()

    prompt = f"""
METADATA TO EMBED IN OUTPUT
============================
title:      (a short topic title inferred from the transcript)
subject:    {subject_line}
source_url: {url_value}
video_id:   {id_value}
style:      "{style_value}"
total_pages: 0
created_at:  null

{style_block}

{chunk_context}

TRANSCRIPT
==========
{transcript}

Now output the NotebookDocument JSON.
Raw JSON only. No markdown. No explanation. No code fences.
""".strip()

    return prompt