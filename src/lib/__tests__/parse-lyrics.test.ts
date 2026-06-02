import { describe, expect, it } from "vitest";
import { parseLyrics } from "../parse-lyrics";

describe("parseLyrics", () => {
  it("parses timed lines with mm:ss timestamps", () => {
    const lyrics = "Line one\nLine two";
    const payload = JSON.stringify({
      lines: [
        { text: "Line one", start: "00:01.50" },
        { text: "Line two", start: "00:03.00" },
      ],
    });

    const parsed = parseLyrics(lyrics, payload);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe("Line one");
    expect(parsed[0].startTime).toBeCloseTo(1.5, 3);
    expect(parsed[1].text).toBe("Line two");
    expect(parsed[1].startTime).toBeCloseTo(3, 3);
  });

  it("parses embedded LRC content from nested payloads", () => {
    const lyrics = "Alpha\nBeta";
    const payload = JSON.stringify({
      data: {
        output: {
          lyrics_timestamped: "[00:01.00]Alpha\n[00:02.50]Beta",
        },
      },
    });

    const parsed = parseLyrics(lyrics, payload);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ text: "Alpha" });
    expect(parsed[0].startTime).toBeCloseTo(1, 3);
    expect(parsed[1]).toMatchObject({ text: "Beta" });
    expect(parsed[1].startTime).toBeCloseTo(2.5, 3);
  });

  it("keeps fallback untimed lines when only task submission data is present", () => {
    const lyrics = "Verse one\nVerse two";
    const payload = JSON.stringify({
      task_id: "abc123",
      status: "submitted",
    });

    const parsed = parseLyrics(lyrics, payload);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].startTime).toBe(-1);
    expect(parsed[1].startTime).toBe(-1);
  });

  it("does not downscale valid second-based timelines above 300s", () => {
    const lyrics = "Intro\nFinale";
    const payload = JSON.stringify({
      lines: [
        { text: "Intro", start: 12 },
        { text: "Finale", start: 342 },
      ],
    });

    const parsed = parseLyrics(lyrics, payload);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].startTime).toBe(12);
    expect(parsed[1].startTime).toBe(342);
  });

  it("downscales millisecond timelines to seconds", () => {
    const lyrics = "Alpha\nBeta\nGamma";
    const payload = JSON.stringify({
      lines: [
        { text: "Alpha", start: 5000 },
        { text: "Beta", start: 9000 },
        { text: "Gamma", start: 13000 },
      ],
    });

    const parsed = parseLyrics(lyrics, payload);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].startTime).toBeCloseTo(5, 3);
    expect(parsed[1].startTime).toBeCloseTo(9, 3);
    expect(parsed[2].startTime).toBeCloseTo(13, 3);
  });
});
