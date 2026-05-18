import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

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
        model: model || "TemPolor v4.0",
        lyrics: lyrics || undefined,
        callback_url: WEBHOOK_URL,
      },
      {
        headers: {
          Authorization: `Tempo-${API_KEY}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );

    return {
      jobId: response.data.data.item_ids[0],
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
          Authorization: `Tempo-${API_KEY}`,
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
      { headers: { Authorization: `Tempo-${API_KEY}` } }
    );
    return response.data?.data?.balance ?? null;
  } catch {
    return null;
  }
}
