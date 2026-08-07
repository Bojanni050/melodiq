/**
 * TTML <-> TclDocument conversion.
 *
 * Used both to parse QuickLRC's TTML alignment response and to serialize a
 * TclDocument back to TTML for the editor's TTML export feature.
 */

import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { TclDocument, TclLine, TclWord } from "./types";

const TTML_NS = "http://www.w3.org/ns/ttml";
const TTS_NS = "http://www.w3.org/ns/ttml#styling";

/** Parses a TTML clock-time value into seconds. Supports "hh:mm:ss(.mmm)" and "12.34s". */
function parseTtmlTime(value: unknown): number {
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();

  const secondsMatch = /^(\d+(?:\.\d+)?)s$/.exec(trimmed);
  if (secondsMatch) return Number(secondsMatch[1]);

  const clockMatch = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(trimmed);
  if (clockMatch) {
    const [, hh, mm, ss] = clockMatch;
    return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
  }

  const direct = Number(trimmed);
  return Number.isFinite(direct) ? direct : 0;
}

function formatTtmlTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${ss.toFixed(3).padStart(6, "0")}`;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

export function parseTtml(xml: string): TclDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
  });

  const root: any = parser.parse(xml);
  const tt = root?.tt ?? root;
  const body = tt?.body ?? {};
  const divs = asArray<Record<string, unknown>>(body.div);
  const paragraphs = divs.flatMap((div) => asArray<Record<string, unknown>>(div?.p as any));

  const lines: TclLine[] = paragraphs.map((p) => {
    const start = parseTtmlTime(p["@_begin"]);
    const end = parseTtmlTime(p["@_end"]);

    const spans = asArray<Record<string, unknown>>(p.span as any);
    let words: TclWord[];
    let text: string;

    if (spans.length > 0) {
      words = spans.map((span) => ({
        word: textOf(span).trim(),
        start: parseTtmlTime(span["@_begin"]),
        end: parseTtmlTime(span["@_end"]),
      })).filter((w: TclWord) => w.word.length > 0);
      text = words.map((w) => w.word).join(" ");
    } else {
      text = textOf(p).trim();
      words = [];
    }

    return { start, end, text, words };
  }).filter((line) => line.text.length > 0);

  return { version: 1, lines };
}

export function serializeTtml(doc: TclDocument): string {
  const paragraphs = doc.lines.map((line) => {
    if (line.words.length > 0) {
      return {
        "@_begin": formatTtmlTime(line.start),
        "@_end": formatTtmlTime(line.end),
        span: line.words.map((w) => ({
          "@_begin": formatTtmlTime(w.start),
          "@_end": formatTtmlTime(w.end),
          "#text": w.word,
        })),
      };
    }
    return {
      "@_begin": formatTtmlTime(line.start),
      "@_end": formatTtmlTime(line.end),
      "#text": line.text,
    };
  });

  const doc_ = {
    "?xml": { "@_version": "1.0", "@_encoding": "utf-8" },
    tt: {
      "@_xmlns": TTML_NS,
      "@_xmlns:tts": TTS_NS,
      body: {
        div: {
          p: paragraphs,
        },
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: true,
    suppressEmptyNode: true,
  });

  return builder.build(doc_);
}
