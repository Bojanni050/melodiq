import { describe, it, expect } from "vitest";
import { resolveStreamSuffix, trackHasLossless, detectStreamFormat } from "@/components/player/playerUtils";
import type { Track } from "@/lib/store";

function track(overrides: Partial<Track>): Track {
  return {
    id: "t1",
    title: "Test",
    provider: "suno",
    providerModel: "v5",
    prompt: "",
    status: "done",
    audioUrl: null,
    audioUrlHd: null,
    s3Key: null,
    s3KeyHd: null,
    duration: null,
    lyrics: null,
    createdAt: new Date(0).toISOString(),
    error: null,
    ...overrides,
  };
}

describe("resolveStreamSuffix", () => {
  it("never asks for HD when highest quality is off", () => {
    const t = track({ format: "flac", s3Key: "a.flac", formatHd: "flac", s3KeyHd: "a-hd.flac" });
    expect(resolveStreamSuffix(t, false)).not.toContain("hd=true");
  });

  it("asks for HD when the lossless file is the primary key (WAV/FLAC upload)", () => {
    // Uploads keep the lossless original in s3Key and add an MP3 derivative.
    // The plain URL resolves to that MP3 first, which is the regression this
    // guards: highest quality used to stream the lossy copy.
    const flacUpload = track({ format: "flac", s3Key: "a.flac", s3KeyMp3: "a.mp3" });
    const wavUpload = track({ format: "wav", s3Key: "a.wav", s3KeyMp3: "a.mp3" });

    expect(resolveStreamSuffix(flacUpload, true)).toContain("hd=true");
    expect(resolveStreamSuffix(wavUpload, true)).toContain("hd=true");
  });

  it("asks for HD when the lossless file sits in the HD slot", () => {
    const t = track({ format: "mp3", s3Key: "a.mp3", formatHd: "flac", s3KeyHd: "a.flac" });
    expect(resolveStreamSuffix(t, true)).toContain("hd=true");
  });

  it("does not ask for HD for a compressed-only track", () => {
    const t = track({ format: "mp3", s3Key: "a.mp3", s3KeyOgg: "a.ogg" });
    expect(resolveStreamSuffix(t, true)).not.toContain("hd=true");
  });
});

describe("trackHasLossless", () => {
  it("is true for lossless in either slot", () => {
    expect(trackHasLossless(track({ format: "flac", s3Key: "a.flac" }))).toBe(true);
    expect(trackHasLossless(track({ formatHd: "wav", s3KeyHd: "a.wav" }))).toBe(true);
  });

  it("is false for compressed-only tracks", () => {
    expect(trackHasLossless(track({ format: "mp3", s3Key: "a.mp3" }))).toBe(false);
    expect(trackHasLossless(null)).toBe(false);
  });
});

describe("detectStreamFormat", () => {
  it("prefers the stream response header", () => {
    const headers = new Headers({
      "x-melodiq-audio-format": "flac",
      "content-type": "audio/mpeg",
    });
    expect(detectStreamFormat(headers)).toBe("flac");
  });

  it("falls back to the response content type", () => {
    expect(detectStreamFormat(new Headers({ "content-type": "audio/wav" }))).toBe("wav");
    expect(detectStreamFormat(new Headers({ "content-type": "audio/ogg" }))).toBe("ogg");
    expect(detectStreamFormat(new Headers({ "content-type": "audio/mpeg" }))).toBe("mp3");
  });

  it("ignores non-audio responses", () => {
    expect(detectStreamFormat(new Headers({ "content-type": "application/json" }))).toBeNull();
  });
});
