import { beforeEach, describe, expect, it, vi } from "vitest";

// One call per finalized track instead of two (atmosphere tags + lyrics score
// used to be separate requests over the same two strings).
const { scoreMock, featuresMock } = vi.hoisted(() => ({
  scoreMock: vi.fn(),
  featuresMock: vi.fn(),
}));

vi.mock("@/lib/providers/llm", () => ({ scoreLyricsAndAtmosphere: scoreMock }));
vi.mock("@/lib/audio-features", () => ({ extractAudioFeatures: featuresMock }));

import { computeAudioDna } from "../audio-dna";

describe("computeAudioDna", () => {
  beforeEach(() => {
    scoreMock.mockReset();
    scoreMock.mockResolvedValue({ tags: ["Warm", "Lo-fi"], lyricsScore: { score: 7.5, notes: "solid hook" } });
    featuresMock.mockReset();
    featuresMock.mockResolvedValue({ tempo: 92, key: "A minor", energy: 0.42, loudness: -9.1 });
  });

  it("fills the text signals from a single LLM call", async () => {
    const raw = await computeAudioDna({
      audioBuffer: Buffer.from("audio"),
      prompt: "warm analog synth, 90bpm",
      lyrics: "[Verse]\nhello",
      instrumental: false,
    });

    expect(scoreMock).toHaveBeenCalledTimes(1);
    expect(scoreMock).toHaveBeenCalledWith({ prompt: "warm analog synth, 90bpm", lyrics: "[Verse]\nhello" });
    expect(JSON.parse(raw)).toMatchObject({
      tempo: 92,
      key: "A minor",
      energy: 0.42,
      loudness: -9.1,
      atmosphereTags: ["Warm", "Lo-fi"],
      lyricsScore: 7.5,
      lyricsNotes: "solid hook",
    });
  });

  it("asks for tags only on an instrumental track", async () => {
    scoreMock.mockResolvedValue({ tags: ["Ambient"], lyricsScore: null });

    const raw = await computeAudioDna({
      audioBuffer: Buffer.from("audio"),
      prompt: "ambient pad, slow",
      lyrics: "[Verse]\nignored",
      instrumental: true,
    });

    expect(scoreMock).toHaveBeenCalledWith({ prompt: "ambient pad, slow", lyrics: null });
    expect(JSON.parse(raw)).toMatchObject({ atmosphereTags: ["Ambient"], lyricsScore: null, lyricsNotes: null });
  });

  it("still returns a usable payload when the text analysis fails", async () => {
    scoreMock.mockRejectedValue(new Error("provider down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = await computeAudioDna({
      audioBuffer: Buffer.from("audio"),
      prompt: "x",
      lyrics: "y",
      instrumental: false,
    });

    expect(JSON.parse(raw)).toMatchObject({
      tempo: 92,
      atmosphereTags: null,
      lyricsScore: null,
      lyricsNotes: null,
    });
    warn.mockRestore();
  });

  it("survives a failed audio feature extraction", async () => {
    featuresMock.mockRejectedValue(new Error("ffmpeg missing"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = await computeAudioDna({
      audioBuffer: Buffer.from("audio"),
      prompt: "x",
      lyrics: "y",
      instrumental: false,
    });

    expect(JSON.parse(raw)).toMatchObject({ tempo: null, atmosphereTags: ["Warm", "Lo-fi"], lyricsScore: 7.5 });
    warn.mockRestore();
  });
});
