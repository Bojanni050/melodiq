import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";
import { getSetting } from "@/lib/settings";

export interface LyricStudioModelOption {
  id: string;
  name: string;
}

// Priority order for the "recommended" group — flagship, strong-at-creative-writing
// models. Only ones actually present in the live OpenRouter catalog are kept, so this
// list can safely list more than 5 candidates as a fallback chain.
const RECOMMENDED_MODEL_PRIORITY = [
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5.1",
  "openai/gpt-5",
  "google/gemini-3-pro-preview",
  "google/gemini-2.5-pro",
  "x-ai/grok-4",
  "deepseek/deepseek-chat-v3.1",
  "mistralai/mistral-large-2411",
];

function isTextCapable(model: any): boolean {
  const arch = model?.architecture || {};
  if (Array.isArray(arch.input_modalities) && Array.isArray(arch.output_modalities)) {
    return arch.input_modalities.includes("text") && arch.output_modalities.includes("text");
  }
  const modality = typeof arch.modality === "string" ? arch.modality : "";
  if (modality) {
    const [input, output] = modality.split("->");
    return (input || "").includes("text") && (output || "").includes("text");
  }
  return true;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const apiKey = (await getSetting("OPENROUTER_API_KEY")) || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter is not configured in Settings" }, { status: 400 });
  }

  try {
    const response = await axios.get("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 15000,
    });

    const all: LyricStudioModelOption[] = (response.data?.data || [])
      .filter(isTextCapable)
      .map((m: any) => ({ id: m.id as string, name: (m.name || m.id.split("/").pop()) as string }));

    const byId = new Map(all.map((m) => [m.id, m]));
    const recommended = RECOMMENDED_MODEL_PRIORITY
      .map((id) => byId.get(id))
      .filter((m): m is LyricStudioModelOption => !!m)
      .slice(0, 5);
    const recommendedIds = new Set(recommended.map((m) => m.id));
    const others = all
      .filter((m) => !recommendedIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ recommended, others });
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || "Could not load models";
    return NextResponse.json({ error: message }, { status: error?.response?.status || 500 });
  }
}
