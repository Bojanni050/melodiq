import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";
import { createApimartAlignedLyrics, getApimartRawTaskStatus } from "@/lib/providers/apimart";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";

// The in-component pollers (TrackDetail/FullscreenPlayer) give up after ~75s,
// which is shorter than APIMart's own documented 30-120s (sometimes longer)
// processing window — a track opened right after generating can outlive that
// window and get stuck on a submission receipt forever with nothing left to
// resolve it. This self-healing pass runs on every /api/tracks poll instead,
// independent of whether any component has the track open.
const APIMART_LYRICS_STALE_CUTOFF_MS = 24 * 60 * 60 * 1000;

export function apimartAudioIndexForJobId(jobId: string): number {
  return jobId.endsWith(":1") ? 2 : 1;
}

export async function retryStaleApimartAlignedLyrics(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - APIMART_LYRICS_STALE_CUTOFF_MS);

  const candidates = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.provider, "apimart"),
        eq(tracks.status, "done"),
        eq(tracks.instrumental, false),
        isNull(tracks.deletedAt),
        isNull(tracks.archivedAt),
        gt(tracks.createdAt, cutoff)
      )
    );

  for (const track of candidates) {
    if (!track.jobId) continue;

    try {
      if (!track.lyricsTimestamps) {
        // Eager submit at generation time was missed or failed — try again.
        const parentJobId = track.jobId.split(":")[0];
        const audioIndex = apimartAudioIndexForJobId(track.jobId);
        const submitRes = await createApimartAlignedLyrics(parentJobId, audioIndex);
        await db
          .update(tracks)
          .set({ lyricsTimestamps: JSON.stringify({ task_id: submitRes.taskId }) })
          .where(eq(tracks.id, track.id!));
        continue;
      }

      if (!isLyricsTaskSubmission(track.lyricsTimestamps)) continue; // already resolved

      const parsed = JSON.parse(track.lyricsTimestamps);
      const lyricsTaskId = parsed.task_id || parsed.taskId;
      if (!lyricsTaskId) continue;

      const raw: any = await getApimartRawTaskStatus(lyricsTaskId);
      const statusValue = String(raw?.data?.status ?? "").toLowerCase();

      if (statusValue === "completed" || statusValue === "done") {
        await db
          .update(tracks)
          .set({ lyricsTimestamps: JSON.stringify(raw) })
          .where(eq(tracks.id, track.id!));
      }
      // else still pending — leave the receipt in place, the next poll retries it
    } catch (error: any) {
      console.error(`[apimart-lyrics] retry failed for track ${track.id}:`, error?.message ?? error);
    }
  }
}
