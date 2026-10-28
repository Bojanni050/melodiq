import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";

const DEEPINFRA_MODELS_URL = "https://api.deepinfra.com/v1/openai/models";

// DeepInfra's OpenAI-compatible model catalog is public (no API key required),
// just like Eden AI's — this is only a read-only lookup for the Settings model
// pickers. Prices in the catalog are USD per 1M tokens; the LLMModel shape
// stores per-token prices, so they are divided down here.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await axios.get(DEEPINFRA_MODELS_URL, { timeout: 15000 });
    const models = (res.data?.data || [])
      .filter((m: any) => (m.metadata?.tags || []).includes("chat"))
      .map((m: any) => {
        const metadata = m.metadata || {};
        const tags: string[] = metadata.tags || [];
        const canSee = tags.includes("vision");

        return {
          id: m.id,
          name: m.id.split("/").pop() || m.id,
          description: metadata.description || "",
          pricing: {
            prompt: (metadata.pricing?.input_tokens ?? 0) / 1_000_000,
            completion: (metadata.pricing?.output_tokens ?? 0) / 1_000_000,
          },
          context_length: metadata.context_length,
          architecture: {
            modality: canSee ? "text+image->text" : "text->text",
            tokenizer: "",
            instruct_type: "",
          },
          capabilities: {
            // No audio-input models exist in this catalog, so the Advanced DNA
            // picker stays empty for DeepInfra on purpose.
            inputModalities: canSee ? ["text", "image"] : ["text"],
            outputModalities: ["text"],
          },
        };
      });

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error("[deepinfra-models] failed:", error?.message ?? error);
    return NextResponse.json({ error: "Failed to fetch DeepInfra models" }, { status: 502 });
  }
}
