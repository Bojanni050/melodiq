import { execFile, execFileSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);

function resolveFfmpegPath(): string {
  // 1. Explicit override via env var
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  // 2. System ffmpeg (works in most Linux containers with ffmpeg installed)
  try {
    const which = execFileSync("which", ["ffmpeg"], { encoding: "utf-8" }).trim();
    if (which) return which;
  } catch {}

  // 3. ffmpeg-static bundled binary (only reliable when npm install ran on the same OS)
  if (ffmpegStatic) return ffmpegStatic;

  throw new Error(
    "ffmpeg not found. Install ffmpeg on the server, set the FFMPEG_PATH env var, or run npm install natively on the target platform."
  );
}

const FFMPEG_BIN = resolveFfmpegPath();

const LOCAL_WAV_DIR =
  process.env.LOCAL_WAV_DIR ||
  join(tmpdir(), "melodiq-wav-uploads");

export async function saveWavLocally(trackId: string, wavBuffer: Buffer): Promise<string> {
  await mkdir(LOCAL_WAV_DIR, { recursive: true });
  const filePath = join(LOCAL_WAV_DIR, `${trackId}.wav`);
  await writeFile(filePath, wavBuffer);
  return filePath;
}

export async function convertWavToFlac(wavBuffer: Buffer): Promise<Buffer> {
  const id = crypto.randomUUID();
  const tmpWav = join(tmpdir(), `${id}.wav`);
  const tmpFlac = join(tmpdir(), `${id}.flac`);

  try {
    await writeFile(tmpWav, wavBuffer);
    await execFileAsync(FFMPEG_BIN, [
      "-i", tmpWav,
      "-c:a", "flac",
      "-compression_level", "8",
      "-y",
      tmpFlac,
    ]);
    return await readFile(tmpFlac);
  } finally {
    await unlink(tmpWav).catch(() => {});
    await unlink(tmpFlac).catch(() => {});
  }
}
