import type { TclDocument } from "./types";
import { serializeTtml } from "./ttml";

function formatSrtTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatLrcTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${ss.toFixed(2).padStart(5, "0")}`;
}

export function exportSrt(doc: TclDocument): string {
  return doc.lines
    .map((line, index) => `${index + 1}\n${formatSrtTime(line.start)} --> ${formatSrtTime(line.end)}\n${line.text}`)
    .join("\n\n");
}

/** Enhanced/word-level LRC: [mm:ss.xx]<mm:ss.xx>word <mm:ss.xx>word ... */
export function exportEnhancedLrc(doc: TclDocument): string {
  return doc.lines
    .map((line) => {
      if (line.words.length === 0) {
        return `[${formatLrcTime(line.start)}]${line.text}`;
      }
      const words = line.words
        .map((word) => `<${formatLrcTime(word.start)}>${word.word}`)
        .join(" ");
      return `[${formatLrcTime(line.start)}]${words}`;
    })
    .join("\n");
}

export function exportTtml(doc: TclDocument): string {
  return serializeTtml(doc);
}

export function exportJson(doc: TclDocument): string {
  return JSON.stringify(doc, null, 2);
}
