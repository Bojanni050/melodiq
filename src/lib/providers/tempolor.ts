import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

const TEMPOLOR_VALID_MODELS = [
  "TemPolor v4.6",
  "TemPolor v3.5",
  "TemPolor v3",
  "TemPolor i3.5",
  "TemPolor i3",
  "MK",
  "MM",
  "LY",
];

// Map legacy/short names → full API model names
const TEMPOLOR_MODEL_ALIASES: Record<string, string> = {
  "v4.6": "TemPolor v4.6",
  "v4.5": "TemPolor v4.6",
  "v4.0": "TemPolor v4.6",
  "v3.5": "TemPolor v3.5",
  "v3":   "TemPolor v3",
  "i3.5": "TemPolor i3.5",
  "i3":   "TemPolor i3",
  "mureka (mk)": "MK",
  "minimax music (mm)": "MM",
  "google lyria 3 pro (ly)": "LY",
  "mureka": "MK",
  "minimax": "MM",
  "lyria": "LY",
  "mk": "MK",
  "mm": "MM",
  "ly": "LY",
};

function normalizeTempolorModel(model?: string): string {
  if (!model) return "TemPolor v4.6";
  if (TEMPOLOR_VALID_MODELS.includes(model)) return model;
  const alias = TEMPOLOR_MODEL_ALIASES[model.toLowerCase().replace("tempolor ", "").trim()];
  if (alias) {
    console.warn(`[tempolor] Remapped model "${model}" → "${alias}"`);
    return alias;
  }
  console.warn(`[tempolor] Unknown model "${model}", falling back to TemPolor v4.6`);
  return "TemPolor v4.6";
}

export async function generateTempolor({
  prompt,
  lyrics,
  instrumental,
  model,
}: {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  model?: string;
}) {
  const API_KEY = await getSetting("TEMPOLOR_API_KEY");
  const WEBHOOK_URL = await getWebhookUrl("tempolor");
  const startTime = Date.now();

  try {
    const response = await axios.post(
      "https://api.tempolor.com/open-apis/v1/song/generate",
      {
        prompt,
        model: normalizeTempolorModel(model),
        lyrics: lyrics || undefined,
        callback_url: WEBHOOK_URL,
      },
      {
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json; charset=utf-8",
        },
        timeout: 30000,
      }
    );

    if (response.data?.success === false || response.data?.fail === true) {
      console.error("[tempolor] API error response:", JSON.stringify(response.data));
      throw {
        message: response.data.message || "Tempolor generation failed",
        duration: Date.now() - startTime,
        statusCode: response.data.status || 500,
      };
    }

    const itemIds = response.data?.data?.item_ids;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      console.error("[tempolor] Unexpected response structure:", JSON.stringify(response.data));
      throw {
        message: `Tempolor returned no item_ids array. Response: ${JSON.stringify(response.data)}`,
        duration: Date.now() - startTime,
        statusCode: 500,
      };
    }
    return {
      jobIds: itemIds,
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

export async function getTempolorStatus(jobId: string) {
  const API_KEY = await getSetting("TEMPOLOR_API_KEY");
  try {
    const response = await axios.post(
      "https://api.tempolor.com/open-apis/v1/song/detail",
      { item_ids: [jobId] },
      {
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

export async function getTempolorCredits() {
  const API_KEY = await getSetting("TEMPOLOR_API_KEY");
  try {
    const response = await axios.post(
      "https://api.tempolor.com/open-apis/v1/account/billing",
      {},
      { headers: { Authorization: API_KEY } }
    );
    return response.data?.data?.balance ?? null;
  } catch (error: any) {
    console.warn("[tempolor] Failed to fetch credits:", error.message);
    return null;
  }
}
