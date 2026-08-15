export type SortOrder = "newest" | "oldest" | "title-asc" | "title-desc";
export type DropPosition = "before" | "after";

const TRACK_ORDER_STORAGE_PREFIX = "melodiq.track-manual-order.v2.";
const SORT_ORDER_STORAGE_KEY = "melodiq.track-sort-order.v1";

// Shared across every TrackList instance (Library, Playlists, Workspaces,
// Archive, Releases, …) so the selected sort sticks when navigating between
// them instead of resetting to "newest" on every remount.
export function readPersistedSortOrder(): SortOrder | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SORT_ORDER_STORAGE_KEY);
    if (raw === "newest" || raw === "oldest" || raw === "title-asc" || raw === "title-desc") {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function writePersistedSortOrder(order: SortOrder) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SORT_ORDER_STORAGE_KEY, order);
  } catch {
    // Ignore storage failures (private mode/quota), keep runtime order in memory.
  }
}

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
