import { parseLyrics } from "./src/lib/parse-lyrics";

const raw = `"{\\"code\\":200,\\"data\\":{\\"task_id\\":\\"16K8N0DXNGKK1LV1\\",\\"status\\":\\"finished\\",\\"created_time\\":\\"2026-06-02T06:35:55\\",\\"error_message\\":null,\\"progress\\":0,\\"files\\":[{\\"timestampe_lyrics\\":{\\"aligned_words\\":[{\\"word\\":\\"[Intro | Distant Male Vocal | Close-Mic | Minimal Ambience]\\\\nComplete \\",\\"success\\":true,\\"startS\\":10.532,\\"endS\\":11.489,\\"palign\\":0}]}}]}}"`;

console.log("parseLyrics with double encoded:", parseLyrics(null, raw));
