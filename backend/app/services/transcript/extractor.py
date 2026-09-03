import logging
from typing import Any
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)


def fetch_transcript(video_id: str) -> list[Any] | None:
    """
    Fetch transcript for a given YouTube video ID.
    Supports English, auto-generated transcripts in any language, and translations.
    """
    try:
        ytt = YouTubeTranscriptApi()

        # 1. Try English transcript first
        try:
            return list(ytt.fetch(video_id, languages=["en", "en-US", "en-GB", "en-IN"]))
        except Exception:
            pass

        # 2. Try listing all available transcripts for the video
        try:
            transcript_list = ytt.list(video_id)

            # Try translating to English if available and translatable
            for transcript in transcript_list:
                try:
                    if getattr(transcript, "is_translatable", False):
                        return list(transcript.translate("en").fetch())
                except Exception:
                    pass

            # If translation failed or wasn't supported, fetch the native transcript
            for transcript in transcript_list:
                try:
                    return list(transcript.fetch())
                except Exception:
                    continue
        except Exception:
            pass

        # 3. Fallback attempt with a broad list of languages
        return list(
            ytt.fetch(
                video_id,
                languages=[
                    "en", "en-US", "en-GB", "hi", "es", "fr", "de",
                    "ja", "ko", "pt", "ru", "zh", "ar", "id", "it",
                ],
            )
        )
    except Exception as e:
        logger.warning("Error fetching transcript for video %s: %s", video_id, e)
        return None