import { describe, expect, it } from "vitest";

import { hookEarlyFromArc } from "../audio-features";

const ARC = 12;

/** Twelve buckets over a three-minute track: window = first two buckets. */
const THREE_MINUTES = 180;

describe("hookEarlyFromArc", () => {
  it("abstains without an arc", () => {
    expect(hookEarlyFromArc(null, THREE_MINUTES)).toBeNull();
    expect(hookEarlyFromArc([], THREE_MINUTES)).toBeNull();
  });

  it("abstains on a track shorter than the hook window", () => {
    expect(hookEarlyFromArc(new Array(ARC).fill(60), 20)).toBeNull();
  });

  it("abstains when the track is too quiet to judge", () => {
    expect(hookEarlyFromArc(new Array(ARC).fill(6), THREE_MINUTES)).toBeNull();
  });

  it("calls a track that is loud from the start an early hook", () => {
    expect(hookEarlyFromArc(new Array(ARC).fill(60), THREE_MINUTES)).toBe(true);
  });

  it("calls a quiet intro without an early hook", () => {
    // First two buckets (0:00-0:30) at 30, the body at 70: median 70.
    const arc = [30, 30, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70];
    expect(hookEarlyFromArc(arc, THREE_MINUTES)).toBe(false);
  });

  it("accepts an early drop that then settles lower", () => {
    const arc = [80, 80, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45];
    expect(hookEarlyFromArc(arc, THREE_MINUTES)).toBe(true);
  });

  it("uses the median, so one loud chorus does not disqualify an early hook", () => {
    // A single 100 bucket would make a peak-relative rule fail; the median is 55.
    const arc = [60, 60, 55, 55, 55, 55, 55, 55, 55, 55, 100, 55];
    expect(hookEarlyFromArc(arc, THREE_MINUTES)).toBe(true);
  });

  it("allows a slightly quieter intro within the share", () => {
    const arc = [54, 54, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60];
    expect(hookEarlyFromArc(arc, THREE_MINUTES)).toBe(true);
  });
});
