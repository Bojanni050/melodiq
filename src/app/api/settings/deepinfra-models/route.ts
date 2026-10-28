import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";

// DeepInfra's native catalog (documented at
// https://docs.deepinfra.com/api-reference/models/models-list) is public, so no
// API key is needed for this read-only lookup for the Settings model pickers.
// It is preferred over /v1/openai/models because it carries the real
// capability tags (multimodal, ocr, input-audio, input-video), deprecation
// info and the pricing type.
const DEEPINFRA_MODELS_URL = "https://api.deepinfra.com/models/list";

// Catalog tags that mean "this text model accepts more than text".
const EXTRA_INPUT_MODALITIES: Array<[tag: string, modality: string]> = [
  ["multimodal", "image"],
  ["ocr", "image"],
  ["input-audio", "audio"],
  ["input-video", "video"],
];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await axios.get(DEEPINFRA_MODELS_URL, { timeout: 15000 });
    const catalog: any[] = Array.isArray(res.data) ? res.data : res.data?.data || [];

    const models = catalog
      .filter(
        (m: any) =>
          m.type === "text-generation" &&
          !m.deprecated &&
          !m.private &&
          m.pricing?.type === "tokens"
      )
      .map((m: any) => {
        const tags: string[] = m.tags || [];
        const inputModalities = [
          "text",
          ...EXTRA_INPUT_MODALITIES.filter(([tag]) => tags.includes(tag)).map(
            ([, modality]) => modality
          ),
        ];
        // De-duplicate: both "multimodal" and "ocr" map to image.
        const uniqueInputModalities = [...new Set(inputModalities)];

        return {
          id: m.model_name,
          name: m.model_name.split("/").pop() || m.model_name,
          description: m.description || "",
          pricing: {
            // cents_per_* is cents per token, LLMModel wants USD per token.
            prompt: (m.pricing.cents_per_input_token ?? 0) / 100,
            completion: (m.pricing.cents_per_output_token ?? 0) / 100,
          },
          context_length: m.max_tokens ?? undefined,
          architecture: {
            modality: `${uniqueInputModalities.join("+")}->text`,
            tokenizer: "",
            instruct_type: "",
          },
          capabilities: {
            inputModalities: uniqueInputModalities,
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
