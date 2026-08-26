"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/lib/store";

interface HasId {
  id: string;
}

/**
 * Keeps the Track Details panel's selected track in sync with the
 * now-playing track (playerStore.currentTrack), for whichever local track
 * list a page has. This logic used to be hand-copied into ~8 pages
 * (Library, Discover, Discover playlist, Playlists, Archive, Releases,
 * Workspaces...) — each one slightly different and each one a chance to
 * drift out of sync (see: the release page never got it at all, the
 * Master Tracks page never got it at all, both fixed only after separate
 * bug reports for the same root cause). One shared hook now.
 *
 * `T` is intentionally left to the caller (LibraryTrack, TrackItem, a
 * PublicTrack, etc.) — the hook only ever touches `.id`. When the
 * now-playing track isn't found in the caller's own list (still loading,
 * or a track from a completely different context), it falls back to
 * `playerStore.currentTrack` itself, cast to `T` — every one of these
 * track shapes is a subset of the player's own `Track` type, so this is
 * safe and (unlike the old hand-rolled fallbacks) never goes stale as new
 * fields get added.
 */
export function useTrackDetailsPanel<T extends HasId>(tracks: T[]) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const showTrackDetailsPanel = usePlayerStore((s) => s.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((s) => s.setShowTrackDetailsPanel);

  const [selectedTrack, setSelectedTrack] = useState<T | null>(null);

  // Keep selectedTrack in sync whenever the panel is open and the caller's
  // track list changes (e.g. it just finished loading, or lyrics streamed in).
  useEffect(() => {
    if (!showTrackDetailsPanel) return;
    setSelectedTrack((prev) => {
      if (prev) {
        const matched = tracks.find((t) => t.id === prev.id);
        return matched ?? prev;
      }
      if (currentTrack) {
        const matched = tracks.find((t) => t.id === currentTrack.id);
        return matched ?? (currentTrack as unknown as T);
      }
      return null;
    });
  }, [showTrackDetailsPanel, currentTrack, tracks]);

  // Follow the now-playing track when the panel is open and playback moves
  // to a different track (or resumes), so the panel doesn't keep showing
  // whatever was selected before.
  const prevIsPlaying = useRef(isPlaying);
  const prevCurrentTrackId = useRef(currentTrack?.id);

  useEffect(() => {
    const playResumed = isPlaying && !prevIsPlaying.current;
    const trackChanged = currentTrack?.id !== prevCurrentTrackId.current;

    prevIsPlaying.current = isPlaying;
    prevCurrentTrackId.current = currentTrack?.id;

    if (showTrackDetailsPanel && currentTrack && (playResumed || trackChanged)) {
      setSelectedTrack((prev) => {
        if (prev?.id === currentTrack.id) return prev;
        const matched = tracks.find((t) => t.id === currentTrack.id);
        return matched ?? (currentTrack as unknown as T);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracks]);

  // Stable identities — several callers put these in effect dependency
  // arrays (e.g. a "jump to track from URL" effect), where a function that
  // changes on every render would re-fire the effect every render too.
  const openTrackDetails = useCallback((track: T) => {
    setSelectedTrack(track);
    setShowTrackDetailsPanel(true);
  }, [setShowTrackDetailsPanel]);

  const closeTrackDetails = useCallback(() => {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
  }, [setShowTrackDetailsPanel]);

  // When cover is regenerated or changed, update selectedTrack's coverUrl
  useEffect(() => {
    function handleCoverChanged(event: Event) {
      const e = event as CustomEvent<{ trackIds?: string[]; ts?: number }>;
      const ids = e.detail?.trackIds;
      if (!Array.isArray(ids)) return;
      const ts = typeof e.detail?.ts === "number" ? e.detail.ts : Date.now();
      setSelectedTrack((prev) => {
        if (!prev || !ids.includes(prev.id)) return prev;
        return { ...prev, coverUrl: `/api/tracks/${prev.id}/cover?t=${ts}` } as T;
      });
    }
    window.addEventListener("melodiq:cover-regenerated", handleCoverChanged);
    return () => window.removeEventListener("melodiq:cover-regenerated", handleCoverChanged);
  }, []);

  return {
    selectedTrack,
    setSelectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  };
}
