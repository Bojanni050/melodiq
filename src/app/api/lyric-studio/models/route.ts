import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getSetting } from "@/lib/settings";
import { getOpenRouterCatalog } from "@/lib/openrouter-catalog";
import type { LLMModel } from "@/lib/settings-utils";

const FALLBACK_LYRICS_MODEL = "google/gemini-2.5-flash";

export type LyricStudioModelOption = LLMModel;

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

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const apiKey = (await getSetting("OPENROUTER_API_KEY")) || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter is not configured in Settings" }, { status: 400 });
  }

  try {
    // Cached for an hour server-side (src/lib/openrouter-catalog.ts) and for an
    // hour in the browser, so opening the Lyrics Studio twice doesn't re-fetch
    // ~300 KB of model metadata.
    const all = await getOpenRouterCatalog();

    const byId = new Map(all.map((m) => [m.id, m]));
    const recommended = RECOMMENDED_MODEL_PRIORITY
      .map((id) => byId.get(id))
      .filter((m): m is LLMModel => !!m)
      .slice(0, 5);
    const recommendedIds = new Set(recommended.map((m) => m.id));
    const others = all
      .filter((m) => !recommendedIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    const defaultModelId =
      (await getSetting("OPENROUTER_LYRICS_MODEL")) ||
      (await getSetting("OPENROUTER_MODEL")) ||
      process.env.OPENROUTER_MODEL ||
      FALLBACK_LYRICS_MODEL;
    const defaultModel = byId.get(defaultModelId) || {
      id: defaultModelId,
      name: defaultModelId.split("/").pop() || defaultModelId,
      description: "",
      pricing: { prompt: null, completion: null },
    };

    return NextResponse.json(
      { recommended, others, defaultModel },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || "Could not load models";
    return NextResponse.json({ error: message }, { status: error?.response?.status || 500 });
  }
}
