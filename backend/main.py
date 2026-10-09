from fastapi import FastAPI , Depends , HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from sqlalchemy import text , select
from sqlalchemy.orm import Session
from database import get_db , engine , Base
import models
from pydantic import BaseModel, HttpUrl
from models import Video , Playlist
from youtube_service import (
    extract_video_metadata,
    extract_playlist_metadata,
)

class VideoIngestRequest(BaseModel):
    url: HttpUrl


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "AI Study Agent API is running"}

@app.get("/db-check")
def db_check(db: Annotated[Session, Depends(get_db)]):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


@app.post("/videos/ingest")
def ingest_video(
    request: VideoIngestRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        metadata = extract_video_metadata(str(request.url))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "We couldn't retrieve this YouTube video. "
                "Check the URL and make sure the video is publicly accessible."
            ),
        )

    video_id = metadata.get("youtube_video_id")
    title = metadata.get("title")

    if not video_id or not title:
        raise HTTPException(
            status_code=400,
            detail="Could not identify a valid YouTube video.",
        )

    existing_video = db.scalar(
        select(Video).where(Video.youtube_video_id == video_id)
    )

    if existing_video:
        return {
            "message": "Video already exists",
            "video": {
                "id": existing_video.id,
                "youtube_video_id": existing_video.youtube_video_id,
                "title": existing_video.title,
                "thumbnail_url": existing_video.thumbnail_url,
                "duration_seconds": existing_video.duration_seconds,
            },
        }

    video = Video(**metadata)
    db.add(video)

    try:
        db.commit()
        db.refresh(video)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the video to the database.",
        )

    return {
        "message": "Video ingested successfully",
        "video": {
            "id": video.id,
            "youtube_video_id": video.youtube_video_id,
            "title": video.title,
            "thumbnail_url": video.thumbnail_url,
            "duration_seconds": video.duration_seconds,
        },
    }

@app.get("/videos")
def get_videos(
    db: Annotated[Session, Depends(get_db)],
):
    videos = db.scalars(
        select(Video)
        .where(Video.playlist_id.is_(None))
        .order_by(Video.id.desc())
    ).all()


    return {
        "count": len(videos),
        "videos": [
            {
                "id": video.id,
                "youtube_video_id": video.youtube_video_id,
                "title": video.title,
                "thumbnail_url": video.thumbnail_url,
                "duration_seconds": video.duration_seconds,
            }
            for video in videos
        ],
    }


@app.post("/playlists/ingest")
def ingest_playlist(
    request: VideoIngestRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        metadata = extract_playlist_metadata(str(request.url))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not retrieve this YouTube playlist. "
                "Check the URL and make sure the playlist is publicly accessible."
            ),
        )

    playlist_id = metadata.get("youtube_playlist_id")
    title = metadata.get("title")

    if not playlist_id or not title:
        raise HTTPException(
            status_code=400,
            detail="Could not identify a valid YouTube playlist.",
        )

    playlist = db.scalar(
        select(Playlist).where(
            Playlist.youtube_playlist_id == playlist_id
        )
    )

    if playlist is None:
        playlist = Playlist(
            youtube_playlist_id=playlist_id,
            title=title,
        )
        db.add(playlist)
        db.flush()

    added_count = 0

    try:
        for item in metadata["videos"]:
            existing_video = db.scalar(
                select(Video).where(
                    Video.youtube_video_id == item["youtube_video_id"]
                )
            )

            if existing_video:
                if existing_video.playlist_id is None:
                    existing_video.playlist_id = playlist.id
                continue

            video = Video(
                **item,
                playlist_id=playlist.id,
            )
            db.add(video)
            added_count += 1

        db.commit()
        db.refresh(playlist)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the playlist and its videos.",
        )

    return {
        "message": "Playlist ingested successfully",
        "playlist": {
            "id": playlist.id,
            "youtube_playlist_id": playlist.youtube_playlist_id,
            "title": playlist.title,
        },
        "videos_added": added_count,
        "videos_found": len(metadata["videos"]),
    }


@app.get("/playlists")
def get_playlists(
    db: Annotated[Session, Depends(get_db)],
):
    playlists = db.scalars(
        select(Playlist).order_by(Playlist.id.desc())
    ).all()

    return {
        "count": len(playlists),
        "playlists": [
            {
                "id": playlist.id,
                "youtube_playlist_id": playlist.youtube_playlist_id,
                "title": playlist.title,
                "videos_count": len(playlist.videos),
            }
            for playlist in playlists
        ],
    }

@app.get("/playlists/{playlist_id}/videos")
def get_playlist_videos(
    playlist_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    playlist = db.get(Playlist, playlist_id)

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found.",
        )

    videos = db.scalars(
        select(Video)
        .where(Video.playlist_id == playlist_id)
        .order_by(Video.id.asc())
    ).all()

    return {
        "playlist_id": playlist.id,
        "playlist_title": playlist.title,
        "count": len(videos),
        "videos": [
            {
                "id": video.id,
                "youtube_video_id": video.youtube_video_id,
                "title": video.title,
                "thumbnail_url": video.thumbnail_url,
                "duration_seconds": video.duration_seconds,
            }
            for video in videos
        ],
    }
