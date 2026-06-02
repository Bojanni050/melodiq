export interface ParsedLyricLine {
  text: string;
  startTime: number; // in seconds
  endTime?: number;  // in seconds
}

function parseTimestampValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(",", ".");
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;

  // Supports mm:ss(.ms) and hh:mm:ss(.ms) formats
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const numericParts = parts.map((part) => Number(part));
  if (!numericParts.every((part) => Number.isFinite(part))) return null;

  if (parts.length === 2) {
    const [mins, secs] = numericParts;
    return mins * 60 + secs;
  }

  const [hours, mins, secs] = numericParts;
  return hours * 3600 + mins * 60 + secs;
}

function parseLrcLines(lrcText: string): ParsedLyricLine[] {
  const lrcLines = lrcText.split("\n");
  const parsed: ParsedLyricLine[] = [];
  const lrcRegex = /^\[(\d+):(\d+(?:[.,]\d+)?)\](.*)/;

  for (const lrcLine of lrcLines) {
    const match = lrcLine.trim().match(lrcRegex);
    if (!match) continue;

    const mins = parseInt(match[1], 10);
    const secs = parseFloat(match[2].replace(",", "."));
    const text = match[3].trim();
    const startTime = mins * 60 + secs;

    if (text && !text.startsWith("[") && Number.isFinite(startTime)) {
      parsed.push({ text, startTime });
    }
  }

  if (parsed.length > 0) {
    parsed.sort((a, b) => a.startTime - b.startTime);
  }

  return parsed;
}

/**
 * Detects if a lyricsTimestamps string is just a task submission object
 * (e.g. from PoYo submit response) rather than actual timing data.
 */
export function isLyricsTaskSubmission(lyricsTimestamps: string | null | undefined): boolean {
  if (!lyricsTimestamps) return false;
  try {
    const trimmed = typeof lyricsTimestamps === "string" ? lyricsTimestamps.trim() : "";
    if (typeof lyricsTimestamps === "string" && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return false;
    }
    const parsed = typeof lyricsTimestamps === "string" ? JSON.parse(trimmed) : lyricsTimestamps;
    if (parsed && typeof parsed === "object") {
      const hasTaskId = !!(parsed.task_id || parsed.taskId || (parsed.data && (parsed.data.task_id || parsed.data.taskId)));
      const hasActualTimings = !!(
        Array.isArray(parsed) ||
        parsed.lines || parsed.words || parsed.segments || parsed.lyrics || parsed.lrc || parsed.lyrics_timestamped || parsed.timestamped_lyrics || parsed.lyricsTimestamped || parsed.timestampedLyrics ||
        (parsed.data && (
          parsed.data.lines || parsed.data.words || parsed.data.segments || parsed.data.lyrics || parsed.data.lrc || parsed.data.lyrics_timestamped || parsed.data.timestamped_lyrics || parsed.data.lyricsTimestamped || parsed.data.timestampedLyrics ||
          parsed.data.result?.lines || parsed.data.result?.words || parsed.data.result?.segments || parsed.data.result?.lyrics || parsed.data.result?.lrc || parsed.data.result?.lyrics_timestamped || parsed.data.result?.timestamped_lyrics || parsed.data.result?.lyricsTimestamped || parsed.data.result?.timestampedLyrics ||
          parsed.data.output?.lines || parsed.data.output?.words || parsed.data.output?.segments || parsed.data.output?.lyrics || parsed.data.output?.lrc || parsed.data.output?.lyrics_timestamped || parsed.data.output?.timestamped_lyrics || parsed.data.output?.lyricsTimestamped || parsed.data.output?.timestampedLyrics
        )) ||
        parsed.result || parsed.output
      );
      return hasTaskId && !hasActualTimings;
    }
  } catch {}
  return false;
}

/**
 * Parses track lyrics and their associated timestamps into a normalized array of timed lines.
 * Handles line-level JSON timestamps, word-level JSON timestamps (reconstructing lines),
 * and classic LRC timing strings.
 */
