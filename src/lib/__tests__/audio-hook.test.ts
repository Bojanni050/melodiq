import { describe, expect, it } from "vitest";

import { hookEarlyFromEnergies } from "../audio-features";

/** A track of `seconds` length whose energy sits at `value` for `count` seconds. */
function seconds(count: number, value: number): number[] {
  return new Array(count).fill(value);
}

describe("hookEarlyFromEnergies", () => {
  it("abstains on a track that cannot fit the hook window", () => {
    expect(hookEarlyFromEnergies(seconds(30, 60))).toBeNull();
    expect(hookEarlyFromEnergies([])).toBeNull();
  });

  it("abstains when the track is too quiet to judge", () => {
    expect(hookEarlyFromEnergies(seconds(120, 6))).toBeNull();
  });

  it("calls a track that is loud from the start an early hook", () => {
    expect(hookEarlyFromEnergies(seconds(120, 60))).toBe(true);
  });

  it("accepts a quiet intro that reaches the typical level within 30 seconds", () => {
    expect(hookEarlyFromEnergies([...seconds(25, 35), ...seconds(95, 60)])).toBe(true);
  });

  it("rejects a slow burn that only settles after 30 seconds", () => {
    expect(hookEarlyFromEnergies([...seconds(40, 35), ...seconds(80, 60)])).toBe(false);
  });

  it("uses the median, so one loud chorus does not disqualify an early hook", () => {
    // Median is 55; the single 100 second would fail a peak-relative rule.
    expect(hookEarlyFromEnergies([...seconds(60, 55), 100, ...seconds(59, 55)])).toBe(true);
  });

  it("allows a slightly quieter intro within the share", () => {
    expect(hookEarlyFromEnergies([...seconds(20, 54), ...seconds(100, 60)])).toBe(true);
  });

  it("rejects a track that never reaches its own median level early", () => {
    const energies = [...seconds(45, 20), ...seconds(60, 70)];
    expect(hookEarlyFromEnergies(energies)).toBe(false);
  });
});
