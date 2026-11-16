import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { mapInBatches, normalizeConcurrency } from "@/lib/batch";
import { hasMissingDnaFields, needsDnaWorkSql } from "@/lib/dna-candidates";
import { reanalyzeAudioFeatures } from "@/lib/track-dna-analysis";

const DEFAULT_CONCURRENCY = 3;

const candidateColumns = {
  id: tracks.id,
  audioDna: tracks.audioDna,
  lyrics: tracks.lyrics,
  instrumental: tracks.instrumental,
};

interface Candidate {
  id: string;
  audioDna: string | null;
  lyrics: string | null;
  instrumental: boolean | null;
}

interface CandidatePage {
  /** Finished tracks in total (kept for callers of the original response shape). */
  totalDone: number;
  /** Tracks whose DNA still needs work. */
  total: number;
  batch: Candidate[];
}

/**
 * Filters in SQL (and only ships `limit` rows) instead of pulling every finished
 * track's lyrics into memory on each call. A row whose `audio_dna` isn't valid
 * JSON would make the `::jsonb` cast throw, so that case falls back to the
 * tolerant in-JS filter over the whole table — the old behaviour, now the
 * exception instead of the path.
 */
async function loadCandidates(limit: number): Promise<CandidatePage> {
  try {
    const [counts] = await db
      .select({
        totalDone: sql<number>`count(*)::int`,
        pending: sql<number>`(count(*) filter (where ${needsDnaWorkSql}))::int`,
      })
      .from(tracks)
      .where(eq(tracks.status, "done"));

    const rows = await db
      .select(candidateColumns)
      .from(tracks)
      .where(and(eq(tracks.status, "done"), needsDnaWorkSql))
      .limit(limit);

    // The SQL predicate is a deliberate superset (a few JSON shapes are only
    // decidable in JS), so the tolerant filter stays authoritative on the batch.
    const batch = rows.filter(hasMissingDnaFields);
    return { totalDone: counts?.totalDone ?? 0, total: counts?.pending ?? batch.length, batch };
  } catch (error) {
    console.warn(
      "[admin/backfill-dna] SQL candidate filter failed (unparseable audio_dna?) — falling back to the in-JS filter:",
      error
    );
    const rows = await db.select(candidateColumns).from(tracks).where(eq(tracks.status, "done"));
    const candidates = rows.filter(hasMissingDnaFields);
    return { totalDone: rows.length, total: candidates.length, batch: candidates.slice(0, limit) };
  }
}

// Batch backfill for auto Track DNA: finds finished tracks whose audio DNA is
// missing (or partially failed) — e.g. tracks uploaded before the DNA pipeline
// existed — and re-runs the analysis for each, keeping fields that are already
// present. Re-runs the paid lyrics-score LLM call only for tracks that have
// lyrics but no score yet. Call repeatedly with { limit } until `remaining`
// hits 0; `concurrency` (default 3, max 8) bounds how many tracks are in flight
// at once, since each one downloads audio, transcodes it and may make two LLM
// calls.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let limit = 25;
  let concurrency = DEFAULT_CONCURRENCY;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(Math.floor(body.limit), 100);
    }
    if (body) concurrency = normalizeConcurrency(body.concurrency, DEFAULT_CONCURRENCY);
  } catch {
    // no body — defaults
  }

  const { totalDone, total, batch } = await loadCandidates(limit);
  const remaining = Math.max(0, total - batch.length);

  const results = await mapInBatches(batch, concurrency, (row) =>
    reanalyzeAudioFeatures(row.id)
  );

  let done = 0;
  const failedIds: string[] = [];
  results.forEach((result, index) => {
    if (result) done++;
    else failedIds.push(batch[index].id);
  });

  return NextResponse.json({
    totalDone,
    candidates: total,
    processed: batch.length,
    done,
    failed: failedIds.length,
    failedIds,
    remaining,
    concurrency,
  });
}
