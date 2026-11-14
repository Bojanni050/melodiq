import { describe, expect, it } from "vitest";
import {
  CARD_HEIGHT,
  CARD_MAX_TRAITS,
  CARD_WIDTH,
  buildDnaCardSvg,
  selectCardTraits,
  wrapText,
} from "../dna/card";

const trait = (key: string, overrides: Partial<{ category: string; display: string; confidence: number; verdict: string | null }> = {}) => ({
  key,
  category: overrides.category ?? "sound",
  label: key,
  display: overrides.display ?? `${key} value`,
  confidence: overrides.confidence ?? 0.7,
  verdict: overrides.verdict ?? null,
  direction: null,
});

const input = {
  name: "Midtempo nostalgic dream pop",
  summary: "Named by tempo around 84 BPM. Returns to nostalgia and warm textures.",
  statsLine: "31 tracks · 9 rated · 6 loved",
  stageLabel: "Grown",
  traits: [
    trait("tempo", { display: "84 BPM" }),
    trait("genres", { display: "pop, dream pop" }),
    trait("language", { category: "words", display: "English" }),
    trait("vocal_gender", { category: "voice", display: "female" }),
  ],
};

describe("wrapText", () => {
  it("returns nothing for invalid limits", () => {
    expect(wrapText("hello", 0, 2)).toEqual([]);
    expect(wrapText("hello", 5, 0)).toEqual([]);
  });

  it("keeps short text on one line", () => {
    expect(wrapText("hello world", 40, 2)).toEqual(["hello world"]);
  });

  it("wraps on words", () => {
    expect(wrapText("one two three four", 9, 4)).toEqual(["one two", "three", "four"]);
  });

  it("ellipsises when the text does not fit", () => {
    const lines = wrapText("one two three four five six", 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("hard-splits a word longer than the line", () => {
    const lines = wrapText("supercalifragilistic", 8, 2);
    expect(lines[0]).toHaveLength(8);
  });
});

describe("selectCardTraits", () => {
  it("never shows a trait the user rejected", () => {
    const traits = [trait("a", { verdict: "disputed" }), trait("b")];
    expect(selectCardTraits(traits).map((item) => item.key)).toEqual(["b"]);
  });

  it("prefers solid traits over still-learning ones", () => {
    const traits = [trait("weak", { confidence: 0.1 }), trait("solid", { confidence: 0.9 })];
    expect(selectCardTraits(traits).map((item) => item.key)).toEqual(["solid", "weak"]);
  });

  it("caps the list so the card stays readable", () => {
    const traits = Array.from({ length: 14 }, (_, index) => trait(`t${index}`));
    expect(selectCardTraits(traits)).toHaveLength(CARD_MAX_TRAITS);
  });

  it("skips traits without a display value", () => {
    expect(selectCardTraits([trait("empty", { display: "  " })]).map((item) => item.key)).toEqual([]);
  });
});

describe("buildDnaCardSvg", () => {
  it("renders a card at the expected size", () => {
    const svg = buildDnaCardSvg(input);
    expect(svg).toContain(`width="${CARD_WIDTH}"`);
    expect(svg).toContain(`height="${CARD_HEIGHT}"`);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("includes the name, summary, stage and stats", () => {
    const svg = buildDnaCardSvg(input);
    expect(svg).toContain("Midtempo");
    expect(svg).toContain("dream pop");
    expect(svg).toContain("Returns to nostalgia and");
    expect(svg).toContain("Grown");
    expect(svg).toContain("31 tracks · 9 rated · 6 loved");
    expect(svg).toContain("melodIQ");
  });

  it("draws the strongest traits", () => {
    const svg = buildDnaCardSvg(input);
    expect(svg).toContain("84 BPM");
    expect(svg).toContain("pop, dream pop");
    expect(svg).toContain("English");
  });

  it("escapes user text so the SVG stays valid", () => {
    const svg = buildDnaCardSvg({ ...input, name: "Tom & Jerry <pop>", summary: `"quoted" 'text'` });
    expect(svg).toContain("Tom &amp; Jerry &lt;pop&gt;");
    expect(svg).toContain("&quot;quoted&quot; &apos;text&apos;");
    expect(svg).not.toContain("<pop>");
  });

  it("falls back to a generic title for an empty name", () => {
    const svg = buildDnaCardSvg({ ...input, name: "" });
    expect(svg).toContain("Melody DNA");
  });

  it("still renders without summary text", () => {
    const svg = buildDnaCardSvg({ ...input, summary: "" });
    expect(svg).toContain("Midtempo");
    expect(svg).not.toContain("undefined");
  });
});
