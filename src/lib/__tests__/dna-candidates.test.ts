import { describe, expect, it } from "vitest";

import { hasMissingDnaFields } from "../dna-candidates";

// The JS filter is the authoritative one: the SQL predicate in the same module
// only narrows the candidate set, and the route re-runs this filter over the
// batch. These are the shapes the two have to agree on — verified against a real
// Postgres 16 with the same fixtures while writing the SQL side.
const complete = { tempo: 120, key: "C major", energy: 0.5, loudness: -9, atmosphereTags: ["Warm"], lyricsScore: 7 };

function row(audioDna: unknown, lyrics: string | null = "[Verse]\nhi", instrumental = false) {
  return {
    audioDna: audioDna === null ? null : JSON.stringify(audioDna),
    lyrics,
    instrumental,
  };
}

describe("hasMissingDnaFields", () => {
  it("accepts a track that has every signal", () => {
    expect(hasMissingDnaFields(row(complete))).toBe(false);
  });

  it("treats a missing audioDna column or an empty object as work", () => {
    expect(hasMissingDnaFields(row(null))).toBe(true);
    expect(hasMissingDnaFields(row({}))).toBe(true);
  });

  it("flags each missing DSP field, including an explicit null", () => {
    for (const field of ["tempo", "key", "energy", "loudness"] as const) {
      expect(hasMissingDnaFields(row({ ...complete, [field]: null }))).toBe(true);
      const without = { ...complete } as Record<string, unknown>;
      delete without[field];
      expect(hasMissingDnaFields(row(without))).toBe(true);
    }
  });

  it("flags a missing, null or empty atmosphereTags and nothing else", () => {
    const withoutTags = { ...complete } as Record<string, unknown>;
    delete withoutTags.atmosphereTags;
    expect(hasMissingDnaFields(row(withoutTags))).toBe(true);
    expect(hasMissingDnaFields(row({ ...complete, atmosphereTags: null }))).toBe(true);
    expect(hasMissingDnaFields(row({ ...complete, atmosphereTags: [] }))).toBe(true);
    // A stray non-array value counts as present — `.length !== 0`, exactly like
    // the SQL side's jsonb_typeof branches.
    expect(hasMissingDnaFields(row({ ...complete, atmosphereTags: "Warm" }))).toBe(false);
    expect(hasMissingDnaFields(row({ ...complete, atmosphereTags: ["A", "B"] }))).toBe(false);
  });

  it("flags a missing lyrics score only for a track that actually has lyrics", () => {
    const withoutScore = { ...complete } as Record<string, unknown>;
    delete withoutScore.lyricsScore;
    expect(hasMissingDnaFields(row(withoutScore, "[Verse]\nhi"))).toBe(true);
    expect(hasMissingDnaFields(row({ ...complete, lyricsScore: null }, "[Verse]\nhi"))).toBe(true);
    expect(hasMissingDnaFields(row(withoutScore, "[Verse]\nhi", true))).toBe(false);
    expect(hasMissingDnaFields(row(withoutScore, null))).toBe(false);
    expect(hasMissingDnaFields(row(withoutScore, "   \n  "))).toBe(false);
  });

  it("treats unparseable audioDna as work instead of throwing", () => {
    expect(hasMissingDnaFields({ audioDna: "{{{ not json", lyrics: "[Verse]\nhi", instrumental: false })).toBe(true);
  });
});
