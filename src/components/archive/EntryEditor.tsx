"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArchiveEntry, EditingTarget, TrackOption } from "./types";

export default function EntryEditor({
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
