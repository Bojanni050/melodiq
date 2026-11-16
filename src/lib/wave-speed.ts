/**
 * WaveSpeed has no documented "whoami" endpoint, so the key test probes a list of
 * plausible URLs. That list is 12 long and every candidate that answers 404
 * costs a round trip — on the first test that is fine, on every later test it is
 * 11 wasted requests. The URL that worked is remembered per server process and
 * tried first from then on.
 */
export const WAVESPEED_CANDIDATES = [
  "https://api.wavespeed.ai/api/v3/user/info",
  "https://api.wavespeed.ai/api/v3/user",
  "https://api.wavespeed.ai/api/v3/account",
  "https://api.wavespeed.ai/api/v3/credits",
  "https://api.wavespeed.ai/api/v3/models",
  "https://api.wavespeed.ai/api/v3/predictions",
  "https://api.wavespeed.ai/api/v1/user/info",
  "https://api.wavespeed.ai/api/v1/user",
  "https://api.wavespeed.ai/api/v1/account",
  "https://api.wavespeed.ai/api/v1/credits",
  "https://api.wavespeed.ai/api/v1/models",
  "https://api.wavespeed.ai/api/v1/predictions",
];

let rememberedUrl: string | null = null;

/** The remembered endpoint first (if we have one), the rest in their original order. */
export function orderWaveSpeedCandidates(): string[] {
  if (!rememberedUrl) return [...WAVESPEED_CANDIDATES];
  return [rememberedUrl, ...WAVESPEED_CANDIDATES.filter((url) => url !== rememberedUrl)];
}

/** Called with the endpoint that answered, so the next test starts there. */
export function rememberWaveSpeedUrl(url: string): void {
  rememberedUrl = url;
}

/** For tests (and a manual reset if the endpoint ever moves). */
export function resetWaveSpeedMemo(): void {
  rememberedUrl = null;
}