export function parseLyrics(
  lyrics: string | null,
  lyricsTimestamps: string | null | undefined
): ParsedLyricLine[] {
  const defaultLines = (lyrics || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[")); // Filter out section headers like [Chorus]

  if (!lyricsTimestamps || isLyricsTaskSubmission(lyricsTimestamps)) {
    return defaultLines.map((text) => ({ text, startTime: -1 }));
  }

  try {
    let rawData: any;
    if (typeof lyricsTimestamps === "string") {
      // Check if it's actually a JSON string
      const trimmed = lyricsTimestamps.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        rawData = JSON.parse(trimmed);
      }
    } else {
      rawData = lyricsTimestamps;
    }

    if (rawData) {
      let items: any[] = [];
      let embeddedTimingText: string | null = null;

      // Extract items from different possible JSON shapes
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (typeof rawData === "object") {
        if (Array.isArray(rawData.lines)) {
          items = rawData.lines;
        } else if (Array.isArray(rawData.words)) {
          items = rawData.words;
        } else if (Array.isArray(rawData.segments)) {
          items = rawData.segments;
        } else if (Array.isArray(rawData.lyrics)) {
          items = rawData.lyrics;
        } else if (rawData.data && Array.isArray(rawData.data)) {
          items = rawData.data;
        } else if (rawData.data && typeof rawData.data === "object") {
          const d = rawData.data;
          items = d.lines || d.words || d.segments || d.lyrics || 
                  d.result?.lines || d.result?.words || d.result?.segments || d.result?.lyrics || 
                  d.output?.lines || d.output?.words || d.output?.segments || d.output?.lyrics || [];
        } else if (rawData.result && typeof rawData.result === "object") {
          const r = rawData.result;
          items = r.lines || r.words || r.segments || r.lyrics || [];
        } else if (rawData.output && typeof rawData.output === "object") {
          const o = rawData.output;
          items = o.lines || o.words || o.segments || o.lyrics || [];
        }

        // Some providers return timestamped lyrics as an embedded LRC-like string
        const candidates = [
          rawData.lrc,
          rawData.lyrics_timestamped,
          rawData.lyricsTimestamped,
          rawData.timestamped_lyrics,
          rawData.data?.lrc,
          rawData.data?.lyrics_timestamped,
          rawData.data?.lyricsTimestamped,
          rawData.data?.timestamped_lyrics,
          rawData.data?.result?.lrc,
          rawData.data?.result?.lyrics_timestamped,
          rawData.data?.result?.lyricsTimestamped,
          rawData.data?.result?.timestamped_lyrics,
          rawData.data?.output?.lrc,
          rawData.data?.output?.lyrics_timestamped,
          rawData.data?.output?.lyricsTimestamped,
          rawData.data?.output?.timestamped_lyrics,
          rawData.result?.lrc,
          rawData.result?.lyrics_timestamped,
          rawData.result?.lyricsTimestamped,
          rawData.result?.timestamped_lyrics,
          rawData.output?.lrc,
          rawData.output?.lyrics_timestamped,
          rawData.output?.lyricsTimestamped,
          rawData.output?.timestamped_lyrics,
        ];

        const firstStringCandidate = candidates.find(
          (candidate) => typeof candidate === "string" && candidate.trim().length > 0
        );
        if (typeof firstStringCandidate === "string") {
          embeddedTimingText = firstStringCandidate;
        }
      }

      if (items.length > 0) {
        // Map and normalize each item
        const parsed: ParsedLyricLine[] = items
          .map((item) => {
            let text = "";
            if (typeof item === "string") {
              text = item;
            } else if (item && typeof item === "object") {
              text = String(item.text || item.word || item.line || item.lyric || item.value || "");
            }

            let start = 0;
            let end: number | undefined = undefined;

            if (item && typeof item === "object") {
              const rawStart = item.start !== undefined ? item.start :
                               item.startTime !== undefined ? item.startTime :
                               item.start_time !== undefined ? item.start_time :
                               item.timestamp !== undefined ? item.timestamp :
                               item.time !== undefined ? item.time :
                               item.offset !== undefined ? item.offset :
                               item.t !== undefined ? item.t :
                               item.begin !== undefined ? item.begin :
                               item.ts !== undefined ? item.ts :
                               item.start_ms !== undefined ? item.start_ms :
                               item.startMs !== undefined ? item.startMs :
                               -1;
              
              const rawEnd = item.end !== undefined ? item.end :
                             item.endTime !== undefined ? item.endTime :
                             item.end_time !== undefined ? item.end_time :
                             item.timestamp_end !== undefined ? item.timestamp_end :
                             item.duration !== undefined ? (Number(rawStart) + Number(item.duration)) : undefined;

              const parsedStart = parseTimestampValue(rawStart);
              start = parsedStart ?? -1;

              const parsedEnd = rawEnd !== undefined ? parseTimestampValue(rawEnd) : null;
              if (parsedEnd !== null) {
                end = parsedEnd;
              }
            }

            return { text: text.trim(), startTime: start, endTime: end };
          })
          .filter((item) => item.text && Number.isFinite(item.startTime));

        if (parsed.length > 0) {
          // Detect if times are in milliseconds (e.g. 5000 instead of 5.0 seconds) and convert to seconds
          const maxStart = Math.max(...parsed.map((p) => p.startTime).filter((value) => value >= 0), 0);
          if (maxStart > 300) {
            parsed.forEach((p) => {
              p.startTime = p.startTime / 1000;
              if (p.endTime !== undefined) {
                p.endTime = p.endTime / 1000;
              }
            });
          }

          // If we have single words, group them to match defaultLines (reconstructing line-level timings)
          const looksLikeWords = parsed.length > defaultLines.length * 2 && parsed.every((p) => !p.text.includes(" ") && p.startTime >= 0);
          if (looksLikeWords && defaultLines.length > 0) {
            const grouped: ParsedLyricLine[] = [];
            let wordIndex = 0;

            for (const lineText of defaultLines) {
              const cleanLine = lineText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
              const lineWords = cleanLine.split(/\s+/).filter(Boolean);
              if (lineWords.length === 0) continue;

              const startWord = parsed[wordIndex];
              if (!startWord) break;

              const startTime = startWord.startTime;
              let endTime = startWord.endTime || startWord.startTime + 0.5;

              wordIndex++;
              // Consume words matching this line
              for (let i = 1; i < lineWords.length; i++) {
                const nextWord = parsed[wordIndex];
                if (!nextWord) break;
                endTime = nextWord.endTime || nextWord.startTime + 0.5;
                wordIndex++;
              }

              grouped.push({
                text: lineText, // Preserve original casing/punctuation
                startTime,
                endTime,
              });
            }

            if (grouped.length > 0) {
              return grouped;
            }
          }

          return parsed;
        }
      }

      if (embeddedTimingText) {
        const embeddedParsed = parseLrcLines(embeddedTimingText);
        if (embeddedParsed.length > 0) {
          return embeddedParsed;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to parse lyricsTimestamps:", e);
  }

  // Fallback to LRC parser in case it is formatted as a standard LRC string
  if (typeof lyricsTimestamps === "string" && lyricsTimestamps.includes("[")) {
    const parsed = parseLrcLines(lyricsTimestamps);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  // Ultimate fallback: return lyrics split by line without timing info (startTime: -1)
  return defaultLines.map((text) => ({ text, startTime: -1 }));
}
