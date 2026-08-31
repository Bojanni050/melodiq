"use client";

import type { Track } from "@/lib/store";
import { withCdn } from "@/lib/cdn-client";

export type AudioSource = "cache" | "s3" | "unknown";
export type AudioSourceState = "hit" | "miss" | "fallback" | "unknown";

// Public Discover tracks may not be owned by the viewer — route their media
// and side-effect calls through the public /api/discover/{id}/* endpoints
// instead of the private, ownership-gated /api/tracks/{id}/* ones. The
// discover base additionally goes through withCdn() since it's the only one
// of the two that's safe to serve from a public CDN hostname.
export function mediaBase(track: Track): string {
  return track.publicSource ? withCdn(`/api/discover/${track.id}`) : `/api/tracks/${track.id}`;
}

// Loudness normalization: bring every track to the same integrated loudness
// (LUFS) via one constant gain multiplier per track, rather than compressing
// or limiting — a single scalar applied uniformly can't change a track's
// internal dynamics, it only rebalances level between tracks. -14 LUFS
// matches the reference level Spotify/YouTube normalize to.
const TARGET_LUFS = -14;
// A measured LUFS that's wildly off (bad analysis, silence, corrupt audio)
// shouldn't be allowed to swing playback level wildly — clamp to a sane
// +/-12dB range.
const MIN_NORMALIZATION_GAIN = 10 ** (-12 / 20);
const MAX_NORMALIZATION_GAIN = 10 ** (12 / 20);

export function loudnessToGain(loudnessLufs: number | null | undefined): number {
  if (loudnessLufs == null || !Number.isFinite(loudnessLufs)) return 1;
  const gain = 10 ** ((TARGET_LUFS - loudnessLufs) / 20);
  return Math.min(MAX_NORMALIZATION_GAIN, Math.max(MIN_NORMALIZATION_GAIN, gain));
}

const loudnessCache = new Map<string, number | null>();

/** Fetches a track's measured integrated loudness (LUFS), cached in memory
 * for the lifetime of the page since it never changes once analysis has run. */
export async function getTrackLoudness(track: Track): Promise<number | null> {
  const cached = loudnessCache.get(track.id);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${mediaBase(track)}/loudness`);
    if (!res.ok) {
      loudnessCache.set(track.id, null);
      return null;
    }
    const data = await res.json();
    const loudness = typeof data?.loudness === "number" ? data.loudness : null;
    loudnessCache.set(track.id, loudness);
    return loudness;
  } catch {
    // Network hiccup — don't cache a transient failure, worth retrying next time.
    return null;
  }
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

export function getPlayingFormat(track: Track | null | undefined, playHighestQuality: boolean): string {
  if (!track) return "mp3";
  if (playHighestQuality) {
    if (track.formatHd === "flac" && track.s3KeyHd) return "flac";
    if (track.format === "flac" && track.s3Key) return "flac";
    if (track.formatHd === "wav" && track.s3KeyHd) return "wav";
    if (track.format === "wav" && track.s3Key) return "wav";
    if (track.s3KeyOgg || track.format === "ogg" || track.formatHd === "ogg") return "ogg";
    if (track.s3KeyMp3 || track.format === "mp3" || track.formatHd === "mp3") return "mp3";
    return track.formatHd || track.format || "mp3";
  }
  // Default playback: OGG -> MP3 -> FLAC -> WAV
  if (track.s3KeyOgg || track.format === "ogg") return "ogg";
  if (track.s3KeyMp3 || track.format === "mp3") return "mp3";
  if (track.formatHd === "flac" || track.format === "flac") return "flac";
  if (track.formatHd === "wav" || track.format === "wav") return "wav";
  return track.format || "mp3";
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
    const audio = new Audio();
    // Without this, mobile browsers fall back to their own default (which
    // varies by platform and can be as conservative as "metadata only"),
    // buffering just enough to report duration before waiting for a play
    // gesture to fetch more. "auto" tells the browser it's free to buffer
    // ahead of playback proactively, closing that data gap on flaky mobile
    // connections.
    audio.preload = "auto";
    window.__melodiqSharedAudioElement = audio;
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
