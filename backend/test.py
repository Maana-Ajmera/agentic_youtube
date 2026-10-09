
from youtube_service import extract_video_metadata

url = input("Enter a public YouTube video URL: ").strip()

try:
    metadata = extract_video_metadata(url)
    print(metadata)
except Exception as error:
    print(f"Could not extract metadata: {error}")
