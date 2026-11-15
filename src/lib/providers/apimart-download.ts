// Wire format for APIMart's audio download endpoint
// (POST /v1/music/generations/download). Same rule as apimart-inspo.ts: no
// settings/db imports, so the contract with the API can be tested directly.
//
// The endpoint replaces the deprecated POST /generations/wav. It takes
// `formats` (array) or `format` (single string), returns a new task id, and
// the finished task carries `result.files[]` — one entry per requested
// format. The legacy `result.wavUrl` is only kept for compatibility, so
// downloads must be read from `files[]` first.

export type ApimartAudioFormat = "mp3" | "m4a" | "wav";

export interface ApimartDownloadBodyParams {
  taskId: string;
  audioIndex?: number;
  formats: ApimartAudioFormat[];
}

export function buildApimartDownloadBody(params: ApimartDownloadBodyParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: "suno",
    task_id: params.taskId,
    formats: params.formats,
  };
  // 1-based index into the source task's music[]; the API defaults to 1.
  if (typeof params.audioIndex === "number") body.audio_index = params.audioIndex;
  return body;
}

interface DownloadFile {
  format?: unknown;
  url?: unknown;
}

/**
 * Picks the URL for `preferred` out of a completed download task.
 *
 * `result.files[]` is authoritative. `wavUrl`/`wav_url` is the legacy shape and
 * is only consulted when the array is missing, so an API that stops sending
 * the compatibility field cannot silently break HD downloads.
 */
export function extractApimartDownloadUrl(raw: any, preferred: ApimartAudioFormat = "wav"): string | null {
  const result = raw?.data?.result ?? raw?.result;
  const files = result?.files;

  if (Array.isArray(files)) {
    const usable = files.filter(
      (file: DownloadFile) => typeof file?.url === "string" && file.url.trim().length > 0
    );
    const exact = usable.find(
      (file: DownloadFile) => String(file.format ?? "").toLowerCase() === preferred
    );
    const picked = exact ?? usable[0];
    if (picked) return String(picked.url);
  }

  const legacy = [result?.wavUrl, result?.wav_url, raw?.data?.wavUrl, raw?.data?.wav_url];
  const found = legacy.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof found === "string" ? found : null;
}
