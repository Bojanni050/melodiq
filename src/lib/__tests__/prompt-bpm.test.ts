import { describe, expect, it } from "vitest";

import { parsePromptBpm, tempoOctaveRelation } from "../prompt-bpm";

describe("parsePromptBpm", () => {
  it("reads the tempo a prompt promises", () => {
    expect(parsePromptBpm("Moody orchestral piano-post-rock in slow 3/4 at 85 BPM")).toBe(85);
    expect(parsePromptBpm("trap, dark, at 140BPM with 808s")).toBe(140);
    expect(parsePromptBpm("half-time groove, 120 Bpm")).toBe(120);
  });

  it("ignores numbers that are not a tempo", () => {
    expect(parsePromptBpm("early 2000's british post-rock")).toBeNull();
    expect(parsePromptBpm("24 bit, 48 kHz, warm tape")).toBeNull();
    expect(parsePromptBpm("")).toBeNull();
    expect(parsePromptBpm(null)).toBeNull();
  });

  it("rejects values outside a plausible range", () => {
    expect(parsePromptBpm("at 300 BPM")).toBeNull();
    expect(parsePromptBpm("at 20 BPM")).toBeNull();
  });
});

describe("tempoOctaveRelation", () => {
  it("recognises the grid the measurement sits on", () => {
    expect(tempoOctaveRelation(114, 114)).toBe("aligned");
    expect(tempoOctaveRelation(115, 114)).toBe("aligned");
    // Half-time: the prompt promises 136, the pulse is 68.
    expect(tempoOctaveRelation(68, 136)).toBe("half");
    expect(tempoOctaveRelation(70, 140)).toBe("half");
    // A waltz whose eighth notes are what the tracker locks onto.
    expect(tempoOctaveRelation(118, 58)).toBe("double");
  });

  it("refuses to call a plain disagreement an octave", () => {
    expect(tempoOctaveRelation(95, 120)).toBeNull();
    expect(tempoOctaveRelation(102, 95)).toBeNull();
    expect(tempoOctaveRelation(null, 120)).toBeNull();
    expect(tempoOctaveRelation(120, null)).toBeNull();
    expect(tempoOctaveRelation(0, 120)).toBeNull();
  });
});
