import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";

async function testWaveSpeedApiKey(apiKey: string): Promise<{ ok: true; info: string } | { ok: false; info: string }> {
  const candidates = [
    "https://api.wavespeed.ai/api/v3/user/info",
    "https://api.wavespeed.ai/api/v3/user",
    "https://api.wavespeed.ai/api/v3/account",
    "https://api.wavespeed.ai/api/v3/credits",
    "https://api.wavespeed.ai/api/v3/models",
    "https://api.wavespeed.ai/api/v3/predictions",
    "https://api.wavespeed.ai/api/v1/user/info",
    "https://api.wavespeed.ai/api/v1/user",
    "https://api.wavespeed.ai/api/v1/account",
    "https://api.wavespeed.ai/api/v1/credits",
    "https://api.wavespeed.ai/api/v1/models",
    "https://api.wavespeed.ai/api/v1/predictions",
  ];

  let lastMessage = "Request failed";

  for (const url of candidates) {
    try {
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (res.status === 404) {
        lastMessage = `404 on ${url}`;
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        return { ok: false, info: `Unauthorized (${res.status}). Check WAVESPEED_API_KEY.` };
      }

      if (res.status < 200 || res.status >= 300) {
        const message =
          (res.data && typeof res.data === "object" && (res.data as any).message) ||
          (res.data && typeof res.data === "object" && (res.data as any).error) ||
          `HTTP ${res.status}`;
        lastMessage = `${res.status} on ${url}: ${typeof message === "string" ? message : "Request failed"}`;
        continue;
      }

      const credits = (res.data as any)?.data?.credits ?? (res.data as any)?.credits ?? (res.data as any)?.data?.balance ?? (res.data as any)?.balance;
      const info = credits !== undefined ? `Connected — ${credits} credits` : "Connected — WaveSpeed API is active";
      return { ok: true, info };
    } catch (error: any) {
      lastMessage = error?.message || "Network error";
    }
  }

  return { ok: false, info: `Failed (404): could not find a working WaveSpeed endpoint. Last: ${lastMessage}` };
}

const TEST_ENDPOINTS: Record<string, { url: string; keyPrefix: string; method: "GET" | "POST"; authHeader?: string; authPrefix?: string }> = {
  lyria: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    keyPrefix: "",
    method: "GET",
    authHeader: "x-goog-api-key",
  },
  poyo: {
    url: "https://api.poyo.ai/api/user/balance",
    keyPrefix: "",
    method: "GET",
  },
  tempolor: {
    url: "https://api.tempolor.com/open-apis/v1/account/billing",
    keyPrefix: "",
    method: "POST",
    authPrefix: "",  // key is the full Authorization value (e.g. Tempo-xxxxx-3w)
  },
  musicgpt: {
    url: "https://api.musicgpt.com/api/public/v1/MusicAI",
    keyPrefix: "",
    method: "POST",
  },
  minimax: {
    url: "https://api.minimax.io/v1/user_balance",
    keyPrefix: "",
    method: "GET",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/key",
    keyPrefix: "",
    method: "GET",
  },
  openai: {
    url: "https://api.openai.com/v1/models",
    keyPrefix: "",
    method: "GET",
  },
  apiframe: {
    url: "https://api.apiframe.ai/v2/me",
    keyPrefix: "",
    method: "GET",
    authHeader: "X-API-Key",
  },
};

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { provider, apiKey } = body;

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "Provider and apiKey are required" }, { status: 400 });
  }

  if (provider === "mureka") {
    const result = await testWaveSpeedApiKey(apiKey);
    return NextResponse.json({ success: result.ok, message: result.info });
  }

  const endpoint = TEST_ENDPOINTS[provider];
  if (!endpoint) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      headers: {
        ...(endpoint.authHeader
          ? { [endpoint.authHeader]: apiKey }
          : { Authorization: `${endpoint.authPrefix ?? "Bearer "}${apiKey}` }),
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });

    let info = "Connected";
    let models: any[] = [];

    if (provider === "poyo") {
      info = `Connected — ${response.data.data?.credits_amount ?? "unknown"} credits`;
    } else if (provider === "tempolor") {
      info = `Connected — ${response.data.data?.balance ?? "unknown"} credits`;
    } else if (provider === "musicgpt") {
      info = `Connected — MusicGPT API is active`;
    } else if (provider === "minimax") {
      info = `Connected — MiniMax API is active`;
    } else if (provider === "mureka") {
      const credits = response.data?.data?.credits ?? response.data?.credits;
      info = credits !== undefined ? `Connected — ${credits} credits` : "Connected — WaveSpeed API is active";
    } else if (provider === "apiframe") {
      info = `Connected — APIFrame is active (Max concurrent jobs: ${response.data?.maxConcurrentJobs ?? "unknown"})`;
    } else if (provider === "openrouter") {
      info = `Connected — ${response.data.data?.label || response.data.data?.credits !== undefined ? `${response.data.data.credits} credits` : "authenticated"}`;
      try {
        const modelsRes = await axios.get("https://openrouter.ai/api/v1/models", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        });
        models = (modelsRes.data.data || []).map((m: any) => ({
          id: m.id,
          name: m.name || m.id.split("/").pop(),
          description: m.description || "",
          pricing: {
            prompt: m.pricing?.prompt,
            completion: m.pricing?.completion,
          },
          context_length: m.context_length,
          architecture: m.architecture,
        }));
      } catch {
        models = [];
      }
    } else if (provider === "openai") {
      info = `Connected — ${response.data.data?.length ?? 0} models available`;
    } else if (provider === "lyria") {
      info = `Connected — ${response.data.models?.length ?? response.data.data?.length ?? "unknown"} models available`;
    }

    return NextResponse.json({ success: true, message: info, models });
  } catch (error: any) {
    const status = error.response?.status;
    const message = error.response?.data?.error?.message || error.response?.data?.message || error.message;

    if (provider === "musicgpt" && status === 422) {
      return NextResponse.json({
        success: true,
        message: "Connected — MusicGPT API key is valid (test payload rejected with 422 validation, expected).",
      });
    }

    return NextResponse.json(
      { success: false, message: `Failed (${status || "network error"}): ${message}` },
      { status: 200 }
    );
  }
}
