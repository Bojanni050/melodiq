"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayerStore } from "@/lib/store";

/**
 * Smooth-scrolls the row for `trackId` into view and flashes a highlight ring
 * on it. Rows must carry `data-track-id={id}` — the convention TrackList
 * already uses, so a listing that renders its own rows only adds the attribute.
 */
export function scrollToTrackRow(trackId: string): boolean {
  const el = document.querySelector(`[data-track-id="${trackId}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-accent/40");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-accent/40"), 1500);
  return true;
}

/**
 * Jump-to-current-track state for a listing that renders its own rows instead
 * of using TrackList (Library and friends get this from TrackListHeader).
 *
 * The button is offered only while the now-playing track actually belongs to
 * this listing AND its row is scrolled out of view — the same rule Library
 * follows. When the row is in `trackIds` but not in the DOM yet (async data) a
 * few retries are made so the button appears once the list renders.
 *
 * @param trackIds every track id this listing can render (order irrelevant).
 * @param enabled  false suppresses the button entirely — e.g. a view mode that
 *                 renders no rows, such as the grid view on the releases pages.
 */
export function useJumpToCurrentTrack(trackIds: string[], enabled = true) {
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id ?? null);
  const idsKey = useMemo(() => trackIds.join("\u0000"), [trackIds]);
  const isInList = currentTrackId ? trackIds.includes(currentTrackId) : false;
  const [rowVisible, setRowVisible] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled || !currentTrackId || !isInList) {
      setRowVisible(true);
      return;
    }

    const el = document.querySelector(`[data-track-id="${currentTrackId}"]`);
    if (!el) {
      // In the list but not rendered yet — offer the button and retry briefly.
      setRowVisible(false);
      if (retry < 10) {
        const timer = window.setTimeout(() => setRetry((n) => n + 1), 150);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    setRetry(0);
    const observer = new IntersectionObserver(
      ([entry]) => setRowVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    // Immediate check: an element already on screen may never fire an entry.
    const rect = el.getBoundingClientRect();
    setRowVisible(rect.top >= 0 && rect.top < window.innerHeight);
    return () => observer.disconnect();
    // `idsKey` re-runs the lookup when rows mount/change (async data, filters).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currentTrackId, isInList, idsKey, retry]);

  const jumpToCurrentTrack = useCallback(() => {
    if (currentTrackId) scrollToTrackRow(currentTrackId);
  }, [currentTrackId]);

  return {
    showJumpToCurrentTrack: enabled && Boolean(currentTrackId) && isInList && !rowVisible,
    jumpToCurrentTrack,
  };
}
