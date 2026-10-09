"""
segmenter.py
============
Transforms raw transcript inputs into an ordered SegmentedTranscript
with stable segment IDs (SEG_001, SEG_002, ...) and timestamps.

Supports two input modalities:
1. YouTube caption snippets: list of dicts with 'text', 'start', 'duration'.
   Groups small consecutive snippets into cohesive ~150-250 word segments
   while tracking start_s and end_s timestamps.
2. Raw text: user-pasted text without timestamps.
   Splits text by sentence/paragraph boundaries into ~150-250 word segments.
"""

from __future__ import annotations

import re
from typing import Any, Sequence

from app.schemas.pipeline import SegmentedTranscript, TranscriptSegment

# Pattern to clean bracketed noise from audio transcription while preserving math parentheses like (theta), (log n)
_ANNOTATION_PATTERN = re.compile(
    r"\[[^\]]+\]|\((?:music|applause|laughter|cough|sigh|cheers|screaming|snicker|giggle|groan|chuckle)\)",
    re.IGNORECASE,
)


def clean_segment_text(raw_text: str) -> str:
    """Removes annotations like [Music] or (applause) and normalizes spaces."""
    cleaned = _ANNOTATION_PATTERN.sub("", raw_text)
    return " ".join(cleaned.split()).strip()


def segment_youtube_transcript(
    raw_snippets: Sequence[dict[str, Any]],
    target_words: int = 180,
    max_duration_s: float = 90.0,
) -> SegmentedTranscript:
    """
    Groups granular YouTube transcript snippets (typically 2-5s each) into
    coherent, timestamped segments of ~150-250 words or up to 90 seconds.

    Args:
        raw_snippets: List of dicts, each with keys 'text', 'start', 'duration'.
        target_words: Target word count before closing a segment.
        max_duration_s: Target maximum time duration for a single segment.

    Returns:
        SegmentedTranscript containing an ordered list of TranscriptSegment.
    """
    segments: list[TranscriptSegment] = []
    current_texts: list[str] = []
    current_start: float | None = None
    current_end: float | None = None
    current_word_count = 0
    seg_idx = 1

    for snippet in raw_snippets:
        raw_text = snippet.get("text", "")
        cleaned = clean_segment_text(raw_text)
        if not cleaned:
            continue

        try:
            start_s = float(snippet.get("start", 0.0))
            duration = float(snippet.get("duration", 0.0))
            end_s = start_s + duration
        except (ValueError, TypeError):
            start_s = current_end if current_end is not None else 0.0
            end_s = start_s + 5.0

        if current_start is None:
            current_start = start_s
        current_end = max(current_end or end_s, end_s)

        words = cleaned.split()
        current_texts.append(cleaned)
        current_word_count += len(words)

        duration_span = current_end - current_start

        # Close segment if threshold reached
        if current_word_count >= target_words or duration_span >= max_duration_s:
            full_segment_text = " ".join(current_texts).strip()
            if full_segment_text:
                segments.append(
                    TranscriptSegment(
                        id=f"SEG_{seg_idx:03d}",
                        start_s=round(current_start, 2),
                        end_s=round(current_end, 2),
                        text=full_segment_text,
                    )
                )
                seg_idx += 1

            current_texts = []
            current_start = None
            current_end = None
            current_word_count = 0

    # Flush remainder
    if current_texts:
        full_segment_text = " ".join(current_texts).strip()
        if full_segment_text:
            segments.append(
                TranscriptSegment(
                    id=f"SEG_{seg_idx:03d}",
                    start_s=round(current_start, 2) if current_start is not None else None,
                    end_s=round(current_end, 2) if current_end is not None else None,
                    text=full_segment_text,
                )
            )

    return SegmentedTranscript(segments=segments)


def segment_plain_text(
    text: str,
    target_words: int = 180,
) -> SegmentedTranscript:
    """
    Segments plain text into cohesive ~150-250 word segments
    using paragraph and sentence boundaries.

    Args:
        text: Raw lecture text.
        target_words: Approximate word threshold per segment.

    Returns:
        SegmentedTranscript with synthetic IDs (SEG_001, ...) and start_s=None.
    """
    cleaned = clean_segment_text(text)
    if not cleaned:
        return SegmentedTranscript(segments=[])

    # Split into rough sentences while preserving punctuation
    sentence_chunks = re.split(r"(?<=[.!?])\s+", cleaned)
    segments: list[TranscriptSegment] = []
    current_sentences: list[str] = []
    current_word_count = 0
    seg_idx = 1

    for sentence in sentence_chunks:
        sentence = sentence.strip()
        if not sentence:
            continue

        words = sentence.split()
        current_sentences.append(sentence)
        current_word_count += len(words)

        if current_word_count >= target_words:
            segment_text = " ".join(current_sentences).strip()
            segments.append(
                TranscriptSegment(
                    id=f"SEG_{seg_idx:03d}",
                    start_s=None,
                    end_s=None,
                    text=segment_text,
                )
            )
            seg_idx += 1
            current_sentences = []
            current_word_count = 0

    # Flush remainder
    if current_sentences:
        segment_text = " ".join(current_sentences).strip()
        if segment_text:
            segments.append(
                TranscriptSegment(
                    id=f"SEG_{seg_idx:03d}",
                    start_s=None,
                    end_s=None,
                    text=segment_text,
                )
            )

    return SegmentedTranscript(segments=segments)


def segment_transcript(
    source: Sequence[dict[str, Any]] | str,
    target_words: int = 180,
) -> SegmentedTranscript:
    """
    Unified entry point. Automatically detects whether the source is a
    list of YouTube caption snippets or a plain text string.
    """
    if isinstance(source, str):
        return segment_plain_text(source, target_words=target_words)
    elif isinstance(source, (list, tuple)):
        return segment_youtube_transcript(source, target_words=target_words)
    else:
        raise TypeError(f"Expected str or list[dict], got {type(source).__name__}")
