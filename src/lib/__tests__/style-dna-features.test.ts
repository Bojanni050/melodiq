import { describe, expect, it } from "vitest";
import {
  countSyllables,
  extractWritingFeatures,
  rhymeKey,
  splitSections,
} from "@/lib/style-dna/features";

describe("countSyllables", () => {
  it("counts English words", () => {
    expect(countSyllables("light", "en")).toBe(1);
    expect(countSyllables("going", "en")).toBe(2);
    expect(countSyllables("beautiful", "en")).toBe(3);
  });

  it("counts Dutch words", () => {
    expect(countSyllables("nacht", "nl")).toBe(1);
    expect(countSyllables("mooie", "nl")).toBe(2);
    expect(countSyllables("liefde", "nl")).toBe(2);
  });

  it("counts Spanish and Portuguese words", () => {
    expect(countSyllables("corazon", "es")).toBe(3);
    expect(countSyllables("saudade", "pt")).toBe(3);
  });

  it("returns null for words without vowels and empty input", () => {
    expect(countSyllables("", "en")).toBeNull();
    expect(countSyllables("hmm", "en")).toBeNull();
  });
});

describe("rhymeKey", () => {
  it("matches genuine English rhymes regardless of spelling", () => {
    expect(rhymeKey("go", "en")).toBe(rhymeKey("show", "en"));
    expect(rhymeKey("light", "en")).toBe(rhymeKey("night", "en"));
  });

  it("separates words that do not rhyme", () => {
    expect(rhymeKey("light", "en")).not.toBe(rhymeKey("love", "en"));
  });

  it("returns null when there is no vowel", () => {
    expect(rhymeKey("", "en")).toBeNull();
  });
});

describe("splitSections", () => {
  it("splits on bracketed headings and drops inline tags", () => {
    const sections = splitSections("[Verse 1]\nhello world\n\n[Chorus]\n[male] shout it");
    expect(sections.map((s) => s.label)).toEqual(["Verse 1", "Chorus"]);
    expect(sections[0].lines).toEqual(["hello world"]);
    expect(sections[1].lines).toEqual(["shout it"]);
  });

  it("treats a text without headings as one untitled section", () => {
    const sections = splitSections("one line\ntwo lines");
    expect(sections).toHaveLength(1);
    expect(sections[0].lines).toEqual(["one line", "two lines"]);
  });
});

