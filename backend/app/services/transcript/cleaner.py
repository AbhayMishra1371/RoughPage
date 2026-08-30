import os
import re
import requests
from typing import List, Dict, Optional
from loguru import logger

def clean_transcript_basic(raw_transcript: Optional[List[Dict[str, any]]]) -> str:
    """
    Extracts text from YouTube transcript segments and performs basic text cleaning:
    - Removes bracketed annotations like [Music], [laughter], (cough), etc.
    - Normalizes extra spaces and newlines.
    - Joins into a single coherent paragraph/string.
    """
    if not raw_transcript:
        logger.warning("Empty or null raw transcript provided for basic cleaning.")
        return ""

    cleaned_segments = []
    
    # Regular expression to match bracketed annotations: [Music], [laughter], (music), etc.
    annotation_pattern = re.compile(r'\[[^\]]+\]|\([^)]+\)')

    for segment in raw_transcript:
        # Extract text safely from dictionary or object attributes
        if isinstance(segment, dict):
            text = segment.get("text", "")
        elif hasattr(segment, "text"):
            text = segment.text
        else:
            try:
                text = segment["text"]
            except Exception:
                text = str(segment)

        # Remove annotations
        cleaned_text = annotation_pattern.sub("", text)
        # Normalize whitespace
        cleaned_text = " ".join(cleaned_text.split())
        if cleaned_text:
            cleaned_segments.append(cleaned_text)

    # Join segments and normalize overall spacing
    full_text = " ".join(cleaned_segments)
    full_text = re.sub(r'\s+', ' ', full_text).strip()
    
    return full_text


