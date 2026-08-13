import { describe, expect, it } from "vitest";
import {
  computeAudioDnaDistance,
  computePairScore,
  computeTextSimilarity,
  groupBySimilarity,
  type TrackForSimilarity,
} from "../smart-archive";
import type { AudioDna } from "../songs";

function audioDna(overrides: Partial<AudioDna> = {}): AudioDna {
  return {
    tempo: 120,
    key: "C major",
    energy: 50,
    loudness: -14,
    atmosphereTags: ["dreamy", "warm"],
    lyricsScore: null,
    lyricsNotes: null,
    compositionScore: null,
    compositionNotes: null,
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

function track(overrides: Partial<TrackForSimilarity> = {}): TrackForSimilarity {
  return { id: "id", title: null, lyrics: null, prompt: null, audioDna: null, ...overrides };
}

describe("computeTextSimilarity", () => {
  it("scores identical text as 1", () => {
    expect(computeTextSimilarity("hello world", "hello world")).toBe(1);
  });

  it("scores completely different text as 0", () => {
    expect(computeTextSimilarity("hello world", "foo bar")).toBe(0);
  });

  it("scores partial overlap between 0 and 1", () => {
    const score = computeTextSimilarity("walking in the rain tonight", "walking in the sun tonight");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("treats missing text as empty", () => {
    expect(computeTextSimilarity(null, undefined)).toBe(0);
  });

  it("is case-insensitive and punctuation-insensitive", () => {
    expect(computeTextSimilarity("Hello, World!", "hello world")).toBe(1);
  });
});

describe("computeAudioDnaDistance", () => {
  it("is 0 for identical DNA", () => {
    expect(computeAudioDnaDistance(audioDna(), audioDna())).toBe(0);
  });

  it("is 1 when either side is null", () => {
    expect(computeAudioDnaDistance(null, audioDna())).toBe(1);
    expect(computeAudioDnaDistance(audioDna(), null)).toBe(1);
  });

  it("increases with tempo/energy/loudness divergence", () => {
    const close = computeAudioDnaDistance(audioDna({ tempo: 120 }), audioDna({ tempo: 122 }));
    const far = computeAudioDnaDistance(audioDna({ tempo: 120 }), audioDna({ tempo: 180 }));
    expect(far).toBeGreaterThan(close);
  });

  it("penalizes a key mismatch", () => {
    const same = computeAudioDnaDistance(audioDna({ key: "C major" }), audioDna({ key: "C major" }));
    const different = computeAudioDnaDistance(audioDna({ key: "C major" }), audioDna({ key: "G major" }));
    expect(different).toBeGreaterThan(same);
  });
});

describe("computePairScore", () => {
  it("never triggers a match on title alone", () => {
    const a = track({ id: "a", title: "Summer Nights" });
    const b = track({ id: "b", title: "Summer Nights" });
    const { score, matchedOn } = computePairScore(a, b);
    expect(score).toBe(0);
    expect(matchedOn).toHaveLength(0);
  });

  it("matches on near-identical lyrics with different titles", () => {
    const lyrics = "walking down the street tonight feeling free and alive under the city lights";
    const a = track({ id: "a", title: "Track One", lyrics });
    const b = track({ id: "b", title: "Completely Different Name", lyrics });
    const { score, matchedOn } = computePairScore(a, b);
    expect(score).toBeGreaterThan(0.5);
    expect(matchedOn).toContain("lyrics");
  });

  it("matches on near-identical prompts", () => {
    const prompt = "upbeat synthwave pop with dreamy female vocals and driving bassline";
    const a = track({ id: "a", prompt });
    const b = track({ id: "b", prompt });
    const { matchedOn } = computePairScore(a, b);
    expect(matchedOn).toContain("prompt");
  });

  it("scores 0 when neither track has any comparable content", () => {
    const a = track({ id: "a" });
    const b = track({ id: "b" });
    const { score } = computePairScore(a, b);
    expect(score).toBe(0);
  });
});

describe("groupBySimilarity", () => {
  const sharedLyrics = "walking down the street tonight feeling free and alive under the city lights forever";

  it("groups tracks with near-identical lyrics regardless of title", () => {
    const tracks: TrackForSimilarity[] = [
      track({ id: "a", title: "Version One", lyrics: sharedLyrics }),
      track({ id: "b", title: "Totally Unrelated Title", lyrics: sharedLyrics }),
      track({ id: "c", title: "Unrelated Track", lyrics: "a completely different set of words about the ocean and stars" }),
    ];
    const groups = groupBySimilarity(tracks, 0.5);
    expect(groups).toHaveLength(1);
    expect(groups[0].trackIds.sort()).toEqual(["a", "b"]);
  });

  it("does not group tracks that only share a similar title", () => {
    const tracks: TrackForSimilarity[] = [
      track({ id: "a", title: "Summer Nights", lyrics: "one set of lyrics entirely about summer rain" }),
      track({ id: "b", title: "Summer Nights", lyrics: "a totally different set of words about winter snow" }),
    ];
    const groups = groupBySimilarity(tracks, 0.5);
    expect(groups).toHaveLength(0);
  });

  it("drops singleton groups", () => {
    const tracks: TrackForSimilarity[] = [track({ id: "a", lyrics: "unique lyrics with nothing else to compare against" })];
    const groups = groupBySimilarity(tracks, 0.5);
    expect(groups).toHaveLength(0);
  });
});
