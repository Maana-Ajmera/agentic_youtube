
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://localhost:8000";

type Video = {
  id: number;
  title?: string;
  url?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  channel_name?: string;
};

type Playlist = {
  id: number;
  title?: string;
  name?: string;
  url?: string;
  playlist_url?: string;
  thumbnail_url?: string;
  videos?: Video[];
};

export default function HomePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"single" | "playlist">("single");
  const [videoUrl, setVideoUrl] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadVideos() {
    try {
      const response = await fetch(`${API}/videos`);
      if (!response.ok) throw new Error("Could not load videos");

      const data = await response.json();
      setVideos(Array.isArray(data) ? data : data.videos ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadPlaylists() {
    try {
      const response = await fetch(`${API}/playlists`);
      if (!response.ok) throw new Error("Could not load playlists");

      const data = await response.json();
      setPlaylists(Array.isArray(data) ? data : data.playlists ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void loadVideos();
    void loadPlaylists();
  }, []);

  async function addVideo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/videos/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to add video");
      }

      setVideoUrl("");
      await loadVideos();

      const video = data.video ?? data;
      if (video.id) {
        router.push(`/videos/${video.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function addPlaylist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/playlists/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: playlistUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to add playlist");
      }

      setPlaylistUrl("");
      await loadPlaylists();

      const playlist = data.playlist ?? data;
      if (playlist.id) {
        await openPlaylist(playlist.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function openPlaylist(playlistId: number) {
    setSelectedPlaylist(playlistId);
    setPlaylistVideos([]);
    setError("");

    try {
      const response = await fetch(`${API}/playlists/${playlistId}/videos`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to load playlist videos");
      }

      setPlaylistVideos(Array.isArray(data) ? data : data.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load playlist");
    }
  }

  function openVideo(video: Video) {
    router.push(`/videos/${video.id}`);
  }

  function getVideoUrl(video: Video) {
    return video.url ?? video.video_url ?? "";
  }

  function getPlaylistTitle(playlist: Playlist) {
    return playlist.title ?? playlist.name ?? "Untitled playlist";
  }

  function getPlaylistUrl(playlist: Playlist) {
    return playlist.url ?? playlist.playlist_url ?? "";
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
            Your AI learning workspace
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            YouTube Prep Interview
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Turn YouTube videos into academic notes and interview preparation
            material.
          </p>
        </header>

        <div className="mb-8 flex gap-3 border-b border-slate-800">
          <button
            onClick={() => {
              setActiveTab("single");
              setError("");
            }}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "single"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Single video
          </button>

          <button
            onClick={() => {
              setActiveTab("playlist");
              setError("");
            }}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "playlist"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Playlist
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {activeTab === "single" && (
          <section>
            <form onSubmit={addVideo} className="mb-10 flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                required
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="Paste a YouTube video URL..."
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add video"}
              </button>
            </form>

            <h2 className="mb-5 text-xl font-semibold">Your videos</h2>

            {videos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                No videos yet. Add a YouTube video to get started.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => openVideo(video)}
                    className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left transition hover:-translate-y-1 hover:border-violet-500/70"
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-slate-800 text-slate-500">
                        YouTube video
                      </div>
                    )}

                    <div className="p-5">
                      <h3 className="line-clamp-2 font-semibold group-hover:text-violet-300">
                        {video.title ?? "Untitled video"}
                      </h3>
                      {video.channel_name && (
                        <p className="mt-2 text-sm text-slate-400">
                          {video.channel_name}
                        </p>
                      )}
                      <p className="mt-4 text-sm font-medium text-violet-400">
                        Open preparation page →
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "playlist" && (
          <section>
            <form
              onSubmit={addPlaylist}
              className="mb-10 flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="url"
                required
                value={playlistUrl}
                onChange={(event) => setPlaylistUrl(event.target.value)}
                placeholder="Paste a YouTube playlist URL..."
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add playlist"}
              </button>
            </form>

            <h2 className="mb-5 text-xl font-semibold">Your playlists</h2>

            {playlists.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                No playlists yet. Add a YouTube playlist to get started.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                  >
                    <button
                      onClick={() =>
                        selectedPlaylist === playlist.id
                          ? setSelectedPlaylist(null)
                          : void openPlaylist(playlist.id)
                      }
                      className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-800/70"
                    >
                      {playlist.thumbnail_url ? (
                        <img
                          src={playlist.thumbnail_url}
                          alt=""
                          className="h-20 w-28 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-400">
                          Playlist
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">
                          {getPlaylistTitle(playlist)}
                        </h3>
                        <p className="mt-2 text-sm text-violet-400">
                          {selectedPlaylist === playlist.id
                            ? "Hide videos ↑"
                            : "View videos →"}
                        </p>
                      </div>
                    </button>

                    {selectedPlaylist === playlist.id && (
                      <div className="border-t border-slate-800 p-4">
                        {playlistVideos.length === 0 ? (
                          <p className="py-3 text-sm text-slate-400">
                            No videos found in this playlist.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {playlistVideos.map((video) => (
                              <button
                                key={video.id}
                                onClick={() => openVideo(video)}
                                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-800"
                              >
                                {video.thumbnail_url ? (
                                  <img
                                    src={video.thumbnail_url}
                                    alt=""
                                    className="h-14 w-24 shrink-0 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="h-14 w-24 shrink-0 rounded-lg bg-slate-800" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block line-clamp-2 text-sm font-medium">
                                    {video.title ?? "Untitled video"}
                                  </span>
                                  <span className="mt-1 block text-xs text-violet-400">
                                    Prepare this video →
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
