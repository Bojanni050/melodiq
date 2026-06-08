import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

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
    await execFileAsync(ffmpegPath!, [
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
