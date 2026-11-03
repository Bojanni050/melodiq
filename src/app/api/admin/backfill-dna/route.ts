import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { reanalyzeAudioFeatures } from "@/lib/track-dna-analysis";
import type { AudioDna } from "@/lib/songs";

function hasMissingDnaFields(row: { audioDna: string | null; lyrics: string | null; instrumental: boolean | null }): boolean {
  let existing: Partial<AudioDna> = {};
  if (row.audioDna) {
    try {
      existing = JSON.parse(row.audioDna) as Partial<AudioDna>;
    } catch {
      return true;
    }
  } else {
    return true;
  }

  const missingDsp = existing.tempo == null || existing.key == null || existing.energy == null || existing.loudness == null;
  const missingAtmosphere = (existing.atmosphereTags ?? []).length === 0;
  const missingLyricsScore =
    existing.lyricsScore == null && !row.instrumental && !!row.lyrics?.trim();

  return missingDsp || missingAtmosphere || missingLyricsScore;
}

// Batch backfill for auto Track DNA: finds finished tracks whose audio DNA is
// missing (or partially failed) — e.g. tracks uploaded before the DNA pipeline
// existed — and re-runs the analysis for each, keeping fields that are already
// present. Re-runs the paid lyrics-score LLM call only for tracks that have
// lyrics but no score yet. Call repeatedly with { limit } until
// `remaining` hits 0.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let limit = 25;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(Math.floor(body.limit), 100);
    }
  } catch {
    // no body — default limit
  }

  const rows = await db
    .select({
      id: tracks.id,
      audioDna: tracks.audioDna,
      lyrics: tracks.lyrics,
      instrumental: tracks.instrumental,
    })
    .from(tracks)
    .where(eq(tracks.status, "done"));

  const candidates = rows.filter(hasMissingDnaFields);
  const remaining = Math.max(0, candidates.length - limit);
  const batch = candidates.slice(0, limit);

  let done = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const track of batch) {
    const result = await reanalyzeAudioFeatures(track.id);
    if (result) {
      done++;
    } else {
      failed++;
      failedIds.push(track.id);
    }
  }

  return NextResponse.json({
    totalDone: rows.length,
    candidates: candidates.length,
    processed: batch.length,
    done,
    failed,
    failedIds,
    remaining,
  });
}
