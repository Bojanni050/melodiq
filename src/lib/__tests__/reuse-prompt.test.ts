import { describe, expect, it } from "vitest";
import { buildReusePayload, REUSE_SCOPE_LABEL, type ReuseScope } from "../reuse-prompt";

const track = { prompt: "warm analog synth, 90bpm", lyrics: "[Verse]\nI was walking home" };

describe("buildReusePayload", () => {
  it("carries both fields for 'both' — the original behaviour", () => {
    expect(buildReusePayload(track, "both")).toEqual({
      songIdea: track.prompt,
      lyrics: track.lyrics,
    });
  });

  it("carries only the lyrics and explicitly clears the prompt", () => {
    // Clearing rather than omitting matters: the Studio sets both fields
    // unconditionally on mount, so an absent key would leave whatever the user
    // already had in the prompt field. "Only Lyrics" would then quietly be
    // "lyrics plus whatever was there".
    expect(buildReusePayload(track, "lyrics")).toEqual({ songIdea: "", lyrics: track.lyrics });
  });

  it("carries only the prompt and explicitly clears the lyrics", () => {
    expect(buildReusePayload(track, "style")).toEqual({ songIdea: track.prompt, lyrics: "" });
  });

  it("always emits both keys, whatever the scope", () => {
    for (const scope of ["lyrics", "style", "both"] as ReuseScope[]) {
      expect(Object.keys(buildReusePayload(track, scope)).sort()).toEqual(["lyrics", "songIdea"]);
    }
  });

  it("tolerates null and missing fields without producing undefined", () => {
    expect(buildReusePayload({ prompt: null, lyrics: null }, "both")).toEqual({
      songIdea: "",
      lyrics: "",
    });
    expect(buildReusePayload({}, "both")).toEqual({ songIdea: "", lyrics: "" });
  });

  it("carries title and vocal gender in every scope when the track has them", () => {
    const rich = { ...track, title: "Midnight Drive", vocalGender: "female" };
    for (const scope of ["lyrics", "style", "both"] as ReuseScope[]) {
      const payload = buildReusePayload(rich, scope);
      expect(payload.title).toBe("Midnight Drive");
      expect(payload.vocalGender).toBe("female");
    }
  });

  it("omits title and vocal gender when unknown, so Studio keeps its values", () => {
    // Pre-migration tracks stored no vocal gender; an absent key must leave
    // the Studio's current selection alone rather than resetting it.
    expect(buildReusePayload(track, "both")).not.toHaveProperty("title");
    expect(buildReusePayload(track, "both")).not.toHaveProperty("vocalGender");
    expect(buildReusePayload({ ...track, title: "  ", vocalGender: "auto" }, "both")).not.toHaveProperty("title");
    expect(buildReusePayload({ ...track, title: "  ", vocalGender: "auto" }, "both")).not.toHaveProperty("vocalGender");
  });
});

describe("REUSE_SCOPE_LABEL", () => {
  it("offers exactly the three scopes, both last", () => {
    // "Both" is the default and the historical behaviour, so it is the last
    // entry — the common case reads last and is reached with one extra click.
    expect(Object.keys(REUSE_SCOPE_LABEL)).toEqual(["lyrics", "style", "both"]);
  });

  it("labels them in the menu's own wording", () => {
    expect(REUSE_SCOPE_LABEL.lyrics).toBe("Only Lyrics");
    expect(REUSE_SCOPE_LABEL.style).toBe("Only Styles");
    expect(REUSE_SCOPE_LABEL.both).toBe("Both");
  });
});
