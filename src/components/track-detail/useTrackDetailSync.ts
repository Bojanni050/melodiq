"use client";

import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { usePlayerStore } from "@/lib/store";
import { isLyricsTaskSubmission, parseLyrics } from "@/lib/parse-lyrics";
import type { TrackDetailTrack } from "./types";

// Owns the "shadow" copy of the track that self-heals via polling: time-coded
// lyrics sync (TCL) and cover art generation both complete asynchronously
// after the initial track load, so this hook keeps re-fetching until either
// resolves, updating local state, the player store, and the SWR track list
// in lockstep.
export function useTrackDetailSync(
  initialTrack: TrackDetailTrack,
  onTrackUpdated?: (track: TrackDetailTrack) => void,
) {
  const { mutate } = useSWRConfig();
  const [localTrack, setLocalTrack] = useState(initialTrack);

  useEffect(() => {
    setLocalTrack(initialTrack);
  }, [initialTrack]);

  // central self-healing polling loop
  useEffect(() => {
    if (localTrack.status !== "done" || (localTrack.provider !== "poyo" && localTrack.provider !== "apimart") || localTrack.instrumental) return;

    const hasTimings = localTrack.lyricsTimestamps && !isLyricsTaskSubmission(localTrack.lyricsTimestamps)
      ? parseLyrics(localTrack.lyrics, localTrack.lyricsTimestamps).some((line) => line.startTime >= 0)
      : false;

    // We only poll if it has NO timings, OR if it's currently a task submission receipt
    const needsPolling = !hasTimings || isLyricsTaskSubmission(localTrack.lyricsTimestamps);
    if (!needsPolling) return;

    console.log(`[TCL-Sync] central TrackDetail started polling for track ${localTrack.id}`);

    let pollCount = 0;
    const maxPolls = 15; // 15 polls * 5 seconds = 75 seconds max
    let active = true;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/tracks/${localTrack.id}`);
        if (!res.ok) return;
        const updatedTrack = await res.json();

        if (!active) return;

        if (updatedTrack && updatedTrack.lyricsTimestamps !== localTrack.lyricsTimestamps) {
          const updatedHasTimings = updatedTrack.lyricsTimestamps && !isLyricsTaskSubmission(updatedTrack.lyricsTimestamps)
            ? parseLyrics(updatedTrack.lyrics, updatedTrack.lyricsTimestamps).some((line) => line.startTime >= 0)
            : false;

          console.log(`[TCL-Sync] central TrackDetail fetched update. Has Timings: ${updatedHasTimings}`);

          // Update local state instantly so user sees it right away
          setLocalTrack(updatedTrack);

          // Update player store instantly so playing track keeps tracking lyrics
          usePlayerStore.getState().syncTrackSnapshots([updatedTrack]);

          // Update SWR global list so other lists are reactively aware
          void mutate("/api/tracks");

          // If we finally got real timings, stop polling
          if (updatedHasTimings) {
            console.log(`[TCL-Sync] central TrackDetail polling finished successfully for track ${localTrack.id}`);
            return;
          }
        }
      } catch (err: any) {
        console.error(`[TCL-Sync] central TrackDetail polling error:`, err?.message ?? err);
      }

      pollCount++;
      if (pollCount < maxPolls && active) {
        timerId = setTimeout(poll, 5000);
      } else if (pollCount >= maxPolls) {
        console.log(`[TCL-Sync] central TrackDetail stopped polling: hit max retries for track ${localTrack.id}`);
      }
    };

    timerId = setTimeout(poll, 2000); // start first poll after 2 seconds

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [localTrack.id, localTrack.lyricsTimestamps, mutate]);

  // Poll for cover art when track has none yet
  useEffect(() => {
    if (localTrack.coverUrl || localTrack.s3KeyCover) return;
    if (localTrack.status !== "done") return;

    let active = true;
    let pollCount = 0;
    const maxPolls = 24; // 24 × 5s = 2 minutes
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/tracks/${localTrack.id}`);
        if (!res.ok) return;
        const updated = await res.json();
        if (!active) return;
        if (updated?.coverUrl || updated?.s3KeyCover) {
          setLocalTrack(updated);
          onTrackUpdated?.(updated);
          usePlayerStore.getState().syncTrackSnapshots([updated]);
          void mutate("/api/tracks");
          return;
        }
      } catch {}
      pollCount++;
      if (pollCount < maxPolls && active) timerId = setTimeout(poll, 5000);
    };

    timerId = setTimeout(poll, 3000);
    return () => { active = false; clearTimeout(timerId); };
  }, [localTrack.id, localTrack.coverUrl, localTrack.s3KeyCover, localTrack.status, onTrackUpdated, mutate]);

  return { track: localTrack, setLocalTrack, mutate };
}
