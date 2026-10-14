
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

type AcademicNotes = {
  title?: string;
  summary?: string;
  key_concepts?: unknown;
  detailed_notes?: unknown;
  revision_points?: unknown;
};

type InterviewQuestion = {
  question: string;
  answer: string;
  difficulty?: string;
  topic?: string;
  follow_up_questions?: string[];
};

type InterviewResult = {
  title?: string;
  questions?: InterviewQuestion[];
};

function displayContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

export default function VideoPreparationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [video, setVideo] = useState<Video | null>(null);
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState<AcademicNotes | null>(null);
  const [interview, setInterview] = useState<InterviewResult | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([]);
  const [loading, setLoading] = useState<"notes" | "interview" | null>(null);
  const [error, setError] = useState("");
  const [loadingVideo, setLoadingVideo] = useState(true);

  const videoId = params.id;

  const findVideo = useCallback(async () => {
    const response = await fetch(`${API}/videos`);
    if (!response.ok) {
      throw new Error("Could not load saved videos.");
    }

    const data = await response.json();
    const standaloneVideos: Video[] = Array.isArray(data)
      ? data
      : data.videos ?? [];

    const directMatch = standaloneVideos.find(
      (item) => String(item.id) === videoId
    );

    if (directMatch) return directMatch;

    const playlistResponse = await fetch(`${API}/playlists`);
    if (!playlistResponse.ok) {
      throw new Error("Could not load playlists.");
    }

    const playlistData = await playlistResponse.json();
    const playlists = Array.isArray(playlistData)
      ? playlistData
      : playlistData.playlists ?? [];

    for (const playlist of playlists) {
      const response = await fetch(
        `${API}/playlists/${playlist.id}/videos`
      );

      if (!response.ok) continue;

      const result = await response.json();
      const playlistVideoList: Video[] = Array.isArray(result)
        ? result
        : result.videos ?? [];

      const match = playlistVideoList.find(
        (item) => String(item.id) === videoId
      );

      if (match) return match;
    }

    return null;
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingVideo(true);
      setError("");

      try {
        const found = await findVideo();

        
if (!cancelled) {
  setVideo(found);

  if (!found) {
    setError(
      "Video nahi mila. Ho sakta hai video save na hua ho ya uski ID invalid ho."
    );
  }
}

if (found) {
  try {
    const response = await fetch(
      `${API}/videos/${found.id}/generated`
    );

    if (!response.ok) {
      throw new Error("Could not load saved preparation.");
    }

    const data = await response.json();

    if (!cancelled) {
      setNotes(data.notes ?? null);
      setInterview(data.interview ?? null);
    }
  } catch (err) {
    if (!cancelled) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load saved preparation."
      );
    }
  }
}

      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load video."
          );
        }
      } finally {
        if (!cancelled) setLoadingVideo(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [findVideo]);

  async function prepare(type: "notes" | "interview") {
    if (!video) return;

    setLoading(type);
    setError("");
    

    try {
      // First, check whether a transcript has already been saved.
      const transcriptResponse = await fetch(
        `${API}/videos/${video.id}/transcript`
      );

      // Extract and save the transcript only when it is missing.
      if (transcriptResponse.status === 404) {
        const extractResponse = await fetch(
          `${API}/videos/${video.id}/transcript`,
          { method: "POST" }
        );

        if (!extractResponse.ok) {
          const data = await extractResponse.json().catch(() => ({}));
          throw new Error(
            data.detail ?? "Transcript extraction failed."
          );
        }
      } else if (!transcriptResponse.ok) {
        const data = await transcriptResponse.json().catch(() => ({}));
        throw new Error(data.detail ?? "Could not retrieve transcript.");
      }

      const endpoint =
        type === "notes" ? "notes" : "interview";

      const response = await fetch(
        `${API}/videos/${video.id}/generate/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            custom_instructions: instructions.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? `Could not generate ${endpoint}.`
        );
      }

      const result = data.result ?? data;

    if (type === "notes") {
    setNotes(result);
    } else {
    setInterview(result);
    }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  function toggleQuestion(index: number) {
    setExpandedQuestions((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  }

  if (loadingVideo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading video...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/")}
          className="mb-8 text-sm font-medium text-violet-400 transition hover:text-violet-300"
        >
          ← Back to home
        </button>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!video ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h1 className="text-xl font-semibold">Video unavailable</h1>
            <p className="mt-3 text-slate-400">
              Check that the video exists in your saved videos or playlists.
            </p>
          </div>
        ) : (
          <>
            <header className="mb-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
                Video preparation
              </p>
              <h1 className="text-3xl font-bold sm:text-4xl">
                {video.title ?? "Untitled video"}
              </h1>
              {video.channel_name && (
                <p className="mt-2 text-slate-400">{video.channel_name}</p>
              )}
            </header>

            {video.thumbnail_url && (
              <div className="mb-8 overflow-hidden rounded-2xl border border-slate-800">
                <img
                  src={video.thumbnail_url}
                  alt="Video thumbnail"
                  className="aspect-video w-full object-cover"
                />
              </div>
            )}

            <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
              <h2 className="text-xl font-semibold">
                Customize your preparation
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Optional: tell the AI what to focus on. For example, ask for
                beginner-friendly explanations, coding examples, or
                company-specific interview questions.
              </p>

              <label
                htmlFor="instructions"
                className="mb-2 mt-5 block text-sm font-medium text-slate-300"
              >
                Custom instructions
              </label>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="e.g. Explain concepts step by step and include practical examples..."
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-violet-500"
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void prepare("notes")}
                  disabled={loading !== null}
                  className="rounded-xl bg-violet-600 px-5 py-4 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === "notes"
                    ? "Generating academic notes..."
                    : "Generate Academic Notes"}
                </button>

                <button
                  onClick={() => void prepare("interview")}
                  disabled={loading !== null}
                  className="rounded-xl border border-violet-500 px-5 py-4 font-semibold text-violet-300 transition hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === "interview"
                    ? "Generating interview prep..."
                    : "Generate Interview Prep"}
                </button>
              </div>

             
            </section>

            
{notes && (
  <section className="mb-8 space-y-6">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-violet-400">
        Academic Preparation
      </p>
      <h2 className="mt-2 text-3xl font-bold">
        {notes.title ?? "Academic Notes"}
      </h2>
    </div>

    {/* Summary */}
    {notes.summary && (
      <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-3 text-xl font-semibold text-violet-300">
          Summary
        </h3>
        <p className="whitespace-pre-wrap leading-7 text-slate-300">
          {notes.summary}
        </p>
      </article>
    )}

    {/* Key Concepts */}
    {Array.isArray(notes.key_concepts) &&
      notes.key_concepts.length > 0 && (
        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 text-xl font-semibold text-violet-300">
            Key Concepts
          </h3>

          <div className="space-y-4">
            {(
              notes.key_concepts as {
                concept: string;
                explanation: string;
              }[]
            ).map((item, index) => (
              <div
                key={`${item.concept}-${index}`}
                className="border-l-2 border-violet-500 pl-4"
              >
                <h4 className="font-semibold text-white">
                  {item.concept}
                </h4>
                <p className="mt-1 leading-7 text-slate-300">
                  {item.explanation}
                </p>
              </div>
            ))}
          </div>
        </article>
      )}

    {/* Detailed Notes */}
    {Array.isArray(notes.detailed_notes) &&
      notes.detailed_notes.length > 0 && (
        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 text-xl font-semibold text-violet-300">
            Detailed Notes
          </h3>

          <div className="space-y-5">
            {(
              notes.detailed_notes as {
                heading: string;
                content: string;
              }[]
            ).map((item, index) => (
              <div key={`${item.heading}-${index}`}>
                <h4 className="mb-2 font-semibold text-white">
                  {item.heading}
                </h4>
                <p className="whitespace-pre-wrap leading-7 text-slate-300">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </article>
      )}

    {/* Revision Points */}
    {Array.isArray(notes.revision_points) &&
      notes.revision_points.length > 0 && (
        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 text-xl font-semibold text-violet-300">
            Revision Points
          </h3>

          <ul className="space-y-3">
            {(notes.revision_points as string[]).map(
              (point, index) => (
                <li
                  key={index}
                  className="flex gap-3 leading-7 text-slate-300"
                >
                  <span className="font-bold text-violet-400">
                    {index + 1}.
                  </span>
                  <span>{point}</span>
                </li>
              )
            )}
          </ul>
        </article>
      )}

    {/* Fallback if the API returns a different structure */}
    {!notes.summary &&
      !(
        Array.isArray(notes.key_concepts) &&
        notes.key_concepts.length
      ) &&
      !(
        Array.isArray(notes.detailed_notes) &&
        notes.detailed_notes.length
      ) &&
      !(
        Array.isArray(notes.revision_points) &&
        notes.revision_points.length
      ) && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          Notes ka response mila, lekin expected fields nahi mile.
          Browser console aur Network response check karo.
        </p>
      )}
  </section>
)}


            {interview && (
              <section className="mb-8 space-y-5">
                <h2 className="text-2xl font-bold">
                  {interview.title ?? "Interview Preparation"}
                </h2>

                {!interview.questions?.length && (
                  <p className="text-slate-400">
                    No questions were returned. Try generating again.
                  </p>
                )}

                {interview.questions?.map((item, index) => (
                  <article
                    key={`${index}-${item.question}`}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                  >
                    <button
                      onClick={() => toggleQuestion(index)}
                      className="flex w-full items-start justify-between gap-4 p-5 text-left"
                    >
                      <span>
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-violet-400">
                          Question {index + 1}
                          {item.difficulty ? ` · ${item.difficulty}` : ""}
                        </span>
                        <span className="font-semibold leading-6">
                          {item.question}
                        </span>
                        {item.topic && (
                          <span className="mt-2 block text-xs text-slate-500">
                            Topic: {item.topic}
                          </span>
                        )}
                      </span>
                      <span className="text-xl text-violet-400">
                        {expandedQuestions.includes(index) ? "−" : "+"}
                      </span>
                    </button>

                    {expandedQuestions.includes(index) && (
                      <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                        <h3 className="mb-2 font-semibold text-violet-300">
                          Answer
                        </h3>
                        <p className="whitespace-pre-wrap leading-7 text-slate-300">
                          {item.answer}
                        </p>

                        {!!item.follow_up_questions?.length && (
                          <div className="mt-5">
                            <h3 className="mb-2 font-semibold text-violet-300">
                              Follow-up Questions
                            </h3>
                            <ul className="list-inside list-disc space-y-2 text-slate-300">
                              {item.follow_up_questions.map((question, i) => (
                                <li key={`${i}-${question}`}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
