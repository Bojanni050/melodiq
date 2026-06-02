import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

const POYO_VALID_MODELS = ["V4", "V4_5", "V4_SALL", "V4_SPLUS", "V5", "V5_5"];
const MINIMAX_MUSIC_26 = "minimax-music-2.6";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFromPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isJsonObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function getFirstArray(value: unknown, paths: string[][]): unknown[] {
  for (const path of paths) {
    const candidate = getFromPath(value, path);
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function getStringField(obj: JsonObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function normalizePoYoModel(model?: string): string {
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
  gender,
  weirdness,
  styleInfluence,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  model?: string;
  title?: string;
  gender?: string;
  weirdness?: number;
  styleInfluence?: number;
}) {
  const API_KEY = await getSetting("POYO_API_KEY");
  const WEBHOOK_URL = await getWebhookUrl("poyo");
  const startTime = Date.now();

  type PoYoSubmitResponse = {
    task_id?: string;
    data?: { task_id?: string };
  };

  try {
    const response = await axios.post<PoYoSubmitResponse>(
      "https://api.poyo.ai/api/generate/submit",
      {
        model: "generate-music",
        callback_url: WEBHOOK_URL,
        input: {
          custom_mode: !!lyrics,
          instrumental: instrumental ?? false,
          mv: normalizePoYoModel(model),
          ...(gender ? { vocal_gender: gender === "male" ? "m" : "f" } : {}),
          ...(weirdness !== undefined ? { weirdness_constraint: weirdness } : {}),
          ...(styleInfluence !== undefined ? { style_weight: styleInfluence } : {}),
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

export async function getPoYoStatus(jobId: string): Promise<unknown> {
  const API_KEY = await getSetting("POYO_API_KEY");
  try {
    const response = await axios.get<unknown>(
      `https://api.poyo.ai/api/generate/status/${jobId}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      }
    );
    return response.data;
  } catch (error: any) {
    const isMusicTaskError =
      error.response?.status === 400 &&
      (String(error.response?.data?.error?.message || error.response?.data?.message || "").includes("detail/music") ||
       String(error.response?.data?.error?.message || error.response?.data?.message || "").includes("music generation"));

    if (isMusicTaskError) {
      console.log(`[poyo] Job ${jobId} is a music generation task. Fetching details via GET generate/detail/music?task_id=${jobId}...`);
      try {
        const detailRes = await axios.get<unknown>(
          `https://api.poyo.ai/api/generate/detail/music?task_id=${jobId}`,
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
            },
            timeout: 30000,
          }
        );
        return detailRes.data;
      } catch (getError: any) {
        throw new Error(
          getError.response?.data?.error?.message || getError.response?.data?.message || getError.message
        );
      }
    }
    throw new Error(error.response?.data?.error?.message || error.response?.data?.message || error.message);
  }
}

function stripQuery(url: string): string {
  return url.split("?")[0];
}

export function inferVariantKey(file: unknown, index: number): string {
  const obj = isJsonObject(file) ? file : {};

  const explicit = getStringField(obj, [
    "audio_id",
    "audioId",
    "song_id",
    "songId",
    "id",
    "clip_id",
    "track_id",
    "file_id",
    "fileId",
  ]);
  if (explicit) return explicit;

  const url =
    getStringField(obj, ["audio_url", "audio_url_hd", "wav_url", "mp3_url", "url"]) || "";
  if (!url) return `variant-${index + 1}`;

  const clean = stripQuery(url);
  const withoutExt = clean.replace(/\.(mp3|wav)$/i, "");
  return withoutExt.replace(/_(mp3|wav|hd)$/i, "");
}

export function getPoYoStatusValue(payload: unknown): string {
  const status =
    getStringField(isJsonObject(payload) ? payload : {}, ["status"]) ||
    getStringField(isJsonObject(getFromPath(payload, ["data"])) ? (getFromPath(payload, ["data"]) as JsonObject) : {}, ["status"]) ||
    "";
  return status.toLowerCase();
}

export function extractPoYoErrorMessage(payload: unknown): string | null {
  const directCandidates: unknown[] = [
    getFromPath(payload, ["error"]),
    getFromPath(payload, ["error_message"]),
    getFromPath(payload, ["message"]),
    getFromPath(payload, ["msg"]),
    getFromPath(payload, ["reason"]),
    getFromPath(payload, ["status_msg"]),
    getFromPath(payload, ["detail"]),
    getFromPath(payload, ["error", "message"]),
    getFromPath(payload, ["error", "msg"]),
    getFromPath(payload, ["error", "reason"]),
    getFromPath(payload, ["data", "error"]),
    getFromPath(payload, ["data", "error_message"]),
    getFromPath(payload, ["data", "message"]),
    getFromPath(payload, ["data", "msg"]),
    getFromPath(payload, ["data", "reason"]),
    getFromPath(payload, ["data", "status_msg"]),
    getFromPath(payload, ["data", "detail"]),
    getFromPath(payload, ["data", "error", "message"]),
    getFromPath(payload, ["data", "error", "msg"]),
    getFromPath(payload, ["data", "error", "reason"]),
    getFromPath(payload, ["result", "error"]),
    getFromPath(payload, ["result", "error_message"]),
    getFromPath(payload, ["result", "message"]),
    getFromPath(payload, ["result", "reason"]),
    getFromPath(payload, ["result", "status_msg"]),
    getFromPath(payload, ["result", "detail"]),
    getFromPath(payload, ["result", "error", "message"]),
    getFromPath(payload, ["output", "error"]),
    getFromPath(payload, ["output", "error_message"]),
    getFromPath(payload, ["output", "message"]),
    getFromPath(payload, ["output", "reason"]),
    getFromPath(payload, ["output", "status_msg"]),
    getFromPath(payload, ["output", "detail"]),
    getFromPath(payload, ["output", "error", "message"]),
  ];

  const message = firstNonEmptyString(directCandidates);
  if (message) return message;

  const errorObject = getFromPath(payload, ["error"]);
  if (isJsonObject(errorObject)) {
    const serialized = JSON.stringify(errorObject);
    if (serialized !== "{}") return serialized;
  }

  return null;
}

export type PoYoVariant = { audioId?: string; audioUrl?: string; audioUrlHd?: string; title?: string };

export function extractPoYoVariants(payload: unknown): PoYoVariant[] {
  const rawFiles = getFirstArray(payload, [
    ["files"],
    ["data", "files"],
    ["data", "output", "files"],
    ["data", "result", "files"],
    ["result", "files"],
    ["output", "files"],
  ]);

  const grouped = new Map<string, PoYoVariant>();

  rawFiles.forEach((file, index) => {
    if (!isJsonObject(file)) return;

    // Lenient file_type check — only skip if explicitly non-audio
    const fileType = (getStringField(file, ["file_type", "fileType", "type"]) || "").toLowerCase();
    if (fileType && !["audio", "mp3", "wav", "music"].some((t) => fileType.includes(t))) return;

    const key = inferVariantKey(file, index);
    const existing = grouped.get(key) || {};

    const mp3Url = getStringField(file, ["audio_url", "mp3_url", "url", "download_url", "file_url"]);
    const wavUrl = getStringField(file, ["audio_url_hd", "wav_url", "url_hd", "download_url_hd"]);
    const fallbackUrl = mp3Url || wavUrl;

    const next = {
      audioId: existing.audioId || getStringField(file, ["audio_id", "audioId", "file_id", "fileId"]),
      title: getStringField(file, ["title", "name"]) || existing.title,
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
    // Check multiple possible locations for direct audio URL
    const fallbackAudioCandidate = [
      getFromPath(payload, ["audio_url"]),
      getFromPath(payload, ["data", "audio_url"]),
      getFromPath(payload, ["data", "output", "audio_url"]),
      getFromPath(payload, ["data", "result", "audio_url"]),
      getFromPath(payload, ["result", "audio_url"]),
      getFromPath(payload, ["output", "audio_url"]),
    ].find((value) => typeof value === "string" && value.trim());
    const fallbackAudioHdCandidate = [
      getFromPath(payload, ["audio_url_hd"]),
      getFromPath(payload, ["data", "audio_url_hd"]),
      getFromPath(payload, ["data", "output", "audio_url_hd"]),
      getFromPath(payload, ["data", "result", "audio_url_hd"]),
      getFromPath(payload, ["result", "audio_url_hd"]),
      getFromPath(payload, ["output", "audio_url_hd"]),
    ].find((value) => typeof value === "string" && value.trim());

    const fallbackAudio = typeof fallbackAudioCandidate === "string" ? fallbackAudioCandidate : undefined;
    const fallbackAudioHd = typeof fallbackAudioHdCandidate === "string" ? fallbackAudioHdCandidate : undefined;
    if (fallbackAudio || fallbackAudioHd) {
      return [{ audioUrl: fallbackAudio || fallbackAudioHd, audioUrlHd: fallbackAudioHd }];
    }
  }

  return variants;
}

export async function getPoYoTimestampedLyrics(taskId: string, audioId: string): Promise<unknown> {
  const API_KEY = await getSetting("POYO_API_KEY");

  const response = await axios.post<unknown>(
    "https://api.poyo.ai/api/generate/submit",
    {
      model: "get-timestamped-lyrics",
      input: {
        task_id: taskId,
        audio_id: audioId,
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

  return response.data;
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

  type PoYoSubmitResponse = {
    task_id?: string;
    data?: { task_id?: string };
  };

  try {
    const response = await axios.post<PoYoSubmitResponse>(
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
    const raw = response.data.data?.credits_amount;
    if (raw === null || raw === undefined) return null;
    // PoYo returns credits as decimal (e.g. 9.08), multiply by 100 for whole credits
    const num = typeof raw === "string" ? parseFloat(raw) : Number(raw);
    return num < 100 ? Math.round(num * 100) : Math.round(num);
  } catch (error: any) {
    console.warn("[poyo] Failed to fetch credits:", error.message);
    return null;
  }
}
