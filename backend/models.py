
from sqlalchemy import String, Integer, ForeignKey, Text, DateTime , func
from sqlalchemy.orm import Mapped, mapped_column, relationship 

from database import Base
from datetime import datetime

class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    youtube_playlist_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)

    videos: Mapped[list["Video"]] = relationship(
        back_populates="playlist"
    )


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    youtube_video_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)

    playlist_id: Mapped[int | None] = mapped_column(
        ForeignKey("playlists.id"), nullable=True
    )

    playlist: Mapped["Playlist | None"] = relationship(
        back_populates="videos"
    )
    transcript: Mapped["Transcript | None"] = relationship(
        back_populates="video",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    video_id: Mapped[int] = mapped_column(
        ForeignKey("videos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    text: Mapped[str] = mapped_column(Text, nullable=False)

    language: Mapped[str | None] = mapped_column(String(50))
    source: Mapped[str | None] = mapped_column(String(50))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    video: Mapped["Video"] = relationship(
        back_populates="transcript"
    )


class GeneratedContent(Base):
    __tablename__ = "generated_contents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    video_id: Mapped[int] = mapped_column(
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    generation_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    result: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    video: Mapped["Video"] = relationship()
