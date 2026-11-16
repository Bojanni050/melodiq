import axios from "axios";

import type { LLMModel } from "@/lib/settings-utils";

/**
 * The OpenRouter catalogue, fetched once per hour per server process.
 *
 * Three places need it (the Lyrics Studio model picker, the settings provider
 * test and, indirectly, the audio-capable filter) and it is ~850 KB of JSON with
 * 460+ entries — fetching and re-mapping that on every studio mount was pure
 * waste. The catalogue is public, so the cache is shared across users and keys.
 */
const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const CATALOG_TTL_MS = 60 * 60 * 1000;

let cached: { models: LLMModel[]; fetchedAt: number } | null = null;
let inFlight: Promise<LLMModel[]> | null = null;

/** Drops the cache (tests, and a manual refresh if one is ever added). */
export function invalidateOpenRouterCatalog(): void {
  cached = null;
}

/** True when the model takes text in and gives text back. */
export function isTextCapable(model: any): boolean {
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

function mapCatalogEntry(m: any): LLMModel {
  return {
    id: m.id as string,
    name: (m.name || m.id.split("/").pop()) as string,
    description: m.description || "",
    pricing: {
      prompt: m.pricing?.prompt,
      completion: m.pricing?.completion,
    },
    context_length: m.context_length,
    architecture: m.architecture,
    capabilities: {
      inputModalities: m.architecture?.input_modalities || [],
      outputModalities: m.architecture?.output_modalities || [],
    },
  };
}

/**
 * Returns the text-capable models, in catalogue order. Concurrent callers share
 * one request, and the result is reused for `CATALOG_TTL_MS`. The catalogue is
 * public (no key needed, and the key is deliberately not put in the query
 * string where it would end up in logs).
 */
export async function getOpenRouterCatalog(): Promise<LLMModel[]> {
  if (cached && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
    return cached.models;
  }
  if (!inFlight) {
    inFlight = axios
      .get(CATALOG_URL, { timeout: 15000 })
      .then((response) => {
        const models = (response.data?.data || [])
          .filter(isTextCapable)
          .map(mapCatalogEntry);
        cached = { models, fetchedAt: Date.now() };
        return models;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
