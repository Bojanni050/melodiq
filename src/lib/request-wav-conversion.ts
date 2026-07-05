import axios from "axios";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getSetting, getWebhookUrl } from "@/lib/settings";
import { logApi } from "@/lib/logger";

const MAX_SUBMIT_ATTEMPTS = 3;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 5000;

// Self-healing retry for tracks whose WAV never came back (webhook lost, PoYo-side
// failure, etc). Gated by cooldown + attempt cap so the polling loop in
// /api/tracks can't hammer PoYo's rate limit every time a client polls.
export const WAV_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
export const MAX_AUTO_WAV_RETRIES = 8;

export function getOriginalPoYoTaskId(jobId: string): string {
  return jobId.replace(/:v\d+$/i, "");
}

function parseRateLimitDelayMs(message: string | undefined): number {
  const match = message?.match(/try again in\s+(\d+(?:\.\d+)?)\s*seconds?/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  return DEFAULT_RATE_LIMIT_BACKOFF_MS;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Vraagt WAV conversie aan bij PoYo voor een gegenereerde track.
 * Returns de WAV task_id of null bij failure.
 * PoYo stuurt het WAV resultaat naar /api/webhooks/poyo-wav via callback.
 *
 * Retries a bounded number of times on PoYo's 429 rate limit before giving up.
 * Logs every attempt (success or failure) via logApi — this is the only submit-time
 * record, since a failure here means PoYo never calls back /api/webhooks/poyo-wav.
 */
export async function requestWavConversion(track: {
  id: string;
  jobId: string;
  audioId: string;
  userId?: string | null;
}): Promise<string | null> {
  const originalTaskId = getOriginalPoYoTaskId(track.jobId);
  const requestPayload = { task_id: originalTaskId, audio_id: track.audioId };

  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
    const startTime = Date.now();

    try {
      const apiKey =
        (await getSetting("POYO_API_KEY")) || process.env.POYO_API_KEY || "";

      if (!apiKey) {
        console.warn("[wav] POYO_API_KEY not configured, skipping WAV conversion");
        await logApi({
          userId: track.userId,
          type: "webhook",
          provider: "poyo",
          endpoint: "/api/generate/submit (convert-to-wav)",
          request: JSON.stringify({ trackId: track.id, ...requestPayload }),
          response: JSON.stringify({ error: "POYO_API_KEY not configured" }),
          statusCode: 0,
          duration: Date.now() - startTime,
        });
        return null;
      }

      const webhookUrl = await getWebhookUrl("poyo_wav");

      const response = await axios.post(
        "https://api.poyo.ai/api/generate/submit",
        {
          model: "convert-to-wav",
          callback_url: webhookUrl,
          input: requestPayload,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const wavTaskId = response.data?.task_id || response.data?.data?.task_id || null;

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "poyo",
        endpoint: "/api/generate/submit (convert-to-wav)",
        request: JSON.stringify({ trackId: track.id, ...requestPayload }),
        response: JSON.stringify(response.data),
        statusCode: response.status,
        duration: Date.now() - startTime,
      });

      if (wavTaskId) {
        console.log(
          `[wav] conversion task_id: ${wavTaskId} for track ${track.id} (source_task_id: ${originalTaskId}, audio_id: ${track.audioId})`
        );
        return wavTaskId;
      }

      console.warn(`[wav] no task_id in response for track ${track.id}`);
      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
      const responseData = axios.isAxiosError(error) ? error.response?.data : undefined;

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "poyo",
        endpoint: "/api/generate/submit (convert-to-wav)",
        request: JSON.stringify({ trackId: track.id, ...requestPayload }),
        response: JSON.stringify({ error: message, details: responseData }),
        statusCode: statusCode ?? 500,
        duration: Date.now() - startTime,
      });

      if (statusCode === 429 && attempt < MAX_SUBMIT_ATTEMPTS) {
        const nestedMessage =
          responseData && typeof responseData === "object"
            ? (responseData as any)?.error?.message
            : undefined;
        const delay = parseRateLimitDelayMs(nestedMessage ?? message);
        console.warn(
          `[wav] rate limited for track ${track.id}, retrying in ${delay}ms (attempt ${attempt}/${MAX_SUBMIT_ATTEMPTS})`
        );
        await sleep(delay);
        continue;
      }

      console.warn(`[wav] conversion request failed for track ${track.id}:`, message);
      return null;
    }
  }

  return null;
}

export async function requestMissingWavConversion(track: {
  id: string | null;
  jobId: string | null;
  audioId: string | null;
  userId?: string | null;
  wavJobId?: string | null;
  s3KeyHd?: string | null;
}): Promise<string | null> {
  if (!track.id || !track.jobId || !track.audioId || track.wavJobId || track.s3KeyHd) {
    return null;
  }

  const wavTaskId = await requestWavConversion({
    id: track.id,
    jobId: track.jobId,
    audioId: track.audioId,
    userId: track.userId,
  });

  if (!wavTaskId) return null;

  await db
    .update(tracks)
    .set({ wavJobId: wavTaskId })
    .where(eq(tracks.id, track.id));

  return wavTaskId;
}

/**
 * Self-healing retry for "done" PoYo tracks that still have no WAV/FLAC, whether the
 * original submit failed, PoYo's own conversion task errored, or the callback was
 * lost. Called from the /api/tracks polling path — gated by wavRetryAt/wavRetryCount
 * so repeated client polling can't spam PoYo's rate limit for the same track.
 */
export async function retryStaleWavConversions(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - WAV_RETRY_COOLDOWN_MS);

  const candidates = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.provider, "poyo"),
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt),
        isNull(tracks.s3KeyHd),
        or(isNull(tracks.wavRetryAt), lt(tracks.wavRetryAt, cutoff)),
        lt(tracks.wavRetryCount, MAX_AUTO_WAV_RETRIES)
      )
    );

  const eligible = candidates.filter((track) => track.jobId && track.audioId);
  if (eligible.length === 0) return;

  for (const track of eligible) {
    const wavTaskId = await requestWavConversion({
      id: track.id!,
      jobId: track.jobId!,
      audioId: track.audioId!,
      userId: track.userId,
    });

    await db
      .update(tracks)
      .set({
        wavJobId: wavTaskId ?? track.wavJobId,
        wavRetryAt: new Date(),
        wavRetryCount: track.wavRetryCount + 1,
      })
      .where(eq(tracks.id, track.id!));
  }
}
