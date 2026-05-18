import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

const POYO_VALID_MODELS = ["V4", "V4_5", "V4_SALL", "V4_SPLUS", "V5", "V5_5"];

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
                lyrics,
                style: prompt,
                title: title || "Generated Track",
              }
            : {
                prompt,
              }),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      jobId: response.data.data.task_id,
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

export async function getPoYoCredits() {
  const API_KEY = await getSetting("POYO_API_KEY");
  try {
    const response = await axios.get("https://api.poyo.ai/api/user/balance", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data.data?.credits_amount;
  } catch {
    return null;
  }
}
