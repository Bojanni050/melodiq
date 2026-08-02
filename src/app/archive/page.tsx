"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";

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
  createdAt: string;
  updatedAt: string;
  translations?: ArchiveEntry[];
}

function entryCoverSrc(entry: Pick<ArchiveEntry, "trackId" | "trackCoverUrl" | "trackS3KeyCoverThumb">): string | null {
  if (entry.trackCoverUrl) return entry.trackCoverUrl;
  if (entry.trackId && entry.trackS3KeyCoverThumb) return `/api/tracks/${entry.trackId}/cover?thumb=1`;
  return null;
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
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">Master Tracks</h1>
              <p className="text-sm text-white/40 mt-0.5">
                Your definitive lyrics &amp; prompt per song — one source of truth, whether it was made in MelodIQ or Suno directly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingTarget({ mode: "new-original" })}
              className="btn-primary text-sm px-3 py-1.5 shrink-0"
            >
              + New
            </button>
          </div>
        </div>

        <main className="p-4 max-w-3xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search master tracks…"
            className="input-field text-sm mb-4"
          />

          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-white/40 italic py-8 text-center">
              {entries.length === 0 ? "No master track entries yet. Add your first definitive lyrics + prompt." : "No matches."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((entry) => (
                <div key={entry.id} className="section-card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="min-w-0 flex-1 flex items-start gap-3 cursor-pointer"
                      onClick={() => setEditingTarget({ mode: "edit", entry })}
                    >
                      <div className="shrink-0 w-12 h-12 rounded-lg bg-white/[0.06] overflow-hidden flex items-center justify-center">
                        {entryCoverSrc(entry) ? (
                          <img src={entryCoverSrc(entry)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white truncate">{entry.title}</h3>
                          {entry.trackTitle && (
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">
                              Linked: {entry.trackTitle}
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
              ))}
            </div>
          )}
        </main>
      </div>

      {editingTarget && (
        <EntryEditor target={editingTarget} onClose={() => setEditingTarget(null)} onSaved={handleSaved} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-96 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-white/80 leading-relaxed">
              Delete &ldquo;{deleteTarget.title}&rdquo;
              {deleteTarget.parentId ? "" : " and all its translations"} from Master Tracks? This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
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
                className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-1.5 text-sm text-red-200 transition-colors hover:bg-red-500/20"
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
