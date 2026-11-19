import { describe, expect, it } from "vitest";

import { spectrumScores } from "../dna/spectra";

describe("spectrumScores", () => {
  it("places a one-sided prompt on the pole it names", () => {
    expect(spectrumScores("trap, drill, dark")).toEqual({ rap_melodic: 0 });
    expect(spectrumScores("soulful, sung, melodic pop")).toEqual({ rap_melodic: 100 });
  });

  it("scores both poles on one prompt as a position between them", () => {
    expect(spectrumScores("rap verses with a melodic chorus")).toEqual({ rap_melodic: 50 });
  });

  it("reads each spectrum independently", () => {
    const scores = spectrumScores("acoustic guitar, intimate, sparse, sung");

    expect(scores.intimate_open).toBe(0);
    expect(scores.minimal_dense).toBe(0);
    expect(scores.electronic_organic).toBe(100);
    expect(scores.rap_melodic).toBe(100);
  });

  it("does not double-count a phrase and its words", () => {
    // "solo piano" is one hit, not also "piano" for the organic pole.
    expect(spectrumScores("solo piano")).toEqual({ minimal_dense: 0, electronic_organic: 100 });
  });

  it("lets a track abstain when the prompt names neither pole", () => {
    expect(spectrumScores("warm, radio-ready, 84 BPM")).toEqual({});
    expect(spectrumScores(null)).toEqual({});
    expect(spectrumScores("   ")).toEqual({});
  });

  it("matches Dutch synonyms", () => {
    expect(spectrumScores("akoestisch, intiem, minimalistisch")).toEqual({
      intimate_open: 0,
      minimal_dense: 0,
      electronic_organic: 100,
    });
  });
});
