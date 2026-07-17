"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import { usePlaylistStore } from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";

interface SongDetail {
  id: string;
  title: string | null;
  prompt: string | null;
  lyrics: string | null;
  notes: string;
  songDna: string | null;
  votingEnabled: boolean;
  releaseStatus: string;
  publishDate: string | null;
  workspaceId: string | null;
  createdAt: string;
  trackVersions: TrackItem[];
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 min-w-[110px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white truncate">{value}</p>
    </div>
  );
}

export default function SongDnaPage() {
  const params = useParams<{ songId: string }>();
  const router = useRouter();
  const songId = params?.songId;

  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();

  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingTrack, setEditingTrack] = useState<TrackItem | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [songDna, setSongDna] = useState("");
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [releaseStatus, setReleaseStatus] = useState("concept");
  const [publishDate, setPublishDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!songId) return;
    let active = true;

    async function fetchSong() {
      const res = await fetch(`/api/songs/${songId}`);
      if (!active) return;

      if (res.ok) {
        const data = await res.json();
        const s: SongDetail = data.song;
        setSong(s);
        setTitle(s.title ?? "");
        setLyrics(s.lyrics ?? "");
        setPrompt(s.prompt ?? "");
        setNotes(s.notes ?? "");
        setSongDna(s.songDna ?? "");
        setVotingEnabled(s.votingEnabled ?? false);
        setReleaseStatus(s.releaseStatus ?? "concept");
        setPublishDate(s.publishDate ? s.publishDate.slice(0, 10) : "");
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }

    fetchSong();
    void loadPlaylists();

    return () => {
      active = false;
    };
  }, [songId, loadPlaylists]);

  async function handleSaveSongInfo() {
    if (!songId) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          lyrics: lyrics.trim() || null,
          prompt: prompt.trim() || null,
          notes,
          songDna: songDna.trim() || null,
          votingEnabled,
          releaseStatus,
          publishDate: publishDate ? new Date(publishDate).toISOString() : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSong((prev) => (prev ? { ...prev, ...data.song } : prev));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("[song-dna] save failed", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTrack(trackId: string) {
    const res = await fetch(`/api/tracks/${trackId}`, { method: "DELETE" });
    if (res.ok) {
      setSong((prev) =>
        prev ? { ...prev, trackVersions: prev.trackVersions.filter((t) => t.id !== trackId) } : prev
      );
    }
  }

  const stats = useMemo(() => {
    if (!song) return null;
    const versions = song.trackVersions;
    const totalPlays = versions.reduce((sum, t) => sum + (t.playCount ?? 0), 0);
    const votedVersion = versions.find((t) => t.votedAt);
    // A version counts as published either individually, or because
    // publishing the whole song (Release Status above) makes every version
    // publicly reachable — mirrors PUBLIC_TRACK_CONDITION in lib/songs.ts,
    // so this tile stays in sync with the Release Status control.
    const songPublished = song.releaseStatus === "published";
    const publishedCount = versions.filter((t) => t.releaseStatus === "published" || songPublished).length;

    // Best-version highlight (mirrors the "crown marks the best value" idea
    // from a compare view) — only meaningful with more than one version.
    const mostPlayed =
      versions.length > 1
        ? versions.reduce((best, t) => ((t.playCount ?? 0) > (best.playCount ?? 0) ? t : best), versions[0])
        : null;
    // versions is ordered oldest-first (see getUserSongWithTrackVersions),
    // so index+1 gives a stable version number even when titles repeat.
    const mostPlayedIndex = mostPlayed ? versions.findIndex((t) => t.id === mostPlayed.id) : -1;

    return {
      versionCount: versions.length,
      totalPlays,
      votedTitle: votedVersion ? votedVersion.title || "Untitled" : "None yet",
      publishedCount,
      mostPlayedTitle:
        mostPlayed && (mostPlayed.playCount ?? 0) > 0
          ? `${mostPlayed.title || "Untitled"} · v${mostPlayedIndex + 1}`
          : null,
    };
  }, [song]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f] text-white">
        <Sidebar credits={null} />
        <main className="flex-1 flex items-center justify-center text-sm text-white/50">Loading song...</main>
      </div>
    );
  }

  if (notFound || !song) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f] text-white">
        <Sidebar credits={null} />
        <main className="flex-1 flex items-center justify-center text-sm text-white/50">Song not found.</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      <Sidebar credits={null} />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-6 pb-16">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <p className="mt-3 text-xs uppercase tracking-[0.28em] text-white/35">Song DNA</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight truncate">{song.title || "Untitled Song"}</h1>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            <StatTile label="Versions" value={stats!.versionCount} />
            <StatTile label="Total Plays" value={stats!.totalPlays} />
            <StatTile label="Current Pick" value={stats!.votedTitle} />
            <StatTile label="Published Versions" value={stats!.publishedCount} />
            {stats!.mostPlayedTitle && <StatTile label="🏆 Most Played" value={stats!.mostPlayedTitle} />}
          </div>

          {/* Song info */}
          <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Song Info</h2>
              <div className="flex items-center gap-2">
                {saved && <span className="text-xs text-green-300">Saved</span>}
                <button
                  type="button"
                  onClick={handleSaveSongInfo}
                  disabled={saving}
                  className="h-9 rounded-full bg-white px-5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/60">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
                className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-white/60">Release Status</label>
                <select
                  value={releaseStatus}
                  onChange={(e) => setReleaseStatus(e.target.value)}
                  className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                >
                  <option value="concept">Concept</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/60">Publish Date</label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">Voting Round</p>
                <p className="text-xs text-white/45">Let versions of this song be voted on</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={votingEnabled}
                onClick={() => setVotingEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${votingEnabled ? "bg-primary-500" : "bg-white/15"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${votingEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/60">Prompt / Style</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Style, mood, genre..."
                className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/60">Lyrics</label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={8}
                placeholder="Paste lyrics here..."
                className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/60">Song DNA</label>
              <textarea
                value={songDna}
                onChange={(e) => setSongDna(e.target.value)}
                rows={4}
                placeholder="The core identity of this song — what should stay consistent across every version..."
                className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/60">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes for yourself or collaborators..."
                className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none"
              />
            </div>
          </section>

          {/* Track versions */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              Track Versions <span className="text-sm font-normal text-white/40">({song.trackVersions.length})</span>
            </h2>
            {song.trackVersions.length > 0 ? (
              <TrackList
                tracks={song.trackVersions}
                autoQueueAfterPlay
                selectedTrackId={selectedTrackId}
                onSelect={(track) => setSelectedTrackId(track.id)}
                onDelete={handleDeleteTrack}
                onAddToPlaylist={(trackId, playlistId, options) => addTrackToPlaylist(playlistId, trackId, options)}
                playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                onTitleUpdate={(trackId, newTitle) =>
                  setSong((prev) =>
                    prev
                      ? {
                          ...prev,
                          trackVersions: prev.trackVersions.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)),
                        }
                      : prev
                  )
                }
                onEditDetails={(track) => setEditingTrack(track)}
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                No track versions yet.
              </div>
            )}
          </section>
        </div>
      </main>

      {editingTrack && (
        <TrackEditPanel
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSaved={(updated) => {
            setSong((prev) =>
              prev
                ? {
                    ...prev,
                    trackVersions: prev.trackVersions.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
                  }
                : prev
            );
            setEditingTrack(null);
          }}
        />
      )}
    </div>
  );
}
