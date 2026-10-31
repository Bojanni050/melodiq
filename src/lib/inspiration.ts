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

/**
 * PoYo Suno models that support audio_urls references. PoYo's own docs don't
 * restrict audio_urls to the V6 family (it works on V4 through V6), but
 * inspiration is kept to V6 here for consistency with the APIMart side and
 * because that's the only tier this app otherwise exposes V6 Options for.
 */
export const POYO_V6_MODELS = ["v6", "v6-wild", "v6-mini"] as const;

export function isPoyoV6Model(model: unknown): boolean {
  return typeof model === "string" && (POYO_V6_MODELS as readonly string[]).includes(model);
}

/** True when this provider/model combination can use "Use As Inspiration". */
export function supportsInspiration(provider: unknown, model: unknown): boolean {
  if (provider === "apimart") return isApimartV6Model(model);
  if (provider === "poyo") return isPoyoV6Model(model);
  return false;
}
