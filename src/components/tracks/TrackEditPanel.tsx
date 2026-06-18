"use client";

import { useState } from "react";
import type { TrackItem } from "./types";

const PROVIDERS = [
  { value: "upload", label: "Unknown / Other" },
  { value: "suno", label: "Suno" },
  { value: "mureka", label: "Mureka" },
  { value: "udio", label: "Udio" },
  { value: "poyo", label: "PoYo" },
  { value: "tempolor", label: "Tempolor" },
  { value: "musicgpt", label: "MusicGPT" },
  { value: "lyria", label: "Lyria 3" },
];

interface TrackEditPanelProps {
  track: TrackItem;
  onClose: () => void;
  onSaved: (updated: TrackItem) => void;
}

export default function TrackEditPanel({ track, onClose, onSaved }: TrackEditPanelProps) {
  const [title, setTitle] = useState(track.title ?? "");
  const [artistName, setArtistName] = useState(track.artistName ?? "");
  const [composerName, setComposerName] = useState(track.composerName ?? "");
  const [provider, setProvider] = useState(track.provider ?? "upload");
  const [language, setLanguage] = useState(track.language ?? "");
  const [instrumental, setInstrumental] = useState(track.instrumental ?? false);
  const [prompt, setPrompt] = useState(track.prompt ?? "");
  const [lyrics, setLyrics] = useState(track.lyrics ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim() || null,
        artistName: artistName.trim() || null,
        composerName: composerName.trim() || null,
        provider: provider.trim() || "upload",
        language: language.trim() || null,
        instrumental,
        prompt: prompt.trim(),
        lyrics: instrumental ? null : (lyrics.trim() || null),
      };

      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Save failed (${res.status})`);
      }

      const updated = await res.json();
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const knownProvider = PROVIDERS.some((p) => p.value === provider);

  return (
    <div className="fixed inset-0 z-70">
      <button
        type="button"
        aria-label="Close edit panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 h-[calc(100vh-var(--player-height))] w-full max-w-120 border-l border-white/10 bg-[#0d0e15] shadow-[0_24px_80px_rgba(0,0,0,0.45)] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
          <div>
            <h3 className="text-lg font-semibold">Edit Track Details</h3>
            <p className="text-xs text-white/50 mt-0.5 truncate max-w-[260px]">
              {track.title ?? track.prompt.substring(0, 60)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs text-white/60">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Track title"
              className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
            />
          </div>

          {/* Artist + Composer side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/60">Artist</label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Artist name"
                className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/60">Composer</label>
              <input
                type="text"
                value={composerName}
                onChange={(e) => setComposerName(e.target.value)}
                placeholder="Composer name"
                className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
              />
            </div>
          </div>

          {/* Source + Language side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/60">Source</label>
              <select
                value={knownProvider ? provider : "__custom__"}
                onChange={(e) => {
                  const v = e.target.value;
                  setProvider(v === "__custom__" ? provider : v);
                }}
                className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
                {!knownProvider && (
                  <option value="__custom__">{provider}</option>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/60">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English"
                className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
              />
            </div>
          </div>

          {/* Instrumental toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-white">Instrumental</p>
              <p className="text-xs text-white/45">No vocals / lyrics</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={instrumental}
              onClick={() => setInstrumental((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${instrumental ? "bg-primary-500" : "bg-white/15"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${instrumental ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Prompt */}
          <div className="space-y-1">
            <label className="text-xs text-white/60">Prompt / Style</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Style, mood, genre..."
              className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-none"
            />
          </div>

          {/* Lyrics */}
          {!instrumental && (
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
          )}

          {error && (
            <p className="text-sm text-red-400">⚠ {error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-4 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full border border-white/12 px-4 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-full bg-white px-5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </div>
  );
}
