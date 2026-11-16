import { beforeEach, describe, expect, it } from "vitest";

import {
  WAVESPEED_CANDIDATES,
  orderWaveSpeedCandidates,
  rememberWaveSpeedUrl,
  resetWaveSpeedMemo,
} from "../wave-speed";

// The key test used to walk all 12 candidate endpoints on every run; the one that
// answered is now tried first, so a repeated test costs one request.
describe("wave-speed endpoint memo", () => {
  beforeEach(() => {
    resetWaveSpeedMemo();
  });

  it("starts with the original order", () => {
    expect(orderWaveSpeedCandidates()).toEqual(WAVESPEED_CANDIDATES);
  });

  it("tries the remembered endpoint first, without duplicating it", () => {
    const working = "https://api.wavespeed.ai/api/v1/user";
    rememberWaveSpeedUrl(working);

    const ordered = orderWaveSpeedCandidates();
    expect(ordered[0]).toBe(working);
    expect(ordered).toHaveLength(WAVESPEED_CANDIDATES.length);
    expect(new Set(ordered).size).toBe(WAVESPEED_CANDIDATES.length);
    // Everything else keeps its relative order.
    expect(ordered.slice(1)).toEqual(WAVESPEED_CANDIDATES.filter((url) => url !== working));
  });

  it("can be reset back to the plain list", () => {
    rememberWaveSpeedUrl("https://api.wavespeed.ai/api/v3/user/info");
    resetWaveSpeedMemo();
    expect(orderWaveSpeedCandidates()[0]).toBe(WAVESPEED_CANDIDATES[0]);
  });
});
