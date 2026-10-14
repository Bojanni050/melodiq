import { describe, expect, it } from "vitest";

import { PLAYBACK_RESUME_WINDOW_MS, shouldResumePlayback } from "../playerResume";

const NOW = 1_700_000_000_000;

describe("shouldResumePlayback", () => {
  it("resumes when playback was alive moments before the reload", () => {
    expect(shouldResumePlayback(true, NOW - 1_000, NOW)).toBe(true);
  });

  it("resumes right at the edge of the window", () => {
    expect(shouldResumePlayback(true, NOW - PLAYBACK_RESUME_WINDOW_MS, NOW)).toBe(true);
  });

  it("does not resume long after the app was closed", () => {
    expect(shouldResumePlayback(true, NOW - PLAYBACK_RESUME_WINDOW_MS - 1, NOW)).toBe(false);
  });

  it("does not resume when playback was paused", () => {
    expect(shouldResumePlayback(false, NOW - 1_000, NOW)).toBe(false);
  });

  it("does not resume without a usable timestamp", () => {
    expect(shouldResumePlayback(true, 0, NOW)).toBe(false);
    expect(shouldResumePlayback(true, undefined, NOW)).toBe(false);
    expect(shouldResumePlayback(true, Number.NaN, NOW)).toBe(false);
    expect(shouldResumePlayback("true", NOW, NOW)).toBe(false);
  });

  it("tolerates a timestamp from the future inside the window", () => {
    expect(shouldResumePlayback(true, NOW + 1_000, NOW)).toBe(true);
    expect(shouldResumePlayback(true, NOW + PLAYBACK_RESUME_WINDOW_MS + 1, NOW)).toBe(false);
  });
});
