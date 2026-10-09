
import yt_dlp


def extract_video_metadata(url: str) -> dict:
    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)

    return {
        "youtube_video_id": info.get("id"),
        "title": info.get("title"),
        "thumbnail_url": info.get("thumbnail"),
        "duration_seconds": info.get("duration"),
    }


def extract_playlist_metadata(url: str) -> dict:
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)

    if info.get("_type") != "playlist" and not info.get("entries"):
        raise ValueError("The URL does not identify a playlist.")

    videos = []

    for entry in info.get("entries") or []:
        if not entry or not entry.get("id") or not entry.get("title"):
            continue

        
        video_id = entry["id"]

        videos.append({
            "youtube_video_id": video_id,
            "title": entry["title"],
            "thumbnail_url": (
                entry.get("thumbnail")
                or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
            ),
            "duration_seconds": entry.get("duration"),
        })


    return {
        "youtube_playlist_id": info.get("id"),
        "title": info.get("title"),
        "videos": videos,
    }
