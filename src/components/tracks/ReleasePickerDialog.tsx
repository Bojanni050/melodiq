"use client";

import { useState } from "react";
import { useReleaseStore } from "@/lib/store";
import type { TrackItem } from "./types";

const RELEASE_TYPES: { value: string; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

interface ReleasePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem;
  onAddToRelease: (releaseId: string, releaseName: string, isDuplicate: boolean) => void;
}

export default function ReleasePickerDialog({
  isOpen,
  onClose,
  track,
  onAddToRelease,
}: ReleasePickerDialogProps) {
  const releases = useReleaseStore((state) => state.releases);
  const createRelease = useReleaseStore((state) => state.createRelease);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("single");
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  function alreadyOnRelease(releaseId: string) {
    const release = releases.find((r) => r.id === releaseId);
    if (!release) return false;
    return release.tracks.some((t) => t.trackId === track.id);
  }

  function toggleRelease(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    for (const id of selected) {
      const release = releases.find((r) => r.id === id);
      if (!release) continue;
      onAddToRelease(id, release.title, alreadyOnRelease(id));
    }
    setSelected(new Set());
    onClose();
  }

  async function handleCreateRelease() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createRelease({ title: newTitle, type: newType });
      if (id) {
        onAddToRelease(id, newTitle.trim(), false);
      }
      setNewTitle("");
      setShowCreate(false);
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#181822] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-xl leading-none font-medium text-white/90">Add to Release</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close add to release menu"
          >
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {showCreate ? (
          <div className="px-5 pb-5 space-y-3">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreateRelease(); if (e.key === "Escape") setShowCreate(false); }}
              placeholder="Release title"
              maxLength={255}
              className="h-11 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25"
            />
            <div className="flex gap-2">
              {RELEASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewType(t.value)}
                  className={`h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${
                    newType === t.value ? "bg-primary-500/80 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-10 rounded-lg bg-white/8 px-4 text-sm font-medium text-white/60 transition-colors hover:bg-white/14 hover:text-white/90"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRelease}
                disabled={!newTitle.trim() || creating}
                className="h-10 rounded-lg bg-primary-500/80 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Creating…" : "Create & add"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[380px] overflow-y-auto px-3 pb-2">
              <div className="space-y-1">
                {releases.length === 0 ? (
                  <p className="text-sm text-white/40 italic px-3 py-6 text-center">No releases yet</p>
                ) : (
                  releases.map((release) => {
                    const fully = alreadyOnRelease(release.id);
                    const isChecked = selected.has(release.id);

                    return (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() => toggleRelease(release.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10 group"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/8 flex items-center justify-center">
                          {release.coverUrl ? (
                            <?xml encoding="UTF-8"?>
<?xml encoding="UTF-8"?>
<img loading="lazy" loading="lazy" src={release.coverUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          )}
                        </div>

                        <span className="min-w-0 flex-1 truncate leading-tight font-medium text-base">{release.title}</span>
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/50">
                          {release.type}
                        </span>
                        <span className="shrink-0 text-xs text-white/60">{release.tracks.length} tracks</span>

                        {fully && (
                          <svg className="shrink-0 w-4 h-4 text-primary-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}

                        <span
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-primary-500 border-primary-500"
                              : "border-white/20 group-hover:border-white/40"
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t border-white/10 px-5 pb-4 pt-3 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="h-12 flex-1 flex items-center gap-2.5 rounded-lg border border-white/70 px-3 text-sm font-medium text-white/45 hover:border-white hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create new release
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 rounded-lg bg-white/8 px-5 text-sm font-medium text-white/60 transition-colors hover:bg-white/14 hover:text-white/90"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className="h-12 rounded-lg bg-primary-500/80 px-5 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add{selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
