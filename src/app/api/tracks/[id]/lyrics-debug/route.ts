import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { parseLyrics, isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import { requireAuth } from "@/lib/require-auth";

type JsonRecord = Record<string, unknown>;

type StartFieldName =
  | "start"
  | "startS"
  | "startTime"
  | "start_time"
  | "timestamp"
  | "time"
  | "offset"
  | "t"
  | "begin"
  | "ts"
  | "start_ms"
  | "startMs";

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNestedJson(value: string): unknown {
  let current: unknown = value.trim();

  while (typeof current === "string") {
    const trimmed = current.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"'))) {
      break;
    }

    try {
      current = JSON.parse(trimmed);
    } catch {
      break;
    }
  }

  return current;
}

function getShape(raw: unknown): {
  rawKind: string;
  topLevelKeys: string[];
  embeddedTimingFields: string[];
  itemCounts: Record<string, number>;
  startFieldUsage: Record<StartFieldName, number>;
} {
  const startFieldUsage: Record<StartFieldName, number> = {
    start: 0,
    startS: 0,
    startTime: 0,
    start_time: 0,
    timestamp: 0,
    time: 0,
    offset: 0,
    t: 0,
    begin: 0,
    ts: 0,
    start_ms: 0,
    startMs: 0,
  };

  const itemCounts: Record<string, number> = {};
  const embeddedTimingFields: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isJsonRecord(item)) {
        for (const field of Object.keys(startFieldUsage) as StartFieldName[]) {
          if (item[field] !== undefined) {
            startFieldUsage[field] += 1;
          }
        }
      }
    }

    return {
      rawKind: "json-array",
      topLevelKeys: [],
      embeddedTimingFields,
      itemCounts: { rootArray: raw.length },
      startFieldUsage,
    };
  }

  if (isJsonRecord(raw)) {
    const topLevelKeys = Object.keys(raw);
    const sources: Array<[string, unknown]> = [
      ["lines", raw.lines],
      ["words", raw.words],
      ["segments", raw.segments],
      ["lyrics", raw.lyrics],
      ["data", raw.data],
      ["result", raw.result],
      ["output", raw.output],
    ];

    for (const [name, value] of sources) {
      if (Array.isArray(value)) {
        itemCounts[name] = value.length;
        for (const item of value) {
          if (isJsonRecord(item)) {
            for (const field of Object.keys(startFieldUsage) as StartFieldName[]) {
              if (item[field] !== undefined) {
                startFieldUsage[field] += 1;
              }
            }
          }
        }
      }

      if (isJsonRecord(value)) {
        const nested = value;
        const nestedArrays: Array<[string, unknown]> = [
          [`${name}.lines`, nested.lines],
          [`${name}.words`, nested.words],
          [`${name}.segments`, nested.segments],
          [`${name}.lyrics`, nested.lyrics],
        ];

        for (const [nestedName, nestedValue] of nestedArrays) {
          if (Array.isArray(nestedValue)) {
            itemCounts[nestedName] = nestedValue.length;
            for (const item of nestedValue) {
              if (isJsonRecord(item)) {
                for (const field of Object.keys(startFieldUsage) as StartFieldName[]) {
                  if (item[field] !== undefined) {
                    startFieldUsage[field] += 1;
                  }
                }
              }
            }
          }
        }
      }
    }

    const timingFieldCandidates: Array<[string, unknown]> = [
      ["lrc", raw.lrc],
      ["lyrics_timestamped", raw.lyrics_timestamped],
      ["lyricsTimestamped", raw.lyricsTimestamped],
      ["timestamped_lyrics", raw.timestamped_lyrics],
    ];

    if (isJsonRecord(raw.data)) {
      timingFieldCandidates.push(
        ["data.lrc", raw.data.lrc],
        ["data.lyrics_timestamped", raw.data.lyrics_timestamped],
        ["data.lyricsTimestamped", raw.data.lyricsTimestamped],
        ["data.timestamped_lyrics", raw.data.timestamped_lyrics],
      );
    }

    if (isJsonRecord(raw.result)) {
      timingFieldCandidates.push(
        ["result.lrc", raw.result.lrc],
        ["result.lyrics_timestamped", raw.result.lyrics_timestamped],
        ["result.lyricsTimestamped", raw.result.lyricsTimestamped],
        ["result.timestamped_lyrics", raw.result.timestamped_lyrics],
      );
    }

    if (isJsonRecord(raw.output)) {
      timingFieldCandidates.push(
        ["output.lrc", raw.output.lrc],
        ["output.lyrics_timestamped", raw.output.lyrics_timestamped],
        ["output.lyricsTimestamped", raw.output.lyricsTimestamped],
        ["output.timestamped_lyrics", raw.output.timestamped_lyrics],
      );
    }

    for (const [name, value] of timingFieldCandidates) {
      if (typeof value === "string" && value.trim().length > 0) {
        embeddedTimingFields.push(name);
      }
    }

    return {
      rawKind: "json-object",
      topLevelKeys,
      embeddedTimingFields,
      itemCounts,
      startFieldUsage,
    };
  }

  if (typeof raw === "string") {
    return {
      rawKind: raw.includes("[") ? "string-lrc-or-text" : "string",
      topLevelKeys: [],
      embeddedTimingFields,
      itemCounts,
      startFieldUsage,
    };
  }

  return {
    rawKind: raw === null ? "null" : typeof raw,
    topLevelKeys: [],
    embeddedTimingFields,
    itemCounts,
    startFieldUsage,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, auth.userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  const lyrics = track.lyrics ?? "";
  const lyricsTimestamps = track.lyricsTimestamps;

  const parsed = parseLyrics(track.lyrics, track.lyricsTimestamps);
  const timed = parsed.filter((line) => line.startTime >= 0);
  const untimed = parsed.length - timed.length;

  const defaultLineCount = lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("["))
    .length;

  const normalizedRaw = typeof lyricsTimestamps === "string" ? parseNestedJson(lyricsTimestamps) : lyricsTimestamps;
  const shape = getShape(normalizedRaw);

  const starts = timed.map((line) => line.startTime).sort((a, b) => a - b);
  const includeRaw = request.nextUrl.searchParams.get("raw") === "1";

  return NextResponse.json({
    track: {
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      status: track.status,
      duration: track.duration,
      createdAt: track.createdAt,
      instrumental: track.instrumental,
    },
    source: {
      hasLyrics: Boolean(track.lyrics),
      lyricsLineCount: defaultLineCount,
      hasLyricsTimestamps: Boolean(lyricsTimestamps),
      lyricsTimestampsLength: lyricsTimestamps?.length ?? 0,
      isLyricsTaskSubmission: isLyricsTaskSubmission(lyricsTimestamps),
      rawPreview: includeRaw && typeof lyricsTimestamps === "string"
        ? {
            head: lyricsTimestamps.slice(0, 400),
            tail: lyricsTimestamps.slice(-400),
          }
        : undefined,
    },
    parser: {
      parsedLines: parsed.length,
      timedLines: timed.length,
      untimedLines: untimed,
      firstTimedStart: starts.length > 0 ? starts[0] : null,
      lastTimedStart: starts.length > 0 ? starts[starts.length - 1] : null,
      sampleLines: parsed.slice(0, 6),
    },
    shape,
    hints: {
      noTimedLines: Boolean(lyricsTimestamps) && timed.length === 0,
      looksDownscaledToSubSecond:
        timed.length > 0 && starts[starts.length - 1] < 1 && (track.duration ?? 0) > 30,
      likelyMismatchWithLyricsBody:
        timed.length > 0 && defaultLineCount > 0 && timed.length < Math.max(1, Math.floor(defaultLineCount * 0.25)),
    },
  });
}
