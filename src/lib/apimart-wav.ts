import axios from "axios";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { createApimartWav, getApimartRawTaskStatus } from "@/lib/providers/apimart";
import { convertWavToFlac } from "@/lib/wav-to-flac";
import { detectFormatFromUrl, detectFormatFromContentType, contentTypeForFormat } from "@/lib/audio-format";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";

// Same cooldown/retry-cap shape as PoYo's WAV self-healing — APIMart has no
// webhook callback, so this is an active poll instead of a passive one.
export const APIMART_WAV_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
export const MAX_AUTO_APIMART_WAV_RETRIES = 8;

export function extractApimartAudioUrl(raw: any): string | null {
  const data = raw?.data;
  const result = data?.result;
  const candidates = [
    result?.music?.[0]?.audio_url,
    result?.audio_url,
    result?.url,
    result?.wav_url,
    result?.wavUrl,
    data?.audio_url,
    data?.url,
    data?.wavUrl,
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof found === "string" ? found : null;
}

export function apimartAudioIndexForJobId(jobId: string): number {
  return jobId.endsWith(":1") ? 2 : 1;
}

export interface ApimartWavRetryResult {
  processedTrackIds: string[];
  succeededTrackIds: string[];
  failedTrackIds: string[];
}

/**
 * Self-healing WAV export for "done" APIMart tracks that still have no HD
 * file. Submits an export task if none is in flight yet, otherwise polls the
 * existing one and downloads/uploads the result once completed. Mirrors
 * retryStaleWavConversions (PoYo) but polls instead of waiting on a webhook.
 */
export async function retryStaleApimartWavConversions(userId: string, trackId?: string): Promise<ApimartWavRetryResult> {
  const cutoff = new Date(Date.now() - APIMART_WAV_RETRY_COOLDOWN_MS);
  const result: ApimartWavRetryResult = { processedTrackIds: [], succeededTrackIds: [], failedTrackIds: [] };

  const candidates = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.provider, "apimart"),
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt),
        isNull(tracks.s3KeyHd),
        or(isNull(tracks.wavRetryAt), lt(tracks.wavRetryAt, cutoff)),
        lt(tracks.wavRetryCount, MAX_AUTO_APIMART_WAV_RETRIES),
        trackId ? eq(tracks.id, trackId) : undefined
      )
    );

  const eligible = candidates.filter((track) => track.jobId);
  if (eligible.length === 0) return result;

  for (const track of eligible) {
    result.processedTrackIds.push(track.id!);
    const startTime = Date.now();
    try {
      if (!track.wavJobId) {
        const parentJobId = track.jobId!.split(":")[0];
        const audioIndex = apimartAudioIndexForJobId(track.jobId!);
        const submitRes = await createApimartWav(parentJobId, audioIndex);
        await db
          .update(tracks)
          .set({ wavJobId: submitRes.taskId, wavRetryAt: new Date(), wavRetryCount: track.wavRetryCount + 1 })
          .where(eq(tracks.id, track.id!));
        await logApi({
          userId,
          type: "webhook",
          provider: "apimart",
          endpoint: "/api/tracks/retry-wav (apimart self-heal)",
          request: JSON.stringify({ trackId: track.id, parentJobId, audioIndex }),
          response: JSON.stringify({ wavJobId: submitRes.taskId }),
          statusCode: 200,
          duration: Date.now() - startTime,
        });
        result.succeededTrackIds.push(track.id!);
        continue;
      }

      const raw: any = await getApimartRawTaskStatus(track.wavJobId);
      const statusValue = String(raw?.data?.status ?? "").toLowerCase();

      if (statusValue !== "completed" && statusValue !== "done") {
        if (statusValue === "failed") {
          // Clear the stale job so the next pass resubmits from scratch.
          await db
            .update(tracks)
            .set({ wavJobId: null, wavRetryAt: new Date(), wavRetryCount: track.wavRetryCount + 1 })
            .where(eq(tracks.id, track.id!));
          await logApi({
            userId, type: "webhook", provider: "apimart",
            endpoint: "/api/tracks/retry-wav (apimart self-heal)",
            request: JSON.stringify({ trackId: track.id, wavJobId: track.wavJobId }),
            response: JSON.stringify({ status: statusValue }),
            statusCode: 400, duration: Date.now() - startTime,
          });
          result.failedTrackIds.push(track.id!);
        } else {
          await db
            .update(tracks)
            .set({ wavRetryAt: new Date(), wavRetryCount: track.wavRetryCount + 1 })
            .where(eq(tracks.id, track.id!));
          // Still processing on APIMart's side — not a failure, just not done yet.
          result.succeededTrackIds.push(track.id!);
        }
        continue;
      }

      const audioUrl = extractApimartAudioUrl(raw);
      if (!audioUrl) {
        await db
          .update(tracks)
          .set({ wavJobId: null, wavRetryAt: new Date(), wavRetryCount: track.wavRetryCount + 1 })
          .where(eq(tracks.id, track.id!));
        await logApi({
          userId, type: "webhook", provider: "apimart",
          endpoint: "/api/tracks/retry-wav (apimart self-heal)",
          request: JSON.stringify({ trackId: track.id, wavJobId: track.wavJobId }),
          // Includes the raw task payload (not just the error) so a mismatch between
          // extractApimartAudioUrl's expected shape and APIMart's actual response is
          // diagnosable from the log instead of needing to reproduce it live.
          response: JSON.stringify({ error: "No audio URL in completed task", raw: raw?.data }).slice(0, 4000),
          statusCode: 400, duration: Date.now() - startTime,
        });
        result.failedTrackIds.push(track.id!);
        continue;
      }

      const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
      const audioBuffer = Buffer.from(audioRes.data);
      const headerType = String(audioRes.headers?.["content-type"] || "");
      let formatHd = detectFormatFromUrl(audioUrl) === "wav"
        ? "wav"
        : detectFormatFromContentType(headerType || "audio/wav");

      let uploadBuffer = audioBuffer;
      if (formatHd === "wav") {
        const flacBuffer = await convertWavToFlac(audioBuffer);
        if (flacBuffer) {
          uploadBuffer = flacBuffer;
          formatHd = "flac";
        }
        // If ffmpeg unavailable, uploadBuffer/formatHd stay as WAV — upload as-is
      }

      const s3KeyHd = `tracks/${track.id}/audio_hd.${formatHd}`;
      await uploadToS3(s3KeyHd, uploadBuffer, contentTypeForFormat(formatHd));

      await db
        .update(tracks)
        .set({
          s3KeyHd,
          formatHd,
          audioUrlHd: `/api/tracks/${track.id}/download?hd=true`,
        })
        .where(eq(tracks.id, track.id!));
      await logApi({
        userId, type: "webhook", provider: "apimart",
        endpoint: "/api/tracks/retry-wav (apimart self-heal)",
        request: JSON.stringify({ trackId: track.id, wavJobId: track.wavJobId }),
        response: JSON.stringify({ s3KeyHd, formatHd }),
        statusCode: 200, duration: Date.now() - startTime,
      });
      result.succeededTrackIds.push(track.id!);
    } catch (error: any) {
      const message = error?.message ?? String(error);
      console.error(`[apimart-wav] retry failed for track ${track.id}:`, message);
      await logApi({
        userId, type: "webhook", provider: "apimart",
        endpoint: "/api/tracks/retry-wav (apimart self-heal)",
        request: JSON.stringify({ trackId: track.id, jobId: track.jobId, wavJobId: track.wavJobId }),
        response: JSON.stringify({ error: message }),
        statusCode: 500, duration: Date.now() - startTime,
      }).catch(() => {});
      await db
        .update(tracks)
        .set({ wavRetryAt: new Date(), wavRetryCount: track.wavRetryCount + 1 })
        .where(eq(tracks.id, track.id!))
        .catch(() => {});
      result.failedTrackIds.push(track.id!);
    }
  }

  return result;
}
