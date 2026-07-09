import axios from "axios";
import { getSetting, getWebhookUrl } from "@/lib/settings";

function extractModelCode(model?: string): string {
  if (!model) return "suno";
  const match = model.match(/\(([^)]+)\)/);
  if (match) return match[1].trim().toLowerCase();
  return model.trim().toLowerCase();
}

export async function generateApiframe({
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
  const API_KEY = await getSetting("APIFRAME_API_KEY");
  if (!API_KEY) throw new Error("APIFRAME_API_KEY not configured");

  const WEBHOOK_URL = await getWebhookUrl("apiframe");
  const startTime = Date.now();
  const modelCode = extractModelCode(model);

  const requestBody: Record<string, any> = {
    model: modelCode,
    prompt: prompt,
  };

  if (WEBHOOK_URL) {
    requestBody.webhookUrl = WEBHOOK_URL;
    requestBody.webhookEvents = ["completed", "failed"];
  }

  // Model-specific parameters
  if (modelCode === "suno") {
    const isCustom = !!lyrics && !instrumental;
    requestBody.sunoParams = {
      custom_mode: isCustom,
      instrumental: !!instrumental,
    };
    if (title) requestBody.sunoParams.title = title;
    
    if (isCustom) {
      // For Suno custom mode, the prompt is the custom lyrics
      requestBody.prompt = lyrics;
      // The style/genre goes into sunoParams.style
      requestBody.sunoParams.style = prompt;
    }
  } else if (modelCode === "udio") {
    const lyricsType = instrumental ? "instrumental" : lyrics ? "user" : "generate";
    requestBody.udioParams = {
      lyrics_type: lyricsType,
      style: prompt,
    };
    if (title) requestBody.udioParams.title = title;
    if (lyricsType === "user") {
      requestBody.udioParams.lyrics = lyrics;
    }
  }

  try {
    const response = await axios.post(
      "https://api.apiframe.ai/v2/music/generate",
      requestBody,
      {
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const jobId = response.data?.jobId || response.data?.id || response.data?.task_id;
    if (!jobId) {
      console.error("[apiframe] Unexpected response structure:", JSON.stringify(response.data));
      throw new Error(`APIFrame returned no job ID. Response: ${JSON.stringify(response.data)}`);
    }

    return {
      jobId,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    const isCopyright =
      error.response?.status === 400 &&
      /copyright|policy|blocked/i.test(error.response?.data?.error || error.response?.data?.message || "");
    throw {
      message: isCopyright ? "COPYRIGHT" : error.response?.data?.error || error.response?.data?.message || error.message,
      duration: Date.now() - startTime,
      statusCode: error.response?.status,
    };
  }
}

export async function getApiframeStatus(jobId: string) {
  const API_KEY = await getSetting("APIFRAME_API_KEY");
  if (!API_KEY) throw new Error("APIFRAME_API_KEY not configured");

  try {
    const response = await axios.get(
      `https://api.apiframe.ai/v2/jobs/${jobId}`,
      {
        headers: {
          "X-API-Key": API_KEY,
        },
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.response?.data?.message || error.message);
  }
}

export async function getApiframeCredits() {
  const API_KEY = await getSetting("APIFRAME_API_KEY");
  if (!API_KEY) return null;

  try {
    const response = await axios.get(
      "https://api.apiframe.ai/v2/me",
      {
        headers: {
          "X-API-Key": API_KEY,
        },
        timeout: 10000,
      }
    );
    return response.data?.maxConcurrentJobs ?? null;
  } catch (error: any) {
    console.warn("[apiframe] Failed to fetch account info:", error.message);
    return null;
  }
}
