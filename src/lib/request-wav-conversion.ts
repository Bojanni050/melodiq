import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

/**
 * Vraagt WAV conversie aan bij PoYo voor een gegenereerde track.
 * Returns de WAV task_id of null bij failure.
 * PoYo stuurt het WAV resultaat naar /api/webhooks/poyo-wav via callback.
 */
export async function requestWavConversion(track: {
  id: string;
  jobId: string;
  audioId: string;
}): Promise<string | null> {
  try {
    const apiKey =
      (await getSetting("POYO_API_KEY")) || process.env.POYO_API_KEY || "";

    if (!apiKey) {
      console.warn("[wav] POYO_API_KEY not configured, skipping WAV conversion");
      return null;
    }

    const webhookUrl = await getWebhookUrl("poyo_wav");

    const response = await axios.post(
      "https://api.poyo.ai/api/generate/submit",
      {
        model: "convert-to-wav",
        callback_url: webhookUrl,
        input: {
          task_id: track.jobId,
          audio_id: track.audioId,
        },
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

    if (wavTaskId) {
      console.log(
        `[wav] conversion task_id: ${wavTaskId} for track ${track.id} (audio_id: ${track.audioId})`
      );
      return wavTaskId;
    }

    console.warn(`[wav] no task_id in response for track ${track.id}`);
    return null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[wav] conversion request failed for track ${track.id}:`,
      message
    );
    return null;
  }
}
