import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";
import { logApi } from "@/lib/logger";
import { createApimartWav } from "@/lib/providers/apimart";
import { apimartAudioIndexForJobId } from "@/lib/apimart-wav";

const MAX_SUBMIT_ATTEMPTS = 3;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 5000;

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
 * Vraagt WAV conversie aan bij APIMart's eigen endpoint.
 * APIMart stuurt het resultaat naar de webhook.
 */
async function requestApimartWavConversion(track: {
  id: string;
  jobId: string;
  audioId: string;
  userId?: string | null;
}): Promise<string | null> {
  const startTime = Date.now();
  try {
    // APIMart jobId format: "taskId" (first track) or "taskId:1" (second track) —
    // same convention as apimartAudioIndexForJobId / the polling fallbacks, not a
    // comma-separated pair.
    const taskId = track.jobId.split(":")[0];
    const audioIndex = apimartAudioIndexForJobId(track.jobId);
    const result = await createApimartWav(taskId, audioIndex);
    
    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "apimart",
      endpoint: "/api/generate/submit (convert-to-wav)",
      request: JSON.stringify({ trackId: track.id, taskId, audioIndex }),
      response: JSON.stringify({ taskId: result.taskId }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });
    
    console.log(`[wav] APIMart conversion task_id: ${result.taskId} for track ${track.id}`);
    return result.taskId;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "apimart",
      endpoint: "/api/generate/submit (convert-to-wav)",
      request: JSON.stringify({ trackId: track.id }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });
    console.warn(`[wav] APIMart conversion request failed for track ${track.id}:`, message);
    return null;
  }
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
  provider?: string | null;
}): Promise<string | null> {
  // APIMart has its own WAV endpoint — don't send it to PoYo
  if (track.provider === "apimart") {
    return requestApimartWavConversion(track);
  }

  // Default: PoYo convert-to-wav flow
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

