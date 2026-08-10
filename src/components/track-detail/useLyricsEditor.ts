"use client";

import { useEffect, useState } from "react";
import type { TrackDetailTrack } from "./types";

export function useLyricsEditor(
  track: TrackDetailTrack,
  initialTrack: TrackDetailTrack,
  onSaved: (updatedTrack: TrackDetailTrack) => void,
) {
  const [lyricsExpanded, setLyricsExpanded] = useState(true);
  const [lyricsDraft, setLyricsDraft] = useState(initialTrack.lyrics ?? "");
  const [lyricsEditing, setLyricsEditing] = useState(false);
  const [lyricsSaving, setLyricsSaving] = useState(false);
  const [lyricsSaveError, setLyricsSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLyricsDraft(initialTrack.lyrics ?? "");
    setLyricsEditing(false);
    setLyricsExpanded(true);
  }, [initialTrack]);

  function startEditingLyrics() {
    setLyricsDraft(track.lyrics ?? "");
    setLyricsEditing(true);
  }

  function cancelEditingLyrics() {
    setLyricsDraft(track.lyrics ?? "");
    setLyricsEditing(false);
  }

  async function handleSaveLyrics() {
    setLyricsSaving(true);
    setLyricsSaveError(null);
    try {
      const trimmedLyrics = lyricsDraft.trim();
      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: trimmedLyrics ? trimmedLyrics : null }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload && typeof payload.error === "string" ? payload.error : `Save failed (${res.status})`;
        throw new Error(message);
      }

      const updatedTrack = await res.json();
      onSaved(updatedTrack);
      setLyricsEditing(false);
      setLyricsDraft(updatedTrack.lyrics ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save lyrics";
      console.error("Failed to update lyrics:", error);
      setLyricsSaveError(message);
    } finally {
      setLyricsSaving(false);
    }
  }

  return {
    lyricsExpanded, setLyricsExpanded,
    lyricsDraft, setLyricsDraft,
    lyricsEditing, lyricsSaving, lyricsSaveError,
    startEditingLyrics, cancelEditingLyrics, handleSaveLyrics,
  };
}
