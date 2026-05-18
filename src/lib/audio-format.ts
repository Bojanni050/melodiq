/** Detect audio format from a URL or Content-Type header value */
export function detectFormatFromUrl(url: string): "mp3" | "wav" {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".wav")) return "wav";
  return "mp3";
}

export function detectFormatFromContentType(contentType: string): "mp3" | "wav" {
  if (contentType.toLowerCase().includes("wav")) return "wav";
  return "mp3";
}

export function contentTypeForFormat(format: "mp3" | "wav"): string {
  return format === "wav" ? "audio/wav" : "audio/mpeg";
}
