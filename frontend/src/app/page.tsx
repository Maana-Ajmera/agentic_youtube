
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
type Video = {
  id: number;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
};

type Playlist = {
  id: number;
  youtube_playlist_id: string;
  title: string;
  videos_count: number;
};

const API_URL = "http://localhost:8000";

function isValidYouTubeUrl(value: string, mode: "video" | "playlist") {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (
      !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)
    ) {
      return false;
    }

    if (mode === "playlist") {
      return (
        host !== "youtu.be" &&
        url.pathname === "/playlist" &&
        Boolean(url.searchParams.get("list"))
      );
    }

    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") ?? "";
    } else {
      videoId =
        url.pathname.match(/^\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]+)/)?.[1] ?? "";
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  } catch {
    return false;
  }
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "Duration unavailable";

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [mode, setMode] = useState<"video" | "playlist">("video");
  const [url, setUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [expandedPlaylist, setExpandedPlaylist] = useState<number | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<Record<number, Video[]>>({});
  const [loadingPlaylist, setLoadingPlaylist] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchVideos = useCallback(async () => {
    const response = await fetch(`${API_URL}/videos`);
    if (!response.ok) throw new Error("Could not fetch videos.");

    const data = await response.json();
    setVideos(data.videos);
  }, []);

  const fetchPlaylists = useCallback(async () => {
    const response = await fetch(`${API_URL}/playlists`);
    if (!response.ok) throw new Error("Could not fetch playlists.");

    const data = await response.json();
    setPlaylists(data.playlists);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      await Promise.all([fetchVideos(), fetchPlaylists()]);
      setError("");
    } catch {
      setError("Cannot connect to the backend. Is FastAPI running?");
    }
  }, [fetchVideos, fetchPlaylists]);

  useEffect(() => {
  let cancelled = false;

  async function loadData() {
    try {
      const [videosResponse, playlistsResponse] = await Promise.all([
        fetch(`${API_URL}/videos`),
        fetch(`${API_URL}/playlists`),
      ]);

      if (!videosResponse.ok || !playlistsResponse.ok) {
        throw new Error("Could not load saved content.");
      }

      const [videosData, playlistsData] = await Promise.all([
        videosResponse.json(),
        playlistsResponse.json(),
      ]);

      if (!cancelled) {
        setVideos(videosData.videos);
        setPlaylists(playlistsData.playlists);
        setError("");
      }
    } catch {
      if (!cancelled) {
        setError("Cannot connect to the backend. Is FastAPI running?");
      }
    }
  }

  loadData();

  return () => {
    cancelled = true;
  };
}, []);

  async function togglePlaylist(playlist: Playlist) {
    if (expandedPlaylist === playlist.id) {
      setExpandedPlaylist(null);
      return;
    }

    setExpandedPlaylist(playlist.id);
    setError("");

    if (playlistVideos[playlist.id]) return;

    setLoadingPlaylist(playlist.id);

    try {
      const response = await fetch(
        `${API_URL}/playlists/${playlist.id}/videos`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load playlist videos.");
      }

      setPlaylistVideos((previous) => ({
        ...previous,
        [playlist.id]: data.videos,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load playlist videos."
      );
    } finally {
      setLoadingPlaylist(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isValidYouTubeUrl(url.trim(), mode)) {
      setError(
        mode === "video"
          ? "Enter a valid YouTube video URL."
          : "Enter a valid YouTube playlist URL."
      );
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "video" ? "/videos/ingest" : "/playlists/ingest";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not ingest this URL.");
      }

      setMessage(data.message);
      setUrl("");

      // Refresh lists and clear cached playlist contents after ingestion.
      setPlaylistVideos({});
      setExpandedPlaylist(null);
      await refreshData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">YouTube Prep Interview</h1>
        <p className="mt-2 text-slate-400">
          Organize videos and playlists for your interview preparation.
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setMode("video");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg px-4 py-2 ${
              mode === "video" ? "bg-blue-600" : "bg-slate-800"
            }`}
          >
            Single video
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("playlist");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg px-4 py-2 ${
              mode === "playlist" ? "bg-blue-600" : "bg-slate-800"
            }`}
          >
            Playlist
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={
              mode === "video"
                ? "Paste a YouTube video URL"
                : "Paste a YouTube playlist URL"
            }
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {loading
              ? "Adding..."
              : mode === "video"
                ? "Add Video"
                : "Add Playlist"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-red-400">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-4 text-green-400">
            {message}
          </p>
        )}
{mode === "video" && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">
            Saved Videos ({videos.length})
          </h2>

          {videos.length === 0 ? (
            <p className="mt-4 text-slate-400">No standalone videos saved yet.</p>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <article
                  key={video.id}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
                >
                  {video.thumbnail_url && (
                    <Image
  src={video.thumbnail_url}
  alt={`Thumbnail for ${video.title}`}
  width={640}
  height={360}
  unoptimized
  className="aspect-video w-full object-cover"
/>
                  )}

                  <div className="p-4">
                    <h3 className="font-medium">{video.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      {formatDuration(video.duration_seconds)}
                    </p>
                    <a
                      href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-sm text-blue-400 hover:underline"
                    >
                      Watch on YouTube ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
)}
{mode === "playlist" && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">
            Saved Playlists ({playlists.length})
          </h2>

          {playlists.length === 0 ? (
            <p className="mt-4 text-slate-400">No playlists saved yet.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {playlists.map((playlist) => {
                const isExpanded = expandedPlaylist === playlist.id;
                const loadedVideos = playlistVideos[playlist.id];

                return (
                  <article
                    key={playlist.id}
                    className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
                  >
                    <button
                      type="button"
                      onClick={() => togglePlaylist(playlist)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-800/70"
                    >
                      <div className="min-w-0">
                        <h3 className="font-semibold">{playlist.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {playlist.videos_count} videos ·{" "}
                          {isExpanded ? "Click to collapse" : "Click to view videos"}
                        </p>
                      </div>

                      <span className="text-xl" aria-hidden="true">
                        {isExpanded ? "−" : "+"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-800 p-4">
                        {loadingPlaylist === playlist.id ? (
                          <p className="text-slate-400">Loading playlist videos...</p>
                        ) : loadedVideos ? (
                          loadedVideos.length === 0 ? (
                            <p className="text-slate-400">
                              No videos are available in this playlist.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {loadedVideos.map((video, index) => (
                                <div
                                  key={video.id}
                                  className="flex items-center gap-4 rounded-lg p-2 hover:bg-slate-800/70"
                                >
                                  <span className="w-5 shrink-0 text-sm text-slate-400">
                                    {index + 1}
                                  </span>

                                  {video.thumbnail_url ? (
                                    <Image
  src={video.thumbnail_url}
  alt=""
  width={320}
  height={180}
  unoptimized
  className="aspect-video w-32 shrink-0 rounded-md object-cover"
/>
                                  ) : (
                                    <div className="flex aspect-video w-32 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs text-slate-500">
                                      No thumbnail
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <h4 className="line-clamp-2 text-sm font-medium">
                                      {video.title}
                                    </h4>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {formatDuration(video.duration_seconds)}
                                    </p>
                                    <a
                                      href={`https://www.youtube.com/watch?v=${video.youtube_video_id}&list=${playlist.youtube_playlist_id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 inline-block text-sm text-blue-400 hover:underline"
                                    >
                                      Watch ↗
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          <p className="text-slate-400">
                            Open the playlist to load its videos.
                          </p>
                        )}

                        <a
                          href={`https://www.youtube.com/playlist?list=${playlist.youtube_playlist_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-block text-sm text-blue-400 hover:underline"
                        >
                          Open full playlist on YouTube ↗
                        </a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
  )}
      </div>
    </main>
  );
}
