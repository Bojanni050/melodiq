import { describe, expect, it } from "vitest";
import {
  buildDnaContext,
  mergeDnaIntoPrompt,
  stripDnaHint,
  DNA_HINT_PREFIX,
  type DnaContextTrait,
} from "../dna/context";

function trait(overrides: Partial<DnaContextTrait> & { key: string }): DnaContextTrait {
  return {
    label: overrides.key,
    value: null,
    text: null,
    display: null,
    confidence: 0.8,
    verdict: null,
    direction: null,
    ...overrides,
  };
}

const list = (...items: string[]) => JSON.stringify(items);

const FULL_PROFILE: DnaContextTrait[] = [
  trait({ key: "genres", label: "Genres", text: list("indie pop", "dream pop", "rock") }),
  trait({ key: "tempo", label: "Tempo", value: 84.4 }),
  trait({ key: "energy", label: "Energy", value: 72 }),
  trait({ key: "vocal_gender", label: "Vocal gender", text: "female" }),
  trait({ key: "language", label: "Language", text: "English" }),
  trait({ key: "instrumental_share", label: "Instrumental share", value: 0.2 }),
  trait({ key: "atmospheres", label: "Atmospheres", text: list("nostalgic", "warm", "night") }),
  trait({ key: "length", label: "Length", value: 211 }),
  trait({ key: "loved_genres", label: "Loved genres", text: list("indie pop") }),
  trait({ key: "avoided_genres", label: "Avoided genres", text: list("trap") }),
];

describe("buildDnaContext", () => {
  it("returns nothing when the influence is off", () => {
    expect(buildDnaContext({ traits: FULL_PROFILE }, "off")).toBe("");
  });

  it("returns nothing when there are no traits", () => {
    expect(buildDnaContext({ traits: [] }, "subtle")).toBe("");
  });

  it("keeps subtle short and strong fuller", () => {
    const subtle = buildDnaContext({ traits: FULL_PROFILE }, "subtle");
    const strong = buildDnaContext({ traits: FULL_PROFILE }, "strong");

    expect(subtle.split(", ")).toHaveLength(4);
    expect(strong.length).toBeGreaterThan(subtle.length);
  });

  it("starts with the strongest style signals in reading order", () => {
    const text = buildDnaContext({ traits: FULL_PROFILE }, "strong");
    expect(text.startsWith("indie pop / dream pop, 84 BPM, high energy, female vocals, English lyrics")).toBe(true);
  });

  it("skips traits below the confidence bar", () => {
    const text = buildDnaContext(
      {
        traits: [
          trait({ key: "genres", text: list("techno"), confidence: 0.2 }),
          trait({ key: "tempo", value: 128, confidence: 0.1 }),
        ],
      },
      "strong"
    );
    expect(text).toBe("");
  });

  it("trusts a confirmed trait even when the measurement is weak", () => {
    const text = buildDnaContext(
      { traits: [trait({ key: "tempo", value: 92, confidence: 0.05, verdict: "confirmed" })] },
      "subtle"
    );
    expect(text).toBe("92 BPM");
  });

  it("never uses a rejected trait, however strong the measurement", () => {
    const text = buildDnaContext(
      {
        traits: [
          trait({ key: "tempo", value: 92, confidence: 0.99, verdict: "disputed" }),
          trait({ key: "language", text: "Dutch", confidence: 0.99, verdict: "disputed" }),
        ],
      },
      "strong"
    );
    expect(text).toBe("");
  });

  it("carries the user's more/less corrections along", () => {
    const text = buildDnaContext(
      {
        traits: [
          trait({ key: "tempo", value: 84 }),
          trait({ key: "atmospheres", label: "Atmospheres", text: list("warm"), direction: "more" }),
          trait({ key: "genres", label: "Genres", text: list("trap"), direction: "less" }),
        ],
      },
      "strong"
    );
    expect(text).toContain("wants more atmospheres");
    expect(text).toContain("wants less genres");
  });

  it("does not repeat a loved genre that the genre list already names", () => {
    const text = buildDnaContext({ traits: FULL_PROFILE }, "strong");
    expect(text).not.toContain("loves indie pop");
  });

  it("adds loved genres when they are new information", () => {
    const text = buildDnaContext(
      {
        traits: [
          trait({ key: "genres", text: list("pop") }),
          trait({ key: "loved_genres", text: list("ambient", "jazz") }),
        ],
      },
      "strong"
    );
    expect(text).toContain("loves ambient, jazz");
  });

  it("describes instrumental-heavy catalogues and mixed vocal genders", () => {
    const text = buildDnaContext(
      {
        traits: [
          trait({ key: "instrumental_share", value: 0.8 }),
          trait({ key: "vocal_gender", text: "mixed" }),
          trait({ key: "length", value: 245 }),
        ],
      },
      "strong"
    );
    expect(text).toContain("mixed vocals");
    expect(text).toContain("mostly instrumental");
    expect(text).toContain("~4:05 songs");
  });
});

describe("mergeDnaIntoPrompt", () => {
  it("leaves the prompt untouched when the influence is off", () => {
    expect(mergeDnaIntoPrompt("  warm synth pop  ", "indie pop", "off")).toBe("warm synth pop");
  });

  it("leaves the prompt untouched when there is no hint", () => {
    expect(mergeDnaIntoPrompt("warm synth pop", "   ", "subtle")).toBe("warm synth pop");
  });

  it("appends the hint behind a recognisable marker", () => {
    const merged = mergeDnaIntoPrompt("warm synth pop", "84 BPM, female vocals", "subtle");
    expect(merged).toBe(`warm synth pop, ${DNA_HINT_PREFIX}84 BPM, female vocals`);
  });

  it("trims the hint instead of the user's prompt", () => {
    const prompt = "x".repeat(1900);
    const merged = mergeDnaIntoPrompt(prompt, "indie pop, 84 BPM, female vocals", "strong", 2000);

    expect(merged.startsWith(prompt)).toBe(true);
    expect(merged.length).toBeLessThanOrEqual(2000);
    expect(merged).toContain(DNA_HINT_PREFIX);
  });

  it("adds nothing when there is no room left", () => {
    const prompt = "x".repeat(1990);
    expect(mergeDnaIntoPrompt(prompt, "indie pop, 84 BPM", "strong", 2000)).toBe(prompt);
  });

  it("cuts the hint at a fragment boundary rather than mid-word", () => {
    const merged = mergeDnaIntoPrompt("pop", "indie pop, dream pop, female vocals, English lyrics", "strong", 60);
    expect(merged).toBe(`pop, ${DNA_HINT_PREFIX}indie pop, dream pop, female vocals`);
  });
});

describe("stripDnaHint", () => {
  it("removes a hint a previous generation appended", () => {
    expect(stripDnaHint(`warm synth pop, ${DNA_HINT_PREFIX}84 BPM, female vocals`)).toBe("warm synth pop");
  });

  it("keeps the user's own words", () => {
    expect(stripDnaHint("warm synth pop")).toBe("warm synth pop");
  });

  it("drops a prompt that was nothing but the hint", () => {
    expect(stripDnaHint(`${DNA_HINT_PREFIX}84 BPM`)).toBe("");
  });

  it("only strips the trailing hint, not a marker the user typed earlier", () => {
    const prompt = `sounds like ${DNA_HINT_PREFIX}but warmer`;
    expect(stripDnaHint(prompt)).toBe(prompt);
  });
});
