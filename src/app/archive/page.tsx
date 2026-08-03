"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TrackDnaPanel from "@/components/tracks/TrackDnaPanel";
import { usePlayerStore } from "@/lib/store";
import type { Track } from "@/lib/store";

interface ArchiveEntry {
  id: string;
  parentId: string | null;
  language: string | null;
  title: string;
  lyrics: string;
  prompt: string;
  notes: string;
  trackId: string | null;
  trackTitle: string | null;
  trackCoverUrl?: string | null;
  trackS3KeyCoverThumb?: string | null;
  // Full track data from joined query
  trackAudioUrl?: string | null;
  trackAudioUrlHd?: string | null;
  trackFormat?: string | null;
  trackFormatHd?: string | null;
  trackS3KeyHd?: string | null;
  trackDuration?: number | null;
  trackLyrics?: string | null;
  trackLyricsTimestamps?: string | null;
  trackProvider?: string | null;
  trackProviderModel?: string | null;
  trackStatus?: string | null;
  trackCreatedAt?: string | null;
  trackInstrumental?: boolean | null;
  trackArtistName?: string | null;
  createdAt: string;
  updatedAt: string;
  translations?: ArchiveEntry[];
}

function entryCoverSrc(entry: Pick<ArchiveEntry, "trackId" | "trackCoverUrl" | "trackS3KeyCoverThumb">): string | null {
  if (entry.trackCoverUrl) return entry.trackCoverUrl;
  if (entry.trackId && entry.trackS3KeyCoverThumb) return `/api/tracks/${entry.trackId}/cover?thumb=1`;
  return null;
}

function entryToTrack(entry: ArchiveEntry): Track | null {
  if (!entry.trackId || entry.trackStatus !== "done") return null;
  return {
    id: entry.trackId,
    title: entry.trackTitle ?? entry.title,
    provider: entry.trackProvider ?? "upload",
    providerModel: entry.trackProviderModel ?? "",
    prompt: entry.prompt,
    lyrics: entry.trackLyrics ?? entry.lyrics,
    language: null,
    translatedLyrics: null,
    translatedLanguage: null,
    status: "done",
    audioUrl: entry.trackAudioUrl ?? null,
    audioUrlHd: entry.trackAudioUrlHd ?? null,
    format: entry.trackFormat ?? null,
    formatHd: entry.trackFormatHd ?? null,
    duration: entry.trackDuration ?? null,
    createdAt: entry.trackCreatedAt ?? entry.createdAt,
    error: null,
    s3Key: null,
    s3KeyHd: entry.trackS3KeyHd ?? null,
    coverUrl: entry.trackCoverUrl ?? null,
    s3KeyCover: null,
    s3KeyCoverThumb: entry.trackS3KeyCoverThumb ?? null,
    rating: null,
    playCount: null,
    othersPlayCount: null,
    votedAt: null,
    instrumental: entry.trackInstrumental ?? null,
    artistName: entry.trackArtistName ?? null,
    composerName: null,
    writerName: null,
    lyricsTimestamps: entry.trackLyricsTimestamps ?? null,
    releaseStatus: null,
    publishDate: null,
    trackDna: null,
    audioDna: null,
    deletedAt: null,
  };
}

interface TrackOption {
  id: string;
  title: string | null;
}

type EditingTarget =
  | { mode: "new-original" }
  | { mode: "new-translation"; parentId: string; parentTitle: string }
  | { mode: "edit"; entry: ArchiveEntry };

