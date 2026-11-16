import { beforeEach, describe, expect, it, vi } from "vitest";

// scoreLyricsAndAtmosphere() is the merged Track DNA text call: one request,
// asking only for the fields whose input exists.
const { postMock, settingsState } = vi.hoisted(() => ({
  postMock: vi.fn(),
  settingsState: { values: {} as Record<string, string> },
}));

vi.mock("axios", () => ({ default: { post: postMock } }));
vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (key: string) => settingsState.values[key] ?? ""),
}));
vi.mock("@/lib/file-logger", () => ({ logToFile: () => {} }));

import { scoreLyricsAndAtmosphere } from "../providers/llm";

function respond(content: string) {
  return { status: 200, data: { choices: [{ message: { content } }] } };
}

describe("scoreLyricsAndAtmosphere", () => {
  beforeEach(() => {
    postMock.mockReset();
    settingsState.values = { TRACKDNA_LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-key" };
  });

  it("answers both signals from one request", async () => {
    postMock.mockResolvedValue(respond('{"tags": ["Warm", "Lo-fi"], "score": 7.4, "notes": "solid hook"}'));

    const result = await scoreLyricsAndAtmosphere({ prompt: "warm synth", lyrics: "[Verse]\nhello" });

    expect(postMock).toHaveBeenCalledTimes(1);
    const body = postMock.mock.calls[0][1];
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBe(400);
    expect(body.messages[1].content).toContain("warm synth");
    expect(body.messages[1].content).toContain("[Verse]\nhello");
    expect(result).toEqual({ tags: ["Warm", "Lo-fi"], lyricsScore: { score: 7.4, notes: "solid hook" } });
  });

  it("asks for tags only when there are no lyrics, and ignores a score anyway", async () => {
    postMock.mockResolvedValue(respond('{"tags": ["Ambient"], "score": 9, "notes": "nice"}'));

    const result = await scoreLyricsAndAtmosphere({ prompt: "ambient pad", lyrics: "   " });

    expect(result).toEqual({ tags: ["Ambient"], lyricsScore: null });
    expect(postMock.mock.calls[0][1].messages[1].content).not.toContain("Lyrics:");
  });

  it("asks for a score only when there is no prompt", async () => {
    postMock.mockResolvedValue(respond('{"tags": ["Ignored"], "score": 6.2, "notes": "ok"}'));

    const result = await scoreLyricsAndAtmosphere({ prompt: null, lyrics: "[Chorus]\nhook" });

    expect(result).toEqual({ tags: null, lyricsScore: { score: 6.2, notes: "ok" } });
    expect(postMock.mock.calls[0][1].messages[1].content).not.toContain("Style/prompt:");
  });

  it("makes no request at all when there is nothing to analyse", async () => {
    const result = await scoreLyricsAndAtmosphere({ prompt: "  ", lyrics: null });

    expect(result).toEqual({ tags: null, lyricsScore: null });
    expect(postMock).not.toHaveBeenCalled();
  });

  it("returns nulls instead of throwing on an unparseable answer", async () => {
    postMock.mockResolvedValue(respond("I'd rather not, sorry."));

    await expect(scoreLyricsAndAtmosphere({ prompt: "x", lyrics: "y" })).resolves.toEqual({
      tags: null,
      lyricsScore: null,
    });
  });

  it("drops an out-of-range score and empty tags", async () => {
    postMock.mockResolvedValue(respond('{"tags": ["  ", ""], "score": 44, "notes": "hmm"}'));

    await expect(scoreLyricsAndAtmosphere({ prompt: "x", lyrics: "y" })).resolves.toEqual({
      tags: null,
      lyricsScore: null,
    });
  });

  it("tolerates a fenced JSON answer", async () => {
    postMock.mockResolvedValue(respond('```json\n{"tags": ["Warm"], "score": 5, "notes": "ok"}\n```'));

    await expect(scoreLyricsAndAtmosphere({ prompt: "x", lyrics: "y" })).resolves.toEqual({
      tags: ["Warm"],
      lyricsScore: { score: 5, notes: "ok" },
    });
  });

  it("returns nulls when the provider call fails", async () => {
    postMock.mockRejectedValue({ response: { status: 401, data: { error: { message: "no auth" } } } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(scoreLyricsAndAtmosphere({ prompt: "x", lyrics: "y" })).resolves.toEqual({
      tags: null,
      lyricsScore: null,
    });
    warn.mockRestore();
  });
});
