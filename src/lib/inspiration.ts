// Shared, client-safe helpers for the "Use As Inspiration" flow (APIMart v6
// inspo endpoint, and PoYo v6's audio_urls references). Kept free of
// node-only imports so studio pages, components and API routes can all use it.

export interface InspirationTrack {
  id: string;
  title: string | null;
  coverUrl: string | null;
}

export const MAX_INSPIRATION_TRACKS = 4;

/** APIMart Suno models that support the /generations/inspo endpoint. */
export const APIMART_V6_MODELS = ["v6", "v6-wild", "v6-mini"] as const;

export function isApimartV6Model(model: unknown): boolean {
  return typeof model === "string" && (APIMART_V6_MODELS as readonly string[]).includes(model);
}

/** PoYo Suno V6 family — used for the V6 Options panel (Style Variety). */
export const POYO_V6_MODELS = ["v6", "v6-wild", "v6-mini"] as const;

export function isPoyoV6Model(model: unknown): boolean {
  return typeof model === "string" && (POYO_V6_MODELS as readonly string[]).includes(model);
}

/**
 * PoYo Suno models that support audio_urls references in this app. PoYo's own
 * docs don't restrict audio_urls to the V6 family (it works on V4 through
 * V6), but here it's opened up to V6 plus v5.5 only, by request — older
 * versions (v5, v4.5, v4) stay out for now.
 */
export const POYO_INSPO_MODELS = [...POYO_V6_MODELS, "v5.5"] as const;

export function isPoyoInspoModel(model: unknown): boolean {
  return typeof model === "string" && (POYO_INSPO_MODELS as readonly string[]).includes(model);
}

/** True when this provider/model combination can use "Use As Inspiration". */
export function supportsInspiration(provider: unknown, model: unknown): boolean {
  if (provider === "apimart") return isApimartV6Model(model);
  if (provider === "poyo") return isPoyoInspoModel(model);
  return false;
}
