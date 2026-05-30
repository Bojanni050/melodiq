import axios from "axios";
import { getSetting } from "@/lib/settings";

export interface MurekaSubmitResponse {
  requestId: string;
}

export interface MurekaResult {
  status: "pending" | "processing" | "completed" | "failed";
  outputs?: string[];
  error?: string;
}

export async function generateMureka({
  lyrics,
  prompt,
  numberOfSongs = 2,
  outputFormat = "mp3",
  webhookUrl,
  instrumental = false,
}: {
  lyrics?: string;
  prompt?: string;
  numberOfSongs?: number;
  outputFormat?: "mp3" | "wav" | "flac";
  webhookUrl?: string;
  instrumental?: boolean;
}): Promise<MurekaSubmitResponse> {
  const apiKey = (await getSetting("WAVESPEED_API_KEY")) || process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not configured");

  const endpoint = instrumental ? "generate-bgm" : "generate-song";
  const url = webhookUrl
    ? `https://api.wavespeed.ai/api/v3/mureka-ai/mureka-v9/${endpoint}?webhook=${encodeURIComponent(webhookUrl)}`
    : `https://api.wavespeed.ai/api/v3/mureka-ai/mureka-v9/${endpoint}`;

  const body: Record<string, any> = {
    number_of_songs: numberOfSongs,
    output_format: outputFormat,
  };

  if (instrumental) {
    if (!prompt) throw new Error("Prompt is required for Mureka instrumental tracks");
    body.prompt = prompt;
  } else {
    if (!lyrics) throw new Error("Lyrics are required for Mureka vocal tracks");
    body.lyrics = lyrics;
    if (prompt) body.prompt = prompt;
  }

  const response = await axios.post(
    url,
    body,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const requestId = response.data?.data?.id ?? response.data?.id;
  if (!requestId) {
    throw new Error(`Mureka returned no request ID. Response: ${JSON.stringify(response.data)}`);
  }

  console.log(`[mureka] job submitted — requestId=${requestId}`);
  return { requestId };
}

export async function getMurekaResult(requestId: string): Promise<MurekaResult> {
  const apiKey = (await getSetting("WAVESPEED_API_KEY")) || process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not configured");

  const response = await axios.get(
    `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 15000,
    }
  );

  const data = response.data?.data ?? response.data;
  const status = (data?.status ?? "pending").toLowerCase();
  const outputs: string[] = Array.isArray(data?.outputs)
    ? data.outputs.filter((u: unknown) => typeof u === "string")
    : [];

  return {
    status: status === "completed" ? "completed" : status === "failed" ? "failed" : "processing",
    outputs,
    error: data?.error ?? undefined,
  };
}
