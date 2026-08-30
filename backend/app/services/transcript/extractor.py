from youtube_transcript_api import YouTubeTranscriptApi

def fetch_transcript(video_id: str):
    try:
        ytt = YouTubeTranscriptApi()
        transcript = ytt.fetch(video_id)
        return transcript
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return None