import { describe, it, expect, vi, beforeEach } from "vitest";
import { pickInspoAudioSource, ensureInspoMp3Source } from "@/lib/inspo-audio-source";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToMp3 } from "@/lib/transcode";
import { db } from "@/db";

vi.mock("@/db", () => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { db: { update } };
});

vi.mock("@/lib/s3", () => ({
  downloadFromS3: vi.fn(),
  uploadToS3: vi.fn(async (key: string) => key),
}));

vi.mock("@/lib/transcode", () => ({
  transcodeToMp3: vi.fn(),
}));

const mp3Buffer = Buffer.from("mp3-bytes");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(downloadFromS3).mockResolvedValue(Buffer.from("source-bytes"));
  vi.mocked(transcodeToMp3).mockResolvedValue(mp3Buffer);
});

describe("pickInspoAudioSource", () => {
  it("prefers a cached MP3 derivative over any other source", () => {
    const picked = pickInspoAudioSource({
      s3KeyMp3: "tracks/1/audio.mp3",
      s3Key: "tracks/1/audio.flac",
      format: "flac",
    });
    expect(picked).toEqual({ s3Key: "tracks/1/audio.mp3", format: "mp3", alreadyMp3: true });
  });

  it("reuses an original MP3 upload without re-encoding", () => {
    const picked = pickInspoAudioSource({ s3Key: "tracks/1/audio.mp3", format: "mp3" });
    expect(picked).toEqual({ s3Key: "tracks/1/audio.mp3", format: "mp3", alreadyMp3: true });
  });

  it("picks the HD FLAC when no MP3 exists, flagged for transcoding", () => {
    const picked = pickInspoAudioSource({
      s3Key: "tracks/1/audio.flac",
      s3KeyHd: "tracks/1/audio_hd.flac",
      format: "flac",
      formatHd: "flac",
    });
    expect(picked).toEqual({ s3Key: "tracks/1/audio_hd.flac", format: "flac", alreadyMp3: false });
  });

  it("picks WAV over FLAC because it is the best transcode source", () => {
    const picked = pickInspoAudioSource({
      s3Key: "tracks/1/audio.wav",
      s3KeyHd: "tracks/1/audio_hd.wav",
      format: "wav",
      formatHd: "wav",
    });
    expect(picked).toEqual({ s3Key: "tracks/1/audio_hd.wav", format: "wav", alreadyMp3: false });
  });

  it("still accepts an OGG-only track, flagged for transcoding", () => {
    const picked = pickInspoAudioSource({
      s3Key: "tracks/1/audio.ogg",
      s3KeyOgg: "tracks/1/audio.ogg",
      format: "ogg",
    });
    expect(picked).toEqual({ s3Key: "tracks/1/audio.ogg", format: "ogg", alreadyMp3: false });
  });

  it("returns null when the track has no audio at all", () => {
    expect(pickInspoAudioSource({})).toBeNull();
  });
});

describe("ensureInspoMp3Source", () => {
  it("transcodes an OGG-only track to MP3, uploads it and caches the key", async () => {
    const key = await ensureInspoMp3Source("user-1", {
      id: "track-1",
      title: "Ogg Only",
      s3Key: "tracks/track-1/audio.ogg",
      s3KeyOgg: "tracks/track-1/audio.ogg",
      format: "ogg",
    });

    expect(key).toBe("tracks/track-1/audio.mp3");
    expect(downloadFromS3).toHaveBeenCalledWith("tracks/track-1/audio.ogg");
    expect(transcodeToMp3).toHaveBeenCalledWith(Buffer.from("source-bytes"), 320);
    expect(uploadToS3).toHaveBeenCalledWith("tracks/track-1/audio.mp3", mp3Buffer, "audio/mpeg");

    const setMock = (db.update as any).mock.results[0].value.set;
    expect(setMock).toHaveBeenCalledWith({ s3KeyMp3: "tracks/track-1/audio.mp3" });
  });

  it("returns the MP3 as-is when S3 already holds one", async () => {
    const key = await ensureInspoMp3Source("user-1", {
      id: "track-2",
      s3Key: "tracks/track-2/audio.mp3",
      format: "mp3",
    });

    expect(key).toBe("tracks/track-2/audio.mp3");
    expect(downloadFromS3).not.toHaveBeenCalled();
    expect(transcodeToMp3).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("throws a clear error when the track has no audio", async () => {
    await expect(
      ensureInspoMp3Source("user-1", { id: "track-3", title: "Empty" })
    ).rejects.toThrow('Inspiration track "Empty" has no audio yet');
  });

  it("throws instead of sending a non-MP3 file when transcoding fails", async () => {
    vi.mocked(transcodeToMp3).mockRejectedValue(new Error("ffmpeg not available"));

    await expect(
      ensureInspoMp3Source("user-1", {
        id: "track-4",
        title: "Broken",
        s3Key: "tracks/track-4/audio.flac",
        s3KeyHd: "tracks/track-4/audio_hd.flac",
        format: "flac",
        formatHd: "flac",
      })
    ).rejects.toThrow('Could not convert inspiration track "Broken" to MP3');

    expect(uploadToS3).not.toHaveBeenCalled();
  });
});
