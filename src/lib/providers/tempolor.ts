import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

const TEMPOLOR_VALID_MODELS = [
  "tempolor-latest",
  "TemPolor i4",
  "TemPolor i3",
  "Eleven Music V2",
  "Lyria 3 Pro",
  "Mureka V9.5",
  "Mureka V9",
  "MiniMax 3.0",
];

// Map legacy/short names → full API model names
const TEMPOLOR_MODEL_ALIASES: Record<string, string> = {
  // Legacy version mappings
  "tempolor v4.6": "tempolor-latest",
  "tempolor v4.5": "tempolor-latest",
  "tempolor v4.0": "tempolor-latest",
  "tempolor v3.5": "tempolor-latest",
  "tempolor v3":   "tempolor-latest",
  "v4.6": "tempolor-latest",
  "v4.5": "tempolor-latest",
  "v4.0": "tempolor-latest",
  "v3.5": "tempolor-latest",
  "v3":   "tempolor-latest",
  "tempolor i3.5": "TemPolor i4",
  "i3.5": "TemPolor i4",
  "i3":   "TemPolor i3",
  "i4":   "TemPolor i4",
  // Provider / short remappings
  "eleven music v2": "Eleven Music V2",
  "elevenlabs": "Eleven Music V2",
  "eleven": "Eleven Music V2",
  "lyria 3 pro": "Lyria 3 Pro",
  "google lyria 3 pro (ly)": "Lyria 3 Pro",
  "lyria": "Lyria 3 Pro",
  "ly": "Lyria 3 Pro",
  "mureka v9.5": "Mureka V9.5",
  "mureka v9": "Mureka V9",
  "mureka (mk)": "Mureka V9",
  "mureka": "Mureka V9",
  "mk": "Mureka V9",
  "minimax 3.0": "MiniMax 3.0",
  "minimax music (mm)": "MiniMax 3.0",
  "minimax": "MiniMax 3.0",
  "mm": "MiniMax 3.0",
};

function normalizeTempolorModel(model?: string): string {
  if (!model) return "tempolor-latest";
  if (TEMPOLOR_VALID_MODELS.includes(model)) return model;
  const rawKey = model.toLowerCase().trim();
  const strippedKey = rawKey.replace(/^tempolor\s+/, "");
  const alias = TEMPOLOR_MODEL_ALIASES[strippedKey] || TEMPOLOR_MODEL_ALIASES[rawKey];
  if (alias) {
    console.warn(`[tempolor] Remapped model "${model}" → "${alias}"`);
    return alias;
  }
  console.warn(`[tempolor] Unknown model "${model}", falling back to tempolor-latest`);
  return "tempolor-latest";
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
