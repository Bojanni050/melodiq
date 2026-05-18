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
      "https://api.tempolor.com/open-apis/v1/generate",
      {
        model: model || "v4.6",
        prompt,
        lyrics: lyrics || undefined,
        instrumental: instrumental || false,
        hd: true,
        webhook_url: WEBHOOK_URL,
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
      jobId: response.data.job_id,
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

export async function getTempolorStatus(jobId: string) {
  const API_KEY = await getSetting("TEMPOLOR_API_KEY");
  try {
    const response = await axios.get(
      `https://api.tempolor.com/open-apis/v1/jobs/${jobId}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
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
    const response = await axios.get("https://api.tempolor.com/open-apis/v1/credits", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data.credits;
  } catch {
    return null;
  }
}
