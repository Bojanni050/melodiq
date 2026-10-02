// Shared, client-safe helpers for the "Use As Inspiration" flow (APIMart v6 inspo).
// Kept free of node-only imports so studio pages, components and API routes can
// all use it.

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
