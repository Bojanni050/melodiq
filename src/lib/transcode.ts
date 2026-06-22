import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import { Readable } from "stream";

/**
 * Transcode any audio buffer to MP3 (192kbps) using ffmpeg.
 * Returns the MP3 as a Buffer.
 */
export function transcodeToMp3(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!ffmpegStatic) {
      reject(new Error("ffmpeg-static not available"));
      return;
    }

    const chunks: Buffer[] = [];

    const proc = spawn(ffmpegStatic, [
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
