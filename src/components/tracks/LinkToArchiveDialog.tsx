"use client";

import { useEffect, useMemo, useState } from "react";
import { useArchiveLinksStore } from "@/lib/store";
import type { TrackItem } from "./types";

interface ArchiveEntryOption {
  id: string;
  title: string;
  language: string | null;
  parentId: string | null;
  parentTitle: string | null;
  trackId: string | null;
  trackTitle: string | null;
}

interface LinkToArchiveDialogProps {
  isOpen: boolean;
  track: TrackItem;
  onClose: () => void;
}

export default function LinkToArchiveDialog({ isOpen, track, onClose }: LinkToArchiveDialogProps) {
  const [entries, setEntries] = useState<ArchiveEntryOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [attaching, setAttaching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const setLink = useArchiveLinksStore((state) => state.setLink);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setError(null);
    setShowCreateForm(false);
    setNewTitle((track.title || track.prompt.substring(0, 50)).replace(/\s*\(2\)\s*$/, ""));
    fetch("/api/archive")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.entries) return;
        const flat: ArchiveEntryOption[] = [];
        for (const entry of data.entries) {
          flat.push({
            id: entry.id,
            title: entry.title,
            language: null,
            parentId: null,
            parentTitle: null,
            trackId: entry.trackId,
            trackTitle: entry.trackTitle,
          });
          for (const translation of entry.translations || []) {
            flat.push({
              id: translation.id,
              title: translation.title,
              language: translation.language,
              parentId: entry.id,
              parentTitle: entry.title,
              trackId: translation.trackId,
              trackTitle: translation.trackTitle,
            });
          }
        }
        setEntries(flat);
      })
      .catch(() => setEntries([]));
  }, [isOpen, track.title, track.prompt]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.title.toLowerCase().includes(q) || (e.parentTitle || "").toLowerCase().includes(q));
  }, [entries, query]);

  async function handleAttach(entry: ArchiveEntryOption) {
    setAttaching(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/archive/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to link track");
        return;
      }
      setLink(track.id, entry.parentId ? "translation" : "original");
      onClose();
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setAttaching(null);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) {
      setError("Title is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          lyrics: track.lyrics || "",
          prompt: track.prompt,
          trackId: track.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to create entry");
        return;
      }
      setLink(track.id, "original");
      onClose();
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#181822] p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold text-white/90">Link to Master Tracks</h3>
          <p className="text-xs text-white/40 mt-0.5 truncate">
            {track.title || track.prompt.substring(0, 60)}
          </p>
        </div>

        {!showCreateForm ? (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Master Tracks entries…"
              className="input-field text-sm"
              autoFocus
            />

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {entries === null ? (
                <p className="text-sm text-white/40 py-4 text-center">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-white/40 italic py-4 text-center">No matching entries.</p>
              ) : (
                filtered.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleAttach(entry)}
                    disabled={attaching !== null}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.language && (
                        <span className="shrink-0 rounded-full border border-primary-400/30 bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-300">
                          {entry.language}
                        </span>
                      )}
                      <span className="text-sm text-white/85 truncate">{entry.title}</span>
                    </div>
                    {entry.parentTitle && (
                      <p className="text-[11px] text-white/35 mt-0.5">Translation of &ldquo;{entry.parentTitle}&rdquo;</p>
                    )}
                    {entry.trackId && entry.trackId !== track.id && (
                      <p className="text-[11px] text-amber-300/70 mt-0.5">
                        Already linked to &ldquo;{entry.trackTitle || "another track"}&rdquo; — attaching will replace it
                      </p>
                    )}
                    {entry.trackId === track.id && (
                      <p className="text-[11px] text-green-300/70 mt-0.5">Already linked to this track</p>
                    )}
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create new Master Tracks entry from this track
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-white/50 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Song title"
                className="input-field text-sm"
                autoFocus
              />
              <p className="text-xs text-white/30 mt-1.5">
                Lyrics and prompt will be pre-filled from this track — you can refine them afterwards in Master Tracks.
              </p>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                ← Back to search
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating…" : "Create & link"}
              </button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
