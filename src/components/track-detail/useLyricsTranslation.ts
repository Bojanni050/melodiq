"use client";

import { useEffect, useState } from "react";
import type { TrackDetailTrack } from "./types";

export function useLyricsTranslation(
  track: TrackDetailTrack,
  initialTrack: TrackDetailTrack,
  onSaved: (updatedTrack: TrackDetailTrack) => void,
) {
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const [showingTranslation, setShowingTranslation] = useState(false);

  useEffect(() => {
    setShowingTranslation(false);
    setTranslateMenuOpen(false);
    setTranslateError(null);
  }, [initialTrack]);

  async function handleTranslateLyrics(targetLanguage: string) {
    setTranslateMenuOpen(false);
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/translate-lyrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload && typeof payload.error === "string" ? payload.error : `Translation failed (${res.status})`;
        throw new Error(message);
      }

      const updatedTrack = await res.json();
      onSaved(updatedTrack);
      setShowingTranslation(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to translate lyrics";
      console.error("Failed to translate lyrics:", error);
      setTranslateError(message);
    } finally {
      setTranslating(false);
    }
  }

  return {
    translating, translateError,
    translateMenuOpen, setTranslateMenuOpen,
    showingTranslation, setShowingTranslation,
    handleTranslateLyrics,
  };
}
