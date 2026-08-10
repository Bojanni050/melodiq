"use client";

import { useEffect, useState } from "react";
import type { TrackDetailTrack } from "./types";

export function useTrackRating(track: TrackDetailTrack, initialTrack: TrackDetailTrack) {
  const [currentRating, setCurrentRating] = useState<string | null>(initialTrack.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    setCurrentRating(initialTrack.rating ?? null);
  }, [initialTrack]);

  async function handleRating(newRating: "up" | "down") {
    // Toggle: if same rating clicked, set to null
    const rating = currentRating === newRating ? null : newRating;

    setRatingLoading(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (res.ok) {
        setCurrentRating(rating);
      } else {
        const body = await res.json().catch(() => null);
        console.error(`Failed to update rating: HTTP ${res.status}`, body);
      }
    } catch (error) {
      console.error("Failed to update rating:", error);
    } finally {
      setRatingLoading(false);
    }
  }

  return { currentRating, ratingLoading, handleRating };
}
