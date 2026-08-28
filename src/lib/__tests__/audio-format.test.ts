import { describe, it, expect } from "vitest";
import {
  detectFormatFromUrl,
  detectFormatFromContentType,
  contentTypeForFormat,
  resolveTrackAudioSource,
  getBestSourceForOggConversion,
} from "../audio-format";

describe("audio-format", () => {
  describe("detectFormatFromUrl", () => {
    it("detects ogg formats", () => {
      expect(detectFormatFromUrl("https://example.com/audio.ogg")).toBe("ogg");
      expect(detectFormatFromUrl("https://example.com/audio.oga?token=123")).toBe("ogg");
    });

    it("detects flac formats", () => {
      expect(detectFormatFromUrl("https://example.com/audio.flac")).toBe("flac");
    });

    it("detects wav formats", () => {
      expect(detectFormatFromUrl("https://example.com/audio.wav")).toBe("wav");
    });

    it("falls back to mp3", () => {
      expect(detectFormatFromUrl("https://example.com/audio.mp3")).toBe("mp3");
      expect(detectFormatFromUrl("https://example.com/audio")).toBe("mp3");
    });
  });

  describe("detectFormatFromContentType", () => {
    it("detects audio/ogg and vorbis", () => {
      expect(detectFormatFromContentType("audio/ogg")).toBe("ogg");
      expect(detectFormatFromContentType("audio/ogg; codecs=vorbis")).toBe("ogg");
      expect(detectFormatFromContentType("application/ogg")).toBe("ogg");
    });

    it("detects audio/flac", () => {
      expect(detectFormatFromContentType("audio/flac")).toBe("flac");
    });

    it("detects audio/wav", () => {
      expect(detectFormatFromContentType("audio/wav")).toBe("wav");
      expect(detectFormatFromContentType("audio/x-wav")).toBe("wav");
    });

    it("falls back to mp3", () => {
      expect(detectFormatFromContentType("audio/mpeg")).toBe("mp3");
      expect(detectFormatFromContentType("audio/mp3")).toBe("mp3");
    });
  });

  describe("contentTypeForFormat", () => {
    it("maps formats to content types", () => {
      expect(contentTypeForFormat("ogg")).toBe("audio/ogg");
      expect(contentTypeForFormat("flac")).toBe("audio/flac");
      expect(contentTypeForFormat("wav")).toBe("audio/wav");
      expect(contentTypeForFormat("mp3")).toBe("audio/mpeg");
    });
  });

  describe("resolveTrackAudioSource", () => {
    const fullTrack = {
      s3Key: "tracks/1/audio.mp3",
      format: "mp3",
      s3KeyHd: "tracks/1/audio_hd.flac",
      formatHd: "flac",
      s3KeyMp3: "tracks/1/audio_transcoded.mp3",
      s3KeyOgg: "tracks/1/audio.ogg",
    };

    it("defaults to OGG Vorbis when available", () => {
      const res = resolveTrackAudioSource(fullTrack);
      expect(res).toEqual({ s3Key: "tracks/1/audio.ogg", format: "ogg" });
    });

    it("falls back to MP3 if no OGG is available", () => {
      const trackWithoutOgg = {
        ...fullTrack,
        s3KeyOgg: null,
      };
      const res = resolveTrackAudioSource(trackWithoutOgg);
      expect(res).toEqual({ s3Key: "tracks/1/audio_transcoded.mp3", format: "mp3" });
    });

    it("falls back to FLAC if no OGG and no MP3 is available", () => {
      const flacOnlyTrack = {
        s3Key: "tracks/1/audio.flac",
        format: "flac",
        s3KeyHd: "tracks/1/audio_hd.flac",
        formatHd: "flac",
        s3KeyMp3: null,
        s3KeyOgg: null,
      };
      const res = resolveTrackAudioSource(flacOnlyTrack);
      expect(res).toEqual({ s3Key: "tracks/1/audio_hd.flac", format: "flac" });
    });

    it("falls back to WAV if no OGG, MP3, or FLAC is available", () => {
      const wavOnlyTrack = {
        s3Key: "tracks/1/audio.wav",
        format: "wav",
        s3KeyHd: "tracks/1/audio_hd.wav",
        formatHd: "wav",
        s3KeyMp3: null,
        s3KeyOgg: null,
      };
      const res = resolveTrackAudioSource(wavOnlyTrack);
      expect(res).toEqual({ s3Key: "tracks/1/audio_hd.wav", format: "wav" });
    });

    it("prioritizes FLAC > WAV > OGG > MP3 when hd option is true", () => {
      const resHd = resolveTrackAudioSource(fullTrack, { hd: true });
      expect(resHd).toEqual({ s3Key: "tracks/1/audio_hd.flac", format: "flac" });

      const trackWavHd = {
        s3Key: "tracks/1/audio.mp3",
        format: "mp3",
        s3KeyHd: "tracks/1/audio_hd.wav",
        formatHd: "wav",
        s3KeyOgg: "tracks/1/audio.ogg",
      };
      const resWavHd = resolveTrackAudioSource(trackWavHd, { hd: true });
      expect(resWavHd).toEqual({ s3Key: "tracks/1/audio_hd.wav", format: "wav" });
    });
  });

  describe("getBestSourceForOggConversion", () => {
    it("prefers WAV when available (even if MP3 or FLAC exist)", () => {
      const trackWithWavAndMp3 = {
        s3Key: "tracks/1/audio.mp3",
        format: "mp3",
        s3KeyHd: "tracks/1/audio_hd.wav",
        formatHd: "wav",
        s3KeyMp3: "tracks/1/audio.mp3",
      };
      const res = getBestSourceForOggConversion(trackWithWavAndMp3);
      expect(res).toEqual({ s3Key: "tracks/1/audio_hd.wav", format: "wav" });
    });

    it("prefers FLAC when WAV is not available but MP3 exists", () => {
      const trackWithFlacAndMp3 = {
        s3Key: "tracks/2/audio.mp3",
        format: "mp3",
        s3KeyHd: "tracks/2/audio_hd.flac",
        formatHd: "flac",
        s3KeyMp3: "tracks/2/audio.mp3",
      };
      const res = getBestSourceForOggConversion(trackWithFlacAndMp3);
      expect(res).toEqual({ s3Key: "tracks/2/audio_hd.flac", format: "flac" });
    });

    it("falls back to MP3 if neither WAV nor FLAC is available", () => {
      const mp3OnlyTrack = {
        s3Key: "tracks/3/audio.mp3",
        format: "mp3",
        s3KeyMp3: "tracks/3/audio.mp3",
        s3KeyHd: null,
        formatHd: null,
      };
      const res = getBestSourceForOggConversion(mp3OnlyTrack);
      expect(res).toEqual({ s3Key: "tracks/3/audio.mp3", format: "mp3" });
    });

    it("returns null if no audio source key exists", () => {
      const emptyTrack = {
        s3Key: null,
        s3KeyHd: null,
        s3KeyMp3: null,
      };
      const res = getBestSourceForOggConversion(emptyTrack);
      expect(res).toBeNull();
    });
  });

  describe("detectUploadFormat", () => {
    it("detects MP3, WAV, OGG, and FLAC files", async () => {
      const { detectUploadFormat, computeUploadAudioHash } = await import("../../app/api/tracks/upload-helpers");
      
      const mp3File = new File(["fake mp3 data"], "song.mp3", { type: "audio/mpeg" });
      const wavFile = new File(["fake wav data"], "song.wav", { type: "audio/wav" });
      const oggFile = new File(["fake ogg data"], "song.ogg", { type: "audio/ogg" });
      const flacFile = new File(["fake flac data"], "song.flac", { type: "audio/flac" });
      const txtFile = new File(["some text"], "song.txt", { type: "text/plain" });

      expect(detectUploadFormat(mp3File)).toBe("mp3");
      expect(detectUploadFormat(wavFile)).toBe("wav");
      expect(detectUploadFormat(oggFile)).toBe("ogg");
      expect(detectUploadFormat(flacFile)).toBe("flac");
      expect(detectUploadFormat(txtFile)).toBeNull();

      const buffer = Buffer.from("test-audio-content");
      const hash1 = computeUploadAudioHash(buffer, "ogg");
      const hash2 = computeUploadAudioHash(buffer, "mp3");
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBe(64);
      expect(typeof hash2).toBe("string");
    });
  });
});
