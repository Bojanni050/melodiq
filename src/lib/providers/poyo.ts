import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

const POYO_VALID_MODELS = ["V4", "V4_5", "V4_SALL", "V4_SPLUS", "V5", "V5_5"];
const MINIMAX_MUSIC_26 = "minimax-music-2.6";

function normalizePoYoModel(model?: string): string {
  if (!model) return "V5_5";
  const normalized = model.toUpperCase().replace(/\./g, "_");
  if (!POYO_VALID_MODELS.includes(normalized)) {
    console.warn(`Invalid PoYo model ${normalized}, falling back to V5_5`);
    return "V5_5";
  }
  return normalized;
}

export async function generatePoYo({
  prompt,
  lyrics,
  instrumental,
  model,
  title,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  model?: string;
  title?: string;
}) {
  const API_KEY = await getSetting("POYO_API_KEY");
  const WEBHOOK_URL = await getWebhookUrl("poyo");
  const startTime = Date.now();

  try {
    const response = await axios.post(
      "https://api.poyo.ai/api/generate/submit",
      {
        model: "generate-music",
        callback_url: WEBHOOK_URL,
        input: {
          custom_mode: !!lyrics,
          instrumental: instrumental ?? false,
          mv: normalizePoYoModel(model),
          ...(lyrics
            ? {
                prompt: lyrics,   // PoYo sings whatever is in `prompt` in custom mode
                style: prompt,    // our style prompt goes here
                title: title || "Generated Track",
              }
            : {
                prompt,           // non-custom: style/idea, PoYo auto-generates lyrics
              }),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const taskId = response.data?.data?.task_id ?? response.data?.task_id;
    if (!taskId) {
      console.error("[poyo] Unexpected response structure:", JSON.stringify(response.data));
      throw {
        message: `PoYo returned no task_id. Response: ${JSON.stringify(response.data)}`,
        duration: Date.now() - startTime,
        statusCode: 500,
      };
    }
    return {
      jobIds: [taskId],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy/i.test(error.response?.data?.message || "");
    throw {
      message: isCopyright ? "COPYRIGHT" : error.response?.data?.message || error.message,
      duration: Date.now() - startTime,
      statusCode: error.response?.status,
    };
  }
}

export async function getPoYoStatus(jobId: string) {
  const API_KEY = await getSetting("POYO_API_KEY");
  try {
    const response = await axios.get(
      `https://api.poyo.ai/api/generate/status/${jobId}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.response?.data?.message || error.message);
  }
}

function stripQuery(url: string): string {
  return url.split("?")[0];
}

function inferVariantKey(file: any, index: number): string {
  const explicit =
    file?.audio_id ||
    file?.audioId ||
    file?.song_id ||
    file?.songId ||
    file?.id ||
    file?.clip_id ||
    file?.track_id;
  if (explicit) return String(explicit);

  const url = file?.audio_url || file?.audio_url_hd || file?.wav_url || file?.mp3_url || "";
  if (!url) return `variant-${index + 1}`;

  const clean = stripQuery(String(url));
  const withoutExt = clean.replace(/\.(mp3|wav)$/i, "");
  return withoutExt.replace(/_(mp3|wav|hd)$/i, "");
}

export function getPoYoStatusValue(payload: any): string {
  return String(payload?.status || payload?.data?.status || "").toLowerCase();
}

export function extractPoYoVariants(payload: any): Array<{ audioId?: string; audioUrl?: string; audioUrlHd?: string; title?: string }> {
  const rawFiles: any[] = payload?.files || payload?.data?.files || [];
  const grouped = new Map<string, { audioId?: string; audioUrl?: string; audioUrlHd?: string; title?: string }>();

  rawFiles.forEach((file, index) => {
    const key = inferVariantKey(file, index);
    const existing = grouped.get(key) || {};

    const mp3Url = file?.audio_url || file?.mp3_url || file?.url;
    const wavUrl = file?.audio_url_hd || file?.wav_url;
    const fallbackUrl = mp3Url || wavUrl;

    const next = {
      audioId: existing.audioId || file?.audio_id || file?.audioId,
      title: file?.title || file?.name || existing.title,
      audioUrl: existing.audioUrl || mp3Url || (fallbackUrl && /\.mp3(\?|$)/i.test(fallbackUrl) ? fallbackUrl : undefined),
      audioUrlHd:
        existing.audioUrlHd ||
        wavUrl ||
        (fallbackUrl && /\.wav(\?|$)/i.test(fallbackUrl) ? fallbackUrl : undefined),
    };

    if (!next.audioUrl && fallbackUrl) {
      next.audioUrl = fallbackUrl;
    }

    grouped.set(key, next);
  });

  const variants = Array.from(grouped.values()).filter((v) => v.audioUrl || v.audioUrlHd);

  if (variants.length === 0) {
    const fallbackAudio = payload?.audio_url || payload?.data?.audio_url;
    const fallbackAudioHd = payload?.audio_url_hd || payload?.data?.audio_url_hd;
    if (fallbackAudio || fallbackAudioHd) {
      return [{ audioUrl: fallbackAudio || fallbackAudioHd, audioUrlHd: fallbackAudioHd }];
    }
  }

  return variants;
}

export async function generateMinimaxMusic26({
  prompt,
  lyrics,
  instrumental,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
}) {
  const API_KEY = await getSetting("POYO_API_KEY");
  const WEBHOOK_URL = await getWebhookUrl("poyo");
  const startTime = Date.now();

  const isInstrumental = instrumental ?? false;
  const hasLyrics = !isInstrumental && lyrics && lyrics.length > 0;

  try {
    const response = await axios.post(
      "https://api.poyo.ai/api/generate/submit",
      {
        model: MINIMAX_MUSIC_26,
        callback_url: WEBHOOK_URL,
        input: {
          prompt,
          ...(hasLyrics ? { lyrics } : {}),
          ...(isInstrumental ? { is_instrumental: true } : {}),
          ...(!hasLyrics && !isInstrumental ? { lyrics_optimizer: true } : {}),
          audio_setting: {
            sample_rate: 44100,
            bitrate: 256000,
            format: "mp3",
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const taskId = response.data?.data?.task_id ?? response.data?.task_id;
    if (!taskId) {
      console.error("[poyo/minimax] Unexpected response structure:", JSON.stringify(response.data));
      throw {
        message: `Minimax Music 2.6 returned no task_id. Response: ${JSON.stringify(response.data)}`,
        duration: Date.now() - startTime,
        statusCode: 500,
      };
    }
    return {
      jobIds: [taskId],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy/i.test(error.response?.data?.message || "");
    throw {
      message: isCopyright ? "COPYRIGHT" : error.response?.data?.message || error.message,
      duration: Date.now() - startTime,
      statusCode: error.response?.status,
    };
  }
}

export async function getPoYoCredits() {
  const API_KEY = await getSetting("POYO_API_KEY");
  try {
    const response = await axios.get("https://api.poyo.ai/api/user/balance", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data.data?.credits_amount;
  } catch (error: any) {
    console.warn("[poyo] Failed to fetch credits:", error.message);
    return null;
  }
}
