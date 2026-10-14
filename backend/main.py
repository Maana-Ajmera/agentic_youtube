import json
from fastapi import FastAPI , Depends , HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from sqlalchemy import text , select
from sqlalchemy.orm import Session
from database import get_db , engine , Base
import models
from pydantic import BaseModel, HttpUrl
from models import Video , Playlist , Transcript , GeneratedContent
from youtube_service import (
    extract_video_metadata,
    extract_playlist_metadata,
    extract_video_transcript,
)
from llm_service import (
    generate_interview_questions,
    generate_academic_notes,
)

class VideoIngestRequest(BaseModel):
    url: HttpUrl

class GenerationRequest(BaseModel):
    custom_instructions: str | None = None

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
@app.post("/videos/{video_id}/transcript")
def ingest_transcript(
    video_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    video = db.get(Video, video_id)

    if video is None:
        raise HTTPException(
            status_code=404,
            detail="Video not found in the database.",
        )

    existing = db.scalar(
        select(Transcript).where(
            Transcript.video_id == video.id
        )
    )

    if existing:
        return {
            "message": "Transcript already exists",
            "transcript": {
                "id": existing.id,
                "video_id": existing.video_id,
                "language": existing.language,
                "source": existing.source,
                "text": existing.text,
            },
        }

    try:
        result = extract_video_transcript(video.youtube_video_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not retrieve captions for this video. "
                "Captions may be unavailable or YouTube may have "
                "temporarily blocked the request."
            ),
        )

    if not result["text"].strip():
        raise HTTPException(
            status_code=400,
            detail="The retrieved transcript is empty.",
        )

    transcript = Transcript(
        video_id=video.id,
        text=result["text"],
        language=result["language"],
        source=result["source"],
    )

    db.add(transcript)

    try:
        db.commit()
        db.refresh(transcript)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the transcript.",
        )

    return {
        "message": "Transcript saved successfully",
        "transcript": {
            "id": transcript.id,
            "video_id": transcript.video_id,
            "language": transcript.language,
            "source": transcript.source,
            "text": transcript.text,
        },
    }
@app.get("/videos/{video_id}/transcript")
def get_transcript(
    video_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    video = db.get(Video, video_id)

    if video is None:
        raise HTTPException(
            status_code=404,
            detail="Video not found.",
        )

    transcript = db.scalar(
        select(Transcript).where(
            Transcript.video_id == video.id
        )
    )

    if transcript is None:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found. Extract it first.",
        )

    return {
        "id": transcript.id,
        "video_id": transcript.video_id,
        "video_title": video.title,
        "language": transcript.language,
        "source": transcript.source,
        "text": transcript.text,
        "created_at": transcript.created_at,
        "updated_at": transcript.updated_at,
    }


def generate_from_transcript(
    video_id: int,
    custom_instructions: str | None,
    generation_type: str,
    db: Session,
) -> tuple[Video, dict]:
    """Reuse saved content or generate and persist it."""

    video = db.get(Video, video_id)

    if video is None:
        raise HTTPException(
            status_code=404,
            detail="Video not found.",
        )

    # Reuse previously generated content, if available.
    saved_content = db.scalar(
        select(GeneratedContent).where(
            GeneratedContent.video_id == video.id,
            GeneratedContent.generation_type == generation_type,
        )
    )

    if saved_content is not None:
        return video, json.loads(saved_content.result)

    # Generation requires a saved transcript.
    transcript = db.scalar(
        select(Transcript).where(
            Transcript.video_id == video.id
        )
    )

    if transcript is None:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found. Extract it first.",
        )

    try:
        if generation_type == "interview":
            result = generate_interview_questions(
                transcript.text,
                custom_instructions,
            )
        elif generation_type == "academic":
            result = generate_academic_notes(
                transcript.text,
                custom_instructions,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid generation type.",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Could not generate content. Please try again.",
        )

    # Store the generated JSON result in PostgreSQL.
    saved_content = GeneratedContent(
        video_id=video.id,
        generation_type=generation_type,
        result=json.dumps(result, ensure_ascii=False),
    )

    try:
        db.add(saved_content)
        db.commit()
        db.refresh(saved_content)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the generated content.",
        )

    return video, result



@app.post("/videos/{video_id}/generate/interview")
def generate_interview(
    video_id: int,
    request: GenerationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    video, result = generate_from_transcript(
        video_id=video_id,
        custom_instructions=request.custom_instructions,
        generation_type="interview",
        db=db,
    )

    return {
        "video_id": video.id,
        "video_title": video.title,
        "generation_type": "interview",
        "result": result,
    }




@app.post("/videos/{video_id}/generate/notes")
def generate_notes(
    video_id: int,
    request: GenerationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    video, result = generate_from_transcript(
        video_id=video_id,
        custom_instructions=request.custom_instructions,
        generation_type="academic",
        db=db,
    )

    return {
        "video_id": video.id,
        "video_title": video.title,
        "generation_type": "academic",
        "result": result,
    }


@app.get("/videos/{video_id}/generated")
def get_generated_content(
    video_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    video = db.get(Video, video_id)

    if video is None:
        raise HTTPException(
            status_code=404,
            detail="Video not found.",
        )

    saved_items = db.scalars(
        select(GeneratedContent).where(
            GeneratedContent.video_id == video_id
        )
    ).all()

    results = {
        "notes": None,
        "interview": None,
    }

    for item in saved_items:
        if item.generation_type == "academic":
            results["notes"] = json.loads(item.result)
        elif item.generation_type == "interview":
            results["interview"] = json.loads(item.result)

    return {
        "video_id": video_id,
        **results,
    }
