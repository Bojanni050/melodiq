import { describe, expect, it } from "vitest";

import { lyricSpectrumScores, MIN_LYRIC_SPECTRUM_HITS } from "../dna/lyric-spectra";

describe("lyricSpectrumScores", () => {
  it("places a one-sided lyric on the pole it names", () => {
    expect(lyricSpectrumScores("velvet moonlight, porcelain stars")).toEqual({
      colloquial_literary: 100,
      literal_imagery: 100,
    });
  });

  it("scores both poles as a position between them", () => {
    expect(lyricSpectrumScores("gonna dance until the dawn, whispers in the dark")).toEqual({
      colloquial_literary: 50,
    });
  });

  it("counts distinct terms, not occurrences, so a repeated hook is one vote", () => {
    // "yeah" twelve times is still one colloquial marker, below the evidence floor.
    expect(lyricSpectrumScores("yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah yeah")).toEqual({});
  });

  it("abstains below the evidence floor and scores from it", () => {
    expect(MIN_LYRIC_SPECTRUM_HITS).toBe(2);
    expect(lyricSpectrumScores("monday")).toEqual({});
    expect(lyricSpectrumScores("monday appointment")).toEqual({ literal_imagery: 0 });
  });

  it("reads each axis independently", () => {
    const scores = lyricSpectrumScores("dance, champagne, joke, haha");

    expect(scores.serious_playful).toBe(100);
    expect(scores.colloquial_literary).toBeUndefined();
    expect(scores.literal_imagery).toBeUndefined();
  });

  it("matches Dutch markers and ignores punctuation and section headings", () => {
    const lyrics = "[Verse 1]\nGewoon effe dansen, toch?\nGewoon effe lachen";

    expect(lyricSpectrumScores(lyrics)).toEqual({
      colloquial_literary: 0,
      serious_playful: 100,
    });
  });

  it("returns nothing without a text", () => {
    expect(lyricSpectrumScores(null)).toEqual({});
    expect(lyricSpectrumScores("   ")).toEqual({});
  });
});
