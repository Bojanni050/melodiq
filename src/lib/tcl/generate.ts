import { db } from "@/db";
import { tracks, trackAlignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";
import { getSetting } from "@/lib/settings";
import { getEngine } from "./engines";
import type { TclDocument } from "./types";

const DEFAULT_TCL_ENGINE = "elevenlabs";

async function resolveEngineName(): Promise<string> {
  return (await getSetting("TCL_ENGINE")) || DEFAULT_TCL_ENGINE;
}

export interface GenerateTimeCodedLyricsResult {
  success: boolean;
  confidence?: number;
  lyrics?: TclDocument;
  error?: string;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Heuristic confidence: QuickLRC returns no score, so approximate it from
 * how many words of the input lyrics actually made it into the alignment. */
function computeConfidence(doc: TclDocument, inputLyrics: string): number {
  const expectedWords = countWords(
    inputLyrics
      .split("\n")
      .filter((line) => !line.trim().startsWith("["))
      .join(" ")
  );
  if (expectedWords === 0) return 0;

  const alignedWords = doc.lines.reduce((sum, line) => sum + (line.words.length || countWords(line.text)), 0);
  return Math.max(0, Math.min(1, alignedWords / expectedWords));
}

/** Line-level JSON shape already understood by src/lib/parse-lyrics.ts, so
 * the rest of the app's timed-lyrics displays (FullscreenPlayer, TrackCard,
 * discover) pick this up with zero changes. */
export function toLyricsTimestampsMirror(doc: TclDocument): string {
  return JSON.stringify({
    lines: doc.lines.map((line) => ({
      text: line.text,
      startTime: line.start,
      endTime: line.end,
    })),
  });
}

/** Validates the track and marks it "processing" — fast, synchronous work
 * that's safe to await directly in an API route before responding. */
export async function beginTimeCodedLyricsGeneration(
  songId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, songId)).limit(1);
  if (!track) {
    return { ok: false, error: "Track not found" };
  }
  if (!track.lyrics || !track.lyrics.trim()) {
    return { ok: false, error: "No lyrics available for this track" };
  }
  const audioKey = track.s3Key || track.s3KeyHd;
  if (!audioKey) {
    return { ok: false, error: "No finished audio available for this track" };
  }

  const engineName = await resolveEngineName();

  await db
    .insert(trackAlignments)
    .values({
      trackId: track.id,
      userId: track.userId,
      status: "processing",
      engine: engineName,
    })
    .onConflictDoUpdate({
      target: trackAlignments.trackId,
      set: { status: "processing", engine: engineName, error: null, updatedAt: new Date() },
    });

  return { ok: true };
}

/** Runs the actual (slow, up to ~90s) alignment call and persists the
 * result. Callers should kick this off without awaiting it — a reverse
 * proxy's gateway timeout would otherwise likely trip before QuickLRC
 * responds — and have clients poll trackAlignments.status instead. */
export async function runTimeCodedLyricsAlignment(songId: string): Promise<GenerateTimeCodedLyricsResult> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, songId)).limit(1);
  if (!track || !track.lyrics) {
    return { success: false, error: "Track not found" };
  }
  const audioKey = track.s3Key || track.s3KeyHd;
  if (!audioKey) {
    return { success: false, error: "No finished audio available for this track" };
  }

  try {
    const audioUrl = await getPresignedUrl(audioKey, 900);
    const engineName = await resolveEngineName();
    const engine = getEngine(engineName);
    const doc = await engine.align({ audioUrl, lyrics: track.lyrics });
    const confidence = computeConfidence(doc, track.lyrics);

    await db
      .update(trackAlignments)
      .set({
        status: "done",
        confidence,
        tcl: JSON.stringify(doc),
        error: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trackAlignments.trackId, track.id));

    await db
      .update(tracks)
      .set({ lyricsTimestamps: toLyricsTimestampsMirror(doc) })
      .where(eq(tracks.id, track.id));

    return { success: true, confidence, lyrics: doc };
  } catch (error: any) {
    const message = error?.message || "Time-coded lyrics generation failed";
    await db
      .update(trackAlignments)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(trackAlignments.trackId, track.id));
    return { success: false, error: message };
  }
}
