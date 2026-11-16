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

import { callLLMWithAudio, scoreLyricsAndAtmosphere } from "../providers/llm";

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

// The Advanced-DNA audio call is the most expensive request in the app; it gets
// the same transient retry as the chat path, and only for failures that weren't
// billed.
describe("callLLMWithAudio retry", () => {
  const audio = Buffer.from("fake-audio-bytes");

  beforeEach(() => {
    postMock.mockReset();
    settingsState.values = {
      ADVANCED_LLM_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "or-key",
      OPENROUTER_ADVANCED_DNA_MODEL: "google/gemini-2.5-flash",
    };
  });

  it("sends the audio as base64 and returns the content", async () => {
    postMock.mockResolvedValue(respond("analysis"));

    await expect(callLLMWithAudio("advanced", audio, "mp3", "system", "user text")).resolves.toBe("analysis");

    const body = postMock.mock.calls[0][1];
    expect(body.model).toBe("google/gemini-2.5-flash");
    expect(body.messages[1].content[1].input_audio.data).toBe(audio.toString("base64"));
    expect(postMock.mock.calls[0][2].timeout).toBe(90_000);
  });

  it("retries a rate-limited attempt once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postMock
      .mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "0" }, data: {} } })
      .mockResolvedValueOnce(respond("second try"));

    await expect(callLLMWithAudio("advanced", audio, "mp3", "s", "u")).resolves.toBe("second try");
    expect(postMock).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("gives up after one retry", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    postMock.mockRejectedValue({ response: { status: 503, headers: { "retry-after": "0" }, data: {} } });

    await expect(callLLMWithAudio("advanced", audio, "mp3", "s", "u")).rejects.toMatchObject({
      response: { status: 503 },
    });
    expect(postMock).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("does not retry a 400", async () => {
    postMock.mockRejectedValue({ response: { status: 400, data: { error: { message: "audio too long" } } } });

    await expect(callLLMWithAudio("advanced", audio, "mp3", "s", "u")).rejects.toMatchObject({
      response: { status: 400 },
    });
    expect(postMock).toHaveBeenCalledTimes(1);
  });
});