describe("extractWritingFeatures", () => {
  it("detects an AA couplet scheme with full density", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nI keep the light on when I go\nI never learned to let it show",
      language: "en",
    });
    expect(f?.rhymeScheme).toBe("AA");
    expect(f?.rhymeDensity).toBe(1);
  });

  it("detects an ABAB scheme", () => {
    const f = extractWritingFeatures({
      lyrics:
        "[Verse 1]\nI keep the light on when I go\nHe never learned to say my name\nI let the shadows take it slow\nHe only ever played the game",
      language: "en",
    });
    expect(f?.rhymeScheme).toBe("ABAB");
  });

  it("counts internal rhymes inside a line", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nthe night is bright and I feel alright\nthe day is grey and I walk away",
      language: "en",
    });
    expect(f?.internalRhyme).toBeGreaterThan(0);
  });

  it("reads first person from English pronouns", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nI keep my head up\nwe never lose",
      language: "en",
    });
    expect(f?.pov).toBe("first");
  });

  it("reads past tense from Dutch markers", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nIk was alleen en ik zag de maan\nWij waren stil en ik wist het al",
      language: "nl",
    });
    expect(f?.tense).toBe("past");
  });

  it("flags explicit lines", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nthis shit is over now\nI walk away",
      language: "en",
    });
    expect(f?.explicitness).toBeGreaterThan(0);
  });

  it("returns themes for mapped keywords", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nthe night is cold\nI remember your love",
      language: "en",
    });
    expect(f?.themes).toEqual(expect.arrayContaining(["love", "night"]));
  });

  it("never invents values for texts that are too short", () => {
    expect(
      extractWritingFeatures({ lyrics: "[Verse 1]\nla", language: "en" }),
    ).toBeNull();
    expect(extractWritingFeatures({ lyrics: "", language: "en" })).toBeNull();
    expect(extractWritingFeatures({ lyrics: null, language: "en" })).toBeNull();
  });

  it("only matches themes on word boundaries", () => {
    // Regressie: "door" viel onder het Portugese "dor" (pijn) en "window" onder
    // "win" (motivation) — samen goed voor 297 van 400 tracks in een steekproef.
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nthe door was open and I walked in\nI saw the window and the rain",
      language: "en",
    });
    expect(f?.themes).not.toContain("pain");
    expect(f?.themes).not.toContain("motivation");
  });

  it("measures multisyllabic rhyme on the rhyming word, not the line", () => {
    const mono = extractWritingFeatures({
      lyrics: "[Verse 1]\nI keep the light on when I go\nI never learned to let it show",
      language: "en",
    });
    const multi = extractWritingFeatures({
      lyrics: "[Verse 1]\nI am a believer\nand you are a retriever",
      language: "en",
    });
    expect(mono?.multisyllabicRhyme).toBe(0);
    expect(multi?.multisyllabicRhyme).toBe(1);
  });

  it("keeps contractions out of the signature words", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nI don't know why you're here\nthere's nothing left to say",
      language: "en",
    });
    expect(f?.contentWords.some((word) => word.includes("'"))).toBe(false);
  });

  it("handles an unknown language without throwing", () => {
    const f = extractWritingFeatures({
      lyrics: "[Verse 1]\nkaas is lekker en de maan is rond\nwij dansen samen in de straat",
      language: "xx",
    });
    expect(f).not.toBeNull();
    expect(f?.avgSyllables).toBeGreaterThan(0);
  });

  it("reads the section order, chorus length and bridge from the headings", () => {
    const f = extractWritingFeatures({
      lyrics: [
        "[Intro]",
        "oh oh",
        "[Verse 1]",
        "I keep the light on when I go",
        "I never learned to let it show",
        "[Chorus]",
        "we run into the night",
        "we run into the light",
        "we never say goodbye",
        "[Verse 2]",
        "I see the morning in your eyes",
        "I carry every alibi",
        "[Chorus]",
        "we run into the night",
        "we run into the light",
        "we never say goodbye",
        "[Bridge]",
        "hold on to me tonight",
        "[Outro]",
        "oh oh",
      ].join("\n"),
      language: "en",
    });
    expect(f?.sectionStructure).toBe("i-v-c-v-c-b-o");
    expect(f?.chorusLines).toBe(3);
    expect(f?.hasBridge).toBe(true);
    expect(f?.repetition).toBeGreaterThan(0.4);
  });

  it("recognises Dutch and Spanish section labels", () => {
    const dutch = extractWritingFeatures({
      lyrics: "[Couplet 1]\nik zie de nacht voorbij gaan\njij blijft hier nog even staan\n[Refrein]\nwij dansen in het licht\nwij dansen in het zicht",
      language: "nl",
    });
    expect(dutch?.sectionStructure).toBe("v-c");
    const spanish = extractWritingFeatures({
      lyrics: "[Verso 1]\ncamino por la calle\nbuscando tu mirada\n[Estribillo]\nven aquí conmigo\nno me dejes solo",
      language: "es",
    });
    expect(spanish?.sectionStructure).toBe("v-c");
  });

  it("counts parenthetical ad-libs per line", () => {
    const f = extractWritingFeatures({
      lyrics: "[Chorus]\nwe run into the night (yeah)\nwe run into the light\nwe never say goodbye (oh-oh)",
      language: "en",
    });
    expect(f?.adLibs).toBeCloseTo(0.67, 1);
  });

  it("returns no structure when the headings are not section labels", () => {
    const f = extractWritingFeatures({
      lyrics: "[Part 1]\nI keep the light on when I go\nI never learned to let it show",
      language: "en",
    });
    expect(f?.sectionStructure).toBeNull();
    expect(f?.chorusLines).toBeNull();
    expect(f?.hasBridge).toBe(false);
  });
});
