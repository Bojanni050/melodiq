import axios from "axios";
import { getSetting } from "@/lib/settings";

export interface HeartMulaSubmitResponse {
  requestId: string;
}

export interface HeartMulaResult {
  status: "pending" | "processing" | "completed" | "failed";
  outputs?: string[];
  error?: string;
}

export async function generateHeartMula({
  lyrics,
  tags,
  seed,
  webhookUrl,
}: {
  lyrics: string;
  tags?: string;
  seed?: number;
  webhookUrl?: string;
}): Promise<HeartMulaSubmitResponse> {
  const apiKey = (await getSetting("WAVESPEED_API_KEY")) || process.env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("WAVESPEED_API_KEY not configured");

  if (!lyrics?.trim()) {
    throw new Error("Lyrics with structure tags are required for HeartMuLa");
  }

  const url = webhookUrl
    ? `https://api.wavespeed.ai/api/v3/wavespeed-ai/heartmula/generate-music?webhook=${encodeURIComponent(webhookUrl)}`
    : `https://api.wavespeed.ai/api/v3/wavespeed-ai/heartmula/generate-music`;

  const body: Record<string, any> = { lyrics };
  if (tags) body.tags = tags;
  if (seed !== undefined) body.seed = seed;

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
    throw new Error(`HeartMuLa returned no request ID. Response: ${JSON.stringify(response.data)}`);
  }

  console.log(`[heartmula] job submitted — requestId=${requestId}`);
  return { requestId };
}

export async function getHeartMulaResult(requestId: string): Promise<HeartMulaResult> {
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
