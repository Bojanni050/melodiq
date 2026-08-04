import {
  STYLE_SNAPSHOTS_KEY,
  STYLE_SNAPSHOTS_MAX,
  type StyleDraftPayload,
} from "@/lib/style-studio-constants";
import type { StyleSnapshot } from "@/lib/style-studio-types";

export function buildStyleDraftPayload(payload: StyleDraftPayload): StyleDraftPayload {
  return {
    primaryGenre: payload.primaryGenre,
    secondaryGenre: payload.secondaryGenre,
    moods: [...payload.moods],
    instrumentation: [...payload.instrumentation],
    vocalDirection: [...payload.vocalDirection],
    tempo: payload.tempo,
    era: payload.era,
    production: [...payload.production],
  };
}

export function parseSavedStyleSnapshots(raw: string | null): StyleSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is StyleSnapshot =>
        s && typeof s === "object" && typeof s.id === "string" && typeof s.name === "string" && s.payload && typeof s.payload === "object"
      )
      .slice(0, STYLE_SNAPSHOTS_MAX);
  } catch {
    localStorage.removeItem(STYLE_SNAPSHOTS_KEY);
    return [];
  }
}

export function saveStyleSnapshotsToStorage(snapshots: StyleSnapshot[]): void {
  if (typeof window === "undefined") return;
  const trimmed = snapshots.slice(0, STYLE_SNAPSHOTS_MAX);
  try {
    window.localStorage.setItem(STYLE_SNAPSHOTS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save style snapshots", error);
  }
}
