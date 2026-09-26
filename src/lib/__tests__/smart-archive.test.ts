import { describe, expect, it } from "vitest";
import * as smartArchiveModule from "../smart-archive";
import {
  computeAudioDnaDistance,
  computePairScore,
  computeTextSimilarity,
  DEFAULT_SIMILARITY_THRESHOLD,
  groupBySimilarity,
  normalizeLanguage,
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

describe("normalizeLanguage", () => {
  it("maps aliases onto one canonical key", () => {
    expect(normalizeLanguage("Dutch")).toBe("dutch");
    expect(normalizeLanguage("dutch")).toBe("dutch");
    expect(normalizeLanguage("Nederlands")).toBe("dutch");
    expect(normalizeLanguage("nl")).toBe("dutch");
  });

  it("returns null for absent or explicitly unknown languages", () => {
    expect(normalizeLanguage(null)).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage("   ")).toBeNull();
    // The detector returns "unknown" when it cannot tell.
    expect(normalizeLanguage("unknown")).toBeNull();
    expect(normalizeLanguage("Unknown")).toBeNull();
  });

  it("keeps an unlisted language as a stable lowercase key", () => {
    expect(normalizeLanguage("Klingon")).toBe("klingon");
  });
});

describe("language as a similarity signal", () => {
  const sameLyrics = "the night is cold and I remember your face in the rain again";

  it("does not penalize a pair when one side has no language", () => {
    const withLang = track({ id: "a", lyrics: sameLyrics, language: "Dutch" });
    const withoutLang = track({ id: "b", lyrics: sameLyrics });
    expect(computePairScore(withLang, withoutLang).score).toBe(1);
  });

  it("reports language as a match when both agree", () => {
    const a = track({ id: "a", lyrics: sameLyrics, language: "Dutch" });
    const b = track({ id: "b", lyrics: sameLyrics, language: "Nederlands" });
    const { matchedOn } = computePairScore(a, b);
    // Aliases must resolve to the same key, so this is a match, not a mismatch.
    expect(matchedOn).toContain("language");
  });

  it("scores a confident mismatch at zero, unknown language costs nothing", () => {
    const a = track({ id: "a", lyrics: sameLyrics, language: "Dutch" });
    const mismatched = computePairScore(a, track({ id: "b", lyrics: sameLyrics, language: "English" }));
    const unknown = computePairScore(a, track({ id: "b", lyrics: sameLyrics }));

    // Unknown language scores exactly 1 — the pair is untouched.
    expect(unknown.score).toBe(1);
    // Identical lyrics in different languages still group: the lyrics weight
    // outweighs the language contradiction.
    expect(mismatched.score).toBeGreaterThan(DEFAULT_SIMILARITY_THRESHOLD);
    // ...but language is not advertised as a reason they matched.
    expect(mismatched.matchedOn).not.toContain("language");
  });

  it("drops a cross-language pair that had nothing but a style prompt", () => {
    // Only a shared prompt (similarity 1) plus a language mismatch. The
    // contradiction outweighs the prompt, so a same-style song in another
    // language is no longer offered as a duplicate.
    const a = track({ id: "a", prompt: "dreamy synthwave", language: "Dutch" });
    const b = track({ id: "b", prompt: "dreamy synthwave", language: "Japanese" });
    expect(computePairScore(a, b).score).toBeLessThan(DEFAULT_SIMILARITY_THRESHOLD);
    expect(groupBySimilarity([a, b])).toHaveLength(0);

    // The same pair without language data still groups, as it did before.
    const noLangA = track({ id: "a", prompt: "dreamy synthwave" });
    const noLangB = track({ id: "b", prompt: "dreamy synthwave" });
    expect(groupBySimilarity([noLangA, noLangB])).toHaveLength(1);
  });
});

describe("group language label", () => {
  it("labels a group whose members share one language", () => {
    const tracks: TrackForSimilarity[] = [
      track({ id: "a", lyrics: "same words here to make them match up well", language: "Dutch" }),
      track({ id: "b", lyrics: "same words here to make them match up well", language: "Dutch" }),
    ];
    const groups = groupBySimilarity(tracks);
    expect(groups).toHaveLength(1);
    expect(groups[0].language).toBe("dutch");
  });

  it("leaves the label off when a member disagrees", () => {
    const tracks: TrackForSimilarity[] = [
      track({ id: "a", lyrics: "same words here to make them match up well", language: "Dutch" }),
      track({ id: "b", lyrics: "same words here to make them match up well", language: "English" }),
    ];
    const groups = groupBySimilarity(tracks);
    expect(groups).toHaveLength(1);
    expect(groups[0].language).toBeNull();
  });

  it("leaves the label off when no member has a language", () => {
    const tracks: TrackForSimilarity[] = [
      track({ id: "a", lyrics: "same words here to make them match up well" }),
      track({ id: "b", lyrics: "same words here to make them match up well" }),
    ];
    expect(groupBySimilarity(tracks)[0].language).toBeNull();
  });
});

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

describe("filterArchivableCandidates (removed)", () => {
  // Archiving is no longer a blocked operation: published / Master Track /
  // playlist members are offered like any other candidate, and the UI warns
  // per track at confirmation time. The old pre-grouping filter that stripped
  // them is gone; src/lib/archive-guards.ts now collects soft warnings instead
  // of refusing. These three tests guarded that deleted filter's behaviour, so
  // they are replaced rather than silently dropped.
  it("is no longer exported", () => {
    expect(typeof (smartArchiveModule as Record<string, unknown>).filterArchivableCandidates).toBe("undefined");
  });

  it("keeps every candidate in the grouping input, including published ones", () => {
    // Nothing in groupBySimilarity is aware of release status any more: the
    // warnings are layered on afterwards by the API route.
    const tracks: TrackForSimilarity[] = [
      track({ id: "a", lyrics: "the same words over and over again here" }),
      track({ id: "b", lyrics: "the same words over and over again here" }),
    ];
    const groups = groupBySimilarity(tracks, 0.5);
    expect(groups).toHaveLength(1);
    expect(groups[0].trackIds.sort()).toEqual(["a", "b"]);
  });
});
