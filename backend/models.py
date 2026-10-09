
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


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
