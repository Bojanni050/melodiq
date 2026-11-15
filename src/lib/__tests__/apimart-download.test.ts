import { describe, expect, it } from "vitest";
import { buildApimartDownloadBody, extractApimartDownloadUrl } from "@/lib/providers/apimart-download";

describe("buildApimartDownloadBody", () => {
  it("asks the download endpoint for a wav of the given track", () => {
    const body = buildApimartDownloadBody({ taskId: "task_123", audioIndex: 2, formats: ["wav"] });
    expect(body).toEqual({
      model: "suno",
      task_id: "task_123",
      audio_index: 2,
      formats: ["wav"],
    });
  });

  it("leaves audio_index out when not known, so the API's default of 1 applies", () => {
    const body = buildApimartDownloadBody({ taskId: "task_123", formats: ["wav"] });
    expect(body).not.toHaveProperty("audio_index");
  });
});

describe("extractApimartDownloadUrl", () => {
  it("reads the wav out of result.files[]", () => {
    const raw = {
      code: 200,
      data: {
        status: "completed",
        result: {
          music_id: "518c74ee",
          files: [
            { format: "mp3", url: "https://assets.apimart.ai/audio/example.mp3" },
            { format: "wav", url: "https://assets.apimart.ai/audio/example.wav" },
          ],
        },
      },
    };
    expect(extractApimartDownloadUrl(raw)).toBe("https://assets.apimart.ai/audio/example.wav");
  });

  it("matches the format case-insensitively", () => {
    const raw = { data: { result: { files: [{ format: "WAV", url: "https://x/example.wav" }] } } };
    expect(extractApimartDownloadUrl(raw)).toBe("https://x/example.wav");
  });

  it("falls back to the first usable file when the requested format is missing", () => {
    const raw = { data: { result: { files: [{ format: "m4a", url: "https://x/example.m4a" }] } } };
    expect(extractApimartDownloadUrl(raw, "wav")).toBe("https://x/example.m4a");
  });

  it("still reads the legacy wavUrl when files[] is absent", () => {
    const raw = { data: { result: { wavUrl: "https://x/legacy.wav" } } };
    expect(extractApimartDownloadUrl(raw)).toBe("https://x/legacy.wav");
  });

  it("prefers files[] over the legacy compatibility field", () => {
    const raw = {
      data: {
        result: {
          files: [{ format: "wav", url: "https://x/new.wav" }],
          wavUrl: "https://x/legacy.wav",
        },
      },
    };
    expect(extractApimartDownloadUrl(raw)).toBe("https://x/new.wav");
  });

  it("returns null when a completed task carries no url at all", () => {
    expect(extractApimartDownloadUrl({ data: { status: "completed", result: { files: [] } } })).toBeNull();
    expect(extractApimartDownloadUrl({ data: { result: {} } })).toBeNull();
    expect(extractApimartDownloadUrl(null)).toBeNull();
  });
});
