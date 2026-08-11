export type SortOrder = "newest" | "oldest" | "title-asc" | "title-desc";
export type DropPosition = "before" | "after";

const TRACK_ORDER_STORAGE_PREFIX = "melodiq.track-manual-order.v2.";

export function readPersistedTrackOrder(key: string): string[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TRACK_ORDER_STORAGE_PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    return parsed.filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return null;
  }
}

export function writePersistedTrackOrder(key: string, order: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TRACK_ORDER_STORAGE_PREFIX + key, JSON.stringify(order));
  } catch {
    // Ignore storage failures (private mode/quota), keep runtime order in memory.
  }
}
