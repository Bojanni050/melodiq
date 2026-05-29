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
}: {
  lyrics: string;
  prompt?: string;
  numberOfSongs?: number;
  outputFormat?: "mp3" | "wav" | "flac";
  webhookUrl?: string;
}): Promise<MurekaSubmitResponse> {
  const apiKey = (await getSetting("WAVESPEED_API_KEY")) || process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not configured");

  const response = await axios.post(
    "https://api.wavespeed.ai/api/v3/mureka-ai/mureka-v9/generate-song",
    {
      lyrics,
      ...(prompt ? { prompt } : {}),
      number_of_songs: numberOfSongs,
      output_format: outputFormat,
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    },
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
