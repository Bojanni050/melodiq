import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";

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
    authPrefix: "Tempo-",  // Tempolor requires "Tempo-{key}", not "Bearer {key}"
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
};

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { provider, apiKey } = body;

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "Provider and apiKey are required" }, { status: 400 });
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
      },
      timeout: 10000,
    });

    let info = "Connected";
    let models: any[] = [];

    if (provider === "poyo") {
      info = `Connected — ${response.data.data?.credits_amount ?? "unknown"} credits`;
    } else if (provider === "tempolor") {
      info = `Connected — ${response.data.data?.balance ?? "unknown"} credits`;
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
    return NextResponse.json(
      { success: false, message: `Failed (${status || "network error"}): ${message}` },
      { status: 200 }
    );
  }
}
