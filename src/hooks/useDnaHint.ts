"use client";

import { useEffect, useState } from "react";
import type { DnaStrength } from "@/lib/dna/context";

/**
 * How long a fetched hint stays fresh. Long enough that flipping between
 * Subtle and Strong feels instant, short enough that a DNA recompute on /dna
 * shows up without a reload.
 */
const CACHE_TTL_MS = 60_000;

const cache = new Map<DnaStrength, { text: string; at: number }>();

function cached(strength: DnaStrength): string | null {
  const hit = cache.get(strength);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(strength);
    return null;
  }
  return hit.text;
}

export type DnaHintState = { text: string; loading: boolean };

/**
 * Live preview of the exact line /api/generate appends for a strength.
 * "off" resolves to an empty hint without a request.
 */
export function useDnaHint(strength: DnaStrength): DnaHintState {
  const [state, setState] = useState<DnaHintState>(() => {
    if (strength === "off") return { text: "", loading: false };
    const hit = cached(strength);
    return hit === null ? { text: "", loading: true } : { text: hit, loading: false };
  });

  useEffect(() => {
    if (strength === "off") {
      setState({ text: "", loading: false });
      return;
    }

    const hit = cached(strength);
    if (hit !== null) {
      setState({ text: hit, loading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ text: prev.text, loading: true }));

    fetch(`/api/dna/context?strength=${strength}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { text?: string } | null) => {
        if (cancelled || !payload) return;
        const text = payload.text ?? "";
        cache.set(strength, { text, at: Date.now() });
        setState({ text, loading: false });
      })
      .catch(() => {
        // A missing preview is not worth an error banner.
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [strength]);

  return state;
}
