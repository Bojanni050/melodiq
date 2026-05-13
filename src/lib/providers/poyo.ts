import axios from "axios";

const API_KEY = process.env.POYO_API_KEY || "";
const WEBHOOK_URL = process.env.POYO_WEBHOOK_URL || "";

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
  const startTime = Date.now();
  try {
    const response = await axios.post(
      "https://api.poyo.com/v1/generate",
      {
        model: model || "v5.5",
        prompt,
        lyrics: lyrics || undefined,
        instrumental: instrumental || false,
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

export async function getPoYoStatus(jobId: string) {
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
  try {
    const response = await axios.get("https://api.poyo.com/v1/credits", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data.credits;
  } catch {
    return null;
  }
}
