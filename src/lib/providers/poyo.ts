import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

export async function generatePoYo({
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
          prompt,
          lyrics: lyrics || undefined,
          instrumental: instrumental || false,
          custom_mode: true,
          mv: model || "V5_5",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const duration = Date.now() - startTime;
    return {
      jobId: response.data.data.task_id,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy/i.test(error.response?.data?.message || "");
    throw {
      message: isCopyright
        ? "COPYRIGHT"
        : error.response?.data?.message || error.message,
      duration,
      statusCode: error.response?.status,
    };
  }
}

export async function getPoYoStatus(jobId: string) {
  const API_KEY = await getSetting("POYO_API_KEY");
  try {
    const response = await axios.get(
      `https://api.poyo.com/v1/jobs/${jobId}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

export async function getPoYoCredits() {
  const API_KEY = await getSetting("POYO_API_KEY");
  try {
    const response = await axios.get("https://api.poyo.com/v1/credits", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data.credits;
  } catch {
    return null;
  }
}
