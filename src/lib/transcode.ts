import ffmpegStatic from "ffmpeg-static";
import { execFileSync, spawn } from "child_process";
import { Readable } from "stream";

export function resolveFfmpegPath(): string | null {
  // 1. Explicit override via env var
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  // 2. System ffmpeg (works when ffmpeg is installed on the server)
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const result = execFileSync(whichCmd, ["ffmpeg"], { encoding: "utf-8" }).trim();
    const firstLine = result.split(/\r?\n/)[0].trim();
    if (firstLine) return firstLine;
  } catch {}

  // 3. ffmpeg-static bundled binary — verify it actually exists before trusting it
  if (ffmpegStatic) {
    try {
      execFileSync(ffmpegStatic, ["-version"], { stdio: "ignore" });
      return ffmpegStatic;
    } catch {}
  }

  return null;
}

/**
 * Transcode any audio buffer to MP3 (192kbps) using ffmpeg.
 * Returns the MP3 as a Buffer.
 */
export function transcodeToMp3(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = resolveFfmpegPath();
    if (!bin) {
      reject(new Error("ffmpeg not available"));
      return;
    }

    const chunks: Buffer[] = [];

    const proc = spawn(bin, [
      "-i", "pipe:0",
      "-vn",
      "-ar", "44100",
      "-ac", "2",
      "-b:a", "192k",
      "-f", "mp3",
      "pipe:1",
    ]);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stdout.on("end", () => resolve(Buffer.concat(chunks)));
    proc.stderr.on("data", () => {}); // suppress ffmpeg logs
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    const readable = Readable.from(input);
    readable.pipe(proc.stdin);
    readable.on("error", reject);
  });
}

/**
 * Transcode any audio buffer to Ogg Vorbis using ffmpeg libvorbis encoder.
 * Returns the OGG as a Buffer.
 */
export function transcodeToOgg(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = resolveFfmpegPath();
    if (!bin) {
      reject(new Error("ffmpeg not available"));
      return;
    }

    const chunks: Buffer[] = [];

    const proc = spawn(bin, [
      "-i", "pipe:0",
      "-vn",
      "-c:a", "libvorbis",
      "-q:a", "6",
      "-f", "ogg",
      "pipe:1",
    ]);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stdout.on("end", () => resolve(Buffer.concat(chunks)));
    proc.stderr.on("data", () => {}); // suppress ffmpeg logs
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    const readable = Readable.from(input);
    readable.pipe(proc.stdin);
    readable.on("error", reject);
  });
}
