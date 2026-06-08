/** Detect audio format from a URL or Content-Type header value */
export function detectFormatFromUrl(url: string): "mp3" | "wav" | "flac" {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".wav")) return "wav";
  if (lower.endsWith(".flac")) return "flac";
  return "mp3";
}

export function detectFormatFromContentType(contentType: string): "mp3" | "wav" | "flac" {
  const lower = contentType.toLowerCase();
  if (lower.includes("wav")) return "wav";
  if (lower.includes("flac")) return "flac";
  return "mp3";
}

export function contentTypeForFormat(format: "mp3" | "wav" | "flac"): string {
  if (format === "wav") return "audio/wav";
  if (format === "flac") return "audio/flac";
  return "audio/mpeg";
}
