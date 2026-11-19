import { describe, expect, it } from "vitest";

import { detectInstruments } from "../dna/instruments";

describe("detectInstruments", () => {
  it("returns nothing for an empty prompt", () => {
    expect(detectInstruments(null)).toEqual([]);
    expect(detectInstruments("   ")).toEqual([]);
  });

  it("finds instruments in English and Dutch", () => {
    expect(detectInstruments("solo piano and warm strings")).toEqual(["Piano", "Strings"]);
    expect(detectInstruments("akoestische gitaar, strijkers, 808")).toEqual([
      "Acoustic guitar",
      "Strings",
      "808",
    ]);
  });

  it("does not count a specific guitar as the other one", () => {
    expect(detectInstruments("electric guitar, power chords")).toEqual(["Electric guitar"]);
    expect(detectInstruments("acoustic guitar, fingerpicked")).toEqual(["Acoustic guitar"]);
  });

  it("reports each instrument once even when named twice", () => {
    expect(detectInstruments("piano, grand piano, upright piano")).toEqual(["Piano"]);
  });

  it("only matches whole words", () => {
    expect(detectInstruments("organic pads, warm analogue")).toEqual([]);
    expect(detectInstruments("bassline and sub bass")).toEqual(["Bass"]);
  });
});
