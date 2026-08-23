import fs from "fs";
import path from "path";

/**
 * Minimal append-only file logger, in addition to console output.
 *
 * Log directory: configured via env LOG_DIR or defaults to "/data/logs".
 * In production (Docker), mount a volume there so logs survive restarts.
 */

function getLogDir(): string {
  if (process.env.LOG_DIR) return process.env.LOG_DIR;
  if (process.platform === "win32") {
    return path.join(process.cwd(), "data", "logs");
  }
  return "/data/logs";
}

function ensureLogDir(): string {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Appends a timestamped line to `<LOG_DIR>/<file>`. Never throws. */
export function logToFile(file: string, message: string): void {
  try {
    const dir = ensureLogDir();
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(path.join(dir, file), line);
  } catch (error) {
    console.warn(`[file-logger] failed to write to ${file}:`, error);
  }
}
