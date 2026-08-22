import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";

// Eden AI's model catalog is public (no API key required), unlike the
// per-provider connection test in /api/settings/test — this is just a
// read-only lookup for the Settings model pickers.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await axios.get("https://api.edenai.run/v3/models", { timeout: 15000 });
    const models = (res.data?.data || []).map((m: any) => ({
      id: m.id,
      name: m.model_name || m.id,
      description: m.description || "",
      pricing: {
        prompt: m.pricing?.input_cost_per_token ?? 0,
        completion: m.pricing?.output_cost_per_token ?? 0,
      },
      context_length: m.context_length,
      architecture: {
        modality: (m.capabilities?.input_modalities || []).join(", "),
        tokenizer: "",
        instruct_type: "",
      },
    }));

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error("[edenai-models] failed:", error?.message ?? error);
    return NextResponse.json({ error: "Failed to fetch Eden AI models" }, { status: 502 });
  }
}