function EntryEditor({
  target,
  onClose,
  onSaved,
}: {
  target: EditingTarget;
  onClose: () => void;
  onSaved: (entry: ArchiveEntry, parentId: string | null) => void;
}) {
  const existing = target.mode === "edit" ? target.entry : null;
  const isTranslation = target.mode === "new-translation" || !!existing?.parentId;

  const [title, setTitle] = useState(
    existing?.title || (target.mode === "new-translation" ? `${target.parentTitle} (translation)` : "")
  );
  const [language, setLanguage] = useState(existing?.language || "");
  const [lyrics, setLyrics] = useState(existing?.lyrics || "");
  const [prompt, setPrompt] = useState(existing?.prompt || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [trackId, setTrackId] = useState<string | null>(existing?.trackId ?? null);
  const [trackQuery, setTrackQuery] = useState(existing?.trackTitle || "");
  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [tracks, setTracks] = useState<TrackOption[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tracks !== null) return;
    fetch("/api/tracks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tracks) {
          setTracks(data.tracks.map((t: { id: string; title: string | null }) => ({ id: t.id, title: t.title })));
        }
      })
      .catch(() => {});
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    if (!tracks) return [];
    const q = trackQuery.trim().toLowerCase();
    if (!q) return tracks.slice(0, 20);
    return tracks.filter((t) => (t.title || "Untitled").toLowerCase().includes(q)).slice(0, 20);
  }, [tracks, trackQuery]);

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { title, lyrics, prompt, notes, trackId };
      if (isTranslation) payload.language = language;
      if (target.mode === "new-translation") payload.parentId = target.parentId;

      const res = await fetch(existing ? `/api/archive/${existing.id}` : "/api/archive", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Failed to save");
        return;
      }
      const selectedTrack = trackId ? tracks?.find((t) => t.id === trackId) : null;
      const parentId = target.mode === "new-translation" ? target.parentId : existing?.parentId ?? null;
      onSaved({ ...data.entry, trackTitle: selectedTrack?.title ?? null }, parentId);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#181822] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white/90">
          {existing ? (isTranslation ? "Edit translation" : "Edit master track entry") : isTranslation ? "New translation" : "New master track entry"}
        </h2>

        <div className={isTranslation ? "grid grid-cols-3 gap-3" : ""}>
          <div className={isTranslation ? "col-span-2" : ""}>
            <label className="block text-sm font-medium text-white/50 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title"
              className="input-field text-sm"
            />
          </div>
          {isTranslation && (
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English"
                className="input-field text-sm"
              />
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-white/50 mb-1">Linked track (optional)</label>
          <input
            type="text"
            value={trackQuery}
            onChange={(e) => {
              setTrackQuery(e.target.value);
              setTrackId(null);
              setShowTrackDropdown(true);
            }}
            onFocus={() => setShowTrackDropdown(true)}
            placeholder="Search your tracks…"
            className="input-field text-sm"
          />
          {trackId && (
            <button
              type="button"
              onClick={() => {
                setTrackId(null);
                setTrackQuery("");
              }}
              className="absolute right-2 top-8 text-xs text-white/40 hover:text-white/70"
            >
              Clear
            </button>
          )}
          {showTrackDropdown && filteredTracks.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#20202c] shadow-xl">
              {filteredTracks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTrackId(t.id);
                    setTrackQuery(t.title || "Untitled");
                    setShowTrackDropdown(false);
                  }}
                  className="block w-full truncate px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                >
                  {t.title || "Untitled"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white/50 mb-1">
            {isTranslation ? "Translated lyrics" : "Definitive lyrics"}
          </label>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={8}
            placeholder={isTranslation ? "Lyrics in the translated language" : "Final lyrics for this song"}
            className="input-field text-sm resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/50 mb-1">
            {isTranslation ? "Prompt / style (leave empty to reuse the original)" : "Definitive prompt / style"}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={isTranslation ? "Only fill in if the style/prompt changed for this version" : "Final style/prompt used for this song"}
            className="input-field text-sm resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/50 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. link to the Suno version, versioning notes…"
            className="input-field text-sm resize-y"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TranslationRow({
  translation,
  onEdit,
  onDelete,
}: {
  translation: ArchiveEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
      onClick={onEdit}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {translation.language && (
            <span className="shrink-0 rounded-full border border-primary-400/30 bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-300">
              {translation.language}
            </span>
          )}
          <h4 className="text-sm font-medium text-white/85 truncate">{translation.title}</h4>
          {translation.trackTitle && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
              Linked: {translation.trackTitle}
            </span>
          )}
        </div>
        {translation.lyrics && <p className="text-xs text-white/30 mt-1 line-clamp-1 whitespace-pre-line">{translation.lyrics}</p>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 p-1 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        aria-label="Delete translation"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

export default function ArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveEntry | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [dnaOpenIds, setDnaOpenIds] = useState<Set<string>>(new Set());

  const playTrackFromGesture = usePlayerStore((state) => state.playTrackFromGesture);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const enqueueTrack = usePlayerStore((state) => state.enqueueTrack);
  const clearQueue = usePlayerStore((state) => state.clearQueue);

  const playableTracks = useMemo<Track[]>(() => {
    const result: Track[] = [];
    for (const entry of entries) {
      const track = entryToTrack(entry);
      if (track) result.push(track);
    }
    return result;
  }, [entries]);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    await refetchEntries();
    setLoading(false);
  }

  async function refetchEntries() {
    const res = await fetch("/api/archive");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries || []);
    }
  }

  function handleSaved(entry: ArchiveEntry, parentId: string | null) {
    if (parentId) {
      setEntries((prev) =>
        prev.map((original) => {
          if (original.id !== parentId) return original;
          const translations = original.translations || [];
          const exists = translations.some((t) => t.id === entry.id);
          return {
            ...original,
            translations: exists
              ? translations.map((t) => (t.id === entry.id ? entry : t))
              : [...translations, entry],
          };
        })
      );
    } else {
      setEntries((prev) => {
        const exists = prev.some((e) => e.id === entry.id);
        if (exists) return prev.map((e) => (e.id === entry.id ? { ...entry, translations: e.translations } : e));
        return [{ ...entry, translations: [] }, ...prev];
      });
    }
    setEditingTarget(null);
    void refetchEntries();
  }

  async function handleDelete(entry: ArchiveEntry) {
    await fetch(`/api/archive/${entry.id}`, { method: "DELETE" });
    if (entry.parentId) {
      setEntries((prev) =>
        prev.map((original) =>
          original.id === entry.parentId
            ? { ...original, translations: (original.translations || []).filter((t) => t.id !== entry.id) }
            : original
        )
      );
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    }
    setDeleteTarget(null);
  }

  function handlePlayTrack(track: Track) {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      playTrackFromGesture(track);
    }
  }

  const handlePlayAll = useCallback(() => {
    if (playableTracks.length === 0) return;
    let ordered = shuffle
      ? [...playableTracks].sort(() => Math.random() - 0.5)
      : playableTracks;
    clearQueue();
    ordered.slice(1).forEach((t) => enqueueTrack(t));
    playTrackFromGesture(ordered[0]);
  }, [playableTracks, shuffle, clearQueue, enqueueTrack, playTrackFromGesture]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.lyrics.toLowerCase().includes(q) ||
        e.prompt.toLowerCase().includes(q) ||
        (e.translations || []).some((t) => t.title.toLowerCase().includes(q) || t.lyrics.toLowerCase().includes(q))
    );
  }, [entries, search]);

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={null} />
      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
          {/* Header card — matching library style */}
          <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(135deg,#11111a_0%,#0b0b11_100%)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Master Tracks</h1>
                  {entries.length > 0 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 shrink-0">
                      {entries.length} {entries.length === 1 ? "track" : "tracks"}{playableTracks.length > 0 ? ` · ${playableTracks.length} playable` : ""}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/40">
                  Your definitive lyrics &amp; prompt per song — one source of truth.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Play All */}
                {playableTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePlayAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors shadow-lg"
                    title="Play all master tracks"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Play All
                  </button>
                )}

                {/* Shuffle toggle */}
                <button
                  type="button"
                  onClick={() => setShuffle((v) => !v)}
                  className={`p-2 rounded-lg border transition-colors ${
                    shuffle
                      ? "border-primary-400/40 bg-primary-500/15 text-primary-300"
                      : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                  title="Shuffle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>

                {/* Repeat toggle */}
                <button
                  type="button"
                  onClick={() => setRepeat((v) => !v)}
                  className={`p-2 rounded-lg border transition-colors ${
                    repeat
                      ? "border-primary-400/40 bg-primary-500/15 text-primary-300"
                      : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                  title="Repeat"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* New entry */}
                <button
                  type="button"
                  onClick={() => setEditingTarget({ mode: "new-original" })}
                  className="btn-primary text-sm px-3 py-1.5"
                >
                  + New
                </button>
              </div>
            </div>
          </section>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search master tracks…"
            className="input-field text-sm"
          />

          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-white/40 italic py-8 text-center">
              {entries.length === 0 ? "No master track entries yet. Add your first definitive lyrics + prompt." : "No matches."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((entry) => {
                const playable = entryToTrack(entry);
                const isCurrent = currentTrack?.id === entry.trackId;
                return (
                  <div key={entry.id} className="section-card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      {/* Cover + play button */}
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0 group">
                          <div className="w-12 h-12 rounded-lg bg-white/[0.06] overflow-hidden flex items-center justify-center">
                            {entryCoverSrc(entry) ? (
                              <img src={entryCoverSrc(entry)!} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            )}
                          </div>
                          {playable && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handlePlayTrack(playable); }}
                              className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity ${
                                isCurrent ? "opacity-100 bg-black/50" : "opacity-0 group-hover:opacity-100 bg-black/60"
                              }`}
                            >
                              {isCurrent && isPlaying ? (
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>

                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => setEditingTarget({ mode: "edit", entry })}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-white truncate">{entry.title}</h3>
                            {entry.trackTitle && (
                              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">
                                Linked: {entry.trackTitle}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="shrink-0 flex items-center gap-1 text-[10px] text-primary-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                                Now playing
                              </span>
                            )}
                          </div>
                          {entry.prompt && <p className="text-xs text-white/40 mt-1 line-clamp-1">{entry.prompt}</p>}
                          {entry.lyrics && <p className="text-xs text-white/30 mt-1 line-clamp-2 whitespace-pre-line">{entry.lyrics}</p>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        className="shrink-0 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        aria-label="Delete entry"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {(entry.translations || []).length > 0 && (
                      <div className="space-y-1.5 pl-3 border-l-2 border-white/5">
                        {entry.translations!.map((translation) => (
                          <TranslationRow
                            key={translation.id}
                            translation={translation}
                            onEdit={() => setEditingTarget({ mode: "edit", entry: translation })}
                            onDelete={() => setDeleteTarget(translation)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Track DNA toggle + panel */}
                    {entry.trackId && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDnaOpenIds((prev) => {
                              const next = new Set(prev);
                              next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id);
                              return next;
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-primary-400/25 bg-primary-500/10 text-primary-200/90 transition-colors hover:bg-primary-500/20"
                          title={dnaOpenIds.has(entry.id) ? "Hide Track DNA" : "Show Track DNA"}
                        >
                          Track DNA
                          <svg
                            className={`w-2.5 h-2.5 shrink-0 transition-transform ${dnaOpenIds.has(entry.id) ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {dnaOpenIds.has(entry.id) && (
                          <TrackDnaPanel trackId={entry.trackId} />
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingTarget({ mode: "new-translation", parentId: entry.id, parentTitle: entry.title })}
                      className="flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add translation
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingTarget && (
        <EntryEditor target={editingTarget} onClose={() => setEditingTarget(null)} onSaved={handleSaved} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#181822] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-white/85">
              Delete <span className="font-semibold">{deleteTarget.title}</span>?
            </p>
            <p className="text-xs text-white/40 mt-1">This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteTarget)}
                className="rounded-lg bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
