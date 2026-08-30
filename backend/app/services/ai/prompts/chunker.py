"""
chunker.py
==========
Splits long transcripts into manageable chunks before sending to Groq.

Problem:
  A 90-minute lecture transcript can be 15,000–25,000 words.
  Sending it all in one call risks hitting context limits and
  produces lower-quality notes (the model loses focus over long input).

Strategy:
  1. Topic extraction — ask Groq to identify topic boundaries first.
     This is a cheap call: small output, small input.
  2. Split transcript at those boundaries.
  3. Generate notebook pages per chunk.
  4. Merge all pages into one NotebookDocument.

Current implementation:
  - Word-count based chunking (simple, no extra AI call).
  - Topic-aware chunking (uses a quick Groq call) available as upgrade.

Use word-count chunking for MVP.
Upgrade to topic-aware once the pipeline is stable.
"""

import re
from dataclasses import dataclass


# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

WORDS_PER_CHUNK    = 1500   # ~5–8 min of lecture audio
MAX_CHUNK_OVERLAP  = 100    # words of overlap between chunks
                             # ensures no concept is split mid-explanation


# ─────────────────────────────────────────────
# Data types
# ─────────────────────────────────────────────

@dataclass
class TranscriptChunk:
    index:        int    # 0-based chunk index
    total:        int    # total number of chunks
    text:         str    # the chunk's transcript text
    word_count:   int    # how many words in this chunk
    is_last:      bool   # True if this is the final chunk


# ─────────────────────────────────────────────
# Word-count chunker (use for MVP)
# ─────────────────────────────────────────────

def chunk_by_word_count(
    transcript: str,
    words_per_chunk: int = WORDS_PER_CHUNK,
    overlap: int = MAX_CHUNK_OVERLAP,
) -> list[TranscriptChunk]:
    """
    Splits a transcript into fixed-size word-count chunks
    with a small overlap to avoid splitting mid-concept.

    Args:
        transcript:      The full cleaned transcript.
        words_per_chunk: Target word count per chunk.
        overlap:         Words of overlap between consecutive chunks.

    Returns:
        A list of TranscriptChunk objects, in order.

    Example:
        chunks = chunk_by_word_count(transcript, words_per_chunk=1500)
        for chunk in chunks:
            prompt = build_user_prompt(chunk.text, ..., chunk_index=chunk.index, total_chunks=chunk.total)
    """
    words = transcript.split()

    if len(words) <= words_per_chunk:
        # Short transcript — no chunking needed
        return [TranscriptChunk(
            index=0, total=1, text=transcript,
            word_count=len(words), is_last=True
        )]

    chunks: list[TranscriptChunk] = []
    start = 0

    while start < len(words):
        end   = min(start + words_per_chunk, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end >= len(words):
            break
        start = end - overlap  # step back by overlap for next chunk

    total = len(chunks)
    return [
        TranscriptChunk(
            index=i,
            total=total,
            text=c,
            word_count=len(c.split()),
            is_last=(i == total - 1),
        )
        for i, c in enumerate(chunks)
    ]


def needs_chunking(transcript: str, threshold: int = WORDS_PER_CHUNK) -> bool:
    """Returns True if the transcript is long enough to require chunking."""
    return len(transcript.split()) > threshold


# ─────────────────────────────────────────────
# Topic-aware chunker (upgrade path — Phase 2+)
#
# Instead of splitting by word count blindly,
# ask Groq to identify topic boundaries first,
# then split exactly at those boundaries.
#
# This is a cheap preliminary call:
#   Input:  full transcript
#   Output: list of topic titles + start sentences
#   Cost:   small — output is just a topic list, not a full notebook
#
# System prompt for this call:
# ─────────────────────────────────────────────

TOPIC_EXTRACTION_SYSTEM_PROMPT = """
You are a lecture analyst.
Your only job is to identify the major topic boundaries in a transcript.

Output a JSON array of objects in this exact format:
[
  {
    "topic": "Introduction to Binary Search",
    "start_phrase": "today we are going to learn"
  },
  {
    "topic": "Algorithm Walkthrough",
    "start_phrase": "so let's actually look at how"
  }
]

Rules:
- Output ONLY raw JSON. No markdown. No explanation. No code fences.
- Identify 3–8 topics per lecture. Not more.
- Use the exact words from the transcript for start_phrase (first 5–7 words).
- Topics should be meaningful sections, not individual sentences.
- Do not invent topics not present in the transcript.
"""


def build_topic_extraction_prompt(transcript: str) -> str:
    """
    Builds the user prompt for the topic extraction call.
    This is a cheap preliminary Groq call that identifies
    where topics begin in the transcript.

    Usage:
        system = TOPIC_EXTRACTION_SYSTEM_PROMPT
        user   = build_topic_extraction_prompt(transcript)
        # call Groq → get topic list
        # use split_by_topics() to create chunks
    """
    return f"""
Identify the major topic boundaries in this lecture transcript.
Output a JSON array as instructed.

TRANSCRIPT
==========
{transcript}
""".strip()


def split_by_topics(
    transcript: str,
    topics: list[dict],   # output from Groq topic extraction call
) -> list[TranscriptChunk]:
    """
    Splits a transcript at the topic boundaries identified by Groq.

    Args:
        transcript: The full cleaned transcript.
        topics:     List of {topic, start_phrase} dicts from topic extraction.

    Returns:
        One TranscriptChunk per topic, in order.
    """
    if not topics:
        return chunk_by_word_count(transcript)

    # Find character positions of each start_phrase in the transcript
    split_points: list[int] = [0]
    for t in topics[1:]:   # first topic always starts at 0
        phrase = t.get("start_phrase", "").lower().strip()
        if phrase:
            pos = transcript.lower().find(phrase)
            if pos > 0:
                split_points.append(pos)

    split_points.sort()
    split_points.append(len(transcript))   # sentinel for the last chunk

    raw_chunks = [
        transcript[split_points[i]:split_points[i + 1]].strip()
        for i in range(len(split_points) - 1)
        if transcript[split_points[i]:split_points[i + 1]].strip()
    ]

    total = len(raw_chunks)
    return [
        TranscriptChunk(
            index=i,
            total=total,
            text=c,
            word_count=len(c.split()),
            is_last=(i == total - 1),
        )
        for i, c in enumerate(raw_chunks)
    ]