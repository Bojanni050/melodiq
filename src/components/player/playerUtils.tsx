"use client";

import type { Track } from "@/lib/store";

export type AudioSource = "cache" | "s3" | "unknown";
export type AudioSourceState = "hit" | "miss" | "fallback" | "unknown";

// Public Discover tracks may not be owned by the viewer — route their media
// and side-effect calls through the public /api/discover/{id}/* endpoints
// instead of the private, ownership-gated /api/tracks/{id}/* ones.
export function mediaBase(track: Track): string {
  return track.publicSource ? `/api/discover/${track.id}` : `/api/tracks/${track.id}`;
}

export function resolveStreamSuffix(track: Track, playHighestQuality: boolean): string {
  if (!playHighestQuality) return "";

  // Prefer FLAC, then WAV — check HD slot first, then primary slot
  for (const fmt of ["flac", "wav"] as const) {
    if (track.formatHd === fmt && track.s3KeyHd) return "?hd=true";
    if (track.format === fmt && track.s3Key) return "";
  }
  return "";
}

export function AudioSourceBadge({ source }: { source: AudioSource; state: AudioSourceState }) {
  // Only show a badge when streaming (not from cache)
  if (source !== "s3") return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200"
      title="Streaming from server"
    >
      <span className="text-[11px] leading-none">☁</span>
      Stream
    </span>
  );
}

declare global {
  interface Window {
    __melodiqSharedAudioElement?: HTMLAudioElement;
  }
}

export function getSharedAudioElement() {
  if (typeof window === "undefined") return null;
  if (!window.__melodiqSharedAudioElement) {
    window.__melodiqSharedAudioElement = new Audio();
  }
  return window.__melodiqSharedAudioElement;
}

export function formatProviderLabel(provider: string) {
  const normalized = (provider || "").toLowerCase();
  if (normalized === "poyo") return "PoYo";
  if (normalized === "tempolor") return "Tempolor";
  if (normalized === "apiframe") return "APIFrame";
  if (normalized === "musicgpt") return "MusicGPT";
  if (normalized === "lyria") return "Lyria";
  if (normalized === "minimax") return "MiniMax";
  if (normalized === "heartmula") return "HeartMuLa";
  if (!provider) return "";
  return provider[0].toUpperCase() + provider.slice(1);
}

export type ActionTimestampRef = { current: number };

export function allowWithDelay(ref: ActionTimestampRef, delayMs: number) {
  const now = Date.now();
  if (now - ref.current < delayMs) return false;
  ref.current = now;
  return true;
}
