import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import axios from "axios";

const TEST_ENDPOINTS: Record<string, { url: string; keyPrefix: string }> = {
  lyria: {
    url: "https://api.lyria.google.com/v1/models",
    keyPrefix: "",
  },
  poyo: {
    url: "https://api.poyo.com/v1/credits",
    keyPrefix: "",
  },
  tempolor: {
    url: "https://api.tempolor.com/v1/credits",
    keyPrefix: "",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/auth/whoami",
    keyPrefix: "",
  },
  openai: {
    url: "https://api.openai.com/v1/models",
    keyPrefix: "",
  },
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const response = await axios.get(endpoint.url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    let info = "Connected";
    let models: any[] = [];

    if (provider === "poyo" || provider === "tempolor") {
      info = `Connected — ${response.data.credits ?? "unknown"} credits`;
    } else if (provider === "openrouter") {
      info = `Connected — ${response.data.data?.name || response.data.data?.email || "authenticated"}`;
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
