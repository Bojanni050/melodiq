import axios from "axios";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSetting, getWebhookUrl } from "@/lib/settings";
import { logApi } from "@/lib/logger";

export function getOriginalPoYoTaskId(jobId: string): string {
  return jobId.replace(/:v\d+$/i, "");
}

/**
 * Vraagt WAV conversie aan bij PoYo voor een gegenereerde track.
 * Returns de WAV task_id of null bij failure.
 * PoYo stuurt het WAV resultaat naar /api/webhooks/poyo-wav via callback.
 *
 * Logs every attempt (success or failure) via logApi — this is the only submit-time
 * record, since a failure here means PoYo never calls back /api/webhooks/poyo-wav.
 */
export async function requestWavConversion(track: {
  id: string;
  jobId: string;
  audioId: string;
  userId?: string | null;
}): Promise<string | null> {
  const startTime = Date.now();
  const originalTaskId = getOriginalPoYoTaskId(track.jobId);
  const requestPayload = { task_id: originalTaskId, audio_id: track.audioId };

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
    console.warn(
      `[wav] conversion request failed for track ${track.id}:`,
      message
    );
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
    return null;
  }
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
