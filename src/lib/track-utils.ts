import type { TrackItem } from "@/components/tracks/types";
import { WORKSPACE_FOLDER_GRADIENTS } from "@/lib/store";

export function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function pickRandomItems<T>(items: T[], seed: string, limit: number): T[] {
  if (limit <= 0 || items.length === 0) return [];

  return [...items]
    .map((item, index) => ({
      item,
      score: hashString(`${seed}:${index}:${JSON.stringify(item)}`),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function getWorkspaceCoverCollage(workspaceId: string, tracks: TrackItem[]): string[] {
  const coverUrls = tracks
    .filter((track) => !!track.coverUrl)
    .map((track) => track.coverUrl as string);

  return pickRandomItems(coverUrls, workspaceId, 4);
}

export function getWorkspaceGradient(workspaceId: string, gradient?: string): string {
  if (gradient) return gradient;
  return WORKSPACE_FOLDER_GRADIENTS[hashString(workspaceId) % WORKSPACE_FOLDER_GRADIENTS.length];
}

export function formatTrackDateTime(date: Date): { date: string; time: string } {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  let dateStr;
  if (isToday) {
    dateStr = "Today";
  } else if (isYesterday) {
    dateStr = "Yesterday";
  } else {
    dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { date: dateStr, time: timeStr };
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatTotalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
